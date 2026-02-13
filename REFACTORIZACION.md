# Ruta de Refactorización — Accredia 10/10

> **Proyecto**: Multi-tenant Acreditaciones  
> **Stack**: Next.js 16 (App Router + Turbopack) · TypeScript · Tailwind CSS v4 · Supabase · Vercel  
> **Fecha de auditoría**: 13 de febrero de 2026  
> **Codebase**: ~16,500 líneas TS/TSX/CSS · 18 API routes · 11 servicios · 0 tests  

---

## Estado Actual

El proyecto es **funcional en producción** con arquitectura multi-tenant por subdominio
(`proxy.ts`), tres roles (acreditado, admin_tenant, superadmin), formularios dinámicos,
sistema de zonas, cupos, exportación PuntoTicket y gestión de equipos.

La auditoría línea por línea reveló **6 áreas de mejora** organizadas por prioridad
en milestones independientes que se pueden desplegar por separado.

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

## Diagnóstico por Área

### Seguridad

| Ruta | Estado | Problema |
|------|--------|----------|
| `GET /api/admin/export` | 🔴 Sin auth | Exporta RUT, email, teléfono de todos los registros |
| `GET /api/registrations` | 🔴 Sin auth | Lista registros con datos personales |
| `GET /api/registrations/[id]` | 🔴 Sin auth | Datos completos de una persona por ID |
| `GET/POST/DELETE /api/events/[id]/quotas` | 🔴 Sin auth | Modifica reglas de cupo |
| `GET/POST/DELETE /api/events/[id]/zones` | 🔴 Sin auth | Modifica reglas de zona |
| `GET/POST /api/tenants/[id]/admins` | 🔴 Sin auth | Crea admins de tenant |
| `GET /api/events` (sin filtro) | 🟡 Sin auth | Lista todos los eventos |
| `POST /api/registrations` | ✅ Diseño intencional | Formulario público, auth es opcional |
| `POST/PATCH /api/tenants` | ✅ SuperAdmin check | Correcto |
| `GET /api/superadmin/stats` | ✅ SuperAdmin check | Correcto |
| `GET /api/acreditado/registrations` | ✅ Auth check | Correcto |

### Performance

| Problema | Ubicación | Impacto |
|----------|-----------|---------|
| N+1 queries (3 sub-queries por tenant) | `listTenants()` en `lib/services/tenants.ts` | 10 tenants = 31 queries |
| N+1 en bulk update (1 UPDATE por registro) | `bulkUpdateStatus()` en `lib/services/registrations.ts` | 100 registros = 100 queries |
| Full table scan para conteos | `getRegistrationStats()` | Trae todos los registros para contar |
| 2 queries secuenciales | `getUserTenantRole()` en `lib/services/auth.ts` | 1 query sería suficiente |
| ExcelJS en client bundle | `DynamicRegistrationForm.tsx` importa ExcelJS | Bundle size innecesario |
| Sin paginación real | AdminContext trae 500 registros de golpe | Lento con datasets grandes |

### Código Duplicado

| Duplicación | Ubicaciones | Solución |
|-------------|-------------|----------|
| Browser client creado inline | **20+ archivos** con `createBrowserClient(url, key)` | Usar singleton de `lib/supabase/client.ts` |
| Lógica de autofill | `buildMergedAutofillData()` (server) + `buildDynamicDataForProfile()` (client) | Función isomórfica única |
| Status labels | `types/index.ts` + `ui.tsx` + `export/route.ts` | Centralizar en 1 lugar |
| Interfaces locales Tenant/Event | `SA eventos/page.tsx` define locales en vez de importar | Importar de `@/types` |

### Código Muerto

| Elemento | Ubicación | Acción |
|----------|-----------|--------|
| `getSupabaseBrowserClient()` singleton | `lib/supabase/client.ts` | Preservar (será usado en M2) |
| `export const supabase` legacy | `lib/supabase/index.ts` | 🗑️ Eliminar |
| `CookieOptions` import no usado | `lib/supabase/server.ts` | 🗑️ Eliminar |
| `AdminDashboard.tsx` legacy | `components/admin/AdminDashboard.tsx` | 🗑️ Eliminar |
| Archivos `.bak` y `.bak2` | `components/forms/` | 🗑️ Eliminar |
| `ip_address` en `AuditLog` | `types/index.ts` | Declarado pero nunca poblado |

