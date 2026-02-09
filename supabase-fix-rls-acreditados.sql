-- =====================================================
-- FIX: RLS para mt_acreditados - Permitir lectura para usuarios autenticados
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- Verificar políticas actuales
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'mt_acreditados';

-- =====================================================
-- OPCIÓN 1: Permitir lectura para todos los usuarios autenticados
-- (Usar esta si los superadmins están autenticados)
-- =====================================================

-- Primero eliminar política existente si causa conflicto
DROP POLICY IF EXISTS "Authenticated users can read all acreditados" ON mt_acreditados;

-- Crear política de lectura para usuarios autenticados
CREATE POLICY "Authenticated users can read all acreditados" 
ON mt_acreditados
FOR SELECT
TO authenticated
USING (true);

-- =====================================================
-- OPCIÓN 2: Permitir lectura pública (solo si es necesario)
-- =====================================================

-- DROP POLICY IF EXISTS "Public read access for acreditados" ON mt_acreditados;
-- CREATE POLICY "Public read access for acreditados" 
-- ON mt_acreditados
-- FOR SELECT
-- TO anon, authenticated
-- USING (true);

-- =====================================================
-- OPCIÓN 3: Si el problema persiste, verificar que RLS esté habilitado
-- =====================================================

-- Habilitar RLS si no está habilitado
ALTER TABLE mt_acreditados ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Verificar resultado
-- =====================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename = 'mt_acreditados';

-- Probar query
SELECT COUNT(*) FROM mt_acreditados;
