# Accredia — Estado del Proyecto y Roadmap

> **Proyecto**: Multi-tenant Acreditaciones  
> **Stack**: Next.js 16 (App Router + Turbopack) · TypeScript · Tailwind CSS v4 · Supabase · Vercel  
> **Codebase**: ~22,500 líneas TS/TSX/CSS · 22 API routes · 15 servicios · 343 tests (30 suites)  
> **Fecha**: 20 de febrero de 2026  

---

## Resumen

Plataforma **funcional en producción** con arquitectura multi-tenant por subdominio,
tres roles (acreditado, admin_tenant, superadmin), formularios dinámicos, sistema de
zonas/cupos, exportación PuntoTicket, gestión de equipos, QR check-in multidía,
emails brandizados y eventos públicos/privados/por invitación.

Se completaron **19 de 20 milestones de refactorización** entre el 13 y 20 de febrero
de 2026. Solo queda pendiente M16 (Billing). Además se implementó **P0 — Registro Simplificado +
Google OAuth** que reduce la fricción de entrada de 5 campos a 2 clics, y el **Sprint 1 — Quick Wins**
(P7, P8, P11, P12, T4) completado el mismo día.
El codebase está estable, seguro y testeado.

---

## Refactorización Completada (19/20 milestones)

| # | Milestone | Fecha | Impacto principal |
|---|-----------|-------|-------------------|
| M1 | Seguridad I | 13 feb | `requireAuth()` helper · 7 rutas API protegidas |
| M2 | Client unificado | 14 feb | Singleton Supabase · eliminación código muerto |
| M3 | Performance queries | 14 feb | Vista `v_tenant_stats` · batch updates · ExcelJS server-side |
| M4 | Decomposición | 15 feb | Form wizard 8 archivos · SA eventos 5 archivos · CSS modular |
| M5 | Tipado fuerte | 16 feb | `database.types.ts` · tipos derivados de DB · `STATUS_MAP` |
| M6 | Optimización Vercel | 17 feb | Server Components · cache · SQL atómica para cupos · Edge Runtime |
| M7 | Testing | 17 feb | 166 tests · 17 suites · coverage lib/ 88% · CI GitHub Actions |
| M8 | Seguridad II | 18 feb | Zod schemas · XSS sanitization · auth en todas las rutas · RUT DV |
| M9 | Performance UI | 18 feb | `React.memo` · virtualización tabla · Modal a11y · spinner unificado |
| M10 | Arquitectura | 18 feb | AdminConfigTab dividido · WizardContext · REST convencional · limpieza |
| M12 | Bug cruce tenants | 18 feb | `getTeamMembersForEvent` con scoping por evento/tenant |
| M13 | Auth completo | 18 feb | Forgot password · cambio contraseña · password temporal + force change |
| M14 | Eliminación tenants | 18 feb | `deleteTenant()` cascada SQL + cleanup storage/auth + doble confirmación |
| M15 | UX SA eventos | 18 feb | Filtro por tenant · agrupación visual · búsqueda · contadores |
| M17 | Eventos públicos/privados | 18 feb | Visibilidad `public`/`private`/`invite_only` · sistema invitaciones |
| M18 | UX Feedback | 19 feb | Toasts Sileo · `ConfirmDialog` a11y · eliminación `confirm()` nativo |
| M19 | UX formulario | 18 feb | Modal confirmación rediseñado · progress overlay · SuccessView |
| M20 | Gate perfil → equipo | 18 feb | `isProfileComplete()` · banner bloqueante · auto-redirect |
| M21 | Security Hardening III | 20 feb | RLS linter-clean · SECURITY INVOKER vistas · `search_path` en ~20 funciones · rol hierarchy (admin/editor/viewer) · FK ON DELETE · CHECK constraints · 4 índices performance |

**Estado actual**: 343 tests · 30 suites · build limpio · Supabase linter 0 ERRORs.

### P0 — Registro Simplificado + Google OAuth ✅ (20 feb)

**Implementado**: Registro en 2 clics (Google) o 2 campos (email + contraseña).

