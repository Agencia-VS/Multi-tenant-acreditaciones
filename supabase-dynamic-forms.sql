-- ============================================================================
-- MIGRACIÓN: Sistema de Formularios Dinámicos Multi-tenant
-- ============================================================================
-- Permite que cada tenant tenga formularios de acreditación personalizados
-- con campos configurables, reglas de validación y soporte masivo.
-- ============================================================================

-- 1. Tabla de configuración de formularios por tenant/evento
CREATE TABLE IF NOT EXISTS public.mt_form_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  evento_id integer,                              -- NULL = config por defecto del tenant
  nombre text NOT NULL,                            -- "Prensa", "Broadcast", "Fotografía", etc.
  slug text NOT NULL,                              -- "prensa", "broadcast", "fotografia"
  tipo text NOT NULL DEFAULT 'individual'
    CHECK (tipo IN ('individual', 'masivo', 'ambos')),
  
  -- Schema del formulario como JSONB
  -- Secciones del formulario (orden y agrupación visual)
  secciones jsonb NOT NULL DEFAULT '[
    {"key": "responsable", "label": "Datos del Responsable", "icon": "user", "order": 1},
    {"key": "medio", "label": "Medio de Comunicación", "icon": "building", "order": 2},
    {"key": "acreditados", "label": "Datos de Acreditados", "icon": "users", "order": 3}
  ]'::jsonb,
  
  -- Campos del formulario (array de definiciones)
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Configuración general
  config jsonb NOT NULL DEFAULT '{
    "max_acreditados_por_solicitud": 10,
    "min_acreditados": 1,
    "requiere_responsable": true,
    "permite_masivo": false,
    "auto_aprobacion": false,
    "campos_masivo": ["nombre", "apellido", "rut", "email", "cargo"],
    "disclaimer": null,
    "email_confirmacion": true
  }'::jsonb,
  
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT mt_form_configs_pkey PRIMARY KEY (id),
  CONSTRAINT mt_form_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.mt_tenants(id) ON DELETE CASCADE,
  CONSTRAINT mt_form_configs_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.mt_eventos(id) ON DELETE SET NULL,
  CONSTRAINT mt_form_configs_slug_tenant_unique UNIQUE (tenant_id, evento_id, slug)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_form_configs_tenant ON public.mt_form_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_form_configs_tenant_evento ON public.mt_form_configs(tenant_id, evento_id);
CREATE INDEX IF NOT EXISTS idx_form_configs_activo ON public.mt_form_configs(activo) WHERE activo = true;

-- 2. Tabla de templates de email por tenant
CREATE TABLE IF NOT EXISTS public.mt_email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('aprobacion', 'rechazo', 'confirmacion', 'recordatorio')),
  subject text NOT NULL,
  body_html text NOT NULL,                         -- Template con {{variables}}
  variables jsonb DEFAULT '[]'::jsonb,             -- Variables disponibles en el template
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT mt_email_templates_pkey PRIMARY KEY (id),
  CONSTRAINT mt_email_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.mt_tenants(id) ON DELETE CASCADE,
  CONSTRAINT mt_email_templates_tipo_tenant_unique UNIQUE (tenant_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON public.mt_email_templates(tenant_id);

-- 3. Agregar columnas a mt_acreditados para datos dinámicos
ALTER TABLE public.mt_acreditados 
  ADD COLUMN IF NOT EXISTS datos_custom jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form_config_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- FK para form_config_id (si la columna fue recién creada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'mt_acreditados_form_config_id_fkey'
  ) THEN
    ALTER TABLE public.mt_acreditados
      ADD CONSTRAINT mt_acreditados_form_config_id_fkey 
      FOREIGN KEY (form_config_id) REFERENCES public.mt_form_configs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acreditados_form_config ON public.mt_acreditados(form_config_id);
CREATE INDEX IF NOT EXISTS idx_acreditados_datos_custom ON public.mt_acreditados USING gin(datos_custom);

-- 4. RLS para mt_form_configs
ALTER TABLE public.mt_form_configs ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer configs activas (necesario para renderizar formularios públicos)
CREATE POLICY form_configs_select ON public.mt_form_configs
  FOR SELECT USING (true);

-- Solo admins y service role pueden modificar
CREATE POLICY form_configs_manage ON public.mt_form_configs
  FOR ALL USING (true);

-- 5. RLS para mt_email_templates
ALTER TABLE public.mt_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_templates_select ON public.mt_email_templates
  FOR SELECT USING (true);

CREATE POLICY email_templates_manage ON public.mt_email_templates
  FOR ALL USING (true);

-- 6. Función helper para obtener form config activa de un tenant
CREATE OR REPLACE FUNCTION public.get_active_form_config(
  p_tenant_slug text,
  p_form_slug text DEFAULT 'prensa',
  p_evento_id integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_config jsonb;
BEGIN
  -- Obtener tenant_id
  SELECT id INTO v_tenant_id FROM mt_tenants WHERE slug = p_tenant_slug AND activo = true;
  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Intentar config específica del evento
  IF p_evento_id IS NOT NULL THEN
    SELECT to_jsonb(fc.*) INTO v_config
    FROM mt_form_configs fc
    WHERE fc.tenant_id = v_tenant_id 
      AND fc.slug = p_form_slug
      AND fc.evento_id = p_evento_id
      AND fc.activo = true
    LIMIT 1;
    
    IF v_config IS NOT NULL THEN
      RETURN v_config;
    END IF;
  END IF;

  -- Fallback: config por defecto del tenant (evento_id IS NULL)
  SELECT to_jsonb(fc.*) INTO v_config
  FROM mt_form_configs fc
  WHERE fc.tenant_id = v_tenant_id 
    AND fc.slug = p_form_slug
    AND fc.evento_id IS NULL
    AND fc.activo = true
  LIMIT 1;

  RETURN v_config;
END;
$$;

-- 7. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_form_configs_updated_at ON public.mt_form_configs;
CREATE TRIGGER update_form_configs_updated_at
  BEFORE UPDATE ON public.mt_form_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.mt_email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.mt_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