### Archivos Monolíticos

| Archivo | Líneas | Responsabilidades mezcladas |
|---------|--------|-----------------------------|
| `DynamicRegistrationForm.tsx` | **1,439** | Wizard 3 pasos + CSV/Excel parser + validación + equipo + bulk + submit |
| `SA eventos/page.tsx` | **897** | CRUD eventos + editor form_fields + cupos + zonas + SelectOptionsEditor |
| `globals.css` | **446** | Design tokens + componentes + animaciones + utilidades |

### Tipado

| Aspecto | Estado |
|---------|--------|
| `any` explícito | ✅ Solo 1 ocurrencia — excelente |
| `Record<string, unknown>` | ✅ Usado consistentemente |
| Tipos generados de Supabase | 🟡 No usa `supabase gen types` — riesgo de drift DB↔TS |
| Castings `as Type` en servicios | 🟡 Funcional pero pierde type safety de la DB |

---

## Plan de Ejecución

### Milestone 1 — Seguridad
> **Prioridad**: URGENTE · **~10 archivos** · **Riesgo de regresión**: Bajo  
> **Tiempo estimado**: 1 sesión

Cierra todas las vulnerabilidades de exposición de datos sin auth.

#### Paso 1.1 — Helper `requireAuth()`
```
📁 Crear: lib/services/requireAuth.ts
```
Función reutilizable que en 1 línea:
- Obtiene el usuario actual con `getCurrentUser()`
- Opcionalmente verifica rol (`admin_tenant`, `superadmin`)
- Opcionalmente verifica ownership de tenant
- Retorna `{ user, role }` o lanza error 401/403

```typescript
// Uso esperado en cada API route:
const { user } = await requireAuth(request, { role: 'admin_tenant', tenantId });
```

#### Paso 1.2 — Proteger export
```
✏️ Editar: app/api/admin/export/route.ts
```
- Agregar `requireAuth()` con rol `admin_tenant` o `superadmin`
- Filtrar registros por el tenant del admin autenticado
- **Verificar**: GET sin auth → 403

#### Paso 1.3 — Proteger registrations GET
```
✏️ Editar: app/api/registrations/route.ts (GET)
✏️ Editar: app/api/registrations/[id]/route.ts (GET)
```
- `requireAuth()` en GET
- Admin solo ve registros de sus eventos
- **Verificar**: GET sin auth → 403, GET con auth → solo sus datos

#### Paso 1.4 — Proteger quotas y zones
```
✏️ Editar: app/api/events/[id]/quotas/route.ts (POST, DELETE)
✏️ Editar: app/api/events/[id]/zones/route.ts (POST, DELETE)
```
- `requireAuth()` en mutaciones
- GET puede quedar público (info no sensible)
- **Verificar**: DELETE sin auth → 403

#### Paso 1.5 — Proteger tenant admins
```
✏️ Editar: app/api/tenants/[id]/admins/route.ts
```
- `requireAuth({ role: 'superadmin' })` en POST
- GET: autenticado + superadmin o admin del mismo tenant
- **Verificar**: POST sin auth → 403

#### Paso 1.6 — Verificación final M1
```bash
npx next build        # 0 errores
# Test manual: cada ruta protegida retorna 403 sin auth
```

---

### Milestone 2 — Cliente Supabase Unificado + Limpieza
> **Prioridad**: Alta · **~25 archivos** · **Riesgo de regresión**: Bajo  
> **Tiempo estimado**: 1 sesión

Elimina código muerto y unifica el patrón de client browser.

#### Paso 2.1 — Simplificar singleton
```
✏️ Editar: lib/supabase/client.ts
```
Dejar un único export claro: `getSupabaseBrowserClient()` que retorna singleton.

#### Paso 2.2 — Reemplazar en 20+ archivos
```
✏️ Editar (batch): Todos los archivos que importan createBrowserClient de @supabase/ssr
```
Reemplazo mecánico:
```typescript
// ANTES (en cada archivo):
import { createBrowserClient } from '@supabase/ssr';
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// DESPUÉS:
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
const supabase = getSupabaseBrowserClient();
```

