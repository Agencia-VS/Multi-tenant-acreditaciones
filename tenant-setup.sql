-- Script para crear la tabla mt_tenants si no existe
CREATE TABLE IF NOT EXISTS mt_tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar tenants de ejemplo
INSERT INTO mt_tenants (nombre, slug) VALUES
  ('Universidad Católica', 'cruzados'),
  ('Colo-Colo', 'colocolo'),
  ('Audax Italiano', 'audax'),
  ('Universidad de Chile', 'uchile'),
  ('Unión Española', 'union')
ON CONFLICT (slug) DO NOTHING;

-- Verificar que se insertaron
SELECT * FROM mt_tenants;