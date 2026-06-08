-- Repair device_sessions RLS: split ALL policy so INSERT/UPDATE upserts work with user JWT.

DROP POLICY IF EXISTS "device_sessions_own" ON public.device_sessions;

CREATE POLICY "device_sessions_select_own" ON public.device_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "device_sessions_insert_own" ON public.device_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "device_sessions_update_own" ON public.device_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "device_sessions_delete_own" ON public.device_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_sessions TO authenticated;
GRANT ALL ON public.device_sessions TO service_role;
