-- Per-participant secret link for SMS split breakdown page (replaces MMS split images).

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS breakdown_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_breakdown_token
  ON public.participants (breakdown_token)
  WHERE breakdown_token IS NOT NULL;
