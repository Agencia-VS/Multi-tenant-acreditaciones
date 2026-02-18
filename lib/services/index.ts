/**
 * Barrel export de servicios
 */
export { lookupProfileByRut, getOrCreateProfile, getProfileByUserId, getProfileByEmail, linkProfileToUser, updateProfileDatosBase, saveTenantProfileData, getTenantProfileData, buildMergedAutofillData, computeTenantProfileStatus } from './profiles';
export { createRegistration, createBulkRegistrations, listRegistrations, updateRegistrationStatus, bulkUpdateStatus, getRegistrationFull, getRegistrationsByProfile, getRegistrationStats } from './registrations';
export { checkQuota, getQuotaRulesWithUsage, upsertQuotaRule, deleteQuotaRule } from './quotas';
export { resolveZone, getZoneRules, upsertZoneRule, deleteZoneRule } from './zones';
export { getTenantBySlug, getTenantById, listTenants, createTenant, updateTenant, createTenantAdmin, listTenantAdmins, listActiveTenants, deleteTenant } from './tenants';
export { getActiveEvent, getEventById, getEventFull, listEventsByTenant, listAllEvents, createEvent, updateEvent, deactivateEvent, deleteEvent } from './events';
export { listEventDays, getCurrentEventDay, createEventDay, createEventDaysBulk, updateEventDay, deleteEventDay, syncEventDays, getRegistrationDays, getEventDayCheckinStats } from './eventDays';
export { getTeamMembers, addTeamMember, removeTeamMember, updateTeamMember, getTeamMembersForEvent } from './teams';
export { sendApprovalEmail, sendRejectionEmail, sendBulkApprovalEmails, sendWelcomeEmail } from './email';
export { logAuditAction, getAuditLogs } from './audit';
export { getCurrentUser, isSuperAdmin, isTenantAdmin, getUserTenantRole, hasAccessToTenant } from './auth';
export { requireAuth } from './requireAuth';
export type { AuthResult, RequireAuthOptions, AuthRole } from './requireAuth';
export { shouldForcePasswordChange, validatePassword, getForceChangeRedirectUrl, PASSWORD_RULES } from './passwordPolicy';
