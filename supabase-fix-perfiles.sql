-- =====================================================
-- FIX: Correcciones para mt_perfiles_acreditados y otras tablas
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PARTE 1: Fixes para mt_perfiles_acreditados
-- =====================================================

-- 1. Hacer que el RUT sea opcional (permitir NULL)
ALTER TABLE mt_perfiles_acreditados 
ALTER COLUMN rut DROP NOT NULL;

-- 2. Agregar columna equipo_frecuente si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mt_perfiles_acreditados' 
        AND column_name = 'equipo_frecuente'
    ) THEN
        ALTER TABLE mt_perfiles_acreditados 
        ADD COLUMN equipo_frecuente JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 3. Agregar constraint único en user_id para upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'mt_perfiles_acreditados_user_id_key'
    ) THEN
        ALTER TABLE mt_perfiles_acreditados
        ADD CONSTRAINT mt_perfiles_acreditados_user_id_key UNIQUE (user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Actualizar RLS para permitir inserts desde el cliente
DROP POLICY IF EXISTS "Users can insert own profile" ON mt_perfiles_acreditados;
CREATE POLICY "Users can insert own profile" ON mt_perfiles_acreditados
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Política para select (usuarios ven su propio perfil)
DROP POLICY IF EXISTS "Users can view own profile" ON mt_perfiles_acreditados;
CREATE POLICY "Users can view own profile" ON mt_perfiles_acreditados
  FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Política para update (usuarios actualizan su propio perfil)
DROP POLICY IF EXISTS "Users can update own profile" ON mt_perfiles_acreditados;
CREATE POLICY "Users can update own profile" ON mt_perfiles_acreditados
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PARTE 2: Fixes para mt_tenants
-- =====================================================

-- Agregar columna 'activo' si no existe (algunos filtros la usan)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mt_tenants' 
        AND column_name = 'activo'
    ) THEN
        ALTER TABLE mt_tenants 
        ADD COLUMN activo BOOLEAN DEFAULT true;
    END IF;
END $$;

-- =====================================================
-- PARTE 3: Fixes para mt_acreditados
-- =====================================================

-- Agregar columna responsable_email si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mt_acreditados' 
        AND column_name = 'responsable_email'
    ) THEN
        ALTER TABLE mt_acreditados 
        ADD COLUMN responsable_email TEXT;
    END IF;
END $$;

-- Agregar columna responsable_nombre si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mt_acreditados' 
        AND column_name = 'responsable_nombre'
    ) THEN
        ALTER TABLE mt_acreditados 
        ADD COLUMN responsable_nombre TEXT;
    END IF;
END $$;

-- Agregar columna responsable_rut si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mt_acreditados' 
        AND column_name = 'responsable_rut'
    ) THEN
        ALTER TABLE mt_acreditados 
        ADD COLUMN responsable_rut TEXT;
    END IF;
END $$;

-- Agregar índice para búsquedas por responsable_email
CREATE INDEX IF NOT EXISTS idx_acreditados_responsable_email 
ON mt_acreditados(responsable_email);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar estructura de mt_perfiles_acreditados
SELECT 'mt_perfiles_acreditados' as tabla, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mt_perfiles_acreditados'
ORDER BY ordinal_position;

-- Verificar estructura de mt_acreditados
SELECT 'mt_acreditados' as tabla, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mt_acreditados'
ORDER BY ordinal_position;
