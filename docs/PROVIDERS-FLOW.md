# Sistema de Proveedores Autorizados — Diseño Completo

> **Rama**: `reservada`  
> **Meta**: 14 de marzo 2026  
> **Estado**: En diseño

---

## 1. Problema

Hoy, cualquier persona puede descubrir los eventos de un tenant desde el portal de acreditados (`/acreditado/nueva`) y completar el formulario de acreditación. El admin no tiene control sobre **quién** puede siquiera ver sus eventos ni sobre **qué zonas** puede solicitar cada proveedor.

El admin de un tenant quiere:
- Que sus eventos sean **invisibles** para el público general
- Que solo **proveedores que él autorice** puedan ver sus eventos
- Asignar **zonas específicas** a cada proveedor (ej: "TeleMedios" = VIP + Staff, "Deportes FM" = Solo Prensa)
- Que esa configuración sea **permanente** para todos los eventos futuros
- Poder **modificar** permisos en cualquier momento

---

## 2. Conceptos clave

| Concepto | Descripción |
|---|---|
| **Proveedor** | Un acreditado (con perfil + cuenta) al que un tenant le ha dado acceso. Es el "responsable" que gestiona acreditaciones para su equipo. |
| **Modo del tenant** | `open` (actual, todo público) vs `approved_only` (solo proveedores autorizados). Lo activa el **superadmin** por tenant. |
| **Zonas permitidas** | Array de zonas a las que el proveedor puede acreditar gente. Definidas a nivel de tenant, aplican a todos los eventos. |
| **Solicitud de acceso** | Petición de un acreditado para convertirse en proveedor de un tenant. |
| **Link de invitación** | URL con código único que el admin comparte a proveedores que quiere invitar. Sin código no se puede solicitar acceso. |
| **Volumen esperado** | Proveedores que acreditan 200-400 personas cada uno, hasta ~1500 por evento. Carga masiva (Excel) es el flujo principal. |

---

## 3. Flujos detallados

### 3.1 Activación del módulo (Superadmin)

El módulo de proveedores **no es visible por defecto**. Solo el superadmin lo habilita para los tenants que lo requieran.

```
Superadmin → Panel Superadmin → Detalle del Tenant → Toggle "Módulo Proveedores"
  └─ Esto setea tenant.config.provider_mode = 'approved_only'
  └─ Desde ese momento:
      ├─ Los eventos del tenant desaparecen de /acreditado/nueva (público)
      ├─ Aparece la tab "Proveedores" en el panel admin del tenant
      └─ El admin del tenant puede gestionar proveedores desde ahí
```

**Prerequisitos que el superadmin debe verificar antes de activar**:
- El tenant debe tener `config.zonas[]` configuradas (son las que se asignarán a proveedores)
- El superadmin puede configurar las zonas en el mismo momento de activar el módulo

**¿Qué ve el admin del tenant?**
- Si el módulo NO está activo → no ve la tab "Proveedores", todo funciona como hoy
- Si el módulo SÍ está activo → ve la tab "Proveedores" y puede gestionar solicitudes, zonas, link de invitación
- El admin **no puede** activar/desactivar el módulo él mismo — solo el superadmin

**¿Qué pasa si se desactiva?**
- Los eventos vuelven a ser públicos
- La tab "Proveedores" desaparece del panel admin
- Los registros de `tenant_providers` se mantienen en DB (por si se reactiva)
- Las acreditaciones existentes no se tocan

### 3.2 Invitación + Solicitud de acceso

El acceso NO es un directorio público. Solo se puede solicitar a través de un **link de invitación** que el admin comparte a los proveedores que desea invitar.

#### 3.2.1 El admin genera el link de invitación

```
Admin → Panel Admin → Tab "Proveedores" → Botón "Generar Link de Invitación"
  └─ Se genera un código único: /{tenant-slug}/proveedores?code=X7k9mZ
  └─ El admin copia el link y lo comparte por WhatsApp, email, etc.
  └─ Si el código se filtra → botón "Regenerar código" (invalida el anterior)
  └─ El código se almacena en tenant.config.provider_invite_code
```

#### 3.2.2 El proveedor recibe el link (página pública ligera)

