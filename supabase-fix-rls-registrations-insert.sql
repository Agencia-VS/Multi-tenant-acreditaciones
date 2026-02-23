-- =============================================================
-- Fix: Restrict registrations INSERT RLS policy
-- =============================================================
-- Issue: registrations_insert had WITH CHECK (true), allowing
-- unrestricted INSERT access for any role (anon/authenticated).
--
-- Reality: All production inserts go through service_role RPCs
--   - check_and_create_registration()
--   - bulk_check_and_create_registrations()
-- which bypass RLS entirely. So this policy is defense-in-depth.
--
-- New policy: Only allow INSERT if the user is:
--   1. The owner of the profile being registered (self-registration)
--   2. A manager submitting on behalf of their team (submitted_by)
--   3. An admin of the event's tenant
--   4. A superadmin
-- =============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS registrations_insert ON registrations;

-- Create restrictive replacement
CREATE POLICY registrations_insert ON registrations
  FOR INSERT
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL
    AND (
      -- 1. Own profile (self-registration)
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = profile_id
          AND p.user_id = auth.uid()
      )
      -- 2. Manager submitting for team member
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = submitted_by
          AND p.user_id = auth.uid()
      )
      -- 3. Admin of the event's tenant
      OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_id
          AND has_tenant_access(e.tenant_id)
      )
      -- 4. Superadmin
      OR is_superadmin()
    )
  );
