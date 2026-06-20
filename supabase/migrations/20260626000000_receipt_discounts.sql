-- DESCRIPTION: Manual receipt discounts on Item Review (percent or fixed amount).
-- ROLLBACK:    DROP TABLE IF EXISTS public.receipt_discounts;
--              ALTER TABLE public.events DROP COLUMN IF EXISTS discount_amount;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS public.receipt_discounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name             VARCHAR(60) NOT NULL,
  discount_type    VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  value            NUMERIC(10,4) NOT NULL CHECK (value > 0),
  resolved_amount  NUMERIC(10,2) NOT NULL CHECK (resolved_amount >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_discounts_event
  ON public.receipt_discounts(event_id);

ALTER TABLE public.receipt_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_discounts_select_payer" ON public.receipt_discounts
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM public.events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_discounts_insert_payer" ON public.receipt_discounts
  FOR INSERT
  WITH CHECK (
    event_id IN (SELECT id FROM public.events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_discounts_update_payer" ON public.receipt_discounts
  FOR UPDATE
  USING (
    event_id IN (SELECT id FROM public.events WHERE payer_id = auth.uid())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM public.events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_discounts_delete_payer" ON public.receipt_discounts
  FOR DELETE
  USING (
    event_id IN (SELECT id FROM public.events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_discounts_select_participant" ON public.receipt_discounts
  FOR SELECT
  USING (
    event_id IN (
      SELECT event_id FROM public.participants WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.reset_event_expenses_data(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM receipt_items WHERE event_id = p_event_id;
  DELETE FROM receipt_discounts WHERE event_id = p_event_id;

  UPDATE participants
  SET
    amount_owed = NULL,
    payment_status = 'pending',
    message_sent_at = NULL,
    message_delivered_at = NULL,
    message_failed = false,
    message_channel = NULL,
    payment_link_tapped_at = NULL,
    self_reported_at = NULL,
    self_reported_method = NULL,
    confirmed_at = NULL
  WHERE event_id = p_event_id;

  DELETE FROM ai_audit_log WHERE event_id = p_event_id;

  UPDATE events
  SET
    total_amount = NULL,
    tax_amount = NULL,
    tip_amount = NULL,
    fees_amount = NULL,
    discount_amount = NULL,
    receipt_scan_attempted = false,
    ai_parse_success = NULL,
    ai_parse_confidence = NULL,
    ai_stage = 'none',
    split_mode = NULL,
    last_parse_attempt_id = NULL
  WHERE id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_event_expenses_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_event_expenses_data(UUID) TO service_role;
