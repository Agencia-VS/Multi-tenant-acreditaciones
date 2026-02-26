-- Fix schema para identidad documental en profiles
-- Ejecutar una vez en la DB donde corre el proyecto.

BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS document_type TEXT,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS document_normalized TEXT;

-- Backfill desde RUT existente
UPDATE profiles
SET
  document_type = COALESCE(document_type, 'rut'),
  document_number = COALESCE(document_number, rut),
  document_normalized = COALESCE(document_normalized, regexp_replace(upper(COALESCE(rut, '')), '\\.', '', 'g'))
WHERE document_type IS NULL
   OR document_number IS NULL
   OR document_normalized IS NULL;

-- Asegurar constraint único para onConflict('document_type,document_normalized')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_document_identity_unique'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_document_identity_unique
      UNIQUE (document_type, document_normalized);
  END IF;
END $$;

COMMIT;
