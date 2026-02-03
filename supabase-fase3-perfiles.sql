-- =====================================================
-- FASE 3: Sistema de Perfiles para Acreditados
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PARTE 1: Tabla de Perfiles de Acreditados
-- =====================================================

CREATE TABLE IF NOT EXISTS mt_perfiles_acreditados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rut TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL,
  empresa TEXT,
  cargo TEXT,
  telefono TEXT,
  nacionalidad TEXT DEFAULT 'Chile',
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_perfiles_acreditados_user_id 
ON mt_perfiles_acreditados(user_id);

CREATE INDEX IF NOT EXISTS idx_perfiles_acreditados_email 
ON mt_perfiles_acreditados(email);

CREATE INDEX IF NOT EXISTS idx_perfiles_acreditados_rut 
ON mt_perfiles_acreditados(rut);

-- =====================================================
-- PARTE 2: Función para actualizar updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-actualizar updated_at
DROP TRIGGER IF EXISTS trigger_perfiles_acreditados_updated_at ON mt_perfiles_acreditados;
CREATE TRIGGER trigger_perfiles_acreditados_updated_at
  BEFORE UPDATE ON mt_perfiles_acreditados
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PARTE 3: Tabla de Acreditados (mt_acreditados)
-- =====================================================

CREATE TABLE IF NOT EXISTS mt_acreditados (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES mt_tenants(id) ON DELETE CASCADE,
  evento_id INTEGER REFERENCES mt_eventos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  apellido TEXT,
  rut TEXT,
  email TEXT,
  cargo TEXT,
  tipo_credencial TEXT,
  empresa TEXT,
  area TEXT,
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  motivo_rechazo TEXT,
  zona_id INTEGER,
  responsable_nombre TEXT,
  responsable_email TEXT,
  responsable_telefono TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar columna perfil_acreditado_id si no existe (para tablas existentes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mt_acreditados' AND column_name = 'perfil_acreditado_id'
  ) THEN
    ALTER TABLE mt_acreditados 
    ADD COLUMN perfil_acreditado_id UUID REFERENCES mt_perfiles_acreditados(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Índices para mt_acreditados
CREATE INDEX IF NOT EXISTS idx_acreditados_tenant_id ON mt_acreditados(tenant_id);
CREATE INDEX IF NOT EXISTS idx_acreditados_evento_id ON mt_acreditados(evento_id);
CREATE INDEX IF NOT EXISTS idx_acreditados_status ON mt_acreditados(status);
CREATE INDEX IF NOT EXISTS idx_acreditados_rut ON mt_acreditados(rut);
CREATE INDEX IF NOT EXISTS idx_acreditados_email ON mt_acreditados(email);
CREATE INDEX IF NOT EXISTS idx_acreditados_empresa ON mt_acreditados(empresa);
CREATE INDEX IF NOT EXISTS idx_acreditados_area ON mt_acreditados(area);
CREATE INDEX IF NOT EXISTS idx_acreditados_perfil ON mt_acreditados(perfil_acreditado_id);

-- RLS para mt_acreditados
ALTER TABLE mt_acreditados ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios anónimos pueden insertar (formulario público)
CREATE POLICY "Anon can insert acreditados" ON mt_acreditados
  FOR INSERT
  WITH CHECK (true);

-- Política: Usuarios autenticados pueden ver acreditados de su tenant
CREATE POLICY "Users can view tenant acreditados" ON mt_acreditados
  FOR SELECT
  USING (true);

-- Política: Service role tiene acceso total
CREATE POLICY "Service role full access acreditados" ON mt_acreditados
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Trigger para updated_at en mt_acreditados
DROP TRIGGER IF EXISTS trigger_acreditados_updated_at ON mt_acreditados;
CREATE TRIGGER trigger_acreditados_updated_at
  BEFORE UPDATE ON mt_acreditados
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PARTE 4: RLS (Row Level Security) Policies para Perfiles
-- =====================================================

-- Habilitar RLS
ALTER TABLE mt_perfiles_acreditados ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver su propio perfil
CREATE POLICY "Users can view own profile" ON mt_perfiles_acreditados
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON mt_perfiles_acreditados
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: Insertar perfil (solo si no tiene user_id o es el mismo usuario)
CREATE POLICY "Users can insert profile" ON mt_perfiles_acreditados
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Política: Acceso anónimo para consultar por RUT (para vincular cuentas)
CREATE POLICY "Anon can check RUT exists" ON mt_perfiles_acreditados
  FOR SELECT
  USING (true);

-- Política: Service role tiene acceso total
CREATE POLICY "Service role full access" ON mt_perfiles_acreditados
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- PARTE 5: Función para vincular perfil existente
-- =====================================================

CREATE OR REPLACE FUNCTION vincular_perfil_por_rut(
  p_user_id UUID,
  p_rut TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  perfil_id UUID
) AS $$
DECLARE
  v_perfil_id UUID;
  v_existing_user_id UUID;
BEGIN
  -- Buscar perfil por RUT
  SELECT id, user_id INTO v_perfil_id, v_existing_user_id
  FROM mt_perfiles_acreditados
  WHERE rut = p_rut;

  IF v_perfil_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No se encontró un perfil con ese RUT'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Verificar si ya tiene usuario vinculado
  IF v_existing_user_id IS NOT NULL AND v_existing_user_id != p_user_id THEN
    RETURN QUERY SELECT FALSE, 'Este RUT ya está vinculado a otra cuenta'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Vincular el perfil al usuario
  UPDATE mt_perfiles_acreditados
  SET user_id = p_user_id, updated_at = NOW()
  WHERE id = v_perfil_id;

  RETURN QUERY SELECT TRUE, 'Perfil vinculado exitosamente'::TEXT, v_perfil_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PARTE 6: Función para obtener o crear perfil
-- =====================================================

CREATE OR REPLACE FUNCTION get_or_create_perfil(
  p_user_id UUID,
  p_rut TEXT,
  p_nombre TEXT,
  p_apellido TEXT,
  p_email TEXT,
  p_empresa TEXT DEFAULT NULL,
  p_cargo TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL,
  p_nacionalidad TEXT DEFAULT 'Chile'
)
RETURNS UUID AS $$
DECLARE
  v_perfil_id UUID;
BEGIN
  -- Buscar perfil existente por RUT
  SELECT id INTO v_perfil_id
  FROM mt_perfiles_acreditados
  WHERE rut = p_rut;

  IF v_perfil_id IS NOT NULL THEN
    -- Actualizar perfil existente y vincular usuario
    UPDATE mt_perfiles_acreditados
    SET 
      user_id = COALESCE(user_id, p_user_id),
      nombre = COALESCE(p_nombre, nombre),
      apellido = COALESCE(p_apellido, apellido),
      email = COALESCE(p_email, email),
      empresa = COALESCE(p_empresa, empresa),
      cargo = COALESCE(p_cargo, cargo),
      telefono = COALESCE(p_telefono, telefono),
      nacionalidad = COALESCE(p_nacionalidad, nacionalidad),
      updated_at = NOW()
    WHERE id = v_perfil_id;
    
    RETURN v_perfil_id;
  END IF;

  -- Crear nuevo perfil
  INSERT INTO mt_perfiles_acreditados (
    user_id, rut, nombre, apellido, email, empresa, cargo, telefono, nacionalidad
  ) VALUES (
    p_user_id, p_rut, p_nombre, p_apellido, p_email, p_empresa, p_cargo, p_telefono, p_nacionalidad
  )
  RETURNING id INTO v_perfil_id;

  RETURN v_perfil_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver estructura de mt_acreditados
SELECT 'mt_acreditados' as tabla, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mt_acreditados'
ORDER BY ordinal_position;

-- Ver estructura de mt_perfiles_acreditados
SELECT 'mt_perfiles_acreditados' as tabla, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mt_perfiles_acreditados'
ORDER BY ordinal_position;
