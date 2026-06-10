-- Repair: some remote projects were created before last_parse_attempt_id was applied.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS last_parse_attempt_id UUID;
