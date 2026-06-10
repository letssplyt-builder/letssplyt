-- Repair schema drift on receipt_items: A1 parsing (E07-S02) requires confidence columns
-- and flags that may be missing on remote DBs created before initial_schema was complete.

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) NOT NULL DEFAULT 1.00;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS is_low_confidence BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS is_tax BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS is_tip BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS receipt_s3_key TEXT;

-- Events financial fields used when caching parse results (A1 idempotency).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS receipt_scan_attempted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ai_parse_success BOOLEAN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ai_parse_confidence NUMERIC(3,2);

-- Refresh PostgREST schema cache so API clients see new columns immediately.
NOTIFY pgrst, 'reload schema';