- **Migración SQL** (`supabase-p0-simplified-signup.sql`): `nombre`, `apellido`, `rut` → nullable en `profiles`
- **Signup UI**: Solo email+contraseña + botón Google OAuth, sin nombre/apellido/RUT
- **Auth callbacks**: Creación de perfiles parciales (sin RUT) para OAuth y email signup
- **Schemas**: Nuevo `profileSignupSchema` (email-only), `profileUpdateSchema` acepta `rut`
- **Perfil acreditado**: RUT ahora es editable; banner "Completa tu perfil para acreditarte"
- **Gate acreditación**: `isReadyToAccredit()` verifica 5 campos (nombre, apellido, medio, tipo_medio, RUT)
- **Nueva Solicitud**: Banner informativo si faltan campos para acreditación
- **Compatibilidad**: `isProfileComplete()` sin cambios (gate de equipo sigue igual), bulk import sin cambios
- **Tests**: 16 tests nuevos para `isReadyToAccredit`, `getMissingAccreditationFields`, `ACCREDITATION_REQUIRED_FIELDS`

### Nota de seguridad post-M21

**Score estimado**: 8.5/10 (vs 5.5/10 pre-hardening)

**Completado**:
- [x] 4 vistas SECURITY DEFINER → SECURITY INVOKER (`v_event_full`, `v_registration_full`, `v_tenant_stats`, `v_team_event_enriched`)
- [x] ~20 funciones con `SET search_path = public` (previene schema injection)
- [x] Políticas RLS restrictivas en 6 tablas (event_days, registration_days, email_zone_content, event_invitations, audit_logs, email_logs, profiles)
- [x] Hierarchy de roles: `can_edit_tenant()` (admin/editor) vs `has_tenant_access()` (cualquier rol)
- [x] FK con ON DELETE SET NULL en `registrations` (submitted_by, checked_in_by, processed_by) y `audit_logs` (user_id)
- [x] CHECK `event_quota_rules_non_negative` para cuotas
- [x] 4 índices de performance (registrations, email_logs)
- [x] GRANT SELECT en vistas para `anon`/`authenticated`

**Pendientes de seguridad** (no bloqueantes):
- [ ] **Leaked password protection** — Activar en Dashboard → Auth → Settings → Password Security (no es SQL)
- [ ] **`registration_days.checked_in_by`** es TEXT, debería ser UUID con FK a `auth.users` — requiere migración de datos
- [ ] **`mt_reglas_cupo`** tiene RLS habilitado pero sin policies — tabla legacy, evaluar si se sigue usando
- [ ] **`registrations_insert`** WITH CHECK(true) — intencionalmente abierto para formulario público; `check_and_create_registration()` valida cuotas/duplicados server-side

---

## Milestone Pendiente

### M16 — Sistema de Billing para Admin Tenant ⬜

**Objetivo**: Infraestructura de planes y límites para monetización de la plataforma.

**Modelo de datos**:
- `plans` — Planes con límites (eventos, acreditados/evento, admins, storage)
- `subscriptions` — Suscripción activa por tenant (1:1)
- `usage_records` — Historial de uso para facturación

**Servicio** (`lib/services/billing.ts`):
- `checkLimit(tenantId, metric)` — Verifica si el tenant puede crear más recursos
- `getTenantPlan()` / `getUsageSummary()` / `recordUsage()`

**Implementación**:
- Enforcement: `checkLimit()` en POST de events, registrations y admins
- UI Admin: Tab "Plan" con barras de uso y tabla de planes
- UI SuperAdmin: Gestión de planes + asignación manual + métricas
- Auto-assign: Plan free al crear tenant
- Notificaciones: Banner al 80% del límite
- Pasarela: Interfaz abstracta `PaymentProvider` (placeholder para Stripe/MercadoPago)

---

## Funcionalidades Propuestas

### P0 — Registro Simplificado + Google OAuth ✅ Completado
> **Esfuerzo**: 1-2 sesiones · **Valor**: Muy alto (reduce fricción de entrada drásticamente)
> **Fecha**: 20 de febrero de 2026

**Problema actual**: El registro de acreditado exige **5 campos** (nombre, apellido, RUT, email,
contraseña) antes de siquiera entrar a la plataforma. El RUT es un dato que se puede
obtener después. Esto genera abandono y fricción innecesaria.

**Objetivo**: Registro en 2 clics (Google) o 3 campos (email + contraseña + confirmación).
El usuario completa su perfil (nombre, apellido, RUT, etc.) **después** en su dashboard.

