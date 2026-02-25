# Panel del Responsable — Documento de Diseño

> **Contexto**: El admin de Claro Arena (y potencialmente otros tenants) quiere delegar la gestión operativa al **responsable de acreditación** — la persona que envía las solicitudes en nombre de su equipo. El admin solo quiere aprobar/rechazar y enviar emails. El responsable quiere: ver su historial, saber cuánta gente acreditó por partido, reutilizar equipos, asignar zonas y cargos.

---

## 1. ¿Qué existe hoy?

### Panel del Acreditado (`/acreditado`)
| Sección | Qué hace | Limitaciones |
|---------|----------|-------------|
| **Inicio** | Saludo + quick actions + eventos activos | No muestra stats por evento |
| **Mis Acreditaciones** | Lista de registrations propias + gestionadas | No muestra totales/resumen por evento. No diferencia "por partido/evento" |
| **Nueva Solicitud** | Lista eventos abiertos → redirige al wizard | Funciona bien |
| **Mi Equipo** | CRUD de miembros frecuentes | Global (no por tenant, no por evento). Cargos fijos de prensa |
| **Mi Perfil** | Editar datos personales | No muestra historial ni stats |

### Datos que ya tenemos en BD
- `registrations.submitted_by` → identifica quién envió cada solicitud
- `registrations.profile_id` → a quién es la acreditación
- `team_members` → equipo del manager (global, sin scope de tenant)
- `registrations.datos_extra` → JSONB con zona, cargo, datos del responsable
- `events.nombre/fecha/venue` → datos del evento para historial

### Lo que NO existe
- ❌ Stats agregadas por responsable (cuántos acreditó por evento, tasa de aprobación)
- ❌ Vista "historial por evento" con detail drill-down
- ❌ Capacidad del responsable de editar zona/cargo de sus propios envíos
- ❌ Equipo scoped por tenant (el equipo es global)
- ❌ Reutilización rápida ("acreditar a los mismos del partido anterior")
- ❌ Vista de QR codes de su equipo

---

## 2. Propuesta: Panel del Responsable Mejorado

### 2.1 — Dashboard con Stats por Evento

**Ruta**: `/acreditado/dashboard` (mejorar el existente)

```
┌─────────────────────────────────────────────────────┐
│  📊 Mi Historial de Acreditaciones                  │
│                                                     │
│  Total acreditados: 47    Eventos: 8     ✅ 89%     │
│                                                     │
│  ┌─ Claro Arena ──────────────────────────────────┐ │
│  │                                                │ │
│  │  River vs Boca (15/03)     12 personas  ✅ 12  │ │
│  │  Racing vs Indep. (22/03)   8 personas  ✅ 7 ❌1│ │
│  │  Argentina vs Brasil (01/04) 15 personas ⏳ 15 │ │
│  │                                                │ │
│  │  [Ver detalle]  [Reutilizar equipo →]          │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Otro Tenant ──────────────────────────────────┐ │
│  │  Evento X (10/03)          12 personas  ✅ 12  │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Datos necesarios** (API nueva o mejorada):
```sql
SELECT 
  e.id, e.nombre, e.fecha, e.venue,
  t.nombre as tenant_nombre, t.slug,
  COUNT(*) as total_enviados,
  COUNT(*) FILTER (WHERE r.status = 'aprobado') as aprobados,
  COUNT(*) FILTER (WHERE r.status = 'rechazado') as rechazados,
  COUNT(*) FILTER (WHERE r.status = 'pendiente') as pendientes