```
Proveedor recibe link por WhatsApp/Email
  │
  └─ Abre /{tenant-slug}/proveedores?code=X7k9mZ
      │
      ├─ Página pública ligera con branding del tenant:
      │   • Logo, nombre, descripción
      │   • "[Tenant] te invita a ser proveedor de acreditaciones"
      │
      ├─ CASO A: No tiene cuenta
      │   └─ Ve botones: "Crear cuenta" / "Iniciar sesión"
      │   └─ Ambos hacen redirect de vuelta a esta URL después de auth
      │   └─ Al registrarse → completa perfil mínimo → vuelve aquí
      │
      ├─ CASO B: Tiene cuenta y está logueado
      │   └─ Ve formulario simple:
      │       • Nombre de organización/medio (pre-llenado del perfil)
      │       • Mensaje opcional al admin
      │       • Botón "Solicitar Acceso"
      │   └─ Se crea tenant_providers(status='pending')
      │   └─ Mensaje: "Solicitud enviada. Puedes ver el estado en tu portal."
      │   └─ Link a /acreditado/organizaciones
      │
      ├─ CASO C: Ya tiene solicitud pendiente
      │   └─ "Tu solicitud está en revisión. Te notificaremos cuando sea procesada."
      │
      ├─ CASO D: Ya fue aprobado
      │   └─ "Ya tienes acceso. Ir al portal →" (link a /acreditado/nueva)
      │
      └─ CASO E: Código inválido o sin código
          └─ "Este link no es válido o ha expirado."
```

#### 3.2.3 El portal de acreditados como centro de operaciones

Después de solicitar acceso, **todo sucede dentro del portal de acreditados**:

```
Portal de Acreditados (/acreditado)
  │
  ├─ "Organizaciones" (/acreditado/organizaciones)
  │   └─ Solo muestra tenants donde el usuario YA tiene relación:
  │       • Pendiente → "Solicitud enviada el DD/MM" (sin acción)
  │       • Aprobado → Tarjeta con zonas asignadas + link a eventos
  │       • Rechazado → "No aprobado" + opción re-solicitar (si admin lo permite)
  │       • Suspendido → "Acceso suspendido temporalmente"
  │   └─ NO es un directorio público de tenants
  │   └─ Si no tiene relaciones → "Aún no tienes organizaciones. 
  │      Contacta al administrador para recibir un link de invitación."
  │
  ├─ "Nueva Solicitud" (/acreditado/nueva)
  │   └─ Eventos de tenants 'open' → se muestran como hoy
  │   └─ Eventos de tenants 'approved_only' → solo si status='approved'
  │   └─ El proveedor aprobado ve los eventos mezclados naturalmente
  │
  ├─ "Mi Equipo" (/acreditado/equipo)
  │   └─ Sin cambios. Sigue gestionando equipo frecuente.
  │
  └─ "Mi Perfil" (/acreditado/perfil)
      └─ Sin cambios.
```

### 3.3 Gestión de proveedores (Admin)

```
Admin → Panel Admin → Tab "Proveedores"
  │
  ├─ HEADER:
  │   ├─ Quick stats: [Total: 12] [Pendientes: 3] [Activos: 8] [Suspendidos: 1]
  │   └─ Botón "Link de Invitación" → copia link + opción "Regenerar código"
  │
  ├─ Vista principal: Tabla con columnas
  │   [Nombre] [Organización] [Email] [Estado] [Zonas] [Acreditados] [Fecha] [Acciones]
  │                                                      └─ cantidad de registrations
  │                                                         enviadas por este proveedor
  │
  ├─ Filtros: Todos | Pendientes | Aprobados | Rechazados | Suspendidos
  │
  ├─ Solicitud PENDIENTE:
  │   └─ Admin ve datos del solicitante + mensaje que escribió al solicitar
  │   └─ Acciones:
  │       • ✅ Aprobar → Se abre modal de asignación de zonas
  │       │    └─ Multi-select con checkboxes de las zonas del tenant
  │       │    └─ Ej: ☑ VIP  ☑ Staff  ☐ Prensa  ☐ Cancha
  │       │    └─ Notas internas (opcional)
  │       │    └─ Al confirmar: status='approved', allowed_zones=[...]
  │       │
  │       • ❌ Rechazar → Modal con motivo (opcional)
  │            └─ status='rejected'
  │
  ├─ Proveedor APROBADO:
  │   └─ Admin puede:
  │       • Editar zonas (agregar/quitar) en cualquier momento
  │       • Suspender temporalmente → status='suspended' (pierde acceso)
  │       • Ver historial de acreditaciones de este proveedor
  │       • Ver resumen: "245 acreditados enviados en 3 eventos"
  │
  └─ Acción masiva: Seleccionar varios proveedores → Suspender / Cambiar zonas
```