#### Flujo propuesto

```
┌─────────────────────────────────────────────────────┐
│  REGISTRO (nuevo)                                   │
│  ┌───────────────────────────┐                      │
│  │  Continuar con Google  ▶  │ ← OAuth, 0 campos   │
│  └───────────────────────────┘                      │
│              ─── o ───                              │
│  Email: ___________                                 │
│  Contraseña: ___________                            │
│  [Crear cuenta]           ← 2 campos               │
│                                                     │
│  ¿Ya tienes cuenta? Iniciar sesión                  │
└─────────────────────────────────────────────────────┘
         │
         ▼ (Confirmación email si no es Google)
┌─────────────────────────────────────────────────────┐
│  DASHBOARD ACREDITADO                               │
│  ┌─────────────────────────────────────────┐        │
│  │ ⚠ Completa tu perfil para acreditarte   │ gate   │
│  │ Nombre · Apellido · RUT · Medio · Cargo │        │
│  └─────────────────────────────────────────┘        │
│  (Una vez completo → puede acreditarse a eventos)   │
└─────────────────────────────────────────────────────┘
```

#### Cambios técnicos requeridos

**A. Base de datos** (migración SQL):
- `ALTER TABLE profiles ALTER COLUMN rut DROP NOT NULL;`
- Permitir perfiles parciales (sin RUT) durante onboarding
- El UNIQUE en `rut` se mantiene (no puede haber 2 iguales), pero ahora acepta NULL

**B. Signup UI** (`app/auth/acreditado/page.tsx`):
- Remover campos nombre, apellido y RUT del formulario de registro
- Dejar solo: **email + contraseña**
- Agregar botón **"Continuar con Google"** → `supabase.auth.signInWithOAuth({ provider: 'google' })`
- UI limpia, moderna, 2 opciones claras

**C. Auth callback** (`app/api/auth/callback/route.ts` + `app/auth/callback/page.tsx`):
- Remover dependencia de `user_metadata.rut` para crear perfil
- Google OAuth: crear perfil parcial con `nombre`/`email` que Supabase trae automáticamente
- Email+password: crear perfil vacío vinculado al `auth.uid`

**D. Backend schemas** (`lib/schemas/index.ts`):
- Nuevo schema `profileCreateLiteSchema` que solo exige email
- El `profileCreateSchema` completo se usa para **actualización** de perfil, no para registro

**E. Gate de completitud** (`lib/profile.ts`):
- `isProfileComplete()` ya NO chequea RUT (solo nombre, apellido, medio, tipo_medio) → ✅ no cambia
- Nuevo: `isReadyToAccredit(profile)` → chequea los 4 campos + RUT (requerido para acreditarse)
- Banner bloqueante en wizard de acreditación si `!isReadyToAccredit`

**F. Perfil del acreditado** (`app/acreditado/perfil/page.tsx`):
- RUT pasa de **solo lectura** a **editable** (se llena aquí, no en signup)
- Validación DV en frontend + backend al guardar
- Banner progresivo: "Completa tu RUT para poder acreditarte"