FROM registrations r
JOIN events e ON r.event_id = e.id
JOIN tenants t ON e.tenant_id = t.id
WHERE r.submitted_by = :profile_id
GROUP BY e.id, e.nombre, e.fecha, e.venue, t.nombre, t.slug
ORDER BY e.fecha DESC;
```

### 2.2 — Detalle por Evento (drill-down)

Al hacer clic en un evento, mostrar la lista de personas que el responsable envió:

```
┌─────────────────────────────────────────────────────┐
│  ← River vs Boca — 15 Mar 2026                     │
│  Claro Arena · 12 acreditados                       │
│                                                     │
│  👤 Juan Pérez      Camarógrafo   Zona: Cancha  ✅ │
│  👤 María López     Periodista    Zona: Tribuna ✅ │
│  👤 Carlos Gómez    Fotógrafo     Zona: Mixta   ✅ │
│  ...                                                │
│                                                     │
│  [📋 Reutilizar para otro evento]                   │
│  [📥 Descargar Excel]                               │
└─────────────────────────────────────────────────────┘
```

### 2.3 — Reutilización de Equipo ("Acreditar los mismos")

**El feature estrella**: En vez de armar el equipo desde cero cada partido, poder:

1. **Desde el historial** → botón "Reutilizar" en un evento pasado
2. Se abre el wizard de acreditación del nuevo evento **pre-llenado** con las mismas personas
3. El responsable puede agregar/quitar antes de enviar

**Implementación posible**:
- `GET /api/acreditado/registrations?event_id=X&submitted_by=me` → retorna las personas
- Redirigir a `/{tenant}/acreditacion?reuse_event=EVENT_ID`
- El wizard detecta `reuse_event`, carga las personas del evento anterior, las pre-llena

### 2.4 — Edición de Zona y Cargo (pre-aprobación)

Permitir al responsable editar zona y cargo de sus envíos mientras están en estado `pendiente`:

| Campo | ¿Editable? | Condición |
|-------|-----------|-----------|
| Zona | ✅ Sí | Solo si `status = pendiente` |
| Cargo | ✅ Sí | Solo si `status = pendiente` |
| Datos personales | ❌ No | El admin controla esto |
| Status | ❌ No | Solo el admin aprueba/rechaza |

**API**: `PATCH /api/acreditado/registrations/:id` con guard:
```typescript
// Solo editar si: submitted_by = mi_perfil AND status = 'pendiente'
```

### 2.5 — Equipo Mejorado

El equipo actual es global. Opciones para mejorar:

**Opción A — Mantener global, mejorar UX**:
- El equipo sigue siendo global (un solo pool)
- Al acreditar, se muestran todos y se filtran por contexto
- ✅ Más simple, menos confusión

**Opción B — Equipo por tenant (sub-grupos)**:
- Tags o grupos dentro del equipo: "Equipo Claro Arena", "Equipo Movistar"
- ❌ Más complejo, puede confundir si un fotógrafo trabaja en varios tenants

**Recomendación**: Opción A + la reutilización del punto 2.3 cubre el caso de uso real.

---

## 3. Arquitectura de Implementación

### Nuevas APIs necesarias

| Método | Ruta | Función |
|--------|------|---------|
| `GET` | `/api/acreditado/stats` | Stats agregadas por evento del responsable |
| `GET` | `/api/acreditado/registrations?event_id=X` | Personas enviadas en un evento específico |
| `PATCH` | `/api/acreditado/registrations/:id` | Editar zona/cargo (solo pendientes propios) |

### Páginas nuevas/modificadas

| Ruta | Cambio |
|------|--------|
| `/acreditado/dashboard` | Agregar vista de stats por evento + drill-down |
| `/acreditado/dashboard/[eventId]` | Nueva: detalle de envíos por evento |
| `/{tenant}/acreditacion` | Soporte para `?reuse_event=X` (pre-llenado) |

### Modelo de permisos

```
Responsable solo puede:
├── VER sus propios envíos (submitted_by = su profile_id)
├── EDITAR zona/cargo de envíos pendientes (submitted_by = su profile_id AND status = 'pendiente')
├── REUTILIZAR personas de eventos pasados
└── VER QR de sus envíos aprobados (submitted_by = su profile_id AND status = 'aprobado')

