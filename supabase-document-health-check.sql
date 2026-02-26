-- Health Check: Identidad documental en profiles
-- Uso: ejecutar en SQL Editor de Supabase (solo lectura)

-- 1) Confirmar columnas documentales en profiles
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('document_type', 'document_number', 'document_normalized')
ORDER BY column_name;

-- 2) Confirmar constraint UNIQUE esperado para upsert
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'profiles'
  AND c.contype = 'u'
  AND pg_get_constraintdef(c.oid) ILIKE '%document_type%document_normalized%';

-- 3) Detectar filas con campos documentales nulos/vacíos
SELECT
  COUNT(*) AS invalid_document_rows
FROM public.profiles
WHERE document_type IS NULL
   OR document_number IS NULL
   OR document_normalized IS NULL
   OR btrim(document_number) = ''
   OR btrim(document_normalized) = '';

-- 4) Detectar duplicados por identidad documental
SELECT
  document_type,
  document_normalized,
  COUNT(*) AS qty
FROM public.profiles
GROUP BY document_type, document_normalized
HAVING COUNT(*) > 1
ORDER BY qty DESC, document_type, document_normalized;

-- 5) Detectar posibles desalineaciones de formato en RUT (con/sin guión)
--    Esperado por backend: cleanRut => SIN puntos, CON guión antes del DV.
SELECT
  COUNT(*) AS rut_normalization_mismatch
FROM public.profiles
WHERE document_type = 'rut'
  AND rut IS NOT NULL
  AND document_normalized <> upper(replace(rut, '.', ''));

-- 6) Muestra una muestra de discrepancias para diagnóstico rápido
SELECT
  id,
  rut,
  document_type,
  document_number,
  document_normalized,
  upper(replace(rut, '.', '')) AS expected_from_rut
FROM public.profiles
WHERE document_type = 'rut'
  AND rut IS NOT NULL
  AND document_normalized <> upper(replace(rut, '.', ''))
LIMIT 20;