**G. Supabase Dashboard** (configuración manual):
- Authentication → Providers → Google → Habilitar
- Crear OAuth credentials en Google Cloud Console
- Configurar redirect URL del proyecto Supabase
- Agregar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` a env vars

#### Compatibilidad hacia atrás
- Usuarios existentes ya tienen RUT → no se ven afectados
- El flujo de acreditación sigue exigiendo RUT, solo que ahora se pide en el **perfil** y no en el **signup**
- Bulk import sigue exigiendo RUT (viene en el Excel)
- `isProfileComplete()` no cambia → el gate de equipo sigue igual

---

### P1 — Credencial Digital Descargable 🔴 Alto impacto
> **Esfuerzo**: 1-2 sesiones · **Valor**: Muy alto

Hoy el acreditado ve "Aprobado" con un QR, pero **no puede descargar una credencial**.
Es lo primero que piden los clientes para presentar en puerta.

- Generar imagen/PDF con foto, nombre, cargo, zona, QR, logo evento y tenant
- Botón "Descargar Credencial" en dashboard acreditado (post-aprobación)
- Botón "Compartir por WhatsApp" con imagen adjunta
- Bonus: Apple Wallet / Google Wallet pass
- Tecnología: `@vercel/og` (Satori) para imagen server-side, o `jsPDF` para PDF

---

### P2 — Vista "Puerta" para Seguridad 🔴 Alto impacto
> **Esfuerzo**: 1-2 sesiones · **Valor**: Muy alto

Dashboard en tiempo real para personal de seguridad en la entrada:

- Lista filtrable de acreditados aprobados por zona
- Estado checked-in/pendiente con timestamp de ingreso
- Contador en vivo: "148/200 ingresados"
- Búsqueda rápida por nombre o RUT
- Optimizado para tablet

---

### P3 — Auto-Aprobación Condicional 🟡 Alto impacto
> **Esfuerzo**: 1 sesión · **Valor**: Alto (reduce trabajo manual del admin)

Reglas configurables por evento:
- "Si organización = El Mercurio → aprobar automáticamente"
- "Si tipo_medio = Prensa Escrita → aprobar"
- "Si cargo = Fotógrafo y cupo disponible → aprobar"

Tabla `auto_approval_rules` con condiciones JSON, evaluación en POST /api/registrations.

---

### P4 — Dashboard Analytics para Admin 🟡 Medio impacto
> **Esfuerzo**: 1-2 sesiones · **Valor**: Medio-Alto

- Gráfico de acreditaciones por día (tendencia temporal)
- Desglose por tipo_medio (pie/bar chart)
- Tasa de check-in por zona y hora (heatmap)
- Tiempo promedio de aprobación
- Comparativa con eventos anteriores
- Tecnología: Recharts

---

### P5 — Guardado Automático del Formulario (Draft) 🟡 Medio impacto
> **Esfuerzo**: 2-3 horas · **Valor**: Alto (tasa de completitud)

Si el acreditado cierra la pestaña, **pierde todo**. Los datos viven solo en `useState`.

Guardar estado en `localStorage` con key `draft:{eventId}:{rut}`. Restaurar al volver
con banner "Tienes un borrador guardado — ¿Restaurar?".

---

### P6 — Sistema de Recordatorios Automáticos 🟡 Medio impacto
> **Esfuerzo**: 1 sesión · **Valor**: Alto

- Email 24h antes del evento a acreditados aprobados (con credencial si P1 existe)
- Email recordatorio de "formulario incompleto" si hay draft
- Email X días antes del cierre de plazo
- Configurable por evento
- Implementación: Vercel Cron o Supabase Edge Functions

---

### P7 — Motivo de Rechazo Visible al Acreditado ✅ Completado
> **Esfuerzo**: 30 minutos · **Valor**: Alto · **Fecha**: 20 de febrero de 2026

`motivo_rechazo` ahora aparece en el dashboard del acreditado:
- Card de historial: bloque rojo con motivo debajo de registros rechazados
- Card de tenant: motivo inline debajo del badge de estado
- Evita emails de soporte innecesarios

---

### P8 — Templates de Rechazo Rápido ✅ Completado
> **Esfuerzo**: 1-2 horas · **Valor**: Medio · **Fecha**: 20 de febrero de 2026

6 motivos predefinidos en `AdminRejectModal` (vs 4 anteriores):
- Documentación incompleta · No cumple requisitos · Cupo máximo alcanzado
- Datos incorrectos · Fuera de plazo · Cupo agotado para su categoría
- Template toggle (click = selecciona, re-click = deselecciona)
- Combinar template + texto libre: "Documentación incompleta — falta foto credencial"
- Preview del motivo final antes de enviar
- Estado del modal se limpia al cerrar

---

### P9 — QR con URL + Scanner Cámara 🟡 Medio impacto
> **Esfuerzo**: 1 sesión · **Valor**: Alto

Actualmente el QR codifica un token puro (al escanearlo con celular no pasa nada).
El scanner solo funciona con lectores USB.

- Codificar URL de check-in en el QR
- Crear página server-side que procesa check-in al abrirse
- Modo cámara al scanner existente (`html5-qrcode`)
- Compatibilidad backward con scanners USB

---

### P10 — Página de Auditoría en SuperAdmin 🟡 Medio impacto
> **Esfuerzo**: 2-3 horas · **Valor organizacional**: Alto

Los audit logs se registran pero **no tienen UI**. Tabla filtrable por acción,
tenant, usuario, fecha. Detalle expandible de metadata. Export CSV.

---

### P11 — SEO Dinámico por Tenant ✅ Completado
> **Esfuerzo**: 1 hora · **Valor marketing**: Medio · **Fecha**: 20 de febrero de 2026

`generateMetadata()` en `[tenant]/layout.tsx` con:
- Título: `{tenant.nombre} — Acreditaciones`
- Descripción contextual del tenant
- Open Graph con logo del tenant como imagen
- Twitter card summary
- Sin query extra (usa `React.cache()` de `getTenantBySlug`)

---

### P12 — Badge "Nuevas Solicitudes" para Admin ✅ Completado
> **Esfuerzo**: 1 hora · **Valor**: Medio · **Fecha**: 20 de febrero de 2026

Doble badge en tab Acreditaciones del admin:
- Badge ámbar: total de pendientes (ya existía)
- **Badge rojo pulsante**: solicitudes nuevas desde la última visita
- `localStorage` con key por tenant+evento (no requiere migración SQL)
- Se resetea al hacer click en el tab de acreditaciones
- Funciona sin `last_seen_at` en BD — solución client-side

---

### P13 — Acreditación desde Página de Equipo 🟡 Medio impacto
> **Esfuerzo**: 3-4 horas · **Valor**: Medio

Seleccionar miembros de equipo → elegir evento → enviar solicitud directa.
Hoy el acreditado debe ir al formulario del evento y seleccionar miembros desde ahí.

---

## Mejoras Técnicas Pendientes

### Prioridad Alta

| # | Mejora | Detalle |
|---|--------|---------|
| T1 | **Rate limiting** | APIs sin protección contra abuso. Upstash Ratelimit en login, registrations, bulk, QR, upload |
| T2 | **PWA** | Sin manifest ni service worker. App instalable en móvil con icono |
| T3 | **Paginación server-side** | AdminContext carga todo en una query. Necesita paginación para +1000 registros |
| T4 | **`next/image`** | ✅ 11 `<img>` → `<Image>` en 8 archivos · lazy loading + WebP automático |

### Prioridad Media

| # | Mejora | Detalle |
|---|--------|---------|
| T5 | **Server Actions** | Muchas operaciones usan `fetch('/api/...')` pudiendo usar Server Actions |
| T6 | **Logging estructurado** | Solo `console.warn`. Sentry, LogRocket, o Pino |
| T7 | **Tests componentes** | 0 tests de RegistrationWizard, AdminTable, AdminDashboardV2 |
| T8 | **Tests E2E** | Sin Playwright/Cypress para flujos completos |
| T9 | **RLS funcional** | ~~Todo usa `createSupabaseAdminClient`~~ M21 endureció RLS en 6 tablas + vistas INVOKER. Falta migrar rutas API de `adminClient` a client con RLS donde sea posible |
| T10 | **`as any` cleanup** | 10+ usos de `as any` en servicios por campos JSONB |

### Prioridad Baja

| # | Mejora | Detalle |
|---|--------|---------|
| T11 | **Font Awesome → SVG** | CDN externo. Migrar a `@fortawesome/react-fontawesome` con tree-shaking |
| T12 | **i18n** | Todo hardcodeado en español. `next-intl` para inglés/portugués |
| T13 | **Dominio personalizado** | Permitir `acreditaciones.miclub.cl` además de `{slug}.accredia.cl` |
| T14 | **White-label** | Opción de ocultar "Accredia" del footer |
| T15 | **SQL migrations formales** | 19 archivos SQL sueltos → `supabase db migration` |

---

## Inventario de Features Actuales

### Plataforma Core
- Multi-tenant por subdominio (`proxy.ts`) con branding dinámico (4 colores + paleta HSL/WCAG)
- 3 roles: SuperAdmin · Admin Tenant (admin/editor/viewer) · Acreditado
- Auth Supabase (email+password) con forgot/change/force-change password
- Password policy + password temporal para admins nuevos
- Security hardening: RLS linter-clean · vistas SECURITY INVOKER · `search_path` fijo · rol hierarchy

### Eventos
- Tipos: simple · deportivo (rival + logos VS) · multidía (jornadas)
- Visibilidad: público · privado · invite_only (con token UUID)
- Formulario dinámico JSONB (10 tipos de campo)
- Fecha límite con override manual · Clonación de eventos · QR toggle

### Acreditaciones
- Workflow: pendiente → aprobado/rechazado/revisión
- Creación atómica SQL (`FOR UPDATE`) anti-race condition
- Prevención de duplicados (UNIQUE event_id + profile_id)
- Carga masiva CSV/Excel (hasta 2000 registros) con template personalizable
- Acciones bulk · Optimistic updates con rollback

### Cupos y Zonas
- Reglas de cupo por tipo_medio (por organización + global)
- Verificación real-time con `useQuotaCheck`
- Auto-asignación de zona por cargo o tipo_medio · Edición manual

### Identidad (Profiles)
- RUT como identificador único global · Vinculación progresiva
- Autofill diferencial (cascada: tenant → datos_base → profile)
- Gate de perfil completo para equipo

### Equipos
- Directorio de "frecuentes" por manager
- Scoping por evento/tenant (sin cruce de datos)

### QR / Check-in
- Token SHA256 al aprobar · Scanner input o lector USB
- Check-in multidía por jornada · Pantalla completa verde/roja con foto

### Emails
- Resend API · Templates custom por tenant (aprobación, rechazo)
- Contenido por zona · 15+ variables · Sanitización XSS

### Exportación
- XLSX 18 columnas brandizado · PuntoTicket 7 columnas
- Column picker · Filtros por evento, tenant, estado, tipo_medio

### SuperAdmin
- Dashboard stats globales · CRUD tenants con eliminación cascada
- CRUD eventos 7 tabs · Gestión admins por tenant
- Filtros/agrupación/búsqueda eventos

### UX
- Design system CSS tokens + paleta dinámica · Toasts Sileo · ConfirmDialog a11y
- Responsive mobile-first · Atajos teclado · Virtualización tabla · Sidebar responsive

---

## Priorización Sugerida

### Sprint 0 — Registro Simplificado (2-3 días) ⭐
- [ ] **P0** — Registro simplificado + Google OAuth
  - [ ] Migración SQL: `rut` nullable en `profiles`
  - [ ] Signup UI: solo email+password + botón Google
  - [ ] Auth callback: perfiles parciales (sin RUT)
  - [ ] Schema lite para creación de perfil
  - [ ] `isReadyToAccredit()` gate para acreditación
  - [ ] RUT editable en perfil del acreditado
  - [ ] Configuración Google OAuth en Supabase

### Sprint 1 — Quick Wins ✅ Completado (20 feb)
- [x] **P7** — Motivo rechazo visible al acreditado
- [x] **P8** — Templates de rechazo rápido (6 motivos + combo)
- [x] **P11** — SEO dinámico por tenant (generateMetadata + OG)
- [x] **P12** — Badge nuevas solicitudes (localStorage client-side)
- [x] **T4** — `next/image` en 11 fotos y logos (8 archivos)

### Sprint 2 — Alto Impacto (3-5 días)
- [ ] **P1** — Credencial digital descargable
- [ ] **P2** — Vista puerta para seguridad
- [ ] **P5** — Auto-save formulario (draft)
- [ ] **T1** — Rate limiting

### Sprint 3 — Monetización (3-4 días)
- [ ] **M16** — Billing (infraestructura completa)
- [ ] **T2** — PWA manifest + service worker

### Sprint 4 — Automatización (2-3 días)
- [ ] **P3** — Auto-aprobación condicional
- [ ] **P6** — Recordatorios automáticos
- [ ] **P9** — QR con URL + scanner cámara

### Sprint 5 — Polish (2-3 días)
- [ ] **P4** — Dashboard analytics
- [ ] **P10** — Página de auditoría
- [ ] **P13** — Acreditación desde equipo
- [ ] **T3** — Paginación server-side

### Backlog
- T5 Server Actions · T6 Logging · T7-T8 Tests componentes/E2E
- T9 RLS funcional (parcialmente resuelto con M21) · T12 i18n · T13-T14 Dominio custom / White-label
- T15 SQL migrations formales (20+ archivos SQL sueltos → `supabase db migration`)