Archivos a editar (lista completa):
- `app/page.tsx`
- `app/superadmin/(dashboard)/page.tsx`
- `app/superadmin/(dashboard)/layout-client.tsx`
- `app/superadmin/(dashboard)/configuracion/page.tsx`
- `app/superadmin/login/page.tsx`
- `app/acreditado/page.tsx`
- `app/acreditado/nueva/page.tsx`
- `app/acreditado/layout.tsx`
- `app/auth/acreditado/page.tsx`
- `app/auth/callback/page.tsx`
- `app/[tenant]/admin/login/AdminLoginForm.tsx`
- `components/admin-dashboard/AdminContext.tsx`
- `components/forms/DynamicRegistrationForm.tsx`
- `hooks/useProfileLookup.ts`
- `hooks/useQuotaCheck.ts`
- `hooks/useTenantProfile.ts`
- (y cualquier otro encontrado con `grep -r "createBrowserClient"`)

#### Paso 2.3 — Eliminar código muerto
```
🗑️ Eliminar: components/admin/AdminDashboard.tsx
🗑️ Eliminar: components/forms/DynamicRegistrationForm.tsx.bak
🗑️ Eliminar: components/forms/AcreditadoRow.tsx.bak2
✏️ Editar: lib/supabase/index.ts         → quitar export const supabase
✏️ Editar: lib/supabase/server.ts        → quitar import CookieOptions
```

#### Paso 2.4 — Verificación final M2
```bash
npx next build                    # 0 errores
grep -r "createBrowserClient" .   # 0 resultados (excepto lib/supabase/)
```

---

### Milestone 3 — Performance de Queries
> **Prioridad**: Alta · **~6 archivos + 1 SQL** · **Riesgo de regresión**: Medio  
> **Tiempo estimado**: 1 sesión

#### Paso 3.1 — Vista SQL para tenant stats
```
📁 Crear: supabase-refactor-views.sql
```
```sql
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
```

#### Paso 3.2 — Reescribir listTenants()
```
✏️ Editar: lib/services/tenants.ts
```
- Usar `v_tenant_stats` → **1 query en vez de 31**
- Misma interfaz `TenantWithStats` de retorno

#### Paso 3.3 — Batch en bulkUpdateStatus()
```
✏️ Editar: lib/services/registrations.ts
```
```typescript
// ANTES: for...of con 1 update por registro
// DESPUÉS:
const { error } = await supabase
  .from('registrations')
  .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
  .in('id', ids);
```

#### Paso 3.4 — Stats con COUNT
```
✏️ Editar: lib/services/registrations.ts → getRegistrationStats()
```
- 3 queries con `count: 'exact', head: true` filtrado por status
- En vez de traer todos los registros y contar en JS

#### Paso 3.5 — Auth role en 1 query
```
✏️ Editar: lib/services/auth.ts → getUserTenantRole()
```
- Combinar check superadmin + tenant_admin en 1 solo query con `or`

#### Paso 3.6 — ExcelJS fuera del client bundle
```
📁 Crear: app/api/bulk/parse/route.ts
✏️ Editar: components/forms/DynamicRegistrationForm.tsx
```
- Mover parsing Excel/CSV a API route server-side
- Client solo envía `FormData` con el archivo
- ExcelJS ya no se importa en el browser → bundle más pequeño

#### Paso 3.7 — Verificación final M3
```bash
npx next build
# Verificar en SA dashboard que stats de tenants sean correctos
# Verificar bulk approve funcione
# Verificar import Excel desde formulario funcione
```

---

### Milestone 4 — Decomposición de Componentes Monolíticos
> **Prioridad**: Media · **3 archivos → ~15 archivos** · **Riesgo de regresión**: Medio  
> **Tiempo estimado**: 1-2 sesiones

#### Paso 4.1 — DynamicRegistrationForm (1,439 → ~5 archivos)

```
📁 Crear: components/forms/registration/
├── RegistrationWizard.tsx       ← Orquestador del wizard (steps, navigation)
├── StepPersonalData.tsx         ← Paso 1: datos personales + autofill
├── StepTeamMembers.tsx          ← Paso 2: equipo (tabla, agregar, eliminar)
├── StepConfirmation.tsx         ← Paso 3: resumen + disclaimer + submit
├── BulkImportParser.tsx         ← Modal de carga masiva CSV/Excel
├── useRegistrationForm.ts       ← Hook: estado del form, validación, submit
└── index.ts                     ← Barrel export
```

