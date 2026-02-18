# Ruta de Refactorización — Accredia 11/11

> **Proyecto**: Multi-tenant Acreditaciones  
> **Stack**: Next.js 16 (App Router + Turbopack) · TypeScript · Tailwind CSS v4 · Supabase · Vercel  
> **Fecha de auditoría**: 13 de febrero de 2026  
> **Última actualización**: 18 de febrero de 2026  
> **Codebase**: ~20,000 líneas TS/TSX/CSS · 21 API routes · 13 servicios · 230 tests (21 suites)  

---

## Estado Actual

El proyecto es **funcional en producción** con arquitectura multi-tenant por subdominio
(`proxy.ts`), tres roles (acreditado, admin_tenant, superadmin), formularios dinámicos,
sistema de zonas, cupos, exportación PuntoTicket y gestión de equipos.

La auditoría inicial reveló **6 áreas de mejora** organizadas en milestones
independientes. Tras completar M1–M7, una segunda auditoría (17 feb 2026) identificó
**3 áreas adicionales** (M8–M10) y una mejora funcional (M11). El 18 feb 2026 se
agregaron **5 milestones funcionales** (M12–M16) a partir de feedback de QA.
El mismo día se agregaron **4 milestones adicionales** (M17–M20) a partir de
feedback de usuario: visibilidad de eventos, UX de feedback, mejora del formulario
de acreditación y gate de perfil para equipo.
**10 de 20 milestones completados**.

Además, el 18 feb 2026 se inició la ejecución de M12 (bloqueante).

### Progreso Global

```
M1  (Seguridad)                ███████████████  ✅ COMPLETADO — 13 feb 2026
M2  (Client unificado)         ████████████     ✅ COMPLETADO — 14 feb 2026
M3  (Performance queries)      ██████████       ✅ COMPLETADO — 14 feb 2026
M4  (Decomposición)            ████████         ✅ COMPLETADO — 15 feb 2026
M5  (Tipado fuerte)            ██████           ✅ COMPLETADO — 16 feb 2026
M6  (Optimización Vercel)      ██████           ✅ COMPLETADO — 17 feb 2026
M7  (Testing)                  ████████████████ ✅ COMPLETADO — 17 feb 2026
M8  (Seguridad II + Validación)████████████     ✅ COMPLETADO — 18 feb 2026
M9  (Performance UI + A11y)    ██████████       ⬜ PENDIENTE
M10 (Arquitectura + Calidad)   ████████         ⬜ PENDIENTE
M11 (QR Check-in Móvil)        ██████           ⬜ PENDIENTE
M12 (Bug Cruce Datos Tenants)  ████████████████ ✅ COMPLETADO — 18 feb 2026
M13 (Flujo Auth Completo)      ██████████       ⬜ PENDIENTE
M14 (Eliminación de Tenants)   ██████           ⬜ PENDIENTE
M15 (UX SuperAdmin Eventos)    ████             ⬜ PENDIENTE
M16 (Billing Admin Tenant)     ████████████     ⬜ PENDIENTE
M17 (Eventos Públicos/Privados) ██████           ⬜ PENDIENTE
M18 (UX Feedback: Toasts+Modal) ████████         ✅ COMPLETADO — 19 feb 2026
M19 (UX Formulario Acreditación)████████████     ⬜ PENDIENTE
M20 (Gate Perfil → Equipo)      ██████           ✅ COMPLETADO — 18 feb 2026
```

---

## Convenciones del Documento

| Símbolo | Significado |
|---------|-------------|
| 🔴 | Crítico — vulnerabilidad o bug potencial |
| 🟡 | Importante — afecta performance o mantenibilidad |
| 🟢 | Mejora — calidad de código, DX |
| ✅ | Ya resuelto / bien implementado |
| 📁 | Archivo a crear |
| 🗑️ | Archivo a eliminar |

---

## Arquitectura de Routing

> **Nota importante**: el proyecto usa `proxy.ts` (convención Next.js 16+) en lugar del
> deprecated `middleware.ts`. Toda referencia a "middleware" en este documento se refiere
> a la lógica dentro de `proxy.ts`, NO al archivo `middleware.ts` legacy.

```
proxy.ts                    ← Rewrite multi-tenant por subdominio
├─ club.accredia.cl/*      → /club/*
├─ arena.accredia.cl/*     → /arena/*
└─ localhost?tenant=club   → /club/*
```

El `proxy.ts` actualmente solo hace rewrite de rutas. La autenticación se verifica
individualmente en cada API route (o no se verifica — ver M1).

---

## Diagnóstico por Área (post-refactorización)

### Seguridad — ✅ Resuelto (M1 + M8)

**Resuelto en M1:**

| Ruta | Estado | Resolución |
|------|--------|------------|
| `GET /api/admin/export` | ✅ Protegido | `requireAuth()` con rol admin_tenant/superadmin |
| `GET /api/registrations` | ✅ Protegido | `requireAuth()` — admin solo ve sus eventos |
| `GET /api/registrations/[id]` | ✅ Protegido | `requireAuth()` — verificación de ownership |
| `GET/POST/DELETE /api/events/[id]/quotas` | ✅ Protegido | `requireAuth()` en mutaciones |
| `GET/POST/DELETE /api/events/[id]/zones` | ✅ Protegido | `requireAuth()` en mutaciones |
| `GET/POST /api/tenants/[id]/admins` | ✅ Protegido | `requireAuth({ role: 'superadmin' })` |
| `POST /api/registrations` | ✅ Diseño intencional | Formulario público, auth es opcional |
| `POST/PATCH /api/tenants` | ✅ SuperAdmin check | Ya estaba correcto |

Helper creado: `lib/services/requireAuth.ts` — verifica usuario, rol y ownership en 1 línea.

**Resuelto en M8 (18 feb 2026):**

| Ruta | Problema | Resolución |
|------|----------|-----------|
| `POST /api/upload` | Sin verificación de auth | ✅ `requireAuth(admin_tenant)` + allowlist carpetas/extensiones |
| `GET/POST /api/email/templates` | Cualquiera podía leer/modificar | ✅ `requireAuth(admin_tenant)` + Zod |
| `GET/POST/DELETE /api/email/zone-content` | Sin auth en ningún método | ✅ `requireAuth(admin_tenant)` + Zod |
| `POST /api/profiles/lookup` | Creaba perfiles con user_id del body | ✅ user_id desde sesión + Zod |
| `GET /api/tenants?all=true` | Exponía stats sin auth | ✅ `requireAuth(superadmin)` |
| `DELETE /api/registrations/[id]` | No verificaba ownership | ✅ `requireAuth()` |
| `POST/PATCH/DELETE /api/events` | Auth inconsistente | ✅ `requireAuth()` + Zod en POST/PATCH |
| `lib/services/email.ts` | XSS en `replaceVars()` | ✅ `escapeHtml()`, `safeColor()`, `safeUrl()` |
| `AdminMailTab.tsx`, `AdminMailZones.tsx` | `dangerouslySetInnerHTML` sin sanitizar | ✅ `sanitizeHtml()` de `lib/sanitize.ts` |
| Todas las rutas POST/PATCH | Sin validación de input | ✅ Zod schemas en `lib/schemas/index.ts` |
| `lib/validation.ts` | DV RUT comentado | ✅ DV reactivado |

### Performance — ✅ Resuelto en M3

| Problema original | Resolución |
|-------------------|------------|
| N+1 queries en `listTenants()` (31 queries) | Vista SQL `v_tenant_stats` → 1 query |
| N+1 en `bulkUpdateStatus()` (100 queries) | Batch con `.in()` → 1 query |
| Full table scan en `getRegistrationStats()` | `count: 'exact', head: true` → 3 queries ligeras |
| 2 queries en `getUserTenantRole()` | Combinado en 1 query |
| ExcelJS en client bundle | Movido a `app/api/bulk/parse/route.ts` (server-side) |

### Código Duplicado — ✅ Resuelto en M2 + M5

| Duplicación original | Resolución |
|---------------------|------------|
| Browser client inline en 20+ archivos | Singleton `getSupabaseBrowserClient()` — 12 archivos migrados |
| Autofill duplicado (server + client) | `lib/services/autofill.ts` — función isomórfica única |
| STATUS_MAP en 3 lugares | Centralizado en `types/index.ts` |
| Interfaces locales Tenant/Event | Eliminadas, importan de `@/types` |

### Código Muerto — 🟡 Parcialmente resuelto (M2 + pendiente M10)

**Eliminado en M2:**

| Elemento | Acción |
|----------|--------|
| `AdminDashboard.tsx` legacy | 🗑️ Eliminado |
| `DynamicRegistrationForm.tsx.bak` | 🗑️ Eliminado |
| `AcreditadoRow.tsx.bak2` | 🗑️ Eliminado |
| `export const supabase` legacy | 🗑️ Eliminado de `lib/supabase/index.ts` |
| `CookieOptions` import | 🗑️ Eliminado de `lib/supabase/server.ts` |

**Residual — identificado en auditoría del 17 feb (→ M10):**

| Elemento | Tipo | Acción sugerida |
|----------|------|----------------|
| `components/admin-dashboard/AdminFilters.tsx` | Código muerto — no se importa en ningún dashboard | 🗑️ Eliminar |
| `STATUS_COLORS` en `types/index.ts` | Marcado `@deprecated` pero aún exportado | 🗑️ Eliminar |
| `components/admin/` | Directorio vacío (residuo de refactorización) | 🗑️ Eliminar |
| `app/auth/layout.tsx` | Pass-through (`<>{children}</>`) — Next.js genera layout implícito | 🗑️ Eliminar |
| `getSupabaseBrowserClient()` en `superadmin/configuracion/page.tsx` | Variable `supabase` declarada pero no usada | 🗑️ Limpiar |
| Código comentado en `TenantLanding.tsx` (líneas 329-337) | Bloque `<h1>` y `<p>` comentados | 🗑️ Limpiar |
| `lib/supabase.ts` | Cliente plano sin SSR — duplica `lib/supabase/client.ts` | 🗑️ Eliminar |

### Archivos Monolíticos — ✅ Descompuestos en M4

| Archivo original | Resultado |
|-----------------|-----------|
| `DynamicRegistrationForm.tsx` (1,439 líneas) | 8 archivos en `components/forms/registration/` (1,805 líneas total) |
| `SA eventos/page.tsx` (1,011 líneas) | `page.tsx` (604) + 4 componentes extraídos (511 total) |
| `globals.css` (446 líneas) | `globals.css` (4) + 3 archivos en `app/styles/` (412 total) |

### Tipado — 🟡 Parcialmente resuelto (M5 + pendiente M10)

**Resuelto en M5:**

| Aspecto | Estado |
|---------|--------|
| Tipos generados de Supabase | ✅ `database.types.ts` (1,071 líneas) auto-generado |
| Clientes Supabase tipados | ✅ `createServerClient<Database>`, `createBrowserClient<Database>` |
| Tipos derivados de DB | ✅ `Tables<'tenants'>` + helper `NonNull<>` en vez de interfaces manuales |
| STATUS_MAP centralizado | ✅ Const tipada en `types/index.ts` con bg/text/icon/label |
| Autofill isomórfico | ✅ `lib/services/autofill.ts` (server + client sin deps de servidor) |

**Pendiente — identificado en auditoría del 17 feb (→ M10):**

| Problema | Severidad |
|----------|-----------|
| 10+ usos de `as any` en servicios (events, profiles, tenants, audit, registrations) | 🟡 |
| `datos_base`, `datos_extra`, `config` siguen siendo `Record<string, unknown>` — pierden type safety en uso | 🟡 |
| `TenantConfig`/`EventConfig` existen pero NO se aplican a los tipos base `Tenant`/`Event` | 🟡 |
| `RegistrationFull` no incluye campos accedidos en el código (`profile_foto`, `motivo_rechazo`, `event_nombre`, etc.) | 🟡 |
| Casts forzados: `(event as Event & { event_type?: EventType })` en `TenantLanding.tsx` y otros | 🟢 |
| `eslint-disable @typescript-eslint/no-explicit-any` en `acreditado/dashboard/page.tsx` | 🟢 |

### Testing — � Base sólida, gaps pendientes (M7 + pendiente M10)

**Resuelto en M7:** 166 tests, 17 suites, todos passing. Coverage `lib/` 88% stmts.

| Aspecto | Estado |
|---------|--------|
| Tests unitarios servicios core | ✅ 166 tests — requireAuth, autofill, validation, dates, colors, quotas, profiles, zones, audit |
| Tests de API routes | ✅ registrations, teams, tenants, events, event-days, export-columns |
| Tests de hooks | ✅ useConfirmation |
| CI pipeline | ✅ GitHub Actions configurado |

**Pendiente — identificado en auditoría del 17 feb (→ M10):**

| Aspecto | Estado |
|---------|--------|
| Tests de componentes React | 🔴 0 tests de RegistrationWizard, AdminTable, AdminDashboardV2, etc. |
| Tests de servicios faltantes | 🟡 `email.ts` (408 líneas), `registrations.ts` (337 líneas), `teams.ts` sin test unit |
| Tests de hooks faltantes | 🟡 `useProfileLookup`, `useQuotaCheck`, `useTenantProfile` sin test |
| Tests E2E | 🟡 Sin Playwright/Cypress |
| Coverage de API routes | 🟡 `vitest.config.ts` excluye `app/api/**` del coverage |