NO puede:
├── Aprobar/rechazar
├── Editar datos después de aprobación
├── Ver envíos de otros responsables
└── Eliminar registrations
```

---

## 4. Priorización sugerida

| Fase | Feature | Esfuerzo | Impacto |
|------|---------|----------|---------|
| **F1** | Stats por evento en dashboard | Medio | 🔥🔥🔥 Alto |
| **F1** | Detalle drill-down por evento | Medio | 🔥🔥🔥 Alto |
| **F2** | Reutilización de equipo de evento anterior | Alto | 🔥🔥🔥 Alto |
| **F2** | Edición de zona/cargo en pendientes | Bajo | 🔥🔥 Medio |
| **F3** | Vista de QR codes del equipo | Bajo | 🔥 Bajo |
| **F3** | Descarga Excel de "mis envíos" | Bajo | 🔥 Bajo |

---

## 5. Preguntas Clave para el Cliente

### Sobre el responsable y su rol

1. **¿Un responsable siempre trabaja para un solo tenant, o puede acreditar gente en varios tenants?**
   > Impacta si el dashboard se organiza por tenant o es flat. Hoy un acreditado puede tener registrations en múltiples tenants.

2. **¿Cuántos responsables hay típicamente por tenant? ¿Es 1 responsable = 1 medio/empresa?**
   > Si hay muchos responsables, necesitamos pensar en escalabilidad de la UI del admin.

3. **¿El responsable puede delegar a otra persona? ¿Hay un "sub-responsable"?**
   > Si sí, necesitamos jerarquía. Si no, mantenemos 1 nivel.

### Sobre la gestión de equipo

4. **¿La gente que acredita es siempre la misma, o varía mucho entre eventos?**
   > Si es siempre la misma → reutilización es crítica. Si varía mucho → el equipo frecuente resuelve más.

5. **¿Cuántas personas acredita un responsable por evento típicamente?**
   > 5-10 es distinto a 200+. Define si necesitamos paginación, búsqueda, filtros en el drill-down.

6. **¿El responsable quiere poder armar "listas" guardadas? Ej: "Equipo cancha", "Equipo transmisión".**
   > Si sí → implementamos sub-grupos en equipo. Si no → la reutilización por evento pasado alcanza.

### Sobre zonas y cargos

7. **¿El responsable sabe de antemano qué zona le corresponde a cada persona, o eso lo asigna el admin?**
   > Si lo sabe → le damos edición de zona pre-aprobación. Si no → solo el admin asigna.

8. **¿Los cargos varían entre eventos del mismo tenant, o son siempre los mismos para ese tenant?**
   > Si son iguales → los configuramos a nivel tenant una vez. Si varían → se configuran por evento (como hoy).

9. **¿Quién decide los cargos disponibles? ¿El admin del tenant o el superadmin?**
   > Define quién tiene acceso a configurar las opciones del dropdown.

### Sobre visibilidad y permisos

10. **¿El responsable debería ver los QR codes de las personas que acreditó?**
    > Caso de uso: el responsable imprime/distribuye las credenciales a su equipo antes del evento.

11. **¿El responsable debería poder cancelar una solicitud pendiente?**
    > Ej: "Mandé a Juan por error, quiero sacarlo antes de que aprueben."

12. **¿El admin quiere ver quién fue el responsable de cada acreditación?**
    > Hoy `submitted_by` existe en la BD pero no se muestra prominentemente en el admin dashboard. Si es importante → la agregamos como columna filtrable.

### Sobre el historial

13. **¿Qué rango de tiempo importa? ¿Solo el tenant actual, o todo el historial cross-tenant?**
    > Define scope del dashboard. Un fotógrafo freelance podría acreditar en Claro Arena y Movistar Arena.

14. **¿El responsable necesita exportar su historial? ¿En qué formato?**
    > Excel, PDF, o solo consultarlo en pantalla.

15. **¿Es útil mostrar estadísticas como "tasa de aprobación" o "tiempo promedio de respuesta"?**
    > Puede ser valioso para que el responsable mida su eficiencia y el admin vea métricas.

### Sobre el workflow admin ↔ responsable

16. **Cuando el admin rechaza una solicitud, ¿el responsable debería poder re-enviarla corregida?**
    > Hoy no existe "reenvío". El responsable tendría que crear una nueva solicitud.

17. **¿El admin quiere poder enviar un mensaje/nota al responsable sobre toda la solicitud (no solo por registro individual)?**
    > Ej: "Faltan datos de 3 personas, completar antes del viernes."

18. **¿El admin quiere limitar cuántas personas puede acreditar un responsable?** 
    > Hoy el cupo es por tipo_medio/evento. ¿Debería haber un cupo por responsable también?

---

## 6. Escenario Ejemplo — Claro Arena

```
Responsable: Laura (Canal 13 - Deportes)
Equipo frecuente: 8 personas (2 camarógrafos, 3 periodistas, 2 fotógrafos, 1 productor)

Flujo actual:
1. Entra a Claro Arena → evento "River vs Boca"
2. Llena datos de responsable
3. Agrega 8 personas una por una (o desde equipo)
4. Envía solicitud
5. Admin aprueba
6. Siguiente partido: repite todo desde cero 😩

Flujo propuesto:
1. Entra a su dashboard → ve historial
2. Ve "River vs Boca — 8 personas ✅"
3. Click "Reutilizar para Racing vs Independiente"
4. Se abre el wizard pre-llenado con las 8 personas
5. Quita 1, agrega 2 nuevos → envía
6. Admin aprueba
7. Laura ve stats: "47 personas acreditadas en 8 partidos, 89% aprobación" 🎉
```

---

## 7. Decisiones Pendientes

| # | Decisión | Opciones | Impacto |
|---|----------|----------|---------|
| D1 | ¿Esto es solo para Claro Arena o para todos los tenants? | A) Feature flag por tenant / B) Para todos | Si es flag → agregar a `TenantConfig` |
| D2 | ¿Edición de zona/cargo pre-aprobación? | A) Sí / B) Solo el admin | Define si creamos nueva API |
| D3 | ¿Equipo por tenant o global? | A) Global / B) Por tenant / C) Tags | Impacto en BD |
| D4 | ¿QR visible para el responsable? | A) Sí / B) No | Seguridad vs practicidad |
| D5 | ¿Columna "Responsable" visible en admin? | A) Sí, filtrable / B) Solo en detalle | UX del admin |
