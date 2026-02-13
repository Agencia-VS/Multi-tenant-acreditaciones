-- ============================================================================
-- Migración: Zone Rules V2 — Soporte multi-campo (cargo + tipo_medio)
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Agregar columna match_field para indicar qué campo de registro matchear
--    'cargo'      → regla basada en el cargo del acreditado (default, ej: Periodista → Prensa)
--    'tipo_medio'  → regla basada en tipo_medio/área (ej: Operaciones → Staff)
ALTER TABLE event_zone_rules 
ADD COLUMN IF NOT EXISTS match_field VARCHAR(50) NOT NULL DEFAULT 'cargo';

-- 2. Actualizar constraint UNIQUE para soportar múltiples reglas por campo
--    Antes: UNIQUE(event_id, cargo)  → solo 1 regla por cargo
--    Ahora: UNIQUE(event_id, match_field, cargo) → 1 regla por (campo, valor)
ALTER TABLE event_zone_rules DROP CONSTRAINT IF EXISTS event_zone_rules_event_id_cargo_key;
ALTER TABLE event_zone_rules ADD CONSTRAINT event_zone_rules_event_id_match_unique 
  UNIQUE(event_id, match_field, cargo);

-- 3. Verificar resultado
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'event_zone_rules' 
ORDER BY ordinal_position;

-- Verificar constraints
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'event_zone_rules'::regclass;
