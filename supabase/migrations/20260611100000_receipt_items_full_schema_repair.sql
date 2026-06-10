-- Full receipt_items schema repair for E07 A1 parsing.
-- Remote DBs may have legacy columns (description, price) or a partial table from early prototypes.
-- Authoritative column list matches 04-Data-Architecture §3.7 and initial_schema.sql.

-- Minimal shell if the table was never created.
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy renames (API spec: name was description, unit_price was price).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receipt_items' AND column_name = 'description'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receipt_items' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.receipt_items RENAME COLUMN description TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receipt_items' AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receipt_items' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE public.receipt_items RENAME COLUMN price TO unit_price;
  END IF;
END $$;

-- Core line-item columns (A1 insert + Item Review).
ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS quantity NUMERIC(6,2) NOT NULL DEFAULT 1;

-- Backfill before NOT NULL constraints.
UPDATE public.receipt_items
SET name = 'Item'
WHERE name IS NULL;

UPDATE public.receipt_items
SET unit_price = 0
WHERE unit_price IS NULL;

UPDATE public.receipt_items
SET quantity = 1
WHERE quantity IS NULL;

ALTER TABLE public.receipt_items
  ALTER COLUMN name SET NOT NULL;

ALTER TABLE public.receipt_items
  ALTER COLUMN unit_price SET NOT NULL;

-- Generated line total (never inserted by app — DB computes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receipt_items' AND column_name = 'line_total'
  ) THEN
    ALTER TABLE public.receipt_items
      ADD COLUMN line_total NUMERIC(10,2)
      GENERATED ALWAYS AS (unit_price * quantity) STORED;
  END IF;
END $$;

-- AI parse metadata (A1 persist + low-confidence UI in E07-S03).
ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) NOT NULL DEFAULT 1.00;

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS is_low_confidence BOOLEAN NOT NULL DEFAULT false;

-- Item classification flags (A2 tax/tip proration).
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

CREATE INDEX IF NOT EXISTS idx_receipt_items_event ON public.receipt_items(event_id);

-- Events columns used when A1 persists parse results and getCachedReceiptResult runs.
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

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ai_stage TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en-US';

NOTIFY pgrst, 'reload schema';