### Performance UI — 🟡 Pendiente (→ M9)

| Problema | Severidad | Archivo(s) |
|----------|-----------|------------|
| `AdminRow` sin `React.memo` — 500+ filas re-render por interacción | 🔴 Alto | `components/admin-dashboard/AdminRow.tsx` |
| Sin virtualización de tabla — DOM con 500+ filas | 🔴 Alto | `components/admin-dashboard/AdminTable.tsx` |
| 6x `window.location.reload()` en vez de actualizar estado | 🟡 Medio | `AdminConfigTab.tsx`, `AdminAccreditationControl.tsx` |
| Submit secuencial — acreditados se envían 1x1 en loop | 🟡 Medio | `useRegistrationForm.ts` |
| `getTenantBySlug` llamado 2 veces por request sin `React.cache()` | 🟡 Medio | `[tenant]/layout.tsx`, `[tenant]/page.tsx` |
| Font Awesome cargado desde CDN (request bloqueante) | 🟢 Bajo | `app/layout.tsx` |

### Accesibilidad — 🟡 Pendiente (→ M9)

| Problema | Severidad | Archivo(s) |
|----------|-----------|------------|
| `Modal` sin `role="dialog"`, `aria-modal`, trap de foco, ni cierre con Escape | 🔴 Alto | `components/shared/ui.tsx` |
| Toggle switches sin label text | 🟡 Medio | `AdminAccreditationControl.tsx` |
| `<select>` sin `<label>` asociado en tabla admin | 🟡 Medio | `AdminRow.tsx`, `AdminTable.tsx` |
| Iconos Font Awesome sin texto alternativo | 🟢 Bajo | Global |

### Arquitectura — 🟡 Pendiente (→ M10)

| Problema | Severidad |
|----------|-----------|
| `AdminConfigTab.tsx` (700 líneas) — demasiadas responsabilidades | 🟡 Importante |
| `StepAcreditados` recibe 31+ props — prop drilling excesivo | 🟡 Importante |
| `app/page.tsx` es `'use client'` completo — perjudica SEO de landing | 🟡 Importante |
| Patrón auth inconsistente: unas rutas usan `requireAuth()`, otras `getCurrentUser()` manual | 🟡 Importante |
| Formato respuesta API inconsistente: `{ success }` vs `{ ok }` vs entidad directa | 🟢 Mejora |
| Rutas REST no convencionales: `PATCH /api/events?id=xxx` en vez de `/api/events/[id]` | 🟢 Mejora |
| Data fetching mixto: Supabase directo vs API routes en páginas acreditado | 🟢 Mejora |
| Spinners: 4+ implementaciones distintas en vez de `LoadingSpinner` compartido | 🟢 Mejora |
| `onMouseEnter`/`onMouseLeave` inline en vez de CSS `:hover` | 🟢 Mejora |
| Colores hardcoded en superadmin (`bg-gray-900`) fuera del design system | 🟢 Mejora |
| SuperAdmin sidebar sin responsive (inutilizable en móvil) | 🟡 Importante |
| 19 archivos SQL sueltos sin herramienta de migración formal | 🟡 Importante |

---

## Milestones Completados

### ✅ Milestone 1 — Seguridad (completado 13 feb 2026)
> **~10 archivos** · Build verificado

**Qué se hizo:**
- Creado `lib/services/requireAuth.ts` — helper reutilizable que verifica usuario, rol y ownership de tenant
- Protegidas 7 rutas API que exponían datos personales sin autenticación:
  - `GET /api/admin/export` — ahora requiere admin_tenant o superadmin
  - `GET /api/registrations` y `GET /api/registrations/[id]` — requiere auth
  - `POST/DELETE /api/events/[id]/quotas` y `/zones` — requiere auth en mutaciones
  - `GET/POST /api/tenants/[id]/admins` — requiere superadmin

### ✅ Milestone 2 — Cliente Supabase Unificado + Limpieza (completado 14 feb 2026)
> **~25 archivos** · Build verificado

**Qué se hizo:**
- 12 archivos migrados de `createBrowserClient(url, key)` inline → `getSupabaseBrowserClient()` singleton
- Eliminados 3 archivos muertos: `AdminDashboard.tsx`, `DynamicRegistrationForm.tsx.bak`, `AcreditadoRow.tsx.bak2`
- Limpiado `export const supabase` legacy de `lib/supabase/index.ts`
- Eliminado import `CookieOptions` no usado de `lib/supabase/server.ts`

### ✅ Milestone 3 — Performance de Queries (completado 14 feb 2026)
> **~6 archivos + 1 vista SQL** · Build verificado

**Qué se hizo:**
- Vista SQL `v_tenant_stats` creada → `listTenants()` pasó de 31 queries a 1
- `bulkUpdateStatus()` reescrito con `.in()` batch → de N queries a 1
- `getRegistrationStats()` usa `count: 'exact', head: true` en vez de full scan
- `getUserTenantRole()` combinado en 1 query
- ExcelJS parsing movido a `app/api/bulk/parse/route.ts` (server-side), eliminado del client bundle

### ✅ Milestone 4 — Decomposición de Componentes Monolíticos (completado 15 feb 2026)
> **3 archivos → 15 archivos** · Build verificado

**Qué se hizo:**

**4.1 — DynamicRegistrationForm (1,439 → 8 archivos):**
```
components/forms/registration/
├── RegistrationWizard.tsx       (216 líneas) — Orquestador wizard
├── StepResponsable.tsx          (226 líneas) — Paso 1: datos responsable
├── StepTipoMedio.tsx            (126 líneas) — Paso 2: tipo de medio
├── StepAcreditados.tsx          (375 líneas) — Paso 3: equipo + bulk
├── ConfirmModal.tsx             (117 líneas) — Modal de confirmación
├── StepIndicator.tsx            (40 líneas)  — Indicador de pasos
├── useRegistrationForm.ts       (631 líneas) — Hook: estado, validación, submit
├── types.ts                     (64 líneas)  — Tipos del formulario
└── index.ts                     (10 líneas)  — Barrel export
```

**4.2 — SA Eventos Page (1,011 → 5 archivos):**
```
app/superadmin/(dashboard)/eventos/
├── page.tsx                     (604 líneas) — Orquestador reducido
├── EventFormFieldsTab.tsx       (92 líneas)  — Tab campos de formulario
├── EventQuotasTab.tsx           (136 líneas) — Tab cupos
├── EventZonesTab.tsx            (221 líneas) — Tab zonas
└── SelectOptionsEditor.tsx      (62 líneas)  — Editor de opciones select
```

**4.3 — globals.css (446 → 4 archivos):**
```
app/globals.css                  (4 líneas)   — Solo @imports
app/styles/tokens.css            (124 líneas) — Design tokens + variables CSS
app/styles/components.css        (207 líneas) — Clases .btn-*, .card-*, etc.
app/styles/animations.css        (81 líneas)  — @keyframes + utilidades
```

### ✅ Milestone 5 — Tipado Fuerte desde la DB (completado 16 feb 2026)
> **~20 archivos** · Build verificado

**Qué se hizo:**

- **5.1**: Generado `lib/supabase/database.types.ts` (1,071 líneas) con `supabase gen types typescript`
  - 14 tablas, 3 vistas, 11 funciones RPC tipadas
- **5.2**: Clientes Supabase tipados con `<Database>` en `server.ts` y `client.ts`
  - Resultado: autocompletado de tablas y columnas en todos los servicios
- **5.3**: Tipos principales derivados de la DB en `types/index.ts`:
  - Helper `NonNull<T, K>` para columnas con default DB (ej: `activo`, `is_active`, `created_at`)
  - `Profile`, `Tenant`, `Event`, `Registration` derivados con `Tables<>` + `NonNull<>`
  - `RegistrationFull`, `EventFull` derivados de vistas `v_registration_full`, `v_event_full`
  - Tipos simples: `EventQuotaRule`, `ZoneAssignmentRule`, `TenantAdmin`, etc. = `Tables<'tabla'>`
  - 44 errores de tipo corregidos en 14 archivos para compatibilidad con tipos nullable de la DB
- **5.4**: Eliminadas interfaces locales `Tenant`/`Event` en SA Eventos → importan de `@/types`
- **5.5**: `STATUS_MAP` centralizado en `types/index.ts` con `{ bg, text, icon, label }` por status
  - Reemplazado `statusConfig` inline en dashboard acreditado
  - Reemplazado `STATUS_LABELS` inline en export route
- **5.6**: Autofill unificado:
  - Creado `lib/services/autofill.ts` — módulo isomórfico sin deps de servidor
  - `buildMergedAutofillData()` acepta `Profile | Record<string, unknown>`
  - Eliminada `buildDynamicDataForProfile()` duplicada del hook `useTenantProfile`
  - `profiles.ts` re-exporta desde `autofill.ts` para backward compatibility

---

## Milestones Completados (M6–M7) y Pendientes (M8–M10)

### ✅ Milestone 6 — Optimización Vercel + Data Fetching (COMPLETADO — 17 feb 2026)
> **Prioridad**: Media · **~8 archivos + 1 SQL** · **Riesgo de regresión**: Medio-Alto  

**Resumen de cambios:**
- **6.1**: Layout acreditado → Server Component con `redirect()` + `AcreditadoShell.tsx` (client)
- **6.2**: `revalidate = 3600` en `[tenant]/layout.tsx` (caché 1h para branding)
- **6.3**: `revalidatePath()` en POST/PATCH/DELETE de `/api/tenants` y `/api/events`
- **6.4**: Función SQL `check_and_create_registration` (atómica con `FOR UPDATE`) + índice único `uq_registration_event_profile`. `createRegistration()` migrada a usar RPC.
- **6.5**: Edge Runtime en `/api/superadmin/stats` y `/api/qr/validate`
- **6.6**: Build verificado ✅

#### Paso 6.1 — Páginas acreditado → Server Components
```
✏️ Editar: app/acreditado/page.tsx
✏️ Editar: app/acreditado/nueva/page.tsx
```
Ambas hacen auth check client-side → convertir a Server Component con `redirect()`.

```typescript
// ANTES (client):
'use client';
useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (!data.user) router.push('/auth/acreditado'); }); }, []);

// DESPUÉS (server):
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/acreditado');
  return <ClientComponent user={user} />;
}
```

#### Paso 6.2 — Caché de tenant data
```
✏️ Editar: app/[tenant]/layout.tsx
```
```typescript
export const revalidate = 3600; // Cachear datos del tenant 1 hora
```

#### Paso 6.3 — Revalidación tras mutaciones
```
✏️ Editar: API routes de POST/PATCH/DELETE
```
Agregar `revalidatePath()` o `revalidateTag()` después de mutaciones
en vez del patrón manual `loadData()` en el client.

#### Paso 6.4 — Race condition en cupos (SQL transaccional)
```
📁 Crear: supabase-refactor-quota-check.sql
```
```sql
CREATE OR REPLACE FUNCTION check_and_create_registration(
  p_event_id UUID, p_profile_id UUID, p_cargo TEXT, ...
) RETURNS UUID AS $$
DECLARE v_count INT; v_max INT; v_id UUID;
BEGIN
  -- Lock + check + insert en una transacción atómica
  SELECT max_global INTO v_max FROM event_quota_rules WHERE ...;
  SELECT COUNT(*) INTO v_count FROM registrations WHERE ...;
  IF v_count >= v_max THEN RAISE EXCEPTION 'Cupo lleno'; END IF;
  INSERT INTO registrations (...) VALUES (...) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
```

#### Paso 6.5 — Evaluar Edge Runtime
```
✏️ Editar: app/api/superadmin/stats/route.ts (y similares)
```
```typescript
export const runtime = 'edge'; // Solo para routes que no usen Node APIs
```
Candidatos: stats, QR validate, tenant lookup. **No candidatos**: export (ExcelJS requiere Node).

#### Paso 6.6 — Verificación final M6
```bash
npx next build
# Verificar en Vercel que rutas edge funcionen
# Test de concurrencia: 2 registros simultáneos al mismo cupo
# Verificar que caché de tenant se invalide correctamente
```

---

### ✅ Milestone 7 — Testing (COMPLETADO — 17 feb 2026)
> **Prioridad**: Alta · **~20+ archivos nuevos** · **Riesgo de regresión**: Ninguno  
> **Resultado**: 166 tests, 17 suites, coverage `lib/` 88%

El proyecto tenía **0 tests** antes de M7. Con la base de código estabilizada tras M1–M6,
se agregó cobertura de tests. **166 tests** en 17 suites, todos passing.