### 3.4 Flujo de acreditación (Proveedor aprobado)

```
Proveedor aprobado → /acreditado/nueva
  │
  ├─ Ve eventos de tenants donde tiene acceso aprobado
  │   (mezclados con eventos públicos de otros tenants)
  │
  ├─ Selecciona evento del tenant → /{tenant-slug}/acreditacion
  │
  ├─ El sistema verifica:
  │   1. ¿Tiene sesión? → Si no, redirect a login
  │   2. ¿Es proveedor aprobado de este tenant? → Si no, pantalla "Acceso Restringido"
  │   3. ¿Está el evento activo + deadline OK? → Gates normales
  │
  ├─ WIZARD (mismos 4 pasos, pero filtrado):
  │   │
  │   ├─ Paso 1 - Disclaimer: Sin cambios
  │   │
  │   ├─ Paso 2 - Responsable: 
  │   │   └─ Sin cambios funcionales (datos del responsable)
  │   │   └─ La organización puede pre-llenarse del provider
  │   │
  │   ├─ Paso 3 - Tipo de Medio:
  │   │   └─ Sin cambios (las quotas siguen aplicando)
  │   │
  │   └─ Paso 4 - Acreditados:
  │       └─ CAMBIO CLAVE: Si el evento tiene zone_rules configuradas,
  │          las zonas que se resuelven automáticamente se INTERSECTAN
  │          con las allowed_zones del proveedor.
  │       └─ Si zona_en_formulario=true (selector manual de zona),
  │          solo se muestran las zonas del proveedor.
  │       └─ Si una persona del lote cae en una zona NO permitida
  │          para este proveedor → error de validación claro.
  │
  ├─ SUBMIT → /api/bulk-accreditation
  │   └─ Validación SERVER-SIDE:
  │       1. Verificar que submitted_by es proveedor aprobado
  │       2. Verificar que todas las zonas resueltas están en allowed_zones
  │       3. Si alguna zona no está permitida → reject con error descriptivo
  │       4. Si OK → crear registrations normalmente
  │
  └─ Admin recibe las solicitudes en su panel como siempre
      └─ Las aprueba/rechaza normalmente
      └─ Las zonas ya vienen correctas (filtradas por permisos del proveedor)
```

### 3.5 Caso: Acceso directo por URL

```
Alguien conoce la URL /{tenant-slug} o /{tenant-slug}/acreditacion
  │
  ├─ Si tenant.provider_mode = 'open':
  │   └─ Flujo normal, sin cambios
  │
  └─ Si tenant.provider_mode = 'approved_only':
      │
      ├─ /{tenant-slug} (landing):
      │   └─ Se muestra la landing del tenant (branding, info)
      │   └─ PERO en vez de CTA "Acredítate" se muestra:
      │       • No logueado → "Esta organización trabaja con proveedores autorizados.
      │                        Si recibiste un link de invitación, úsalo para solicitar acceso."
      │       • Logueado + sin relación → Mismo mensaje
      │       • Logueado + pendiente → "Tu solicitud está en revisión"
      │       • Logueado + aprobado → "Acredítate" (CTA normal)
      │       • Logueado + rechazado → "Acceso no concedido"
      │   └─ NO se muestra botón "Solicitar Acceso" sin código
      │       (evita solicitudes no deseadas)
      │
      ├─ /{tenant-slug}/proveedores?code=XXXXX:
      │   └─ Página de invitación (ver 3.2.2)
      │
      └─ /{tenant-slug}/acreditacion:
          └─ Si no es proveedor aprobado → redirect a /{tenant-slug}
          └─ Si es proveedor aprobado → wizard normal (con filtro de zonas)
```

---

## 4. Modelo de datos

### 4.1 Nueva tabla: `tenant_providers`

