-- DESCRIPTION: Widen money columns to NUMERIC(12,3) for 3-decimal currencies (BHD, KWD, etc.) — audit C4.
-- ROLLBACK:    Reverse ALTER TYPE to NUMERIC(10,2) (may truncate third decimal).

ALTER TABLE public.events
  ALTER COLUMN total_amount TYPE NUMERIC(12,3),
  ALTER COLUMN tax_amount TYPE NUMERIC(12,3),
  ALTER COLUMN tip_amount TYPE NUMERIC(12,3),
  ALTER COLUMN fees_amount TYPE NUMERIC(12,3),
  ALTER COLUMN discount_amount TYPE NUMERIC(12,3);

ALTER TABLE public.participants
  ALTER COLUMN amount_owed TYPE NUMERIC(12,3),
  ALTER COLUMN original_amount_owed TYPE NUMERIC(12,3);

ALTER TABLE public.receipt_items
  DROP COLUMN IF EXISTS line_total;

ALTER TABLE public.receipt_items
  ALTER COLUMN unit_price TYPE NUMERIC(12,3);

ALTER TABLE public.receipt_items
  ADD COLUMN line_total NUMERIC(12,3) GENERATED ALWAYS AS (unit_price * quantity) STORED;

ALTER TABLE public.item_assignments
  ALTER COLUMN share_amount TYPE NUMERIC(12,3);

ALTER TABLE public.settlement_log
  ALTER COLUMN amount TYPE NUMERIC(12,3);

ALTER TABLE public.receipt_discounts
  ALTER COLUMN resolved_amount TYPE NUMERIC(12,3);