#### Paso 7.1 — Setup del framework de testing
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```
```
📁 Crear: vitest.config.ts
📁 Crear: tests/setup.ts          ← Setup global (mocks de Supabase, env vars)
```

Configuración:
- **Vitest** como test runner (compatible con Vite/Turbopack)
- **@testing-library/react** para tests de componentes
- **jsdom** como environment para DOM
- Path aliases `@/` funcionando en tests

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**', 'components/**', 'hooks/**', 'app/api/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

#### Paso 7.2 — Tests unitarios de servicios (prioridad alta)

Servicios puros con lógica de negocio — alto valor, fácil de testear con mocks de Supabase.

```
📁 Crear: tests/services/
├── profiles.test.ts             ← lookupProfileByRut, getOrCreateProfile, computeTenantProfileStatus
├── autofill.test.ts             ← buildMergedAutofillData (isomórfico, sin mocks)
├── registrations.test.ts        ← bulkUpdateStatus, getRegistrationStats
├── tenants.test.ts              ← listTenants, createTenant
├── auth.test.ts                 ← getUserTenantRole, getCurrentUser
├── quotas.test.ts               ← checkQuota, getQuotaRules
├── requireAuth.test.ts          ← requireAuth helper (401, 403, success paths)
└── validation.test.ts           ← validateRut, validación de formularios
```

**Prioridad de cobertura:**
1. `requireAuth.ts` — seguridad, debe tener 100% coverage
2. `autofill.ts` — lógica pura, 0 deps → test directo sin mocks
3. `profiles.ts` — core del formulario diferencial
4. `registrations.ts` — bulk operations, stats
5. `validation.ts` — validación RUT, campos requeridos

#### Paso 7.3 — Tests unitarios de utilidades

```
📁 Crear: tests/lib/
├── dates.test.ts                ← Timezone Chile, DST, formateo
├── colors.test.ts               ← Palette generator, WCAG contrast
└── validation.test.ts           ← Validación de RUT con dígito verificador
```

#### Paso 7.4 — Tests de hooks

```
📁 Crear: tests/hooks/
├── useProfileLookup.test.ts     ← Lookup por RUT con debounce
├── useQuotaCheck.test.ts        ← Verificación de cupos
├── useTenantProfile.test.ts     ← Autofill + profile status
└── useConfirmation.test.ts      ← Modal de confirmación
```

Requiere mock de `getSupabaseBrowserClient()` y `renderHook()` de testing-library.

#### Paso 7.5 — Tests de API routes (integración)

```
📁 Crear: tests/api/
├── registrations.test.ts        ← CRUD + auth checks (403 sin auth)
├── events.test.ts               ← CRUD + quotas + zones
├── export.test.ts               ← Export con auth, filtro por tenant
├── bulk.test.ts                 ← Bulk parse + bulk accreditation
├── tenants.test.ts              ← CRUD + admin management
└── auth.test.ts                 ← Callback, session
```

Estrategia: llamar las funciones GET/POST directamente con `Request` mockeado,
verificar status codes y response bodies.

#### Paso 7.6 — Tests de componentes (opcional, menor prioridad)

```
📁 Crear: tests/components/
├── RegistrationWizard.test.tsx  ← Navegación entre pasos
├── AdminTable.test.tsx          ← Renderizado de filas, filtros
└── StepAcreditados.test.tsx     ← Agregar/eliminar miembros de equipo
```

#### Paso 7.7 — CI + Coverage

```
📁 Crear: .github/workflows/test.yml
```

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npx vitest run --coverage
      - run: npx next build
```

Scripts en `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### Paso 7.8 — Meta de cobertura

| Área | Meta | Justificación |
|------|------|---------------|
| `lib/services/requireAuth.ts` | 100% | Seguridad crítica |
| `lib/services/autofill.ts` | 100% | Lógica pura, 0 deps |
| `lib/validation.ts` | 100% | Validación RUT |
| `lib/services/*.ts` | ≥80% | Lógica de negocio core |
| `hooks/*.ts` | ≥70% | Lógica client-side |
| `app/api/**` | ≥60% | Auth + response codes |
| `components/**` | ≥40% | Menor prioridad, más frágil |
| **Global** | **≥70%** | — |

---

### ⬜ Milestone 8 — Seguridad II + Validación de Input
> **Prioridad**: Alta · **~15 archivos** · **Riesgo de regresión**: Medio  
> **Tiempo estimado**: 1-2 sesiones

M1 protegió las rutas principales, pero la auditoría del 17 feb encontró **rutas adicionales
sin protección**, XSS en emails y **ausencia total de validación de input**.

#### Paso 8.1 — Auth faltante en rutas restantes
```
✏️ Editar: app/api/upload/route.ts                    ← Agregar requireAuth({ role: 'superadmin' })
✏️ Editar: app/api/email/templates/route.ts            ← Agregar requireAuth() en GET/POST
✏️ Editar: app/api/email/zone-content/route.ts         ← Agregar requireAuth() en GET/POST/DELETE
✏️ Editar: app/api/profiles/lookup/route.ts            ← Agregar requireAuth() en POST
✏️ Editar: app/api/registrations/[id]/route.ts         ← Agregar ownership check en DELETE y PATCH
✏️ Editar: app/api/events/route.ts                     ← Verificar admin del tenant en POST
✏️ Editar: app/api/tenants/route.ts                    ← Proteger ?all=true y ?withStats=true
```

#### Paso 8.2 — Sanitización XSS en emails
```
npm install dompurify @types/dompurify
```
```
✏️ Editar: lib/services/email.ts
```
Sanitizar `vars.nombre`, `vars.organizacion` y otros campos interpolados en `replaceVars()`:
```typescript
import DOMPurify from 'dompurify';

function replaceVars(html: string, vars: EmailVars): string {
  const safe = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, DOMPurify.sanitize(v)])
  );
  return html
    .replace(/\{nombre\}/g, safe.nombre)
    .replace(/\{organizacion\}/g, safe.organizacion)
    // ...
}
```

#### Paso 8.3 — DOMPurify en preview de emails (admin)
```
✏️ Editar: components/admin-dashboard/AdminMailTab.tsx       ← Sanitizar antes de dangerouslySetInnerHTML
✏️ Editar: components/admin-dashboard/AdminMailZones.tsx     ← Idem
```
```typescript
import DOMPurify from 'dompurify';
// ...
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
```

#### Paso 8.4 — Validación de input con Zod
```
npm install zod
```
Crear schemas para cada endpoint mutador:
```
📁 Crear: lib/schemas/
├── registration.ts     ← CreateRegistrationSchema, UpdateRegistrationSchema
├── event.ts            ← CreateEventSchema, UpdateEventSchema
├── tenant.ts           ← CreateTenantSchema, UpdateTenantSchema
├── email.ts            ← EmailTemplateSchema, ZoneContentSchema
└── index.ts            ← Barrel export
```

Patrón de uso en cada route:
```typescript
import { CreateRegistrationSchema } from '@/lib/schemas';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }
  // usar parsed.data (tipado automático)
}
```

#### Paso 8.5 — Rate limiting
```
npm install @upstash/ratelimit @upstash/redis
```
Crear middleware de rate limiting:
```
📁 Crear: lib/rateLimit.ts
```
Aplicar en rutas críticas:
- `POST /api/registrations` — 10 req/min por IP
- `POST /api/bulk-accreditation` — 2 req/min por IP
- `POST /api/upload` — 5 req/min por usuario
- `POST /api/qr/validate` — 30 req/min por IP (anti brute-force)
- `POST /api/email/*` — 5 req/min por usuario

#### Paso 8.6 — Reactivar validación RUT
```
✏️ Editar: lib/validation.ts
```
Descomentar la validación del dígito verificador (actualmente en "modo prueba"):
```typescript
// ANTES:
// Validación de dígito verificador DESACTIVADA (modo prueba)

// DESPUÉS:
if (computedDv !== providedDv) return false;
```

#### Paso 8.7 — Verificación final M8
```bash
npx next build
npx vitest run
# Test manual: intentar acceder a /api/upload sin auth → 401
# Test manual: inyectar <script> en nombre de usuario → no ejecuta
# Test manual: enviar body con campos faltantes → 400 con detalles Zod
```

---

### ⬜ Milestone 9 — Performance UI + Accesibilidad
> **Prioridad**: Media · **~12 archivos** · **Riesgo de regresión**: Medio  
> **Tiempo estimado**: 1-2 sesiones

La tabla admin con 500+ registros tiene problemas de rendimiento significativos,
y los modales carecen de accesibilidad básica (WCAG 2.1 AA).

#### Paso 9.1 — `React.memo` en `AdminRow`
```
✏️ Editar: components/admin-dashboard/AdminRow.tsx
```
```typescript
// ANTES:
export default function AdminRow({ ... }) { ... }

// DESPUÉS:
function AdminRowInner({ ... }) { ... }
export default React.memo(AdminRowInner);
```
Memoizar también `zonaOptions` con `useMemo`.

#### Paso 9.2 — Virtualización de tabla
```
npm install @tanstack/react-virtual
```
```
✏️ Editar: components/admin-dashboard/AdminTable.tsx
```
Usar `useVirtualizer` para renderizar solo las filas visibles:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: filteredRows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 56, // altura estimada de fila
});
```

#### Paso 9.3 — Eliminar `window.location.reload()`
```
✏️ Editar: components/admin-dashboard/AdminConfigTab.tsx      ← 5 ocurrencias → fetchData()
✏️ Editar: components/admin-dashboard/AdminAccreditationControl.tsx  ← 1 ocurrencia → fetchData()
```
Reemplazar cada `window.location.reload()` con la función `fetchData()` del `AdminContext`.

#### Paso 9.4 — `React.cache()` en tenant lookup
```
✏️ Editar: lib/services/tenants.ts
```
```typescript
import { cache } from 'react';

export const getTenantBySlug = cache(async (slug: string) => {
  // ...query existente
});
```
Esto deduplica las 2 llamadas en `[tenant]/layout.tsx` y `[tenant]/page.tsx` dentro del mismo request.

#### Paso 9.5 — Accesibilidad del Modal
```
✏️ Editar: components/shared/ui.tsx
```
Agregar al componente `Modal`:
- `role="dialog"` y `aria-modal="true"`
- `aria-labelledby` apuntando al título
- Handler de `Escape` para cerrar
- Focus trap (primer elemento focusable al abrir, devolver foco al cerrar)
- `onKeyDown` para mantener foco dentro del modal con Tab/Shift+Tab

```typescript
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [onClose]);
```

#### Paso 9.6 — Labels de accesibilidad
```
✏️ Editar: components/admin-dashboard/AdminAccreditationControl.tsx  ← aria-label en toggles
✏️ Editar: components/admin-dashboard/AdminRow.tsx                    ← <label> en <select>
✏️ Editar: components/admin-dashboard/AdminTable.tsx                  ← <label> en filtros
```

#### Paso 9.7 — Spinner unificado
```
✏️ Editar: components/shared/ui.tsx        ← Agregar prop `size` y `color` a LoadingSpinner
```
Reemplazar las 4+ implementaciones inline de spinner por `<LoadingSpinner />`:
```
✏️ Editar: app/acreditado/page.tsx
✏️ Editar: app/acreditado/dashboard/page.tsx
✏️ Editar: app/auth/acreditado/page.tsx
✏️ Editar: app/auth/callback/page.tsx
```

#### Paso 9.8 — Font Awesome self-hosted (opcional)
```
✏️ Editar: app/layout.tsx
```
Reemplazar CDN por self-hosted o `@fortawesome/fontawesome-svg-react` con tree-shaking.
Esto elimina un request externo bloqueante.

#### Paso 9.9 — Verificación final M9
```bash
npx next build
npx vitest run
# Test manual: abrir tabla con 500+ registros — verificar fluidez de scroll
# Test manual: navegar modal con teclado (Tab, Shift+Tab, Escape)
# Test manual: verificar que no hay full page reload al cambiar configuración
```

---

### ⬜ Milestone 10 — Arquitectura + Calidad de Código
> **Prioridad**: Media-Baja · **~20 archivos** · **Riesgo de regresión**: Bajo  
> **Tiempo estimado**: 2-3 sesiones

Mejoras de mantenibilidad, consistencia de patrones y expansión de test coverage.

#### Paso 10.1 — Dividir `AdminConfigTab.tsx` (700 líneas)
```
components/admin-dashboard/
├── AdminConfigTab.tsx          ← Orquestador reducido (~150 líneas)
├── EventListSection.tsx        📁 ← Lista de eventos con acciones
├── EventFormModal.tsx          📁 ← Modal crear/editar evento
├── TenantInfoSection.tsx       📁 ← Información del tenant (slug, dominio, etc.)
└── EventCloneDialog.tsx        📁 ← Diálogo de clonación de eventos
```

#### Paso 10.2 — Reducir props de `StepAcreditados` (31+ props)
Crear un contexto del wizard:
```
📁 Crear: components/forms/registration/WizardContext.tsx
```
```typescript
const WizardContext = createContext<WizardContextType | null>(null);
export const useWizard = () => useContext(WizardContext)!;
```
Los steps acceden a estado vía `useWizard()` en vez de recibir 31 props.

#### Paso 10.3 — `app/page.tsx` → Server Component híbrido
```
✏️ Editar: app/page.tsx
```
Convertir a Server Component con fetch de tenants en el server y parte interactiva en un client component:
```typescript
// app/page.tsx (Server Component)
export default async function HomePage() {
  const tenants = await listTenants();
  return <HomeClient tenants={tenants} />;
}

// app/HomeClient.tsx (Client Component)
'use client';
export default function HomeClient({ tenants }: { tenants: Tenant[] }) {
  // Estado interactivo, animaciones, etc.
}
```
Beneficio: SEO de la landing marketing, mejor FCP/LCP.

#### Paso 10.4 — Limpiar código muerto residual
```
🗑️ Eliminar: components/admin-dashboard/AdminFilters.tsx     ← No se importa
🗑️ Eliminar: components/admin/                               ← Directorio vacío
🗑️ Eliminar: app/auth/layout.tsx                              ← Pass-through innecesario
🗑️ Eliminar: lib/supabase.ts                                  ← Cliente legacy (si aún existe)
✏️ Editar: types/index.ts                                     ← Eliminar STATUS_COLORS deprecated
✏️ Editar: app/[tenant]/TenantLanding.tsx                     ← Eliminar código comentado (L329-337)
✏️ Editar: app/superadmin/(dashboard)/configuracion/page.tsx  ← Eliminar variable supabase sin uso
```

#### Paso 10.5 — Unificar patrón de auth en API routes
Migrar **todas** las rutas que usan `getCurrentUser()` manual a `requireAuth()`:
```
✏️ Editar: app/api/registrations/[id]/route.ts
✏️ Editar: app/api/events/route.ts
✏️ Editar: app/api/tenants/route.ts
✏️ Editar: app/api/bulk/route.ts
✏️ Editar: app/api/bulk-accreditation/route.ts
✏️ Editar: app/api/teams/route.ts
```

#### Paso 10.6 — Unificar formato de respuesta API
Establecer convención:
```typescript
// Éxito con datos:
NextResponse.json({ data: result }, { status: 200 });

// Éxito sin datos:
NextResponse.json({ success: true }, { status: 200 });

// Error:
NextResponse.json({ error: 'Mensaje descriptivo' }, { status: 4xx });
```
Eliminar inconsistencias (`{ ok: true }`, `{ found: true }`, entidad directa).

#### Paso 10.7 — Rutas REST convencionales
Crear route files dinámicos para events y tenants:
```
📁 Crear: app/api/events/[id]/route.ts    ← PATCH/DELETE (actualmente en /api/events?id=xxx)
📁 Crear: app/api/tenants/[id]/route.ts   ← PATCH (actualmente en /api/tenants?id=xxx)
```
Mover la lógica de PATCH/DELETE desde las rutas de colección.

#### Paso 10.8 — Nombres de rutas bulk más claros
```
📁 Renombrar: app/api/bulk/route.ts            → app/api/registrations/bulk-status/route.ts
📁 Renombrar: app/api/bulk-accreditation/route.ts → app/api/registrations/bulk-create/route.ts
📁 Renombrar: app/api/bulk/parse/route.ts      → app/api/registrations/bulk-parse/route.ts
```

#### Paso 10.9 — Usar `.upsert()` en vez de SELECT+IF+INSERT/UPDATE
```
✏️ Editar: app/api/email/zone-content/route.ts
✏️ Editar: app/api/email/templates/route.ts
```
```typescript
// ANTES (3 queries):
const { data: existing } = await supabase.from('email_zone_content').select('id')...
if (existing) { /* update */ } else { /* insert */ }

