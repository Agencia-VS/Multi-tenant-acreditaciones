/**
 * Componentes de Autenticación (Client-side only)
 * 
 * Para Server Components, importar directamente desde './AuthGuard'
 */

// Client Components (para usar en páginas con "use client")
export {
  ProtectedRoute,
  TenantAdminRoute,
  SuperAdminRoute,
  usePermissions,
  type ProtectedRouteProps,
} from './ProtectedRoute';

// Modal de recuperación de contraseña
export { ForgotPasswordModal } from './ForgotPasswordModal';

// Contexto de autenticación para acreditados
export { 
  AuthAcreditadoProvider, 
  useAuthAcreditado, 
  AuthAcreditadoContext 
} from './AuthAcreditadoContext';

// NOTA: Para usar AuthGuard, SuperAdminGuard, TenantAdminGuard
// importar directamente: import { AuthGuard } from '@/components/auth/AuthGuard'