Estrategia de división:
1. Extraer el hook de estado primero (`useRegistrationForm`)
2. Mover cada step a su componente
3. `RegistrationWizard` solo orquesta steps y navegación
4. `BulkImportParser` componente aislado con su propia lógica

#### Paso 4.2 — SA Eventos Page (897 → ~4 archivos)

```
📁 Crear: app/superadmin/(dashboard)/eventos/
├── page.tsx                     ← Orquestador (lista + modal)
├── EventFormFieldsTab.tsx       ← Tab de configuración de campos
├── EventQuotasTab.tsx           ← Tab de cupos
├── EventZonesTab.tsx            ← Tab de zonas
└── SelectOptionsEditor.tsx      ← Componente reutilizable (ya existe inline)
```

#### Paso 4.3 — globals.css (446 → 3 archivos)

```
📁 Crear: app/styles/
├── tokens.css                   ← @theme, variables CSS, colores semánticos
├── components.css               ← Clases .btn-*, .card-*, .badge-*, etc.
└── animations.css               ← @keyframes + utilidades de animación

✏️ Editar: app/globals.css       ← Solo @import de los 3 archivos
```

#### Paso 4.4 — Verificación final M4
```bash
npx next build
# Test manual: formulario de acreditación completo (3 pasos + equipo + bulk)
# Test manual: SA eventos CRUD + tabs de form/cupos/zonas
# Test visual: todos los estilos se ven igual
```

---

### Milestone 5 — Tipado Fuerte desde la DB
> **Prioridad**: Media · **~15 archivos** · **Riesgo de regresión**: Bajo-Medio  
> **Tiempo estimado**: 1 sesión

#### Paso 5.1 — Generar tipos de Supabase
```bash
npx supabase gen types typescript --project-id <PROJECT_ID> > lib/supabase/database.types.ts
```

#### Paso 5.2 — Tipar clientes Supabase
```
✏️ Editar: lib/supabase/server.ts
```
```typescript
import type { Database } from './database.types';

export function createSupabaseAdminClient() {
  return createClient<Database>(...);
}
```
Resultado: autocompletado de tablas y columnas en todos los servicios.

#### Paso 5.3 — Derivar tipos de las tablas
```
✏️ Editar: types/index.ts
```
```typescript
import type { Database } from '@/lib/supabase/database.types';

// Derivar en vez de definir manualmente
export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Event  = Database['public']['Tables']['events']['Row'];
// ... etc
```
Mantener interfaces extendidas (`TenantWithStats`, `RegistrationFull`) que agregan campos de vistas.

#### Paso 5.4 — Eliminar interfaces locales
```
✏️ Editar: app/superadmin/(dashboard)/eventos/page.tsx
```
- Eliminar `interface Tenant { ... }` y `interface Event { ... }` locales
- Importar de `@/types`

#### Paso 5.5 — Centralizar STATUS_MAP
```
✏️ Editar: types/index.ts
```
```typescript
export const STATUS_MAP = {
  pendiente: { label: 'Pendiente', color: 'yellow', bgClass: 'bg-yellow-100 text-yellow-800' },
  aprobado:  { label: 'Aprobado',  color: 'green',  bgClass: 'bg-green-100 text-green-800' },
  rechazado: { label: 'Rechazado', color: 'red',    bgClass: 'bg-red-100 text-red-800' },
  revision:  { label: 'En revisión', color: 'blue', bgClass: 'bg-blue-100 text-blue-800' },
} as const;
```
Eliminar definiciones duplicadas en `ui.tsx` y `export/route.ts`.

#### Paso 5.6 — Unificar lógica de autofill
```
✏️ Editar: lib/services/profiles.ts
```
- Hacer `buildMergedAutofillData()` isomórfica (funciona en server y client)
- Eliminar `buildDynamicDataForProfile()` duplicada del hook

#### Paso 5.7 — Verificación final M5
```bash
npx next build
# Verificar autocompletado en IDE al escribir queries Supabase
# Verificar que formulario autocomplete datos correctamente
```

---

