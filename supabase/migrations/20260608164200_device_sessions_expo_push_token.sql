-- Repair: remote DB had device_sessions without expo_push_token despite migration history.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

CREATE INDEX IF NOT EXISTS idx_device_sessions_token
  ON public.device_sessions(expo_push_token)
  WHERE expo_push_token IS NOT NULL;