// DESPUÉS (1 query):
const { data } = await supabase.from('email_zone_content').upsert({ ... }, { onConflict: 'event_id,zone' });
```

#### Paso 10.10 — Tipar campos JSONB
```
✏️ Editar: types/index.ts
```
Aplicar `TenantConfig` y `EventConfig` a los tipos base:
```typescript
// ANTES:
export type Tenant = NonNull<Tables<'tenants'>, 'activo' | 'created_at'>;
// config es Record<string, unknown> (heredado de la DB)

// DESPUÉS:
export type Tenant = Omit<NonNull<Tables<'tenants'>, 'activo' | 'created_at'>, 'config'> & {
  config: TenantConfig;
};
```
Hacer lo mismo para `Event.config`, `datos_extra`, `datos_base` con interfaces específicas.

#### Paso 10.11 — Reemplazar hover inline por CSS
```
✏️ Editar: app/[tenant]/TenantLanding.tsx
```
Reemplazar `onMouseEnter`/`onMouseLeave` con CSS custom properties + `:hover`:
```css
/* Ya se puede hacer con CSS vars del tenant */
.tenant-btn:hover { background-color: var(--color-primary-hover); }
```

#### Paso 10.12 — Colores design tokens en superadmin
```
✏️ Editar: app/superadmin/(dashboard)/layout-client.tsx
```
Reemplazar `bg-gray-900`, `text-gray-400`, `border-gray-800` por tokens semánticos.

#### Paso 10.13 — SuperAdmin sidebar responsive
```
✏️ Editar: app/superadmin/(dashboard)/layout-client.tsx
```
Agregar menú hamburguesa para mobile:
```typescript
const [sidebarOpen, setSidebarOpen] = useState(false);
// ...
<button className="md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
  <i className="fas fa-bars" />
