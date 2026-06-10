-- DESCRIPTION: Atomic reset of receipt/split expense data for a locked event (POST /events/:id/expenses/reset).
--              Deletes receipt_items, clears participant split fields, resets events receipt/AI columns.
-- ROLLBACK:    DROP FUNCTION IF EXISTS public.reset_event_expenses_data(UUID);
-- TESTED IN STAGING: (date before production)
CREATE OR REPLACE FUNCTION public.reset_event_expenses_data(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM receipt_items WHERE event_id = p_event_id;

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
