-- DESCRIPTION: Close PostgREST write holes on financial / PII tables.
--              Client JWTs may still SELECT (Realtime) and update their own
--              profile + device_sessions. All other mutations require service_role
--              or a SECURITY DEFINER RPC (auth.role() is not authenticated/anon).
-- ROLLBACK:    Recreate the dropped policies from 20260601000000 / 20260620000000 /
--              20260626000000; DROP TRIGGER/FUNCTION added here; GRANT write
--              privileges back to authenticated if needed.

-- ─── 1. Shared guard: authenticated/anon cannot mutate locked tables ────────

CREATE OR REPLACE FUNCTION public.reject_client_row_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION '% can only be written by the service role', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_client_row_mutation() IS
  'BEFORE INSERT/UPDATE/DELETE guard. Blocks PostgREST client JWTs; service_role and SECURITY DEFINER RPCs pass.';

REVOKE ALL ON FUNCTION public.reject_client_row_mutation() FROM PUBLIC;

-- ─── 2. Users: keep profile PATCH via user JWT, lock identity/PII columns ───

CREATE OR REPLACE FUNCTION public.enforce_users_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.phone_hash IS DISTINCT FROM OLD.phone_hash
     OR NEW.phone_encrypted IS DISTINCT FROM OLD.phone_encrypted
     OR NEW.name_encrypted IS DISTINCT FROM OLD.name_encrypted
     OR NEW.acquisition_source IS DISTINCT FROM OLD.acquisition_source
     OR NEW.acquisition_event_id IS DISTINCT FROM OLD.acquisition_event_id
     OR NEW.first_event_at IS DISTINCT FROM OLD.first_event_at
     OR NEW.last_active_at IS DISTINCT FROM OLD.last_active_at
     OR NEW.total_events_created IS DISTINCT FROM OLD.total_events_created
     OR NEW.total_events_joined IS DISTINCT FROM OLD.total_events_joined
     OR NEW.is_opted_out IS DISTINCT FROM OLD.is_opted_out
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'protected user columns cannot be updated via client role'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_users_protected_columns() IS
  'Blocks client JWT updates to phone/PII, counters, opt-out, and soft-delete on public.users.';

REVOKE ALL ON FUNCTION public.enforce_users_protected_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_users_protect_sensitive_columns ON public.users;
CREATE TRIGGER trg_users_protect_sensitive_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_users_protected_columns();

-- ─── 3. Drop client write policies (SELECT kept for Realtime / own reads) ───

DROP POLICY IF EXISTS "participants_update_self_safe" ON public.participants;
DROP POLICY IF EXISTS "participants_update_payer" ON public.participants;

DROP POLICY IF EXISTS "events_insert_payer" ON public.events;
DROP POLICY IF EXISTS "events_update_payer" ON public.events;

DROP POLICY IF EXISTS "receipt_items_insert_payer" ON public.receipt_items;
DROP POLICY IF EXISTS "receipt_items_update_payer" ON public.receipt_items;
DROP POLICY IF EXISTS "receipt_items_delete_payer" ON public.receipt_items;

DROP POLICY IF EXISTS "item_assignments_insert_payer" ON public.item_assignments;
DROP POLICY IF EXISTS "item_assignments_delete_payer" ON public.item_assignments;

DROP POLICY IF EXISTS "receipt_discounts_insert_payer" ON public.receipt_discounts;
DROP POLICY IF EXISTS "receipt_discounts_update_payer" ON public.receipt_discounts;
DROP POLICY IF EXISTS "receipt_discounts_delete_payer" ON public.receipt_discounts;

DROP POLICY IF EXISTS "handles_insert_own" ON public.user_payment_handles;
DROP POLICY IF EXISTS "handles_update_own" ON public.user_payment_handles;
DROP POLICY IF EXISTS "handles_delete_own" ON public.user_payment_handles;

DROP POLICY IF EXISTS user_notifications_update_own ON public.user_notifications;

DROP POLICY IF EXISTS "analytics_insert_authenticated" ON public.analytics_events;

-- ─── 4. Triggers on tables that must not accept client mutations ────────────

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'participants',
    'events',
    'receipt_items',
    'item_assignments',
    'receipt_discounts',
    'user_payment_handles',
    'event_join_tokens',
    'settlement_log',
    'notification_log',
    'guest_pii',
    'user_notifications',
    'analytics_events',
    'otp_verifications',
    'nudge_links',
    'sms_opt_outs',
    'ai_audit_log',
    'funnel_checkpoints'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_service_role_writes ON public.%I',
      tbl,
      tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%I_service_role_writes
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.reject_client_row_mutation()',
      tbl,
      tbl
    );
  END LOOP;
END $$;

-- ─── 5. Revoke leftover table write grants from client roles ────────────────

REVOKE INSERT, UPDATE, DELETE ON TABLE public.participants FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.receipt_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.item_assignments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.receipt_discounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_payment_handles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_join_tokens FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.settlement_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.notification_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.guest_pii FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_notifications FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.analytics_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.otp_verifications FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.nudge_links FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.sms_opt_outs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ai_audit_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.funnel_checkpoints FROM anon, authenticated;