```sql
CREATE TABLE public.tenant_providers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Status del proveedor
  status        varchar NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  
  -- Zonas autorizadas (matchean con tenant.config.zonas / event.config.zonas)
  allowed_zones text[] NOT NULL DEFAULT '{}',
  
  -- Datos de la solicitud
  organizacion  varchar,          -- nombre de org al momento de solicitar
  mensaje       text,             -- mensaje del solicitante al admin
  
  -- Datos de gestión
  notas         text,             -- notas internas del admin
  approved_by   uuid REFERENCES auth.users(id),
  approved_at   timestamptz,
  rejected_at   timestamptz,
  motivo_rechazo text,
  
  -- Timestamps
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  
  -- Un perfil solo puede ser proveedor una vez por tenant
  UNIQUE(tenant_id, profile_id)
);

-- Índices para queries frecuentes
CREATE INDEX idx_tenant_providers_tenant_status 
  ON public.tenant_providers(tenant_id, status);
CREATE INDEX idx_tenant_providers_profile 
  ON public.tenant_providers(profile_id);
```

### 4.2 Cambio en `TenantConfig` (types + tenant.config JSONB)

```typescript
export interface TenantConfig {
  // ... campos existentes ...
  
  /** Modo de acceso: 'open' = público (default), 'approved_only' = solo proveedores.
   *  Solo modificable por superadmin. */
  provider_mode?: 'open' | 'approved_only';
  
  /** Código de invitación para proveedores (se genera automáticamente al activar) */
  provider_invite_code?: string;
  
  /** Descripción pública del tenant para la página de invitación */
  provider_description?: string;
}
```

### 4.3 RLS para `tenant_providers`

```sql
-- Lectura: el propio usuario, admins del tenant, superadmins
CREATE POLICY "providers_select" ON tenant_providers FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR has_tenant_access(tenant_id)
  OR is_superadmin()
);

-- Insert: cualquier usuario autenticado puede solicitar acceso
CREATE POLICY "providers_insert" ON tenant_providers FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND status = 'pending'
);

-- Update: solo admins del tenant o superadmin
CREATE POLICY "providers_update" ON tenant_providers FOR UPDATE USING (
  can_edit_tenant(tenant_id)
  OR is_superadmin()
);

-- Delete: solo superadmin
CREATE POLICY "providers_delete" ON tenant_providers FOR DELETE USING (
  is_superadmin()
);
```

---

## 5. Puntos de integración (cambios en código existente)

### 5.1 Filtrado de eventos en `/acreditado/nueva`

**Archivo**: `app/acreditado/nueva/page.tsx`

**Hoy**: Consulta `events` + `tenants` donde `is_active = true`.
**Nuevo**: Agregar filtro:
```
- Si tenant.config.provider_mode = 'approved_only':
    - Solo mostrar si el usuario tiene tenant_providers con status='approved' para ese tenant
- Si tenant.config.provider_mode = 'open' o undefined:
    - Mostrar como hoy (sin cambios)
```

### 5.2 Landing del tenant `/{tenant-slug}`

**Archivo**: `app/[tenant]/page.tsx` + `TenantLanding.tsx`

**Hoy**: Muestra evento + CTA "Acredítate".
**Nuevo**: Si `provider_mode = 'approved_only'`:
- Server component consulta `tenant_providers` para el usuario actual
- Pasa `providerStatus` al client component
- TenantLanding renderiza CTA condicional según status (ver 3.5)

### 5.3 Gate en página de acreditación `/{tenant}/acreditacion`

**Archivo**: `app/[tenant]/acreditacion/page.tsx`

**Hoy**: Gate solo por `invite_only` + token.
**Nuevo**: Si `provider_mode = 'approved_only'`:
- Verificar que el usuario sea proveedor aprobado
- Si no → redirect a `/{tenant-slug}`
- Si sí → pasar `allowedZones` al wizard

### 5.4 Wizard: Filtro de zonas

**Archivo**: `components/forms/registration/useRegistrationForm.ts`

**Nuevo prop**: `allowedZones?: string[]`
- Si presente, filtra zonas en:
  - Resolución automática de zonas (intersectar resultado con allowed)
  - Selector manual de zona (solo mostrar allowed)
- Si no presente → comportamiento actual (sin filtro)

### 5.5 API: Validación server-side de zonas

**Archivo**: `app/api/bulk-accreditation/route.ts`

**Nuevo**: Si `tenant.config.provider_mode = 'approved_only'`:
1. Consultar `tenant_providers` para el `submitted_by`
2. Verificar `status = 'approved'`
3. Verificar que cada zona resuelta ∈ `allowed_zones`
4. Si falla → `403` con mensaje descriptivo

### 5.6 Nueva sección en portal: "Organizaciones"

