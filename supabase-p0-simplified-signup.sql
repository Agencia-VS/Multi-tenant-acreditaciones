-- ============================================================
-- P0: Registro Simplificado — Migración SQL
-- Fecha: 2026-02-20
--
-- Permite perfiles parciales (sin RUT) durante onboarding.
-- El RUT se completa después en el perfil del acreditado.
-- UNIQUE en rut se mantiene (no puede haber 2 iguales), pero acepta NULL.
-- ============================================================

-- 1. Hacer rut nullable (permite perfiles sin RUT durante signup)
ALTER TABLE profiles ALTER COLUMN rut DROP NOT NULL;

-- 2. Hacer nombre/apellido nullable (para signup con Google OAuth solo con email)
ALTER TABLE profiles ALTER COLUMN nombre DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN apellido DROP NOT NULL;

-- Verificación: UNIQUE en rut sigue activo (multiple NULLs son permitidos en UNIQUE)
-- PostgreSQL permite múltiples NULL en columnas UNIQUE por diseño.

-- ============================================================
-- FIN — Compatible hacia atrás:
--   - Usuarios existentes ya tienen RUT → no se ven afectados
--   - Bulk import sigue exigiendo RUT (viene en el Excel)
--   - El formulario público sigue pidiendo RUT (se guarda en profiles)
-- ============================================================
