-- Item-scoped receipt discounts (null receipt_item_id = whole-bill discount).
ALTER TABLE public.receipt_discounts
  ADD COLUMN IF NOT EXISTS receipt_item_id UUID REFERENCES public.receipt_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_receipt_discounts_item
  ON public.receipt_discounts(receipt_item_id)
  WHERE receipt_item_id IS NOT NULL;
