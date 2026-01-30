# Multi-tenant-acreditaciones

## Descripción

Multi-tenant-acreditaciones es una aplicación web multi-tenant desarrollada con Next.js y Supabase para gestionar acreditaciones de prensa y medios. El sistema permite a diferentes tenants (organizaciones o eventos) administrar sus propias acreditaciones de manera independiente, con funcionalidades como registro de acreditados, aprobación/rechazo, exportación de datos y paneles de administración.

La arquitectura multi-tenant asegura que cada tenant tenga su propio espacio aislado de datos, manteniendo la privacidad y la integridad de la información.

## Características Principales

- **Multi-tenancy**: Soporte completo para múltiples tenants con aislamiento de datos.
- **Gestión de Acreditaciones**: Registro, edición y eliminación de acreditaciones.
- **Panel de Administración**: Interfaz para administradores para gestionar acreditaciones, exportar datos y configurar tenants.
- **Aprobación/Rechazo**: Flujo de trabajo para aprobar o rechazar solicitudes de acreditación.
- **Exportación a Excel**: Funcionalidad para exportar listas de acreditados en formato Excel.
- **Autenticación**: Sistema de login para administradores.
- **Responsive Design**: Interfaz adaptativa para dispositivos móviles y de escritorio.
- **API RESTful**: Endpoints para integración con otros sistemas.

## Tecnologías Utilizadas

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Backend**: Next.js API Routes, Supabase (Base de datos PostgreSQL)
- **Estilos**: Tailwind CSS, PostCSS
- **Linter**: ESLint
- **Base de Datos**: PostgreSQL (a través de Supabase)
- **Despliegue**: Vercel (recomendado)

## Requisitos Previos

- Node.js 18 o superior
- npm o yarn
- Cuenta de Supabase para la base de datos

## Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/Antonio-Capra/Multi-tenant-acreditaciones.git
   cd Multi-tenant-acreditaciones
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Copia el archivo de variables de entorno de ejemplo:
   ```bash
   cp env-example .env.local
   ```

4. Configura las variables de entorno en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima de Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Clave de rol de servicio de Supabase
   - Otras variables específicas del proyecto

## Configuración de la Base de Datos

1. Crea un proyecto en Supabase.

2. Ejecuta el script de configuración de tenants:
   ```bash
   node setup-tenants.js
   ```

3. Ejecuta el archivo SQL de configuración:
   - Importa `tenant-setup.sql` en tu base de datos Supabase.

4. Configura las constantes de tenants en `constants/tenant-configs.ts` según tus necesidades.

## Uso

### Desarrollo

Para ejecutar el proyecto en modo desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Construcción para Producción

```bash
npm run build
npm start
```

### Rutas Principales

- `/`: Página principal
- `/[tenant]`: Página específica del tenant
- `/[tenant]/acreditacion`: Formulario de acreditación
- `/admin`: Panel de administración global
- `/[tenant]/admin`: Panel de administración del tenant
- `/api/*`: Endpoints de la API

### API Endpoints

- `POST /api/acreditaciones/prensa`: Crear acreditación de prensa
- `GET /api/medios`: Obtener lista de medios
- `POST /api/send-approval`: Enviar aprobación
- `POST /api/send-rejection`: Enviar rechazo
- `GET /api/admin/export-excel`: Exportar datos a Excel
- `POST /api/setup-tenants`: Configurar tenants

## Estructura del Proyecto

```
/
├── app/                          # Páginas y layouts de Next.js
│   ├── [tenant]/                 # Rutas dinámicas por tenant
│   ├── admin/                    # Panel de administración
│   └── api/                      # Endpoints de la API
├── components/                   # Componentes reutilizables
│   ├── acreditacion/             # Componentes de acreditación
│   ├── admin-dashboard/          # Componentes del dashboard admin
│   └── common/                   # Componentes comunes
├── constants/                    # Constantes y configuraciones
├── hooks/                        # Hooks personalizados
├── lib/                          # Utilidades y configuración
│   └── supabase/                 # Cliente de Supabase
├── public/                       # Archivos estáticos
├── types/                        # Definiciones de tipos TypeScript
└── middleware.ts                 # Middleware de Next.js
```

## Configuración de Tenants

Los tenants se configuran en `constants/tenant-configs.ts`. Cada tenant tiene su propia configuración incluyendo:

- Nombre del tenant
- Configuración de colores
- URLs específicas
- Permisos y roles

Para agregar un nuevo tenant:

1. Agrega la configuración en `tenant-configs.ts`
2. Crea las tablas correspondientes en la base de datos si es necesario
3. Actualiza el middleware si requiere lógica especial

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## Pruebas

Ejecuta las pruebas con:

```bash
npm test
```

## Despliegue

### Vercel

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en Vercel
3. Despliega automáticamente con cada push a main

### Otros Proveedores

Asegúrate de configurar las variables de entorno y ejecutar `npm run build` antes del despliegue.

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Para soporte o preguntas, abre un issue en el repositorio de GitHub.

## Changelog

### v1.0.0
- Lanzamiento inicial con funcionalidades básicas de multi-tenancy
- Gestión de acreditaciones
- Panel de administración
- Exportación a Excel

---

Desarrollado con ❤️ por Antonio Capra