### Milestone 6 — Optimización Vercel + Data Fetching
> **Prioridad**: Baja · **~8 archivos + 1 SQL** · **Riesgo de regresión**: Medio-Alto  
> **Tiempo estimado**: 1-2 sesiones

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

## Orden de Ejecución Recomendado

```
Sesión 1  →  M1 (Seguridad)                    ███████████████  URGENTE
Sesión 2  →  M2 (Client unificado + limpieza)   ████████████     ALTA
Sesión 3  →  M3 (Performance queries)            ██████████       ALTA
Sesión 4  →  M4 (Decomposición componentes)      ████████         MEDIA
Sesión 5  →  M5 (Tipado fuerte)                  ██████           MEDIA
Sesión 6  →  M6 (Optimización Vercel)            ██████           BAJA
```

Cada sesión termina con `npx next build` exitoso y commit independiente.

---

## Checklist de Verificación por Milestone

### M1 — Seguridad
- [ ] Helper `requireAuth()` creado y testeado
- [ ] `GET /api/admin/export` protegido
- [ ] `GET /api/registrations` protegido
- [ ] `GET /api/registrations/[id]` protegido
- [ ] `POST/DELETE /api/events/[id]/quotas` protegido
- [ ] `POST/DELETE /api/events/[id]/zones` protegido
- [ ] `GET/POST /api/tenants/[id]/admins` protegido
- [ ] Build exitoso

### M2 — Cliente unificado
- [ ] Singleton `getSupabaseBrowserClient()` simplificado
- [ ] 20+ archivos migrados al singleton
- [ ] Código muerto eliminado (AdminDashboard.tsx, .bak, legacy supabase)
- [ ] Import `CookieOptions` removido
- [ ] `grep "createBrowserClient"` retorna 0 (fuera de lib/supabase)
- [ ] Build exitoso

### M3 — Performance
- [ ] Vista `v_tenant_stats` creada en Supabase
- [ ] `listTenants()` usa la vista (1 query)
- [ ] `bulkUpdateStatus()` usa `.in()` batch
- [ ] `getRegistrationStats()` usa COUNT
- [ ] `getUserTenantRole()` en 1 query
- [ ] ExcelJS parsing en API route server-side
- [ ] Build exitoso

### M4 — Decomposición
- [ ] `DynamicRegistrationForm` dividido en 6+ archivos
- [ ] SA eventos page dividida en 4+ archivos
- [ ] `globals.css` dividido en 3 archivos
- [ ] Formulario de acreditación funciona completo
- [ ] SA eventos CRUD + tabs funcionales
- [ ] Build exitoso

### M5 — Tipado fuerte
- [ ] `database.types.ts` generado
- [ ] Clientes Supabase tipados con `Database`
- [ ] Tipos principales derivados de la DB
- [ ] Interfaces locales eliminadas
- [ ] `STATUS_MAP` centralizado
- [ ] Autofill unificado
- [ ] Build exitoso

### M6 — Optimización Vercel
- [ ] Páginas acreditado como Server Components
- [ ] Caché de tenant con `revalidate`
- [ ] `revalidatePath` tras mutaciones
- [ ] Función SQL transaccional para cupos
- [ ] Edge runtime en rutas candidatas
- [ ] Build exitoso

---

## Lo que Ya Está Bien (no tocar)

- ✅ **Arquitectura tenant por subdominio** con `proxy.ts` — limpio y correcto para Next.js 16
- ✅ **Server Components** en `[tenant]/layout.tsx`, `[tenant]/page.tsx`, `[tenant]/acreditacion/page.tsx`, `[tenant]/admin/page.tsx`
- ✅ **Capa de servicios** separada de API routes — buen patrón
- ✅ **Vistas SQL** (`v_registration_full`, `v_event_full`) para datos enriquecidos
- ✅ **Sistema de colores** con palette generator y WCAG contrast checks
- ✅ **Validación de RUT** con dígito verificador
- ✅ **Timezone Chile** con manejo de DST
- ✅ **Auditoría** de acciones críticas
- ✅ **Barrel exports** en servicios y componentes admin
- ✅ **0 usos de `any`** (solo 1 en tipos) — disciplina excelente
- ✅ **Design tokens semánticos** en CSS
- ✅ **Sistema de zonas v2** con match_field cargo/tipo_medio
- ✅ **PuntoTicket export** con acreditación fija configurable por tenant
