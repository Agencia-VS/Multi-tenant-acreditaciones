-- =====================================================
-- MIGRACIÓN: Sistema de Autenticación y Roles
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Este script configura:
-- 1. Tablas de roles y permisos
-- 2. Row Level Security (RLS) policies
-- 3. Funciones helper para verificar permisos
-- =====================================================

-- =====================================================
-- PARTE 1: Asegurar estructura de tablas de roles
-- =====================================================

-- Tabla de SuperAdmins (usuarios con acceso global)
CREATE TABLE IF NOT EXISTS mt_superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  nombre TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Admin por Tenant (usuarios con acceso a tenant específico)
CREATE TABLE IF NOT EXISTS mt_admin_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES mt_tenants(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'editor', 'lector')),
  email TEXT,
  nombre TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Índices para mejorar rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_superadmins_user_id ON mt_superadmins(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_tenants_user_id ON mt_admin_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_tenants_tenant_id ON mt_admin_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_tenants_user_tenant ON mt_admin_tenants(user_id, tenant_id);

-- =====================================================
-- PARTE 2: Funciones Helper para verificar permisos
-- =====================================================

-- Función para verificar si el usuario actual es superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mt_superadmins
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si el usuario tiene acceso a un tenant
CREATE OR REPLACE FUNCTION has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Los superadmins tienen acceso a todo
  IF is_superadmin() THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar si tiene rol en el tenant específico
  RETURN EXISTS (
    SELECT 1 FROM mt_admin_tenants
    WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener el rol del usuario en un tenant
CREATE OR REPLACE FUNCTION get_tenant_role(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Los superadmins tienen rol 'admin' en todos los tenants
  IF is_superadmin() THEN
    RETURN 'admin';
  END IF;
  
  SELECT rol INTO v_role
  FROM mt_admin_tenants
  WHERE user_id = auth.uid()
  AND tenant_id = p_tenant_id;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si puede editar (admin o editor)
CREATE OR REPLACE FUNCTION can_edit_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := get_tenant_role(p_tenant_id);
  RETURN v_role IN ('admin', 'editor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PARTE 3: Habilitar RLS en todas las tablas
-- =====================================================

ALTER TABLE mt_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_acreditados ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_areas_prensa ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_zonas_acreditacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_admin_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_superadmins ENABLE ROW LEVEL SECURITY;
ALTER TABLE mt_email_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PARTE 4: Políticas para mt_tenants
-- =====================================================

-- Cualquiera puede ver tenants (para landing pages públicas)
DROP POLICY IF EXISTS "tenants_select_public" ON mt_tenants;
CREATE POLICY "tenants_select_public" ON mt_tenants
  FOR SELECT
  USING (true);

-- Solo superadmins pueden crear/editar tenants
DROP POLICY IF EXISTS "tenants_insert_superadmin" ON mt_tenants;
CREATE POLICY "tenants_insert_superadmin" ON mt_tenants
  FOR INSERT
  WITH CHECK (is_superadmin());

DROP POLICY IF EXISTS "tenants_update_superadmin" ON mt_tenants;
CREATE POLICY "tenants_update_superadmin" ON mt_tenants
  FOR UPDATE
  USING (is_superadmin());

DROP POLICY IF EXISTS "tenants_delete_superadmin" ON mt_tenants;
CREATE POLICY "tenants_delete_superadmin" ON mt_tenants
  FOR DELETE
  USING (is_superadmin());

-- =====================================================
-- PARTE 5: Políticas para mt_eventos
-- =====================================================

-- Cualquiera puede ver eventos activos (para landing pages)
DROP POLICY IF EXISTS "eventos_select_public" ON mt_eventos;
CREATE POLICY "eventos_select_public" ON mt_eventos
  FOR SELECT
  USING (true);

-- Superadmins y admins del tenant pueden gestionar eventos
DROP POLICY IF EXISTS "eventos_insert_admin" ON mt_eventos;
CREATE POLICY "eventos_insert_admin" ON mt_eventos
  FOR INSERT
  WITH CHECK (
    is_superadmin() OR 
    get_tenant_role(tenant_id) = 'admin'
  );

DROP POLICY IF EXISTS "eventos_update_admin" ON mt_eventos;
CREATE POLICY "eventos_update_admin" ON mt_eventos
  FOR UPDATE
  USING (
    is_superadmin() OR 
    get_tenant_role(tenant_id) = 'admin'
  );

DROP POLICY IF EXISTS "eventos_delete_admin" ON mt_eventos;
CREATE POLICY "eventos_delete_admin" ON mt_eventos
  FOR DELETE
  USING (
    is_superadmin() OR 
    get_tenant_role(tenant_id) = 'admin'
  );

-- =====================================================
-- PARTE 6: Políticas para mt_acreditados
-- =====================================================

-- Usuarios anónimos pueden insertar acreditaciones (formulario público)
DROP POLICY IF EXISTS "acreditados_insert_public" ON mt_acreditados;
CREATE POLICY "acreditados_insert_public" ON mt_acreditados
  FOR INSERT
  WITH CHECK (true);

-- Solo usuarios con acceso al tenant pueden ver acreditaciones
DROP POLICY IF EXISTS "acreditados_select_tenant" ON mt_acreditados;
CREATE POLICY "acreditados_select_tenant" ON mt_acreditados
  FOR SELECT
  USING (has_tenant_access(tenant_id));

-- Solo admins y editores pueden actualizar
DROP POLICY IF EXISTS "acreditados_update_editor" ON mt_acreditados;
CREATE POLICY "acreditados_update_editor" ON mt_acreditados
  FOR UPDATE
  USING (can_edit_tenant(tenant_id));

-- Solo admins pueden eliminar
DROP POLICY IF EXISTS "acreditados_delete_admin" ON mt_acreditados;
CREATE POLICY "acreditados_delete_admin" ON mt_acreditados
  FOR DELETE
  USING (
    is_superadmin() OR 
    get_tenant_role(tenant_id) = 'admin'
  );

-- =====================================================
-- PARTE 7: Políticas para mt_areas_prensa
-- =====================================================

DROP POLICY IF EXISTS "areas_select_public" ON mt_areas_prensa;
CREATE POLICY "areas_select_public" ON mt_areas_prensa
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "areas_manage_admin" ON mt_areas_prensa;
CREATE POLICY "areas_manage_admin" ON mt_areas_prensa
  FOR ALL
  USING (
    is_superadmin() OR 
    get_tenant_role(tenant_id) = 'admin'
  );

-- =====================================================
-- PARTE 8: Políticas para mt_zonas_acreditacion
-- =====================================================

DROP POLICY IF EXISTS "zonas_select_public" ON mt_zonas_acreditacion;
CREATE POLICY "zonas_select_public" ON mt_zonas_acreditacion
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "zonas_manage_admin" ON mt_zonas_acreditacion;
CREATE POLICY "zonas_manage_admin" ON mt_zonas_acreditacion
  FOR ALL
  USING (
    is_superadmin() OR 
    get_tenant_role(tenant_id) = 'admin'
  );

-- =====================================================
-- PARTE 9: Políticas para mt_admin_tenants
-- =====================================================

-- Los usuarios pueden ver sus propios registros
DROP POLICY IF EXISTS "admin_tenants_select_own" ON mt_admin_tenants;
CREATE POLICY "admin_tenants_select_own" ON mt_admin_tenants
  FOR SELECT
  USING (
    user_id = auth.uid() OR 
    is_superadmin() OR
    get_tenant_role(tenant_id) = 'admin'
  );

-- Solo superadmins y admins del tenant pueden gestionar admins
DROP POLICY IF EXISTS "admin_tenants_manage" ON mt_admin_tenants;
CREATE POLICY "admin_tenants_manage" ON mt_admin_tenants
  FOR ALL
  USING (
    is_superadmin() OR 
    get_tenant_role(tenant_id) = 'admin'
  );

-- =====================================================
-- PARTE 10: Políticas para mt_superadmins
-- =====================================================

-- Solo superadmins pueden ver la lista de superadmins
DROP POLICY IF EXISTS "superadmins_select" ON mt_superadmins;
CREATE POLICY "superadmins_select" ON mt_superadmins
  FOR SELECT
  USING (is_superadmin() OR user_id = auth.uid());

-- Solo superadmins pueden gestionar otros superadmins
DROP POLICY IF EXISTS "superadmins_manage" ON mt_superadmins;
CREATE POLICY "superadmins_manage" ON mt_superadmins
  FOR ALL
  USING (is_superadmin());

-- =====================================================
-- PARTE 11: Políticas para mt_email_logs
-- =====================================================

DROP POLICY IF EXISTS "email_logs_select_tenant" ON mt_email_logs;
CREATE POLICY "email_logs_select_tenant" ON mt_email_logs
  FOR SELECT
  USING (has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "email_logs_insert" ON mt_email_logs;
CREATE POLICY "email_logs_insert" ON mt_email_logs
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- PARTE 12: Crear primer SuperAdmin
-- =====================================================
-- ⚠️ IMPORTANTE: Reemplaza con tu email real
-- Primero debes crear el usuario en Supabase Auth

-- Ejemplo de cómo agregar un superadmin:
-- INSERT INTO mt_superadmins (user_id, email, nombre)
-- SELECT id, email, 'Administrador Principal'
-- FROM auth.users
-- WHERE email = 'tu-email@agencia.com';

-- =====================================================
-- VERIFICACIÓN: Revisar políticas creadas
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
