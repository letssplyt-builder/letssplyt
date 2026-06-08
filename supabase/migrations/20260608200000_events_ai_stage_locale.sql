-- Repair schema drift on events: ai_stage and locale are required by the event API
-- (E05-S01) but were absent on remote DBs provisioned before initial_schema included them.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ai_stage TEXT NOT NULL DEFAULT 'none'
    CHECK (ai_stage IN (
      'none',
      'parsing',
      'parsed',
      'calculating',
      'calculated',
      'messaging',
      'complete',
      'failed'
    ));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en-US';
