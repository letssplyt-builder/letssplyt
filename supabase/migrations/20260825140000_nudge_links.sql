-- DESCRIPTION: Secret capability URLs for consolidated organizer nudge SMS (member or phone guest).
-- ROLLBACK:    DROP TABLE IF EXISTS public.nudge_links;

CREATE TABLE IF NOT EXISTS public.nudge_links (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token                 TEXT        NOT NULL,
  payer_id              UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  counterparty_user_id  UUID        REFERENCES public.users(id) ON DELETE CASCADE,
  guest_phone_hash      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nudge_links_subject_xor CHECK (
    (counterparty_user_id IS NOT NULL AND guest_phone_hash IS NULL)
    OR (counterparty_user_id IS NULL AND guest_phone_hash IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nudge_links_token
  ON public.nudge_links (token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nudge_links_payer_member
  ON public.nudge_links (payer_id, counterparty_user_id)
  WHERE counterparty_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nudge_links_payer_guest
  ON public.nudge_links (payer_id, guest_phone_hash)
  WHERE guest_phone_hash IS NOT NULL;

ALTER TABLE public.nudge_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nudge_links'
      AND policyname = 'nudge_links_no_direct_access'
  ) THEN
    CREATE POLICY nudge_links_no_direct_access ON public.nudge_links
      FOR ALL USING (false);
  END IF;
END $$;
