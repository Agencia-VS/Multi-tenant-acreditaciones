# Ruta de Refactorización — Accredia 10/10

> **Proyecto**: Multi-tenant Acreditaciones  
> **Stack**: Next.js 16 (App Router + Turbopack) · TypeScript · Tailwind CSS v4 · Supabase · Vercel  
> **Fecha de auditoría**: 13 de febrero de 2026  
> **Última actualización**: 16 de febrero de 2026  
> **Codebase**: ~20,000 líneas TS/TSX/CSS · 21 API routes · 13 servicios · 76 tests  

---

## Estado Actual

El proyecto es **funcional en producción** con arquitectura multi-tenant por subdominio
(`proxy.ts`), tres roles (acreditado, admin_tenant, superadmin), formularios dinámicos,
sistema de zonas, cupos, exportación PuntoTicket y gestión de equipos.

La auditoría línea por línea reveló **6 áreas de mejora** organizadas por prioridad
en milestones independientes. **6 de 6 milestones completados** (M1–M6).
Se agrega un **M7 — Testing** como siguiente prioridad.

### Progreso Global

```
M1 (Seguridad)                ███████████████  ✅ COMPLETADO — 13 feb 2026
M2 (Client unificado)          ████████████     ✅ COMPLETADO — 14 feb 2026
M3 (Performance queries)       ██████████       ✅ COMPLETADO — 14 feb 2026
M4 (Decomposición)             ████████         ✅ COMPLETADO — 15 feb 2026
M5 (Tipado fuerte)             ██████           ✅ COMPLETADO — 16 feb 2026
M6 (Optimización Vercel)       ██████           ✅ COMPLETADO — 17 feb 2026
M7 (Testing)                   ████████         🔄 FASE 1 COMPLETADA — 17 feb 2026
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

### Seguridad — ✅ Resuelto en M1

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

### Código Muerto — ✅ Eliminado en M2

| Elemento | Acción |
|----------|--------|
| `AdminDashboard.tsx` legacy | 🗑️ Eliminado |
| `DynamicRegistrationForm.tsx.bak` | 🗑️ Eliminado |
| `AcreditadoRow.tsx.bak2` | 🗑️ Eliminado |
| `export const supabase` legacy | 🗑️ Eliminado de `lib/supabase/index.ts` |
| `CookieOptions` import | 🗑️ Eliminado de `lib/supabase/server.ts` |

### Archivos Monolíticos — ✅ Descompuestos en M4

| Archivo original | Resultado |
|-----------------|-----------|
| `DynamicRegistrationForm.tsx` (1,439 líneas) | 8 archivos en `components/forms/registration/` (1,805 líneas total) |
| `SA eventos/page.tsx` (1,011 líneas) | `page.tsx` (604) + 4 componentes extraídos (511 total) |
| `globals.css` (446 líneas) | `globals.css` (4) + 3 archivos en `app/styles/` (412 total) |

### Tipado — ✅ Reforzado en M5

| Aspecto | Estado |
|---------|--------|
| Tipos generados de Supabase | ✅ `database.types.ts` (1,071 líneas) auto-generado |
| Clientes Supabase tipados | ✅ `createServerClient<Database>`, `createBrowserClient<Database>` |
| Tipos derivados de DB | ✅ `Tables<'tenants'>` + helper `NonNull<>` en vez de interfaces manuales |
| STATUS_MAP centralizado | ✅ Const tipada en `types/index.ts` con bg/text/icon/label |
| Autofill isomórfico | ✅ `lib/services/autofill.ts` (server + client sin deps de servidor) |

### Testing — 🔴 Pendiente

| Aspecto | Estado |
|---------|--------|
| Tests unitarios | 🔴 0 tests — sin framework configurado |
| Tests de integración API | 🔴 No existen |
| Tests E2E | 🔴 No existen |
| Coverage | 🔴 Sin medición |

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

## Milestones Pendientes

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

### ⬜ Milestone 7 — Testing
> **Prioridad**: Alta · **~20+ archivos nuevos** · **Riesgo de regresión**: Ninguno  
> **Tiempo estimado**: 2-3 sesiones

El proyecto tiene **0 tests**. Con la base de código estabilizada tras M1–M5,
es el momento ideal para agregar cobertura de tests.

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

## Orden de Ejecución

```
Sesión 1  →  M1 (Seguridad)                    ███████████████  ✅ COMPLETADO
Sesión 2  →  M2 (Client unificado + limpieza)   ████████████     ✅ COMPLETADO
Sesión 3  →  M3 (Performance queries)            ██████████       ✅ COMPLETADO
Sesión 4  →  M4 (Decomposición componentes)      ████████         ✅ COMPLETADO
Sesión 5  →  M5 (Tipado fuerte)                  ██████           ✅ COMPLETADO
Sesión 6  →  M6 (Optimización Vercel)            ██████           ⬜ PENDIENTE
Sesión 7  →  M7 (Testing)                        ████████         ⬜ PENDIENTE
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