</button>
```

#### Paso 10.14 — SQL migrations con herramienta formal
Migrar archivos SQL sueltos a `supabase db migration`:
```bash
supabase migration new initial_schema
# Mover contenido de supabase-v2-complete.sql
# ...
supabase migration list    # Verificar orden
```
Esto permite rollback, tracking de estado, y CI/CD con `supabase db push`.

#### Paso 10.15 — Expandir test coverage
```
📁 Crear: tests/services/email.test.ts           ← replaceVars, sendEmail, templates
📁 Crear: tests/services/registrations.test.ts   ← createRegistration, bulkUpdateStatus
📁 Crear: tests/hooks/useProfileLookup.test.ts
📁 Crear: tests/hooks/useQuotaCheck.test.ts
📁 Crear: tests/hooks/useTenantProfile.test.ts
📁 Crear: tests/components/RegistrationWizard.test.tsx
📁 Crear: tests/components/AdminTable.test.tsx
```
Actualizar `vitest.config.ts` para incluir `app/api/**` en coverage.

#### Paso 10.16 — Auth guard centralizado para admin tenant
```
📁 Crear: app/[tenant]/admin/layout.tsx
```
```typescript
export default async function AdminLayout({ children, params }: { children: ReactNode; params: { tenant: string } }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${params.tenant}/admin/login`);
  // verificar rol admin_tenant
  return <>{children}</>;
}
```
Esto elimina auth checks duplicados en `page.tsx` y `scanner/page.tsx`.

#### Paso 10.17 — Verificación final M10
```bash
npx next build
npx vitest run --coverage
# Verificar que API responses siguen el formato unificado
# Verificar que PATCH /api/events/[id] funciona
# Verificar coverage ≥70% global
```

---

## Orden de Ejecución

```
Sesión 1   →  M1  (Seguridad)                    ███████████████  ✅ COMPLETADO
Sesión 2   →  M2  (Client unificado + limpieza)   ████████████     ✅ COMPLETADO
Sesión 3   →  M3  (Performance queries)            ██████████       ✅ COMPLETADO
Sesión 4   →  M4  (Decomposición componentes)      ████████         ✅ COMPLETADO
Sesión 5   →  M5  (Tipado fuerte)                  ██████           ✅ COMPLETADO
Sesión 6   →  M6  (Optimización Vercel)            ██████           ✅ COMPLETADO
Sesión 7   →  M7  (Testing)                        ████████         ✅ COMPLETADO
Sesión 8   →  M8  (Seguridad II + Validación)      ████████████     ✅ COMPLETADO
Sesión 8b  →  M12 (Bug Cruce Datos Tenants)         ████████████████ ✅ COMPLETADO
Sesión 9   →  M13 (Flujo Auth Completo)             ██████████       ⬜ PENDIENTE
Sesión 10  →  M9  (Performance UI + A11y)           ██████████       ⬜ PENDIENTE
Sesión 11  →  M10 (Arquitectura + Calidad)          ████████         ⬜ PENDIENTE
Sesión 12  →  M14 (Eliminación de Tenants)          ██████           ⬜ PENDIENTE
Sesión 13  →  M15 (UX SuperAdmin Eventos)           ████             ⬜ PENDIENTE
Sesión 14  →  M11 (QR Check-in Móvil)              ██████           ⬜ PENDIENTE
Sesión 15  →  M16 (Billing Admin Tenant)            ████████████     ⬜ PENDIENTE
Sesión 16  →  M17 (Eventos Públicos/Privados)       ██████           ⬜ PENDIENTE
Sesión 17  →  M18 (UX Feedback: Toasts+Modales)     ████████         ✅ COMPLETADO — 19 feb 2026
Sesión 17b →  M19 (UX Formulario Acreditación)      ████████████     ⬜ PENDIENTE
Sesión 18  →  M20 (Gate Perfil → Equipo)             ██████           ✅ COMPLETADO — 18 feb 2026
```

Cada sesión termina con `npx next build` exitoso y commit independiente.

---

## Checklist de Verificación por Milestone

### M1 — Seguridad ✅
- [x] Helper `requireAuth()` creado y testeado
- [x] `GET /api/admin/export` protegido
- [x] `GET /api/registrations` protegido
- [x] `GET /api/registrations/[id]` protegido
- [x] `POST/DELETE /api/events/[id]/quotas` protegido
- [x] `POST/DELETE /api/events/[id]/zones` protegido
- [x] `GET/POST /api/tenants/[id]/admins` protegido
- [x] Build exitoso

### M2 — Cliente unificado ✅
- [x] Singleton `getSupabaseBrowserClient()` simplificado
- [x] 12 archivos migrados al singleton
- [x] Código muerto eliminado (AdminDashboard.tsx, .bak, legacy supabase)
- [x] Import `CookieOptions` removido
- [x] `grep "createBrowserClient"` retorna 0 (fuera de lib/supabase)
- [x] Build exitoso

### M3 — Performance ✅
- [x] Vista `v_tenant_stats` creada en Supabase
- [x] `listTenants()` usa la vista (1 query)
- [x] `bulkUpdateStatus()` usa `.in()` batch
- [x] `getRegistrationStats()` usa COUNT
- [x] `getUserTenantRole()` en 1 query
- [x] ExcelJS parsing en API route server-side
- [x] Build exitoso

### M4 — Decomposición ✅
- [x] `DynamicRegistrationForm` dividido en 8 archivos
- [x] SA eventos page dividida en 5 archivos
- [x] `globals.css` dividido en 4 archivos
- [x] Formulario de acreditación funciona completo
- [x] SA eventos CRUD + tabs funcionales
- [x] Build exitoso

### M5 — Tipado fuerte ✅
- [x] `database.types.ts` generado (1,071 líneas)
- [x] Clientes Supabase tipados con `Database`
- [x] Tipos principales derivados de la DB con `NonNull<>` helper
- [x] Interfaces locales eliminadas
- [x] `STATUS_MAP` centralizado
- [x] Autofill unificado en `lib/services/autofill.ts` (isomórfico)
- [x] Build exitoso

### M6 — Optimización Vercel ✅
- [x] Layout acreditado → Server Component + AcreditadoShell.tsx
- [x] Caché de tenant con `revalidate = 3600`
- [x] `revalidatePath` tras mutaciones en tenants y events
- [x] Función SQL `check_and_create_registration` (atómica, FOR UPDATE)
- [x] Índice único `uq_registration_event_profile`
- [x] Edge runtime en stats y QR validate
- [x] Build exitoso

### M7 — Testing ✅ (Completado — 17 feb 2026)

**Fase 1 — Unit tests base (76 → 102 tests)**
- [x] Vitest + testing-library + jsdom configurado
- [x] Tests de `requireAuth` — 9 tests, 100% branch coverage
- [x] Tests de `autofill.ts` — 9 tests, 100% lógica pura
- [x] Tests de `validation.ts` — 27 tests (RUT, email, teléfono, sanitize)
- [x] Tests de `dates.ts` — 18 tests (timezone Chile, deadline, formatting)
- [x] Tests de `colors.ts` — 5 tests (palette generation, CSS vars)
- [x] Tests de `quotas.ts` — 4 tests (motor de cupos con mocks)
- [x] Tests de `useConfirmation` hook — 4 tests
- [x] Tests de `profiles.ts` — 8 tests (computeTenantProfileStatus)
- [x] Tests de API `registrations` — 8 tests (POST validation/auth/201/409, GET)
- [x] Tests de API `teams` — 10 tests (GET/POST/DELETE auth + validation)

**Fase 2 — API routes + servicios + CI (102 → 138 tests)**
- [x] Tests de API `tenants` — 8 tests (GET active/all, POST/PATCH auth + superadmin)
- [x] Tests de API `events` — 12 tests (GET filters, POST/PATCH/DELETE auth + validation)
- [x] Tests de `zones.ts` — 10 tests (resolveZone priority, CRUD, errors)
- [x] Tests de `audit.ts` — 6 tests (insert, swallow errors, getAuditLogs filtros)
- [x] CI pipeline con GitHub Actions (`.github/workflows/test.yml`)
- [x] **138 tests passing, 14 suites**
- [x] Coverage: `lib/` 88% stmts, `lib/services` key modules 95-100%

### M8 — Seguridad II + Validación ✅ (18 feb 2026)
- [x] Auth en `/api/upload`, `/api/email/templates`, `/api/email/zone-content`, `/api/profiles/lookup`, `/api/events`, `/api/tenants`
- [x] Ownership check en `DELETE /api/registrations/[id]` (via `requireAuth`)
- [x] Sanitización XSS en `buildVars()` (`lib/services/email.ts`) — `escapeHtml()`, `safeColor()`, `safeUrl()`
- [x] `sanitizeHtml()` en `dangerouslySetInnerHTML` (AdminMailTab, AdminMailZones) — `lib/sanitize.ts`
- [x] Schemas Zod para todas las rutas POST/PATCH — `lib/schemas/index.ts`
- [x] Reactivar validación dígito verificador RUT (`lib/validation.ts`)
- [x] Path traversal fix en upload (`ALLOWED_FOLDERS` whitelist, `ALLOWED_EXTS`)
- [x] Profile POST: user_id desde sesión, no del body (previene impersonación)
- [x] 29 tests nuevos (security-m8.test.ts) + tests existentes actualizados
- [x] **204 tests passing, 19 suites** — Build exitoso

### M9 — Performance UI + Accesibilidad ⬜
- [ ] `React.memo` en `AdminRow`
- [ ] Virtualización de tabla con `@tanstack/react-virtual`
- [ ] Eliminar 6x `window.location.reload()` → `fetchData()`
- [ ] `React.cache()` en `getTenantBySlug`
- [ ] Modal: `role="dialog"`, `aria-modal`, focus trap, Escape
- [ ] Labels de accesibilidad en toggles y selects
- [ ] Spinner unificado (`LoadingSpinner` en todas las páginas)
- [ ] Font Awesome self-hosted (opcional)
- [ ] Build exitoso

### M10 — Arquitectura + Calidad ⬜
- [ ] Dividir `AdminConfigTab.tsx` (700 líneas) en 4 subcomponentes
- [ ] Reducir props de `StepAcreditados` con `WizardContext`
- [ ] `app/page.tsx` → Server Component híbrido (SEO)
- [ ] Eliminar código muerto (AdminFilters, STATUS_COLORS, auth/layout, components/admin/, lib/supabase.ts)
- [ ] Unificar patrón auth: todas las rutas con `requireAuth()`
- [ ] Unificar formato respuesta API (`{ data }` / `{ success }` / `{ error }`)
- [ ] Rutas REST convencionales: `/api/events/[id]`, `/api/tenants/[id]`
- [ ] Renombrar rutas bulk: `registrations/bulk-create`, `registrations/bulk-status`
- [ ] `.upsert()` en email templates y zone-content
- [ ] Tipar campos JSONB (aplicar `TenantConfig`/`EventConfig` a tipos base)
- [ ] Reemplazar `onMouseEnter`/`onMouseLeave` por CSS `:hover`
- [ ] Colores design tokens en superadmin sidebar
- [ ] SuperAdmin sidebar responsive
- [ ] SQL migrations con `supabase db migration`
- [ ] Auth guard centralizado en `[tenant]/admin/layout.tsx`
- [ ] Expandir tests: componentes React, servicios faltantes, hooks, E2E
- [ ] Incluir `app/api/**` en vitest coverage
- [ ] Build exitoso

### M12 — Bug Cruce Datos entre Tenants ✅
- [x] Función `getTeamMembersForEvent()` con enriquecimiento por tenant/evento
- [x] API `/api/teams` acepta `event_id` opcional en GET
- [x] `useRegistrationForm.ts` pasa `event_id` al cargar equipo
- [x] `handleAddFromTeam` / `handleAddAllTeam` usan `dynamicData.cargo` (tenant-scoped)
- [x] Vista SQL `v_team_event_enriched` + índice en registrations(profile_id, event_id)
- [x] Tests de aislamiento entre tenants (6 tests)
- [x] Tests API actualizados (11 tests, +1 nuevo)
- [x] 173 tests passing, 18 suites
- [x] Build exitoso

### M13 — Flujo Completo de Autenticación ⬜
- [ ] "Olvidé contraseña" en login acreditado
- [ ] "Olvidé contraseña" en login superadmin
- [ ] "Olvidé contraseña" en login admin tenant
- [ ] Callback de recovery con formulario de nueva contraseña
- [ ] Cambio de contraseña en perfil acreditado
- [ ] Crear admin con contraseña temporal + email de bienvenida
- [ ] Forzar cambio de contraseña en primer login de admin
- [ ] Tests del flujo auth
- [ ] Build exitoso

### M14 — Eliminación de Tenants ⬜
- [ ] Verificar/completar cascadas SQL
- [ ] Función `deleteTenant()` con cleanup de storage y auth users
- [ ] Endpoint `DELETE /api/tenants/[id]` (requiere superadmin)
- [ ] UI con doble confirmación (escribir nombre del tenant)
- [ ] Tests de eliminación en cascada
- [ ] Build exitoso

### M15 — UX SuperAdmin Eventos ⬜
- [ ] Filtro por tenant en página de eventos
- [ ] Agrupación visual por tenant (headers con color)
- [ ] Filtro por estado activo/inactivo
- [ ] Búsqueda por nombre de evento
- [ ] Contadores en barra de filtros
- [ ] Build exitoso

### M16 — Billing Admin Tenant ⬜
- [ ] Schema SQL: tablas `plans`, `subscriptions`, `usage_records`
- [ ] Servicio `billing.ts` con `checkLimit()`, `getUsageSummary()`
- [ ] Enforcement en POST de events, registrations, admins
- [ ] API de billing (plan actual, planes disponibles, cambiar plan)
- [ ] Tab Billing en dashboard admin_tenant
- [ ] Gestión de planes en superadmin
- [ ] Asignación automática de plan free al crear tenant
- [ ] Notificaciones de límite (80%)
- [ ] Placeholder de pasarela de pago
- [ ] Tests de billing
- [ ] Build exitoso

### M17 — Eventos Públicos / Privados (por Invitación) ⬜
- [ ] Columna `visibility` en tabla `events` (`'public' | 'private' | 'invite_only'`)
- [ ] UI toggle en formulario de evento (admin_tenant + superadmin)
- [ ] Evento `private` / `invite_only` → no aparece en landing público del tenant
- [ ] Evento `invite_only` → requiere link directo con token o lista de invitados
- [ ] Schema SQL: tabla `event_invitations` (event_id, email, token, accepted_at)
- [ ] Servicio `invitations.ts` con `createInvitation()`, `validateInviteToken()`
- [ ] API `POST /api/events/[id]/invite` — enviar invitación por email
- [ ] API `GET /api/events/[id]/invite?token=xxx` — validar token de invitación
- [ ] Formulario de acreditación valida visibilidad antes de mostrar
- [ ] Admin puede ver lista de invitados y estados (enviado, aceptado, rechazado)
- [ ] Tests de visibilidad y tokens
- [ ] Build exitoso

### M18 — UX Feedback: Toasts + Modales ✅
- [x] Migrar todos los `setMessage()`/`setError()` inline a toasts de Sileo — 10 archivos migrados
- [x] Reemplazar `confirm()` nativo por `useConfirmation` hook + `ConfirmDialog` (equipo/page.tsx)
- [x] `ConfirmDialog` mejorado con a11y: role=dialog, aria-modal, Escape, focus trap, body scroll lock, iconos por variante
- [x] Sileo Toaster ya configurado globalmente en `SileoProvider` (root layout)
- [x] `ButtonSpinner` usado en acciones asíncronas (equipo/page.tsx)
- [x] Notificaciones contextuales en: perfil, equipo, auth, admin login, superadmin (config, admins, tenants, eventos, login)
- [x] Eliminados legacy `<Toast>` en 3 páginas superadmin + mensajes inline en configuracion
- [x] `fireToast()` helper en `useRegistrationForm.ts` para toasts sin hook React
- [x] Auditoría completa: acreditado (perfil, equipo), auth/acreditado, admin login, superadmin (5 páginas), registration form
- [x] 11 tests ConfirmDialog + 4 tests useConfirmation = 15 tests UX
- [x] 230 tests passing, 21 suites
- [x] Build exitoso

### M19 — UX Formulario de Acreditación ⬜
- [ ] Rediseñar modal de confirmación de acreditados — layout responsivo que no se descuadre
- [ ] Mejorar visualización de datos en el modal: tabla con columnas alineadas
- [ ] Scroll interno en modal cuando hay muchos acreditados (max-height + overflow)
- [ ] Indicadores de validación claros: campos con error marcados en rojo con tooltip
- [ ] Paso de acreditados: mejorar UX de agregar/eliminar miembros (animaciones, feedback)
- [ ] Preview de datos antes de enviar: resumen claro de quién se acredita
- [ ] Responsive: formulario usable en móvil sin overflow ni scroll horizontal
- [ ] Loading state claro durante envío (progress indicator si son múltiples)
- [ ] Mensaje de éxito post-envío con resumen y link a dashboard
- [ ] Tests de componentes del formulario
- [ ] Build exitoso

### M20 — Gate de Perfil Completo para Equipo ✅
- [x] Definir campos requeridos del perfil: nombre, apellido, medio, tipo_medio → `lib/profile.ts`
- [x] `isProfileComplete()` + `getMissingProfileFields()` + `REQUIRED_PROFILE_FIELDS` en `lib/profile.ts`
- [x] En `/acreditado/equipo`: banner bloqueante si perfil incompleto → oculta contenido
- [x] Banner con lista de campos faltantes + botón "Completar Perfil" → link a `/acreditado/perfil?from=equipo`
- [x] En `/acreditado/perfil`: labels "⚠ Requerido" + borde warning en campos faltantes
- [x] Banner contextual cuando viene de equipo: "Completa los campos marcados"
- [x] Auto-redirect a `/acreditado/equipo` tras guardar perfil completo (si `from=equipo`)
- [x] Toast Sileo en éxito/error al guardar perfil (reemplaza solo setMessage)
- [x] Herencia medio/tipo_medio validada (profileMedio/profileTipoMedio ya forzados)
- [x] 15 tests (isProfileComplete, getMissingProfileFields, REQUIRED_PROFILE_FIELDS)
- [x] 219 tests passing, 20 suites
- [x] Build exitoso

---

## Lo que Ya Está Bien

### Arquitectura original (no tocado)
- ✅ **Arquitectura tenant por subdominio** con `proxy.ts` — limpio y correcto para Next.js 16
- ✅ **Server Components** en `[tenant]/layout.tsx`, `[tenant]/page.tsx`, `[tenant]/acreditacion/page.tsx`, `[tenant]/admin/page.tsx`
- ✅ **Capa de servicios** separada de API routes — buen patrón
- ✅ **Vistas SQL** (`v_registration_full`, `v_event_full`) para datos enriquecidos
- ✅ **Sistema de colores** con palette generator y WCAG contrast checks
- ✅ **Validación de RUT** con dígito verificador
- ✅ **Timezone Chile** con manejo de DST
- ✅ **Auditoría** de acciones críticas
- ✅ **Barrel exports** en servicios y componentes admin
- ✅ **Design tokens semánticos** en CSS
- ✅ **Sistema de zonas v2** con match_field cargo/tipo_medio
- ✅ **PuntoTicket export** con acreditación fija configurable por tenant

### Mejoras de la refactorización (M1–M7)
- ✅ **Seguridad base**: Rutas API principales protegidas con `requireAuth()` (M1)
- ✅ **Client singleton**: Un solo `getSupabaseBrowserClient()` en todo el proyecto
- ✅ **Queries optimizadas**: Vista `v_tenant_stats`, batch updates, COUNT en vez de full scan
- ✅ **Componentes modulares**: Formulario wizard en 8 archivos, SA Eventos en 5 archivos
- ✅ **Tipado fuerte**: Tipos derivados de la DB con `supabase gen types`, helper `NonNull<>`
- ✅ **Autofill isomórfico**: Una sola función `buildMergedAutofillData()` para server y client
- ✅ **STATUS_MAP centralizado**: Una fuente de verdad para labels, colores e iconos de status
- ✅ **Testing**: 166 tests (17 suites), coverage `lib/` 88%
- ✅ **Optimización Vercel**: Server Components, caché, revalidación, función SQL atómica
- ✅ **CI pipeline**: GitHub Actions con build + tests automáticos

---

## Métricas de la Refactorización

| Métrica | Antes (13 feb) | Después M7 (17 feb) | Estimado post-M16 |
|---------|----------------|----------------------|--------------------|
| Líneas de código | ~16,500 | ~20,000 | ~26,000 |
| API routes | 18 | 21 | ~30 (billing, auth, tenants/[id]) |
| Servicios | 11 | 13 | ~18 (billing, passwordPolicy, schemas, rateLimit) |
| Archivos eliminados | — | 5 | ~12 (+7 código muerto residual) |
| Vulnerabilidades auth | 6 rutas | 0 (principales) | 0 (todas) |
| Rutas sin auth (secundarias) | N/A | ~8 | 0 |
| Fuga de datos cross-tenant | N/A | 1 (team_members) | 0 |
| XSS potencial | N/A | 4 puntos | 0 |
| N+1 queries | 3 lugares | 0 | 0 |
| Archivos >500 líneas | 3 | 2* | 1* |
| Tipos derivados de DB | 0 | 14 tablas + 3 vistas | +6 tablas (billing, team scope) |
| Tests | 0 | 230 (21 suites) | ~300+ (componentes + billing + auth + E2E) |
| Coverage global | 0% | ~70% lib/ | ≥75% global |
| Rate limiting | Ninguno | Ninguno | 5 rutas críticas |
| Validación input (Zod) | Ninguna | Ninguna | Todas las rutas POST/PATCH |
| Password recovery | No | No | Todos los roles |
| Tenant CRUD completo | Sin DELETE | Sin DELETE | CRUD completo + cascada |
| Billing / planes | Ninguno | Ninguno | 3 planes + enforcement + UI |

\* `useRegistrationForm.ts` (636 líneas) + `AdminConfigTab.tsx` (700 líneas, se dividirá en M10)

---

### ⬜ Milestone 11 — QR Check-in Móvil
> **Prioridad**: Media · **~6 archivos** · **Riesgo de regresión**: Bajo  
> **Tiempo estimado**: 1 sesión · **Dificultad**: Bajo-Medio

**Problema actual**: El QR enviado por email codifica un **token puro** (string hex SHA-256),
no una URL. Cuando alguien escanea el QR con la cámara del celular, el sistema operativo
no sabe qué hacer con un string de texto → lo abre como nota. El scanner actual
(`QRScanner.tsx`) solo funciona con **scanners USB/Bluetooth** que actúan como teclado.

**Solución**: Codificar una **URL de check-in** en vez del token puro, y crear una página
web que auto-procese el check-in al abrirse.

**Lo que ya existe y funciona** (no hay que tocar):
- ✅ Función SQL `validate_qr_checkin_day` — lógica completa con soporte multidía
- ✅ API `POST /api/qr/validate` — Edge Runtime, auditoría incluida
- ✅ Columnas DB: `qr_token`, `checked_in`, `checked_in_at`, `checked_in_by`
- ✅ Tabla `registration_days` para check-in por día
- ✅ Función SQL `generate_qr_token` — se ejecuta al aprobar
- ✅ Dashboard admin muestra contadores de check-in

#### Paso 11.1 — Codificar URL en el QR del email
```
✏️ Editar: lib/services/email.ts
```
Cambiar la data del QR de token puro a URL:
```typescript
// ANTES:
const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qr_token}`;

// DESPUÉS:
const checkInUrl = `https://${tenant_slug}.accredia.cl/admin/scanner/checkin?token=${qr_token}`;
const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkInUrl)}`;
```
Se necesita pasar `tenant_slug` al contexto del email (ya se tiene acceso al `event_id`,
se puede JOIN con `tenants` para obtener el slug).

#### Paso 11.2 — Crear página de check-in por URL
```
📁 Crear: app/[tenant]/admin/scanner/checkin/page.tsx
```
Server Component que:
1. Verifica tenant existe
2. Verifica usuario autenticado como admin del tenant
3. Si no autenticado → redirect a login con `returnTo` param
4. Extrae `token` de `searchParams`
5. Llama internamente a la función SQL `validate_qr_checkin_day`
6. Renderiza resultado (verde/rojo) reutilizando UI del `QRScanner`

```typescript
import { redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/services/tenants';
import { getCurrentUser, getUserTenantRole } from '@/lib/services/auth';
import CheckInResult from './CheckInResult'; // client component para UI

export default async function CheckInPage({
  params, searchParams
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ token?: string; day?: string }>;
}) {
  const { tenant: slug } = await params;
  const { token, day } = await searchParams;
  const tenantData = await getTenantBySlug(slug);
  if (!tenantData) return notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${slug}/admin/login?returnTo=scanner/checkin?token=${token}`);

  const role = await getUserTenantRole(user.id, tenantData.id);
  if (role !== 'admin_tenant' && role !== 'superadmin') redirect(`/${slug}/admin/login`);

  // Validar el QR server-side
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('validate_qr_checkin_day', {
    p_qr_token: token,
    p_scanner_user_id: user.id,
    p_event_day_id: day || null,
  });

  return <CheckInResult result={data} tenantSlug={slug} />;
}
```

#### Paso 11.3 — Componente de resultado de check-in
```
📁 Crear: app/[tenant]/admin/scanner/checkin/CheckInResult.tsx
```
Client component con la UI de resultado (pantalla completa verde/roja).
Puede extraerse/reutilizarse de la sección de resultado de `QRScanner.tsx`.

Debe mostrar:
- **Éxito** (verde): foto, nombre completo, RUT, organización, cargo, tipo medio, hora de check-in
- **Error** (rojo): motivo (ya ingresó, no autorizado, no encontrado, no aprobado)
- Botón "Volver al scanner" → `/{tenant}/admin/scanner`

#### Paso 11.4 — Scanner con cámara (opcional, mejora UX)
```
npm install html5-qrcode
```
```
✏️ Editar: components/qr/QRScanner.tsx
```
Agregar modo alternativo de escaneo con cámara además del input USB:
```typescript
import { Html5QrcodeScanner } from 'html5-qrcode';

// Toggle entre modos:
// [📷 Cámara] [⌨️ Manual]
// Modo cámara → abre viewfinder, al detectar QR → handleValidate(decodedText)
// Modo manual → input actual (para scanners USB/Bluetooth)
```
Esto permite que un admin escanee directamente desde el celular sin scanner externo.

#### Paso 11.5 — Compatibilidad backward
El scanner existente con input de texto **debe seguir funcionando** para scanners USB.
Si el input recibe una URL (empieza con `http`), extraer el token del query param:
```typescript
// En QRScanner.tsx handleValidate:
let tokenToValidate = rawInput.trim();
if (tokenToValidate.startsWith('http')) {
  const url = new URL(tokenToValidate);
  tokenToValidate = url.searchParams.get('token') || tokenToValidate;
}
```

#### Paso 11.6 — (Opcional) Página pública de verificación
```
📁 Crear: app/[tenant]/verificar/page.tsx
```
Página pública (sin auth) que **solo consulta** el estado del QR sin hacer check-in.
Útil para que seguridad/portería verifique si una credencial es válida sin marcar ingreso:
- Muestra: nombre, foto, organización, estado de la acreditación
- **NO** marca check-in (solo lectura)
- Endpoint separado: `POST /api/qr/verify` (nuevo, solo lectura)

#### Paso 11.7 — Verificación final M11
```bash
npx next build
npx vitest run
# Test: escanear QR del email con celular → abre página → check-in exitoso (verde)
# Test: escanear mismo QR otra vez → ya ingresó (rojo)
# Test: scanner USB sigue funcionando con token puro y con URL
# Test: usuario no-admin escanea → redirect a login
# Test: (si 11.4) cámara lee QR y hace check-in
```

---

### ⬜ Milestone 12 — Bug Crítico: Cruce de Datos entre Tenants
> **Prioridad**: 🔴 Bloqueante · **~10 archivos + 1 SQL** · **Riesgo de regresión**: Alto  
> **Tiempo estimado**: 1 sesión · **Dificultad**: Medio-Alto

**Problema**: Se ha detectado una fuga de datos entre perfiles de miembros de equipo.
Al registrar o editar un "Miembro de Equipo Frecuente", el sistema mezcla información
con datos de otros perfiles o tenants. El proceso de acreditación resulta erróneo,
comprometiendo la integridad de la información y la privacidad del usuario.

**Causa raíz identificada**: La tabla `profiles` es global (no tiene columna `tenant_id`).
El diseño intencional es que un perfil (identidad por RUT) pueda participar en múltiples
tenants. Sin embargo, la tabla `team_members` tampoco filtra por tenant — solo vincula
`manager_id` ↔ `member_profile_id`. Esto causa que:

1. `getTeamMembers()` en `lib/services/teams.ts` filtra solo por `manager_id`, sin contexto de tenant/evento
2. `addTeamMember()` busca perfiles por RUT globalmente sin acotar a un tenant
3. `lookupProfileByRut()` en `lib/services/profiles.ts` retorna el primer perfil con ese RUT sin filtro de evento/tenant
4. El hook `useProfileLookup` no envía contexto de tenant al backend
5. La API `POST /api/teams` no valida que el perfil pertenezca al mismo contexto de acreditación

**Impacto**: Un acreditado del Tenant A puede ver datos de miembros de equipo que
fueron creados en el contexto del Tenant B. Al auto-completar datos por RUT,
pueden aparecer datos de otra organización.

#### Paso 12.1 — Agregar `event_id` a `team_members`
```
📁 Crear: supabase-fix-team-tenant-scope.sql
```
```sql
-- Agregar columna de scoping a team_members
ALTER TABLE team_members ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;

-- Índice compuesto para queries eficientes
CREATE INDEX idx_team_members_manager_event 
  ON team_members(manager_id, event_id);

-- Restricción: un miembro no puede estar duplicado para el mismo manager+evento
ALTER TABLE team_members ADD CONSTRAINT uq_team_member_event 
  UNIQUE(manager_id, member_profile_id, event_id);

-- Backfill: asignar event_id a registros existentes basándose en registrations
UPDATE team_members tm
SET event_id = (
  SELECT r.event_id FROM registrations r
  WHERE r.profile_id = tm.manager_id
  ORDER BY r.created_at DESC LIMIT 1
)
WHERE tm.event_id IS NULL;

-- RLS: team_members visibles solo si el usuario es el manager
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_manager_policy ON team_members
  FOR ALL USING (
    manager_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );
```

#### Paso 12.2 — Actualizar servicio de equipos
```
✏️ Editar: lib/services/teams.ts
```
Agregar `event_id` como parámetro obligatorio en todas las funciones:
```typescript
// ANTES:
export async function getTeamMembers(managerId: string) {
  const { data } = await supabase.from('team_members').select('*').eq('manager_id', managerId);
}

// DESPUÉS:
export async function getTeamMembers(managerId: string, eventId: string) {
  const { data } = await supabase
    .from('team_members')
    .select('*, member_profile:profiles!member_profile_id(*)')
    .eq('manager_id', managerId)
    .eq('event_id', eventId);  // ← scope por evento (que pertenece a un tenant)
}
```
Hacer lo mismo en `addTeamMember()` y `removeTeamMember()` — siempre pasar `event_id`.

#### Paso 12.3 — Actualizar API de equipos
```
✏️ Editar: app/api/teams/route.ts
✏️ Editar: app/api/team/route.ts (si existe)
```
Requerir `event_id` en el body/query de GET/POST/DELETE:
```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('event_id');
  if (!eventId) return NextResponse.json({ error: 'event_id requerido' }, { status: 400 });

  // Verificar que el evento pertenece al tenant del usuario
  const event = await getEventById(eventId);
  if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });

  const members = await getTeamMembers(profile.id, eventId);
  return NextResponse.json({ data: members });
}
```

#### Paso 12.4 — Acotar lookup de perfil por contexto
```
✏️ Editar: hooks/useProfileLookup.ts
✏️ Editar: app/api/profiles/lookup/route.ts
```
Al hacer lookup por RUT para autofill de equipo, filtrar datos visibles:
- El perfil base (nombre, RUT, email) es global — OK compartirlo
- Los datos de acreditación (`cargo`, `tipo_medio`, `medio`) deben venir de
  `registrations` del mismo evento/tenant, NO de registrations de otro tenant
- Agregar parámetro `event_id` al lookup para traer datos del contexto correcto

```typescript
// En useProfileLookup.ts:
const res = await fetch(`/api/profiles/lookup?rut=${rut}&event_id=${eventId}`);

// En el API, al hacer autofill:
const { data: registration } = await supabase
  .from('registrations')
  .select('datos_base, datos_extra')
  .eq('profile_id', profile.id)
  .eq('event_id', eventId)  // ← Solo datos de este evento
  .maybeSingle();
```

#### Paso 12.5 — Actualizar formulario de registro
```
✏️ Editar: components/forms/registration/StepAcreditados.tsx
✏️ Editar: components/forms/registration/useRegistrationForm.ts
```
Pasar `event_id` al hook de team members y al lookup de perfiles.
El formulario ya tiene acceso al `event_id` del wizard — solo falta propagarlo.

#### Paso 12.6 — Tests de aislamiento entre tenants
```
📁 Crear: tests/services/teams-isolation.test.ts
```
```typescript
describe('Team Members - Tenant Isolation', () => {
  it('no retorna miembros de equipo de otro evento', async () => { ... });
  it('no permite agregar miembro con event_id de otro tenant', async () => { ... });
  it('lookup de perfil retorna datos del evento correcto', async () => { ... });
  it('autofill usa registration del mismo evento', async () => { ... });
});
```

#### Paso 12.7 — Verificación final M12
```bash
npx next build
npx vitest run
# Test manual: crear equipo en Tenant A → verificar que no aparece en Tenant B
# Test manual: buscar RUT que existe en 2 tenants → datos de acreditación del tenant correcto
# Test manual: registros existentes (backfill) asignados correctamente
```

---

### ⬜ Milestone 13 — Flujo Completo de Autenticación
> **Prioridad**: Alta · **~12 archivos** · **Riesgo de regresión**: Medio  
> **Tiempo estimado**: 1-2 sesiones · **Dificultad**: Medio

**Problema**: El sistema tiene login y registro funcionales, pero carece de flujos
críticos de gestión de contraseña:
- No existe "Olvidé mi contraseña" en ningún login
- No se puede cambiar contraseña desde el perfil (ningún rol)
- Al crear usuarios admin (superadmin o tenant admin) se usa `email_confirm: true`
  pero no se gestiona la creación de contraseña — el usuario queda sin forma de entrar

**Estado actual:**

| Funcionalidad | Acreditado | Admin Tenant | SuperAdmin |
|---------------|:----------:|:------------:|:----------:|
| Login email+pwd | ✅ | ✅ | ✅ |
| Registro | ✅ | N/A (creado por SA) | N/A (creado por SA) |
| Olvidé contraseña | ❌ | ❌ | ❌ |
| Cambiar contraseña | ❌ | ❌ | ❌ |
| Crear con contraseña | N/A | ❌ (sin pwd) | ❌ (sin pwd) |

#### Paso 13.1 — "Olvidé mi contraseña" en login de acreditado
```
✏️ Editar: app/auth/acreditado/page.tsx
```
Agregar link y flujo de recuperación bajo el botón de login:
```typescript
const handleForgotPassword = async () => {
  if (!email) { setError('Ingresa tu email'); return; }
  setLoading(true);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });
  if (error) setError(error.message);
  else setSuccess('Se envió un enlace de recuperación a tu email');
  setLoading(false);
};

// En el JSX del tab Login:
<button
  type="button"
  onClick={handleForgotPassword}
  className="text-sm text-blue-600 hover:underline mt-2"
>
  ¿Olvidaste tu contraseña?
</button>
```

#### Paso 13.2 — "Olvidé mi contraseña" en login de SuperAdmin
```
✏️ Editar: app/superadmin/login/page.tsx
```
Mismo patrón que 13.1 pero con redirect a `/superadmin/login?recovered=true`.

#### Paso 13.3 — "Olvidé mi contraseña" en login de Admin Tenant
```
✏️ Editar: app/[tenant]/admin/page.tsx (o login/page.tsx si existe)
```
Mismo patrón con redirect a `/${tenant}/admin?recovered=true`.

#### Paso 13.4 — Página de callback para recovery
```
✏️ Editar: app/auth/callback/page.tsx
```
Manejar el tipo `recovery` del callback de Supabase:
```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Mostrar formulario de nueva contraseña
      setShowPasswordReset(true);
    }
  });
  return () => subscription.unsubscribe();
}, []);
```
Cuando `PASSWORD_RECOVERY`:
- Mostrar formulario con 2 campos: nueva contraseña + confirmación
- Validar: mínimo 8 caracteres, coincidencia
- Llamar `supabase.auth.updateUser({ password: newPassword })`
- Redirect al login correspondiente con mensaje de éxito

#### Paso 13.5 — Cambio de contraseña en perfil de acreditado
```
✏️ Editar: app/acreditado/perfil/page.tsx
```
Agregar sección "Cambiar contraseña" al formulario de perfil:
```typescript
const handleChangePassword = async () => {
  if (newPassword !== confirmPassword) {
    setPasswordError('Las contraseñas no coinciden');
    return;
  }
  if (newPassword.length < 8) {
    setPasswordError('Mínimo 8 caracteres');
    return;
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) setPasswordError(error.message);
  else {
    setPasswordSuccess('Contraseña actualizada');
    setNewPassword('');
    setConfirmPassword('');
  }
};
```
UI: card separada debajo de los datos personales con inputs de contraseña colapsable.

#### Paso 13.6 — Crear admin con contraseña temporal
```
✏️ Editar: lib/services/tenants.ts  (createTenantAdmin)
✏️ Editar: app/superadmin/(dashboard)/configuracion/page.tsx (create-superadmin action)
```
Al crear un usuario admin, generar contraseña temporal y enviar por email:
```typescript
import { randomBytes } from 'crypto';

const tempPassword = randomBytes(12).toString('base64url');

const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { role, nombre, apellido },
});

// Enviar email con credenciales temporales
await sendWelcomeEmail(email, {
  nombre,
  tempPassword,
  loginUrl: role === 'superadmin'
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/superadmin/login`
    : `https://${tenantSlug}.accredia.cl/admin`,
});
```

#### Paso 13.7 — Forzar cambio de contraseña en primer login
```
📁 Crear: lib/services/passwordPolicy.ts
```
```typescript
export function shouldForcePasswordChange(user: User): boolean {
  return user.user_metadata?.must_change_password === true;
}
```
En la creación de admin (13.6), agregar metadata `must_change_password: true`.
En el login de admin, verificar y redirigir a cambio de contraseña:
```typescript
if (shouldForcePasswordChange(user)) {
  router.push('/auth/callback?type=force-change');
}
```

#### Paso 13.8 — Email de bienvenida con credenciales
```
📁 Crear: lib/services/welcomeEmail.ts (o agregar a email.ts)
```
Template de email:
- Asunto: "Bienvenido a Accredia — Tus credenciales de acceso"
- Body: nombre, email, contraseña temporal, link de login, instrucción de cambiar contraseña
- Usar Resend/SMTP existente del proyecto

#### Paso 13.9 — Tests del flujo auth
```
📁 Crear: tests/services/passwordPolicy.test.ts
📁 Crear: tests/api/auth-recovery.test.ts
```
```typescript
describe('Password Policy', () => {
  it('detecta must_change_password en metadata', () => { ... });
  it('no fuerza cambio si metadata es false', () => { ... });
});

describe('Auth Recovery API', () => {
  it('envía email de recuperación', () => { ... });
  it('actualiza contraseña con token válido', () => { ... });
  it('rechaza contraseña < 8 caracteres', () => { ... });
});
```

#### Paso 13.10 — Verificación final M13
```bash
npx next build
npx vitest run
# Test manual: click "Olvidé contraseña" → recibir email → abrir link → nueva contraseña → login OK
# Test manual: cambiar contraseña desde perfil acreditado → logout → login con nueva contraseña
# Test manual: crear admin tenant → email con credenciales → login → forzar cambio de pwd
# Test manual: crear superadmin → email con credenciales → login → forzar cambio de pwd
```

---

### ⬜ Milestone 14 — Gestión Completa de Tenants (Eliminación en Cascada)
> **Prioridad**: Media-Alta · **~6 archivos + 1 SQL** · **Riesgo de regresión**: Alto  
> **Tiempo estimado**: 1 sesión · **Dificultad**: Medio

**Problema**: El CRUD de tenants está incompleto — falta la funcionalidad de eliminación.
No existe endpoint `DELETE`, función de servicio `deleteTenant`, ni UI para eliminar un
tenant. Si un tenant se desactiva permanentemente, sus datos quedan como "huérfanos"
ocupando espacio en la BD.

**Estado actual de cascadas en la BD**:

| Tabla hija | FK → `tenants(id)` | Tipo CASCADE |
|------------|--------------------|--------------|
| `events` | `tenant_id` | ✅ `ON DELETE CASCADE` |
| `tenant_admins` | `tenant_id` | ✅ `ON DELETE CASCADE` |
| `email_templates` | `tenant_id` | ✅ `ON DELETE CASCADE` |
| `email_logs` | `tenant_id` | `ON DELETE SET NULL` |
| `email_zone_content` | (vía event_id) | ✅ Cascada transitiva |
| `registrations` | (vía event_id) | ✅ Cascada transitiva |
| `event_quota_rules` | (vía event_id) | ✅ Cascada transitiva |
| `event_zone_rules` | (vía event_id) | ✅ Cascada transitiva |
| `event_days` | (vía event_id) | ✅ Cascada transitiva |

La BD ya tiene cascadas correctas. Falta toda la capa de aplicación.

#### Paso 14.1 — Verificar cascadas pendientes en SQL
```
📁 Crear: supabase-tenant-cascade-check.sql
```
```sql
-- Verificar que no haya tablas huérfanas sin CASCADE
-- Agregar CASCADE faltante si se detecta:

-- Storage: eliminar archivos del tenant (logos, fotos de perfil)
-- Esto debe hacerse a nivel de aplicación ANTES del DELETE SQL

-- Audit logs: decidir si preservar o eliminar
-- Opción A: SET NULL (preservar logs anónimos para auditoría)
-- Opción B: CASCADE (eliminar todo rastro)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_tenant_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
```

#### Paso 14.2 — Función de servicio `deleteTenant`
```
✏️ Editar: lib/services/tenants.ts
```
```typescript
export async function deleteTenant(tenantId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 1. Obtener datos del tenant para cleanup
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error('Tenant no encontrado');

  // 2. Eliminar archivos de storage asociados
  const { data: files } = await supabase.storage
    .from('tenant-assets')
    .list(tenantId);
  if (files?.length) {
    await supabase.storage
      .from('tenant-assets')
      .remove(files.map(f => `${tenantId}/${f.name}`));
  }

  // 3. Eliminar usuarios auth asociados (admin_tenant)
  const admins = await listTenantAdmins(tenantId);
  for (const admin of admins) {
    // Solo eliminar user si no es admin de otro tenant
    const { count } = await supabase
      .from('tenant_admins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', admin.user_id)
      .neq('tenant_id', tenantId);
    if (count === 0) {
      await supabase.auth.admin.deleteUser(admin.user_id);
    }
  }

  // 4. DELETE del tenant (cascadas SQL eliminan todo lo demás)
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', tenantId);
  if (error) throw error;

  // 5. Audit log (con tenant_id NULL ya que fue eliminado)
  await logAudit({ action: 'tenant_deleted', details: { tenant_nombre: tenant.nombre, tenant_slug: tenant.slug } });
}
```

#### Paso 14.3 — Endpoint `DELETE /api/tenants/[id]`
```
📁 Crear: app/api/tenants/[id]/route.ts
```
```typescript
import { requireAuth } from '@/lib/services/requireAuth';
import { deleteTenant } from '@/lib/services/tenants';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { role: 'superadmin' });
  if (authResult.error) return authResult.error;

  const { id } = await params;

  try {
    await deleteTenant(id);
    revalidatePath('/superadmin/tenants');
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al eliminar tenant';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

#### Paso 14.4 — UI de eliminación en SuperAdmin
```
✏️ Editar: app/superadmin/(dashboard)/tenants/page.tsx
```
Agregar botón de eliminación con **doble confirmación** (modal + escribir nombre del tenant):
```typescript
const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
const [confirmText, setConfirmText] = useState('');

const handleDelete = async () => {
  if (confirmText !== deleteTarget?.nombre) return;
  await fetch(`/api/tenants/${deleteTarget.id}`, { method: 'DELETE' });
  setDeleteTarget(null);
  loadData(); // refrescar lista
};

// Modal:
<Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
  <h3>¿Eliminar tenant "{deleteTarget?.nombre}"?</h3>
  <p className="text-red-600">Esta acción es IRREVERSIBLE. Se eliminarán todos los
  eventos, registros, acreditaciones y configuraciones del tenant.</p>
  <p>Escribe <strong>{deleteTarget?.nombre}</strong> para confirmar:</p>
  <input value={confirmText} onChange={e => setConfirmText(e.target.value)} />
  <button disabled={confirmText !== deleteTarget?.nombre} onClick={handleDelete}>
    Eliminar permanentemente
  </button>
</Modal>
```

#### Paso 14.5 — Soft delete como alternativa (opcional)
Considerar agregar columna `deleted_at TIMESTAMPTZ` en vez de DELETE hard:
```sql
ALTER TABLE tenants ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
```
Esto permite "papelera" con restauración. El DELETE endpoint marca `deleted_at = NOW()`
y un cron job purga los tenants eliminados tras 30 días.
Si se implementa, ajustar todas las queries de tenant para filtrar `deleted_at IS NULL`.

#### Paso 14.6 — Tests de eliminación
```
📁 Crear: tests/services/tenants-delete.test.ts
```
```typescript
describe('deleteTenant', () => {
  it('elimina tenant y todos sus datos asociados', async () => { ... });
  it('elimina archivos de storage', async () => { ... });
  it('no elimina admin si es admin de otro tenant', async () => { ... });
  it('falla si tenant no existe', async () => { ... });
  it('requiere rol superadmin', async () => { ... });
});
```

#### Paso 14.7 — Verificación final M14
```bash
npx next build
npx vitest run
# Test manual: eliminar tenant de prueba → verificar que no quedan datos huérfanos
# Test manual: verificar que el tenant no aparece más en listados
# Test manual: verificar que admins exclusivos del tenant fueron eliminados de auth
# Test manual: verificar que admins compartidos con otro tenant NO fueron eliminados
```

---

### ⬜ Milestone 15 — UX SuperAdmin: Filtros y Organización de Eventos
> **Prioridad**: Media · **~3 archivos** · **Riesgo de regresión**: Bajo  
> **Tiempo estimado**: 0.5 sesión · **Dificultad**: Bajo

**Problema**: La página de eventos del SuperAdmin (`app/superadmin/(dashboard)/eventos/page.tsx`,
823 líneas) lista **todos** los eventos de **todos** los tenants en una lista plana,
sin filtro ni agrupación. Con múltiples tenants, la página se vuelve inmanejable.

**Estado actual**: `loadData()` hace `fetch('/api/events')` que retorna todos los eventos.
Los eventos se muestran con `events.map(...)` sin filtrado. La variable `tenants` solo
se usa para el dropdown al crear/editar evento.

#### Paso 15.1 — Filtro por tenant
```
✏️ Editar: app/superadmin/(dashboard)/eventos/page.tsx
```
Agregar selector de tenant como filtro principal:
```typescript
const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

const filteredEvents = useMemo(() => {
  if (selectedTenantId === 'all') return events;
  return events.filter(e => e.tenant_id === selectedTenantId);
}, [events, selectedTenantId]);

// UI: barra de filtros arriba de la lista
<div className="flex items-center gap-4 mb-6">
  <label htmlFor="tenant-filter" className="font-medium">Tenant:</label>
  <select
    id="tenant-filter"
    value={selectedTenantId}
    onChange={e => setSelectedTenantId(e.target.value)}
    className="border rounded px-3 py-2"
  >
    <option value="all">Todos los tenants ({events.length})</option>
    {tenants.map(t => (
      <option key={t.id} value={t.id}>
        {t.nombre} ({events.filter(e => e.tenant_id === t.id).length})
      </option>
    ))}
  </select>
</div>
```

#### Paso 15.2 — Agrupación visual por tenant
Cuando el filtro es "Todos", agrupar eventos bajo headers de tenant:
```typescript
const groupedEvents = useMemo(() => {
  if (selectedTenantId !== 'all') return null;
  const groups: Record<string, { tenant: Tenant; events: Event[] }> = {};
  for (const event of events) {
    const tid = event.tenant_id;
    if (!groups[tid]) {
      groups[tid] = { tenant: tenants.find(t => t.id === tid)!, events: [] };
    }
    groups[tid].events.push(event);
  }
  return Object.values(groups).sort((a, b) => a.tenant.nombre.localeCompare(b.tenant.nombre));
}, [events, tenants, selectedTenantId]);

// Renderizar con headers:
{groupedEvents ? groupedEvents.map(group => (
  <div key={group.tenant.id}>
    <h3 className="text-lg font-semibold mt-6 mb-2 flex items-center gap-2">
      <span className="w-3 h-3 rounded-full" style={{ background: group.tenant.color_primario }} />
      {group.tenant.nombre}
      <span className="text-sm text-gray-500">({group.events.length} eventos)</span>
    </h3>
    {group.events.map(event => renderEventCard(event))}
  </div>
)) : filteredEvents.map(event => renderEventCard(event))}
```

#### Paso 15.3 — Filtro por estado de evento
Agregar filtro secundario por estado activo/inactivo:
```typescript
const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

// Combinar filtros:
const filteredEvents = useMemo(() => {
  let result = events;
  if (selectedTenantId !== 'all') result = result.filter(e => e.tenant_id === selectedTenantId);
  if (statusFilter === 'active') result = result.filter(e => e.activo);
  if (statusFilter === 'inactive') result = result.filter(e => !e.activo);
  return result;
}, [events, selectedTenantId, statusFilter]);
```

#### Paso 15.4 — Búsqueda por nombre de evento
```typescript
const [searchQuery, setSearchQuery] = useState('');

// Agregar al pipeline de filtrado:
if (searchQuery.trim()) {
  const q = searchQuery.toLowerCase();
  result = result.filter(e =>
    e.nombre.toLowerCase().includes(q) ||
    e.tenant?.nombre?.toLowerCase().includes(q)
  );
}

// UI:
<input
  type="search"
  placeholder="Buscar evento..."
  value={searchQuery}
  onChange={e => setSearchQuery(e.target.value)}
  className="border rounded px-3 py-2 w-64"
/>
```

#### Paso 15.5 — Contadores en barra de filtros
Mostrar estadísticas rápidas:
```typescript
<div className="flex items-center gap-6 text-sm text-gray-600">
  <span>{filteredEvents.length} eventos</span>
  <span>{filteredEvents.filter(e => e.activo).length} activos</span>
  <span>{tenants.length} tenants</span>
</div>
```

#### Paso 15.6 — Verificación final M15
```bash
npx next build
# Test manual: seleccionar tenant → solo sus eventos visibles
# Test manual: "Todos" → eventos agrupados por tenant con headers
# Test manual: búsqueda → filtra en tiempo real
# Test manual: crear evento → aparece en el grupo correcto
```

---

### ⬜ Milestone 16 — Sistema de Billing para Admin Tenant
> **Prioridad**: Media · **~15 archivos + SQL** · **Riesgo de regresión**: Bajo (feature nueva)  
> **Tiempo estimado**: 3-4 sesiones · **Dificultad**: Alto

**Nota**: El pricing es TBD. Este milestone implementa la **infraestructura de billing**
(modelo de datos, enforcement de límites, UI) dejando los valores de planes como
configurables. La pasarela de pago se integrará cuando se defina el pricing.

**Lo que NO existe actualmente**: Cero código de billing, planes, suscripciones,
límites ni facturación. La tabla `tenants` no tiene campos relacionados.

#### Paso 16.1 — Modelo de datos de billing
```
📁 Crear: supabase-billing.sql
```
```sql
-- Planes disponibles
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,               -- 'free', 'pro', 'enterprise'
  display_name TEXT NOT NULL,        -- 'Plan Gratuito', 'Plan Pro', 'Plan Enterprise'
  max_events INT NOT NULL DEFAULT 1, -- Límite de eventos activos simultáneos
  max_registrations_per_event INT NOT NULL DEFAULT 50,  -- Límite de acreditados por evento
  max_admins INT NOT NULL DEFAULT 1, -- Límite de admins del tenant
  max_storage_mb INT NOT NULL DEFAULT 100,  -- Almacenamiento
  features JSONB DEFAULT '{}',       -- Features adicionales: email_custom, bulk_import, etc.
  price_monthly NUMERIC(10,2) DEFAULT 0,  -- Precio mensual (moneda local)
  price_yearly NUMERIC(10,2) DEFAULT 0,   -- Precio anual
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suscripción activa de cada tenant
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  payment_provider TEXT,            -- 'stripe', 'mercadopago', 'manual'
  payment_provider_id TEXT,         -- ID externo de la suscripción
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id)                 -- Un tenant = una suscripción activa
);

-- Historial de uso para facturación
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,             -- 'events', 'registrations', 'storage_mb', 'emails_sent'
  value INT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Seed de planes iniciales (valores placeholder)
INSERT INTO plans (name, display_name, max_events, max_registrations_per_event, max_admins, max_storage_mb, price_monthly, price_yearly) VALUES
  ('free', 'Plan Gratuito', 1, 50, 1, 100, 0, 0),
  ('pro', 'Plan Pro', 5, 500, 3, 1000, 0, 0),       -- Precio TBD
  ('enterprise', 'Plan Enterprise', -1, -1, -1, -1, 0, 0);  -- -1 = ilimitado, Precio TBD

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_public_read ON plans FOR SELECT USING (true);
CREATE POLICY subscriptions_admin ON subscriptions FOR ALL 
  USING (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()));
CREATE POLICY usage_admin ON usage_records FOR ALL 
  USING (tenant_id IN (SELECT tenant_id FROM tenant_admins WHERE user_id = auth.uid()));
```

#### Paso 16.2 — Servicio de billing
```
📁 Crear: lib/services/billing.ts
```
```typescript
export async function getTenantSubscription(tenantId: string): Promise<Subscription | null> { ... }
export async function getTenantPlan(tenantId: string): Promise<Plan> { ... }
export async function checkLimit(tenantId: string, metric: LimitMetric): Promise<LimitCheckResult> { ... }
export async function recordUsage(tenantId: string, metric: string, value: number): Promise<void> { ... }
export async function getUsageSummary(tenantId: string): Promise<UsageSummary> { ... }
export async function listPlans(): Promise<Plan[]> { ... }
export async function updateSubscription(tenantId: string, planId: string): Promise<void> { ... }
```

La función clave es `checkLimit()`:
```typescript
export type LimitMetric = 'events' | 'registrations' | 'admins' | 'storage_mb';

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;     // -1 = ilimitado
  metric: LimitMetric;
}

export async function checkLimit(tenantId: string, metric: LimitMetric): Promise<LimitCheckResult> {
  const plan = await getTenantPlan(tenantId);
  const limitKey = `max_${metric}` as keyof Plan;
  const limit = plan[limitKey] as number;

  if (limit === -1) return { allowed: true, current: 0, limit: -1, metric };

  let current = 0;
  switch (metric) {
    case 'events':
      const { count } = await supabase.from('events').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('activo', true);
      current = count ?? 0;
      break;
    case 'registrations':
      // Count across all active events
      break;
    case 'admins':
      const { count: adminCount } = await supabase.from('tenant_admins').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      current = adminCount ?? 0;
      break;
  }

  return { allowed: current < limit, current, limit, metric };
}
```

#### Paso 16.3 — Enforcement en API routes
Integrar `checkLimit()` en los endpoints de creación:
```
✏️ Editar: app/api/events/route.ts  ← POST: checkLimit('events')
✏️ Editar: app/api/registrations/route.ts  ← POST: checkLimit('registrations')
✏️ Editar: app/api/tenants/[id]/admins/route.ts  ← POST: checkLimit('admins')
```
```typescript
// Ejemplo en POST /api/events:
const limitCheck = await checkLimit(tenant_id, 'events');
if (!limitCheck.allowed) {
  return NextResponse.json({
    error: `Límite de plan alcanzado: ${limitCheck.current}/${limitCheck.limit} eventos activos`,
    upgrade_required: true,
  }, { status: 403 });
}
```

#### Paso 16.4 — API de billing
```
📁 Crear: app/api/billing/route.ts           ← GET plan actual, usage
📁 Crear: app/api/billing/plans/route.ts     ← GET planes disponibles
📁 Crear: app/api/billing/subscribe/route.ts ← POST cambiar plan
```

#### Paso 16.5 — UI de billing en dashboard admin_tenant
```
📁 Crear: components/admin-dashboard/AdminBillingTab.tsx
```
Nuevo tab "Billing" / "Plan" en el dashboard del admin_tenant que muestre:
- Plan actual con nombre, características y límites
- Barra de uso: `3/5 eventos`, `127/500 acreditados`, `1/3 admins`
- Tabla de planes disponibles con botón "Cambiar plan"
- Historial de facturación (cuando se integre pasarela)

```typescript
export default function AdminBillingTab({ tenantId }: { tenantId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Barras de uso:
  <div className="grid grid-cols-2 gap-4">
    <UsageBar label="Eventos" current={usage.events} max={plan.max_events} />
    <UsageBar label="Acreditados" current={usage.registrations} max={plan.max_registrations_per_event} />
    <UsageBar label="Admins" current={usage.admins} max={plan.max_admins} />
    <UsageBar label="Almacenamiento" current={usage.storage_mb} max={plan.max_storage_mb} unit="MB" />
  </div>
}
```

#### Paso 16.6 — Gestión de planes en SuperAdmin
```
📁 Crear: app/superadmin/(dashboard)/billing/page.tsx
```
Página para que el superadmin:
- Vea todos los planes y los edite (nombre, límites, precio)
- Vea suscripciones de cada tenant
- Asigne plan manualmente a un tenant (override)
- Vea métricas de uso agregadas

#### Paso 16.7 — Asignación automática de plan free
```
✏️ Editar: lib/services/tenants.ts (createTenant)
```
Al crear un tenant, asignar automáticamente el plan free:
```typescript
// Después de crear el tenant:
const { data: freePlan } = await supabase
  .from('plans')
  .select('id')
  .eq('name', 'free')
  .single();

await supabase.from('subscriptions').insert({
  tenant_id: newTenant.id,
  plan_id: freePlan.id,
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'active',
});
```

#### Paso 16.8 — Notificaciones de límite
Cuando un tenant alcance el 80% de un límite, mostrar banner de advertencia:
```typescript
// En AdminDashboardV2.tsx o AdminContext.tsx:
if (usage.events >= plan.max_events * 0.8) {
  showBanner('Estás cerca del límite de eventos de tu plan. Considera actualizar.');
}
```

#### Paso 16.9 — Placeholder de pasarela de pago
```
📁 Crear: lib/services/paymentProvider.ts
```
Interfaz abstracta para la futura integración:
```typescript
export interface PaymentProvider {
  createCheckoutSession(tenantId: string, planId: string): Promise<{ url: string }>;
  handleWebhook(payload: unknown): Promise<void>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

// Implementación placeholder:
export class ManualPaymentProvider implements PaymentProvider {
  async createCheckoutSession() { return { url: '/billing/contact' }; }
  async handleWebhook() { /* no-op */ }
  async cancelSubscription() { /* manual process */ }
}
```
Cuando se defina el pricing y la pasarela (Stripe, MercadoPago, etc.),
se crea una implementación concreta de esta interfaz.

#### Paso 16.10 — Tests de billing
```
📁 Crear: tests/services/billing.test.ts
```
```typescript
describe('Billing Service', () => {
  it('retorna plan free por defecto', () => { ... });
  it('checkLimit permite si está bajo el límite', () => { ... });
  it('checkLimit bloquea si está en el límite', () => { ... });
  it('plan enterprise (-1) siempre permite', () => { ... });
  it('registra uso correctamente', () => { ... });
});
```

#### Paso 16.11 — Verificación final M16
```bash
npx next build
npx vitest run
# Test manual: crear tenant → plan free asignado automáticamente
# Test manual: crear más eventos que el límite → error 403 con mensaje claro
# Test manual: admin ve su plan y uso en tab Billing
# Test manual: superadmin puede cambiar plan de un tenant
# Test manual: banner de advertencia al 80% del límite
```
