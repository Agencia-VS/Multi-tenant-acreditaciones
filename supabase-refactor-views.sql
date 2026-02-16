-- =============================================================================
-- Refactorización M3: Vistas optimizadas
-- =============================================================================

-- Vista para tenant stats (evita N+1 queries en listTenants)
CREATE OR REPLACE VIEW v_tenant_stats AS
SELECT
  t.*,
  COALESCE(e.cnt, 0)  AS total_events,
  COALESCE(a.cnt, 0)  AS total_admins,
  COALESCE(r.cnt, 0)  AS total_registrations
FROM tenants t
LEFT JOIN (SELECT tenant_id, COUNT(*) cnt FROM events GROUP BY tenant_id) e ON e.tenant_id = t.id
LEFT JOIN (SELECT tenant_id, COUNT(*) cnt FROM tenant_admins GROUP BY tenant_id) a ON a.tenant_id = t.id
LEFT JOIN (
  SELECT ev.tenant_id, COUNT(*) cnt
  FROM registrations reg
  JOIN events ev ON ev.id = reg.event_id
  GROUP BY ev.tenant_id
) r ON r.tenant_id = t.id;
