-- Item review confirm (E07-S03) transitions parsed → parsed_confirmed
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ai_stage_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_ai_stage_check CHECK (ai_stage IN (
    'none',
    'parsing',
    'parsed',
    'parsed_confirmed',
    'calculating',
    'calculated',
    'messaging',
    'complete',
    'failed'
  ));