**Archivo nuevo**: `app/acreditado/organizaciones/page.tsx`

- Solo muestra tenants donde el usuario YA tiene relación (no es directorio público)
- Muestra estado: pendiente/aprobado/rechazado/suspendido
- Si aprobado: zonas asignadas + link directo a eventos
- Si no tiene relaciones: mensaje "Contacta al administrador para recibir un link de invitación"

### 5.7 Página de invitación de proveedor

**Archivo nuevo**: `app/[tenant]/proveedores/page.tsx`

- Página pública ligera con branding del tenant
- Valida `?code=` contra `tenant.config.provider_invite_code`
- Si código válido + logueado → formulario de solicitud
- Si código válido + no logueado → botones login/registro con redirect back
- Si código inválido → error

### 5.8 Nueva tab en admin: "Proveedores"

**Archivos nuevos**: 
- `components/admin-dashboard/AdminProvidersTab.tsx`
- `components/admin-dashboard/ProviderApprovalModal.tsx`

- Tab con lista, filtros, acciones de aprobar/rechazar/editar zonas
- Botón generar/copiar link de invitación
- Columna "Acreditados" con conteo de registrations por proveedor

---

## 6. Resumen de nuevos endpoints API

| Endpoint | Método | Auth | Función |
|---|---|---|---|
| `/api/providers/request` | POST | Acreditado | Solicitar acceso (requiere `code` válido) |
| `/api/providers` | GET | Admin | Listar proveedores de su tenant |
| `/api/providers/[id]` | PATCH | Admin | Aprobar/rechazar/editar zonas |
| `/api/providers/[id]` | DELETE | Superadmin | Eliminar proveedor |
| `/api/providers/my-access` | GET | Acreditado | Mis accesos (status + zonas por tenant) |
| `/api/providers/invite-code` | POST | Admin | Generar/regenerar código de invitación |
| `/api/providers/validate-code` | GET | Público | Validar código de invitación (para la página) |
| `/api/providers/toggle` | POST | Superadmin | Activar/desactivar módulo proveedores para un tenant |

---

## 7. Lo que NO cambia

- Tenants con `provider_mode: 'open'` (o sin configurar) → **cero cambios**, flujo idéntico al actual
- El perfil sigue siendo global
- `team_members` sigue igual (el proveedor gestiona su equipo)
- `event_zone_rules` siguen funcionando (solo se agrega intersección con allowed_zones)
- `event_quota_rules` siguen funcionando sin cambios
- El proceso de aprobación/rechazo del admin sobre cada acreditación individual sigue igual
- Emails, QR, check-in → sin cambios

---

## 8. Orden de implementación

| Fase | Días | Entregable |
|---|---|---|
| **F1: Base** | 1-2 | Migración SQL + tipos TS + RLS |
| **F2: API** | 3-4 | 8 endpoints de proveedores (incluye toggle superadmin) |
| **F3: Superadmin** | 5 | Toggle de activación en panel superadmin |
| **F4: Admin** | 6-7 | Tab Proveedores + modal de aprobación con zonas |
| **F5: Portal** | 8-9 | Página de invitación + sección Organizaciones |
| **F6: Gates** | 10-11 | Filtro en /nueva, gate en landing+acreditación, filtro de zonas en wizard |
| **F7: Validación** | 11-12 | Server-side en bulk-accreditation + chunked submit + tests |
| **F8: QA** | 12 | Tests + ajustes + edge cases |

---

## 9. Edge cases a considerar

1. **Proveedor suspendido con acreditaciones pendientes**: Las acreditaciones ya enviadas siguen su curso. Nuevas solicitudes son bloqueadas.
2. **Admin cambia zonas de un proveedor**: Solo afecta acreditaciones FUTURAS. Las existentes mantienen su zona.
3. **Admin desactiva provider_mode**: Todos los eventos vuelven a ser públicos. Los registros de `tenant_providers` se mantienen (por si reactiva).
4. **Proveedor solicita acceso dos veces**: UNIQUE constraint lo previene. Si fue rechazado y tiene el link, puede volver a solicitar (PATCH de 'rejected' a 'pending' con nuevo mensaje).
5. **Tenant sin zonas configuradas**: No se puede activar `provider_mode='approved_only'` sin zonas. Validación en el toggle.
6. **Proveedor aprobado pero con 0 zonas**: Error de configuración. La UI exige al menos 1 zona al aprobar.
7. **Código de invitación filtrado**: Admin puede regenerar el código con un clic. El anterior deja de funcionar inmediatamente.
8. **Proveedor sin código intenta acceder por URL directa**: Landing muestra mensaje genérico sin botón de solicitud.

