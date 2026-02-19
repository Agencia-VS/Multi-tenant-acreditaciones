# Accredia — Estado del Proyecto y Roadmap

> **Proyecto**: Multi-tenant Acreditaciones  
> **Stack**: Next.js 16 (App Router + Turbopack) · TypeScript · Tailwind CSS v4 · Supabase · Vercel  
> **Codebase**: ~22,000 líneas TS/TSX/CSS · 22 API routes · 15 servicios · 301 tests (28 suites)  
> **Fecha**: 19 de febrero de 2026  

---

## Resumen

Plataforma **funcional en producción** con arquitectura multi-tenant por subdominio,
tres roles (acreditado, admin_tenant, superadmin), formularios dinámicos, sistema de
zonas/cupos, exportación PuntoTicket, gestión de equipos, QR check-in multidía,
emails brandizados y eventos públicos/privados/por invitación.

Se completaron **18 de 19 milestones de refactorización** entre el 13 y 19 de febrero
de 2026. Solo queda pendiente M16 (Billing). El codebase está estable, seguro y testeado.

---

## Refactorización Completada (18/19 milestones)

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

**Estado actual**: 301 tests · 28 suites · build limpio · 0 vulnerabilidades conocidas.

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

### P7 — Motivo de Rechazo Visible al Acreditado 🟢 Quick win
> **Esfuerzo**: 30 minutos · **Valor**: Alto

`motivo_rechazo` llega por email pero **no se ve en el dashboard del acreditado**.
Agregar al card de acreditación rechazada. Evita emails de soporte.

---

### P8 — Templates de Rechazo Rápido 🟢 Quick win
> **Esfuerzo**: 1-2 horas · **Valor**: Medio

Motivos pre-definidos en dropdown del `AdminRejectModal`:
- "Documentación incompleta"
- "Fuera de plazo"
- "No cumple requisitos del evento"
- "Cupo agotado para su categoría"
- + opción texto libre

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

### P11 — SEO Dinámico por Tenant 🟢 Quick win
> **Esfuerzo**: 1 hora · **Valor marketing**: Medio

`generateMetadata()` en `[tenant]/layout.tsx` con título, descripción y Open Graph
con logo del tenant. Mejora compartir links en redes.

---

### P12 — Badge "Nuevas Solicitudes" para Admin 🟢 Quick win
> **Esfuerzo**: 1 hora · **Valor**: Medio

Contador de solicitudes pendientes desde último login en sidebar/header admin.
Requiere `last_seen_at` en `tenant_admins`.

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
| T4 | **`next/image`** | Fotos y logos sin lazy loading ni WebP |

### Prioridad Media

| # | Mejora | Detalle |
|---|--------|---------|
| T5 | **Server Actions** | Muchas operaciones usan `fetch('/api/...')` pudiendo usar Server Actions |
| T6 | **Logging estructurado** | Solo `console.warn`. Sentry, LogRocket, o Pino |
| T7 | **Tests componentes** | 0 tests de RegistrationWizard, AdminTable, AdminDashboardV2 |
| T8 | **Tests E2E** | Sin Playwright/Cypress para flujos completos |
| T9 | **RLS funcional** | Todo usa `createSupabaseAdminClient` que bypasea RLS |
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

### Sprint 1 — Quick Wins (1-2 días)
- [ ] **P7** — Motivo rechazo visible al acreditado (30 min)
- [ ] **P8** — Templates de rechazo rápido (1-2h)
- [ ] **P11** — SEO dinámico por tenant (1h)
- [ ] **P12** — Badge nuevas solicitudes (1h)
- [ ] **T4** — `next/image` en fotos y logos (2h)

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
- T9 RLS funcional · T12 i18n · T13-T14 Dominio custom / White-label
- T15 SQL migrations formales
