# Paso a paso (prompts)

Este archivo contiene prompts numerados para guiar la ejecucion del plan en este repo.

1) "Resume el estado actual del multi-tenant en este repo (tablas mt_*, rutas API, hooks y RLS) y lista los gaps criticos de aislamiento."
2) "Propone el esquema SQL para reglas de cupo por tenant, opcional por evento, y por area + empresa + tipo de medio. Incluye indices y RLS."
3) "Refactoriza la validacion de cupos en la ruta de acreditacion para usar mt_reglas_cupo y respetar prioridades (empresa especifica > general, evento > global)."
4) "Ajusta las rutas API que usan tablas no mt_* para que sean tenant-safe (export, medios, etc.) y documenta los cambios."
5) "Define el modelo de configuracion por tenant para formularios dinamicos y muestra un ejemplo de schema para un tenant con restricciones." 
6) "Implementa el loader de configuracion por tenant (registry + resolveTenantConfig) y conecta el formulario actual a ese schema." 
7) "Revisa y endurece RLS para mt_acreditados, mt_email_logs, mt_areas_prensa y mt_zonas_acreditacion con roles: acreditado, admin_tenant, super_admin."
8) "Agrega un checklist de aislamiento y una guia de pruebas manuales (alta de acreditacion, limites de cupo, acceso admin y superadmin)."

Notas:
- Todos los cambios deben mantener compatibilidad con el flujo actual.
- Las decisiones de multi-tenant deben documentarse en el README principal.
