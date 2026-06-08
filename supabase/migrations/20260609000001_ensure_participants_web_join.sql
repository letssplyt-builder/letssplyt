-- Ensure participants + guest_pii support web join (E06-S01).
-- Repairs schema drift on remote DBs (missing guest_pii_token, qr_web join_method, etc.).

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

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS country_code TEXT;

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS message_channel TEXT;

-- Normalise legacy join_method values before tightening the CHECK constraint.
UPDATE public.participants
SET join_method = 'manual_name_only'
WHERE join_method = 'manual';

UPDATE public.participants
SET join_method = 'manual_name_only'
WHERE join_method IS NOT NULL
  AND join_method NOT IN ('qr_app', 'qr_web', 'manual_phone', 'manual_name_only');

-- Replace legacy join_method CHECK constraints that omit qr_web / qr_app.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'participants'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%join_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.participants DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_join_method_check;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_join_method_check
  CHECK (join_method IN ('qr_app', 'qr_web', 'manual_phone', 'manual_name_only'));

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'participants'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%message_channel%'
  LOOP
    EXECUTE format('ALTER TABLE public.participants DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.participants
  DROP CONSTRAINT IF EXISTS participants_message_channel_check;

ALTER TABLE public.participants
  ADD CONSTRAINT participants_message_channel_check
  CHECK (message_channel IS NULL OR message_channel IN ('sms', 'whatsapp'));

CREATE INDEX IF NOT EXISTS idx_participants_guest_pii
  ON public.participants(guest_pii_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_guest_unique
  ON public.participants (event_id, guest_pii_token)
  WHERE guest_pii_token IS NOT NULL;
