-- E07: additional receipt charges (service charge, city fee, large party fee, etc.)
-- fees_amount on events = sum of additional_charges; each charge also stored as receipt_items row with is_fee=true.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS fees_amount NUMERIC(10,2);

ALTER TABLE public.receipt_items
  ADD COLUMN IF NOT EXISTS is_fee BOOLEAN NOT NULL DEFAULT false;