### M7 — Testing ✅ (Fase 1 — 17 feb 2026)
- [x] Vitest + testing-library + jsdom configurado
- [x] Tests de `requireAuth` — 8 paths, 100% branch coverage
- [x] Tests de `autofill.ts` — 9 tests, 100% lógica pura
- [x] Tests de `validation.ts` — 27 tests (RUT, email, teléfono, sanitize)
- [x] Tests de `dates.ts` — 18 tests (timezone Chile, deadline, formatting)
- [x] Tests de `colors.ts` — 5 tests (palette generation, CSS vars)
- [x] Tests de `quotas.ts` — 4 tests (motor de cupos con mocks)
- [x] Tests de `useConfirmation` hook — 4 tests
- [x] **76 tests passing, 7 suites, build exitoso**
- [ ] Tests de API routes (auth + response codes)
- [ ] CI pipeline con GitHub Actions
- [ ] Coverage global ≥70%

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

### Mejoras de la refactorización (M1–M5)
- ✅ **Seguridad**: Todas las rutas API con datos sensibles protegidas con `requireAuth()`
- ✅ **Client singleton**: Un solo `getSupabaseBrowserClient()` en todo el proyecto
- ✅ **Queries optimizadas**: Vista `v_tenant_stats`, batch updates, COUNT en vez de full scan
- ✅ **Componentes modulares**: Formulario wizard en 8 archivos, SA Eventos en 5 archivos
- ✅ **Tipado fuerte**: Tipos derivados de la DB con `supabase gen types`, helper `NonNull<>`
- ✅ **Autofill isomórfico**: Una sola función `buildMergedAutofillData()` para server y client
- ✅ **STATUS_MAP centralizado**: Una fuente de verdad para labels, colores e iconos de status
- ✅ **0 código muerto**: Eliminados backups, imports sin usar, exports legacy

---

## Métricas de la Refactorización

| Métrica | Antes (13 feb) | Después (16 feb) | Cambio |
|---------|----------------|-------------------|--------|
| Líneas de código | ~16,500 | ~20,000 | +3,500 (tipos generados + nuevos servicios) |
| API routes | 18 | 21 | +3 (bulk/parse, email/templates, email/zone-content) |
| Servicios | 11 | 13 | +2 (requireAuth, autofill) |
| Archivos eliminados | — | 5 | -5 (backups, legacy) |
| Vulnerabilidades auth | 6 rutas | 0 | -6 |
| N+1 queries | 3 lugares | 0 | -3 |
| Archivos >500 líneas | 3 | 1* | -2 (*solo useRegistrationForm.ts, que es un hook complejo) |
| Tipos derivados de DB | 0 | 14 tablas + 3 vistas | +17 |
| Tests | 0 | 0 | Pendiente M7 |
