<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1-black?logo=next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript" />
</p>

# 🎫 ACCREDIA — Sistema Multi-Tenant de Acreditación de Prensa

> Plataforma integral para gestionar acreditaciones de medios de comunicación en eventos deportivos y espectáculos. Arquitectura multi-tenant con identidad única por RUT, formularios dinámicos, sistema de cupos y control de acceso QR.

---

## Tabla de Contenidos

- [Visión General](#visión-general)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Modelo de Datos](#modelo-de-datos)
- [Flujo de Trabajo (Workflow)](#flujo-de-trabajo-workflow)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Rutas de la Aplicación](#rutas-de-la-aplicación)
- [API Endpoints](#api-endpoints)
- [Instalación y Setup](#instalación-y-setup)
- [Variables de Entorno](#variables-de-entorno)
- [Changelog v2.0](#changelog-v20)
- [Roadmap — Posibles Mejoras](#roadmap--posibles-mejoras)

---

## Visión General

Accredia resuelve un problema real: **la gestión de acreditaciones de prensa en eventos en vivo es caótica, manual y repetitiva**. Cada club, arena o productora maneja sus propias planillas Excel, emails y listas impresas.

### Principios de diseño

| Principio | Implementación |
|---|---|
| **Identidad Única** | Un periodista se registra UNA vez (por RUT). Sus datos se reutilizan en todos los eventos. |
| **Multi-tenancy por Slug** | Cada organización tiene su URL (`/cruzados`, `/claro-arena`), branding propio y datos aislados. |
| **Formularios Diferenciales** | Si el perfil ya tiene nombre/email/foto, esos campos no se muestran. Solo se piden los datos faltantes. |
| **Cupos Inteligentes** | Límites configurables por tipo de medio y por organización (ej: máx 3 fotógrafos de Canal 13). |
| **QR Opcional** | Cada tenant decide si habilita control de acceso con QR. Si lo activa, se genera automáticamente al aprobar. |

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                            │
│  Next.js 16 (App Router + Turbopack)                    │
│  React 19 · Tailwind v4 · TypeScript Strict             │
├──────────┬──────────┬───────────┬───────────────────────┤
│ Landing  │ /[tenant]│ /acredita │ /superadmin            │
│ Pública  │ Público  │ do Portal │ Panel Global           │
│          │ Admin    │ Manager   │                        │
├──────────┴──────────┴───────────┴───────────────────────┤
│                    API ROUTES (13)                        │
│  /api/registrations · /api/events · /api/tenants · ...   │
├─────────────────────────────────────────────────────────┤
│                  SERVICES LAYER (9)                       │
│  profiles · registrations · quotas · tenants · events    │
│  teams · email · audit · auth                            │
├─────────────────────────────────────────────────────────┤
│              SUPABASE (PostgreSQL + Auth)                 │
│  11 tablas · 2 vistas · 9 funciones · RLS completo       │
│  Profiles (identidad) · Tenants · Events · Registrations │
└─────────────────────────────────────────────────────────┘
```

### Jerarquía de Roles

| Rol | Alcance | Capacidades |
|-----|---------|-------------|
| **SuperAdmin** | Global | Crear tenants, eventos, formularios, cupos, asignar admins |
| **Admin Tenant** | 1 tenant | Aprobar/rechazar, exportar, escanear QR, ver stats |
| **Manager/Acreditado** | Su perfil | Registrarse, gestionar equipo frecuente, ver estado |
| **Público** | 1 evento | Completar formulario de acreditación sin cuenta |

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.1.6 |
| UI | React | 19.2.4 |
| Estilos | Tailwind CSS | 4.x |
| Lenguaje | TypeScript (strict) | 5.x |
| Base de datos | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth + @supabase/ssr | 0.8.0 |
| Email | Resend | 6.5.2 |
| Export | ExcelJS | 4.4.0 |
| Fuentes | Montserrat + Barlow Condensed (Google Fonts) | — |

---

## Modelo de Datos

### Tablas principales (11)

```
profiles              ← Identidad única global por RUT
  ├── registrations   ← "Ticket" de acreditación (profile + event)
  │     └── qr_token, checked_in_at
  └── team_members    ← Equipo frecuente del manager

tenants               ← Organizaciones (branding, colores, logos)
  ├── events          ← Eventos con form_fields JSONB dinámico
  │     └── event_quota_rules  ← Cupos por tipo_medio
  └── tenant_admins   ← Admins asignados al tenant

superadmins           ← Administradores globales
audit_logs            ← Registro de auditoría
email_templates       ← Templates de email por tenant
email_logs            ← Log de emails enviados
```

### Vistas

| Vista | Propósito |
|-------|-----------|
| `v_event_full` | Evento + datos del tenant (JOIN) |
| `v_registration_full` | Registration + profile + event + tenant (JOIN completo) |

### Funciones DB (9)

| Función | Propósito |
|---------|-----------|
| `get_or_create_profile()` | Busca por RUT, crea si no existe, actualiza datos_base |
| `check_quota()` | Verifica cupo disponible por tipo_medio y organización |
| `generate_qr_token()` | Genera token UUID único para la credencial |
| `validate_qr_checkin()` | Valida token + marca check-in con timestamp |
| `is_superadmin()` | RLS helper — verifica rol superadmin |
| `has_tenant_access()` | RLS helper — verifica acceso a tenant |
| `get_tenant_role()` | RLS helper — retorna rol del usuario en tenant |
| `can_edit_tenant()` | RLS helper — verifica permiso de escritura |
| `update_updated_at()` | Trigger — actualiza `updated_at` automáticamente |

---

## Flujo de Trabajo (Workflow)

### 1. Configuración (SuperAdmin)

```
SuperAdmin Login → Crear Tenant (nombre, slug, branding, colores)
                 → Crear Evento (nombre, fecha, venue, rival)
                 → Diseñar Formulario (form builder con campos drag)
                 → Configurar Cupos (reglas por tipo_medio → máx/org + máx/global)
                 → Asignar Admin Tenant (email + password + rol)
                 → Activar Evento
```

### 2. Registro Público (Acreditación)

```
Periodista visita /{slug} (ej: /cruzados)
  → Ve landing con evento activo, fecha, venue, rival
  → Click "Solicitar Acreditación"
  → PASO 1: Ingresa RUT
       ├─ RUT encontrado → Auto-rellena nombre, email, medio, foto
       │                   Solo muestra campos FALTANTES (formulario diferencial)
       └─ RUT nuevo → Muestra formulario completo
  → PASO 2: Completa campos dinámicos (definidos por el SuperAdmin)
       → Verificación de cupo en tiempo real
       → Si cupo agotado → muestra mensaje y bloquea envío
  → PASO 3: Confirmación → Registration creada con status "pendiente"
```

### 3. Gestión (Admin Tenant)

```
Admin Login → Dashboard con estadísticas en tiempo real
  → Tabla de acreditaciones con filtros (estado, tipo, organización, búsqueda)
  → Acciones individuales:
       ├─ ✅ Aprobar → Auto-envía email + genera QR (si habilitado)
       └─ ❌ Rechazar → Auto-envía email de rechazo con motivo
  → Acciones masivas (bulk):
       ├─ Seleccionar múltiples → Aprobar/Rechazar en lote
       └─ Envío de emails en batch (con rate limiting 500ms)
  → Exportar a Excel/CSV (con filtros aplicados)
  → Scanner QR (pantalla completa, control de puerta)
```

### 4. Control de Acceso (Día del Evento)

```
Admin/Staff abre /{slug}/admin/scanner
  → Escanea QR del acreditado (cámara o scanner USB)
  → Sistema valida token:
       ├─ ✅ Válido → Pantalla VERDE con foto, nombre, medio, cargo
       │              Marca checked_in_at en DB
       ├─ ⚠️ Ya ingresó → Pantalla AMARILLA con hora de check-in previo
       └─ ❌ Inválido → Pantalla ROJA "Credencial no válida"
  → Auto-reset después de 4 segundos
```

### 5. Portal del Acreditado (Manager)

```
Periodista con cuenta → Login → Dashboard personal
  → Ver todas sus acreditaciones (cross-tenant)
  → Ver estado de cada solicitud (pendiente/aprobado/rechazado)
  → Editar su perfil (datos se reutilizan en futuras acreditaciones)
  → Solicitar nueva acreditación en eventos activos
```

### Diagrama de flujo completo

```
                    ┌──────────────┐
                    │   Público    │
                    └──────┬───────┘
                           │
                    /{slug}/acreditacion
                           │
                    ┌──────▼───────┐
                    │  Ingresa RUT │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │ Perfil     │            │ Perfil
              │ existe     │            │ nuevo
              │            │            │
        ┌─────▼─────┐     │     ┌──────▼──────┐
        │ Auto-fill  │     │     │  Form       │
        │ Solo pide  │     │     │  Completo   │
        │ faltantes  │     │     │             │
        └─────┬─────┘     │     └──────┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼───────┐
                    │ Check Cupo   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  PENDIENTE   │ ← Registration creada
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Admin Tenant │ ← Revisa solicitud
                    └──┬───────┬──┘
                       │       │
                ┌──────▼──┐ ┌──▼──────┐
                │APROBADO │ │RECHAZADO│
                │+ Email  │ │+ Email  │
                │+ QR     │ │+ Motivo │
                └────┬────┘ └─────────┘
                     │
              ┌──────▼───────┐
              │  DÍA EVENTO  │
              │  Scanner QR  │
              │  Check-in ✓  │
              └──────────────┘
```

---

## Estructura del Proyecto

```
/
├── app/
│   ├── layout.tsx                        # Root layout (Montserrat + Barlow)
│   ├── page.tsx                          # Landing pública con lista de tenants
│   ├── globals.css                       # Tailwind v4 + CSS variables tenant
│   │
│   ├── [tenant]/                         # ── RUTAS DINÁMICAS POR TENANT ──
│   │   ├── layout.tsx                    # Inyecta branding (CSS vars)
│   │   ├── page.tsx                      # Landing del tenant con evento activo
│   │   ├── acreditacion/page.tsx         # Formulario dinámico de acreditación
│   │   └── admin/
│   │       ├── page.tsx                  # Dashboard admin (protected)
│   │       ├── login/page.tsx            # Login admin tenant
│   │       └── scanner/page.tsx          # Scanner QR control de acceso
│   │
│   ├── superadmin/                       # ── PANEL SUPER ADMINISTRADOR ──
│   │   ├── layout.tsx                    # Auth guard + sidebar
│   │   ├── layout-client.tsx             # Sidebar navegación
│   │   ├── page.tsx                      # Dashboard global con stats
│   │   ├── login/page.tsx                # Login superadmin
│   │   ├── tenants/page.tsx              # CRUD tenants + branding
│   │   ├── eventos/page.tsx              # CRUD eventos + form builder + cupos
│   │   ├── admins/page.tsx               # Gestión admins por tenant
│   │   ├── acreditados/page.tsx          # Vista global de perfiles
│   │   └── configuracion/page.tsx        # Config sistema + crear superadmins
│   │
│   ├── acreditado/                       # ── PORTAL DEL ACREDITADO ──
│   │   ├── layout.tsx                    # Sidebar portal
│   │   ├── page.tsx                      # Home + eventos activos
│   │   ├── dashboard/page.tsx            # Mis acreditaciones
│   │   ├── nueva/page.tsx                # Seleccionar evento
│   │   └── perfil/page.tsx               # Editar mi perfil
│   │
│   ├── auth/                             # ── AUTENTICACIÓN ──
│   │   ├── layout.tsx                    # Auth layout
│   │   ├── acreditado/page.tsx           # Login/Registro acreditado
│   │   └── callback/page.tsx             # OAuth callback (Suspense)
│   │
│   └── api/                              # ── 13 RUTAS API ──
│       ├── registrations/route.ts        # POST crear / GET listar
│       ├── registrations/[id]/route.ts   # PATCH aprobar-rechazar / GET detalle
│       ├── profiles/lookup/route.ts      # GET buscar por RUT
│       ├── events/route.ts               # GET listar / POST crear
│       ├── events/[id]/quotas/route.ts   # GET-POST-DELETE cupos
│       ├── tenants/route.ts              # GET listar / POST crear
│       ├── tenants/[id]/admins/route.ts  # GET-POST admins
│       ├── teams/route.ts                # GET-POST-DELETE equipo
│       ├── qr/validate/route.ts          # POST validar QR + check-in
│       ├── bulk/route.ts                 # POST acciones masivas
│       ├── superadmin/stats/route.ts     # GET estadísticas globales
│       ├── admin/export/route.ts         # GET export Excel/CSV
│       └── auth/callback/route.ts        # GET callback Supabase
│
├── components/
│   ├── shared/ui.tsx                     # StatusBadge, Alert, Spinner, Card
│   ├── forms/DynamicRegistrationForm.tsx # Formulario 3 pasos (RUT→Form→OK)
│   ├── admin/AdminDashboard.tsx          # Panel admin (stats, tabla, filtros)
│   └── qr/QRScanner.tsx                  # Scanner QR pantalla completa
│
├── hooks/
│   ├── useProfileLookup.ts              # Lookup RUT + detección campos faltantes
│   └── useQuotaCheck.ts                 # Verificación cupo en tiempo real
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # Browser client
│   │   ├── server.ts                    # Server client + Admin client
│   │   └── middleware.ts                # Middleware client
│   └── services/                        # ── 9 SERVICIOS ──
│       ├── profiles.ts                  # CRUD perfil, lookup por RUT
│       ├── registrations.ts             # CRUD registrations, bulk, stats
│       ├── quotas.ts                    # check_quota, reglas con usage
│       ├── tenants.ts                   # CRUD tenants, admins
│       ├── events.ts                    # CRUD eventos, active event
│       ├── teams.ts                     # CRUD equipo frecuente
│       ├── email.ts                     # Envío emails con Resend
│       ├── audit.ts                     # Logging de auditoría
│       ├── auth.ts                      # Roles, permisos, guards
│       └── index.ts                     # Barrel export
│
├── types/
│   └── index.ts                         # Tipos unificados (Profile, Tenant, Event, etc.)
│
├── supabase-v2-complete.sql             # Schema completo (11 tablas, 9 funciones, RLS)
├── middleware.ts                         # Supabase session refresh
├── next.config.ts                       # Config Next.js
├── package.json                         # Dependencias
└── env-example                          # Variables de entorno requeridas
```

---

## Rutas de la Aplicación

### Páginas (26 rutas compiladas)

| Ruta | Tipo | Protección | Descripción |
|------|------|-----------|-------------|
| `/` | Estática | Pública | Landing con lista de tenants activos |
| `/[tenant]` | Dinámica | Pública | Landing del tenant con evento activo |
| `/[tenant]/acreditacion` | Dinámica | Pública | Formulario de acreditación |
| `/[tenant]/admin` | Dinámica | Admin Tenant | Dashboard de administración |
| `/[tenant]/admin/login` | Dinámica | Pública | Login admin tenant |
| `/[tenant]/admin/scanner` | Dinámica | Admin Tenant | Scanner QR control de puertas |
| `/superadmin` | Dinámica | SuperAdmin | Dashboard global |
| `/superadmin/login` | Estática | Pública | Login superadmin |
| `/superadmin/tenants` | Dinámica | SuperAdmin | CRUD de organizaciones |
| `/superadmin/eventos` | Dinámica | SuperAdmin | CRUD eventos + form builder |
| `/superadmin/admins` | Dinámica | SuperAdmin | Gestión de admins por tenant |
| `/superadmin/acreditados` | Dinámica | SuperAdmin | Vista global de perfiles |
| `/superadmin/configuracion` | Dinámica | SuperAdmin | Configuración sistema |
| `/auth/acreditado` | Estática | Pública | Login/Registro acreditado |
| `/auth/callback` | Estática | Pública | OAuth callback |
| `/acreditado` | Estática | Acreditado | Home portal |
| `/acreditado/dashboard` | Estática | Acreditado | Mis acreditaciones |
| `/acreditado/nueva` | Estática | Acreditado | Seleccionar evento |
| `/acreditado/perfil` | Estática | Acreditado | Editar perfil |

---

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/registrations` | Crear acreditación (con check de cupo) |
| `GET` | `/api/registrations` | Listar con filtros (event, tenant, status, search) |
| `PATCH` | `/api/registrations/[id]` | Aprobar/rechazar + email automático + QR |
| `GET` | `/api/registrations/[id]` | Detalle de una acreditación |
| `GET` | `/api/profiles/lookup?rut=...` | Buscar perfil por RUT |
| `GET` | `/api/events` | Listar eventos (por tenant o todos) |
| `POST` | `/api/events` | Crear evento con form_fields |
| `GET` | `/api/events/[id]/quotas` | Ver cupos con usage actual |
| `POST` | `/api/events/[id]/quotas` | Upsert regla de cupo |
| `DELETE` | `/api/events/[id]/quotas` | Eliminar regla de cupo |
| `GET` | `/api/tenants` | Listar tenants (con stats opcional) |
| `POST` | `/api/tenants` | Crear tenant |
| `GET` | `/api/tenants/[id]/admins` | Listar admins del tenant |
| `POST` | `/api/tenants/[id]/admins` | Crear admin (auth user + asignación) |
| `GET` | `/api/teams` | Equipo frecuente del manager |
| `POST` | `/api/teams` | Agregar miembro al equipo |
| `DELETE` | `/api/teams` | Eliminar miembro |
| `POST` | `/api/qr/validate` | Validar QR token + check-in |
| `POST` | `/api/bulk` | Aprobar/rechazar masivo + emails |
| `GET` | `/api/superadmin/stats` | Estadísticas globales |
| `GET` | `/api/admin/export` | Exportar Excel/CSV |
| `GET` | `/api/auth/callback` | Callback Supabase Auth |

---

## Instalación y Setup

### Requisitos previos

- Node.js 18+
- Cuenta de Supabase (free tier es suficiente)
- Cuenta de Resend (opcional, para emails)

### 1. Clonar e instalar

```bash
git clone https://github.com/Agencia-VS/Multi-tenant-acreditaciones.git
cd Multi-tenant-acreditaciones
npm install
```

### 2. Configurar variables de entorno

```bash
cp env-example .env.local
```

Editar `.env.local` con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@tuproyecto.resend.dev
```

### 3. Crear la base de datos

Ejecutar `supabase-v2-complete.sql` en el SQL Editor de Supabase. Este script:
- Elimina el schema anterior (tablas `mt_*`)
- Crea 11 tablas nuevas
- Crea 2 vistas
- Crea 9 funciones
- Configura RLS en todas las tablas
- Inserta seed data (2 tenants de ejemplo con eventos)

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

La app estará en `http://localhost:3000`.

### 5. Build para producción

```bash
npm run build
npm start
```

---

## Variables de Entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clave pública anon de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clave service_role (solo server-side) |
| `RESEND_API_KEY` | ⚡ | API key de Resend (para emails) |
| `RESEND_FROM_EMAIL` | ⚡ | Email remitente (ej: `noreply@accredia.resend.dev`) |

---

## Changelog v2.0

> **Borrón y cuenta nueva** — Rediseño completo del sistema sobre la misma base de Next.js + Supabase.

### Base de datos
- ❌ Eliminadas todas las tablas `mt_*` del schema anterior
- ✅ Nuevo schema con 11 tablas limpias sin prefijo
- ✅ Columna `form_fields` JSONB en `events` (reemplaza `mt_form_configs`)
- ✅ Sistema de cupos con `event_quota_rules` (por tipo_medio + organización)
- ✅ Tabla `profiles` como identidad única global por RUT
- ✅ RLS completo en todas las tablas
- ✅ 9 funciones SQL (get_or_create_profile, check_quota, QR, etc.)
- ✅ Seed data con 2 tenants de ejemplo

### Tipos TypeScript
- ❌ Eliminados 6 archivos de tipos fragmentados
- ✅ `types/index.ts` unificado con todas las interfaces y constantes

### Servicios
- ❌ Eliminados hooks y servicios legacy
- ✅ 9 servicios nuevos en `lib/services/` (profiles, registrations, quotas, tenants, events, teams, email, audit, auth)

### API
- ❌ Eliminadas todas las rutas API anteriores
- ✅ 13 rutas nuevas RESTful con validación y audit logging

### UI / Páginas
- ❌ Eliminados todos los componentes y páginas anteriores
- ✅ 4 componentes core nuevos (DynamicRegistrationForm, AdminDashboard, QRScanner, UI shared)
- ✅ 2 hooks especializados (useProfileLookup, useQuotaCheck)
- ✅ 19 páginas nuevas organizadas en 5 áreas:
  - **Landing** (1): Lista de tenants activos
  - **Tenant** (5): Landing, acreditación, admin, login, scanner QR
  - **SuperAdmin** (7): Dashboard, tenants, eventos+forms+cupos, admins, perfiles, config, login
  - **Acreditado** (4): Home, dashboard, nueva solicitud, perfil
  - **Auth** (2): Login/registro, callback

### Conceptos nuevos
- 🆕 **Formulario Diferencial**: detecta campos ya completados y solo pide los faltantes
- 🆕 **Form Builder**: SuperAdmin diseña formularios por evento (tipo campo, obligatorio, profile_field)
- 🆕 **Sistema de Cupos**: reglas por tipo_medio con máx/organización y máx/global
- 🆕 **QR Toggle**: cada tenant habilita/deshabilita QR independientemente
- 🆕 **Scanner QR de Puerta**: pantalla completa con verde/rojo/amarillo y foto del acreditado
- 🆕 **Portal Acreditado**: dashboard cross-tenant para periodistas
- 🆕 **Audit Log**: registro de todas las acciones (approve, reject, create, checkin)

---

## Roadmap — Posibles Mejoras

### 🔴 Prioridad Alta — Core Features

| # | Feature | Descripción | Impacto |
|---|---------|-------------|---------|
| 1 | **Upload de fotos a Supabase Storage** | Actualmente `foto_url` es un string. Implementar upload directo a Supabase Storage con resize automático, preview en el formulario, y thumbnail en la tabla admin. | Crítico para credenciales impresas |
| 2 | **Generación de credencial PDF/imagen** | Al aprobar, generar automáticamente la credencial con foto, nombre, medio, cargo, QR y branding del tenant. Imprimible o descargable desde el portal. | Diferenciador clave vs competencia |
| 3 | **Middleware de autenticación robusto** | Mejorar `middleware.ts` para proteger rutas server-side (actualmente la protección es a nivel de componente). Redirect automático según rol. | Seguridad |
| 4 | **Validación RUT chileno** | Implementar algoritmo de verificación de dígito verificador del RUT en frontend y backend. Formateo automático (12.345.678-9). | UX + integridad de datos |
| 5 | **Notificaciones en tiempo real** | Usar Supabase Realtime para que admins vean nuevas solicitudes instantáneamente sin recargar. Badge de "nuevas" en la sidebar. | UX admin |

### 🟡 Prioridad Media — Experiencia y Eficiencia

| # | Feature | Descripción | Impacto |
|---|---------|-------------|---------|
| 6 | **Equipo frecuente funcional** | Completar UI de gestión de equipo en portal acreditado. Un manager puede guardar su equipo (periodista, camarógrafo, fotógrafo) y acreditarlos a todos con un clic. | Ahorro de tiempo masivo |
| 7 | **Drag & drop en Form Builder** | Agregar reordenamiento de campos arrastrando (dnd-kit). Campos custom con validación regex. Campos condicionales (si selecciona "TV" → mostrar campo "Canal"). | Flexibilidad máxima |
| 8 | **Dashboard analytics avanzado** | Gráficos con Recharts/Chart.js: tendencias de acreditaciones, distribución por tipo de medio, tiempos de aprobación, tasa de rechazo, comparativa entre eventos. | Valor para tomadores de decisiones |
| 9 | **Email templates editables** | UI en SuperAdmin para editar templates de email (aprobación, rechazo, recordatorio). Variables dinámicas ({nombre}, {evento}, {qr_url}). Preview en tiempo real. | Personalización |
| 10 | **Import masivo desde Excel** | Permitir que admins suban un Excel con lista de periodistas pre-aprobados. Crear perfiles + registrations automáticamente. | Migración de datos |
| 11 | **Historial de eventos pasados** | Vista de eventos archivados con estadísticas históricas. Comparar evento actual vs anteriores. Reutilizar formulario de evento pasado como template. | Gestión a largo plazo |

### 🟢 Prioridad Baja — Diferenciadores Premium

| # | Feature | Descripción | Impacto |
|---|---------|-------------|---------|
| 12 | **Multi-idioma (i18n)** | Soporte inglés/español/portugués con next-intl. Detección automática por browser. Útil para eventos internacionales (Copa América, etc). | Mercado internacional |
| 13 | **App móvil para Scanner** | PWA o React Native wrapper para que el staff de puerta use su celular como scanner QR dedicado. Modo offline con sync posterior. | Operaciones en campo |
| 14 | **Zonas de acceso** | Credencial con zonas habilitadas (cancha, sala de prensa, cabina, mixta). Scanner valida zona específica según ubicación del checkpoint. | Granularidad de acceso |
| 15 | **API pública + webhooks** | API key por tenant para integrar con sistemas externos. Webhook en cambios de status. SDK para medios que quieran pre-cargar datos. | Ecosistema abierto |
| 16 | **Firma digital / disclaimer** | Checkbox de aceptación de términos y condiciones con firma digital. PDF firmado adjunto a la credencial. | Compliance legal |
| 17 | **Auto-aprobación por whitelist** | Lista de RUTs pre-aprobados (ej: periodistas recurrentes). Si el RUT está en la whitelist → aprobación instantánea sin intervención manual. | Eficiencia operacional |
| 18 | **Integración con calendario** | Al aprobar → enviar invitación ICS al email del acreditado con fecha, hora, venue y link a credencial digital. | UX periodista |
| 19 | **Rate limiting y anti-spam** | Rate limiter en API routes. Captcha en formulario público. Detección de registros duplicados. IP tracking. | Seguridad |
| 20 | **Testing E2E** | Playwright tests para flujos críticos: registro → aprobación → QR → check-in. CI/CD con GitHub Actions. | Calidad y confianza |

### 🔵 Visión a Futuro — La Plataforma Definitiva

| Feature | Descripción |
|---------|-------------|
| **Marketplace de tenants** | Self-service signup para nuevos clubes/organizadores. Plan free (1 evento, 50 acreditaciones) → Pro → Enterprise. |
| **AI para fotos** | Validar automáticamente que la foto sea tipo carnet (rostro centrado, fondo neutro). Recorte automático. Detección de duplicados por rostro. |
| **Analytics públicos** | Dashboard tipo "State of Press Accreditation" con datos anónimos agregados. Cuántos periodistas cubren fútbol vs música, tendencias, etc. |
| **White-label completo** | Dominio custom por tenant (prensa.cruzados.cl). Emails desde su propio dominio. Logo y branding 100% personalizado. |
| **Integración con ticketing** | Sync con sistemas de venta de entradas (Ticketmaster, Passline) para reservar cupos de prensa automáticamente. |
| **Blockchain credentials** | Credenciales verificables on-chain. Un periodista puede demostrar su historial de acreditaciones sin depender de la plataforma. |

---

## Despliegue

### Vercel (Recomendado)

1. Conectar el repositorio a Vercel
2. Configurar variables de entorno en el dashboard
3. Deploy automático en cada push a `main`

### Otros proveedores

```bash
npm run build  # Genera .next/
npm start      # Inicia servidor de producción
```

Asegúrate que las variables de entorno estén configuradas en el runtime.

---

## Licencia

MIT License

---

<p align="center">
  <b>Accredia v2.0</b> — Sistema de Acreditación de Prensa<br>
  Desarrollado por <a href="https://github.com/Agencia-VS">Agencia VS</a> ❤️
</p>