---

## 10. Consideraciones de volumen (acreditación masiva)

Este tenant en particular maneja volúmenes altos: proveedores que acreditan 200-400 personas por lote, totalizando ~1500 acreditados por evento. Esto impacta el diseño:

### 10.1 Contexto actual de bulk

- El wizard ya soporta carga masiva vía Excel/CSV (paso 4 "Acreditados")
- El endpoint `/api/bulk-accreditation` procesa todo el lote atómicamente
- Cada fila pasa por: validación → get_or_create_profile → check_quota → resolve_zone → create registration
- Funciona bien para lotes de ~50-100, pero 400 en un POST puede ser lento/timeout

### 10.2 Cambios necesarios para escala

| Problema | Solución |
|---|---|
| **Timeout en lotes de 400**: un solo POST puede tardar >30s | Procesamiento en chunks de 50 con progreso en tiempo real. La UI ya tiene `submitProgress` — usarlo con un loop de POSTs parciales |
| **Validación de zonas por proveedor en bulk**: cada fila necesita verificar zona ∈ allowed_zones | Hacer la verificación una vez al inicio: cargar allowed_zones del proveedor y pasarlas al resolver. Complejidad O(1) por fila |
| **Cupos por organización**: con 400 personas del mismo org, el check de cuota debe considerar el lote completo | Ya existe `check_quota` — pero necesita considerar las N filas pendientes del mismo lote, no solo las ya guardadas |
| **Excel con zona predefinida**: el proveedor podría querer indicar la zona por fila en el Excel | Agregar columna "zona" al template de Excel. La zona se valida contra `allowed_zones` en el submit |
| **Feedback post-envío**: con 400 registros, el admin necesita ver quién los envió | Ya existe `submitted_by` en registrations. En la tabla del admin, agregar filtro por proveedor/responsable |

### 10.3 Template Excel mejorado para proveedores

Cuando un proveedor aprobado descarga el template Excel, este debería:
- Pre-configurar la columna "zona" con un dropdown limitado a sus `allowed_zones`
- Pre-llenar organización del proveedor
- Pre-llenar tipo_medio si el proveedor tiene uno asociado
- Incluir validaciones de datos en Excel (RUT format, email format)

### 10.4 Vista del admin: filtro por proveedor

Con ~1500 acreditados de ~5-8 proveedores distintos, el admin necesita:
- **Filtro por proveedor** en la tabla de acreditaciones (ya existe filtro por organización, pero ahora por submitted_by/provider)
- **Agrupación visual**: "Proveedor X envió 350 acreditados" como resumen colapsable
- **Acción masiva por proveedor**: "Aprobar todos los de Proveedor X" (ya existe bulk action, solo necesita el filtro)

### 10.5 Flujo optimizado para el proveedor de alto volumen

```
Proveedor aprobado (zonas: VIP, Staff)
  │
  ├─ Entra al wizard → Paso 1-3 normal (responsable + tipo medio)
  │
  ├─ Paso 4 - Acreditados:
  │   ├─ Descarga template Excel (pre-filtrado con sus zonas)
  │   ├─ Llena 400 filas con zona por persona
  │   ├─ Sube Excel → parseo + preview con validaciones
  │   │   └─ Errores visibles: "Fila 23: zona 'Cancha' no permitida para tu acceso"
  │   │   └─ Resumen: "350 válidos, 50 con errores"
  │   └─ Puede corregir errores en la tabla inline o re-subir
  │
  ├─ Submit:
  │   ├─ Se envía en chunks de 50 (8 requests para 400)
  │   ├─ Barra de progreso: "Procesando... 200/400"
  │   ├─ Si un chunk falla → los anteriores se mantienen,
  │   │   puede reintentar los fallidos
  │   └─ Al terminar: "398 enviados exitosamente, 2 con error"
  │
  └─ Admin ve en su panel:
      └─ 398 registros nuevos de "[Proveedor X]"
      └─ Filtro rápido: "Proveedor X" → ve solo sus 398
      └─ Acción: "Aprobar todos" → bulk approve
```
