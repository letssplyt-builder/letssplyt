-- Repair schema drift: guest_pii vault and participants.guest_pii_token required by
-- manual participant add (E05-S02) but absent on remote DBs provisioned before initial_schema included them.

CREATE TABLE IF NOT EXISTS public.guest_pii (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash      TEXT        NOT NULL,
  phone_encrypted TEXT        NOT NULL,
  name_encrypted  TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purge_after     TIMESTAMPTZ
);

ALTER TABLE public.guest_pii ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_pii'
      AND policyname = 'guest_pii_no_direct_access'
  ) THEN
    CREATE POLICY "guest_pii_no_direct_access" ON public.guest_pii
      FOR ALL USING (false);
  END IF;
END $$;

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS guest_pii_token UUID REFERENCES public.guest_pii(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_participants_guest_pii
  ON public.participants(guest_pii_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_guest_unique
  ON public.participants (event_id, guest_pii_token)
  WHERE guest_pii_token IS NOT NULL;
