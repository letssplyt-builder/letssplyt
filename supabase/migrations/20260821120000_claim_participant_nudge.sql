-- DESCRIPTION: Atomic organizer nudge claim so double-taps cannot send two SMS.
-- ROLLBACK:    DROP FUNCTION IF EXISTS public.claim_participant_nudge(UUID, UUID);

CREATE OR REPLACE FUNCTION public.claim_participant_nudge(
  p_participant_id UUID,
  p_event_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_at TIMESTAMPTZ;
BEGIN
  UPDATE participants
  SET
    last_nudged_at = NOW(),
    nudge_count = nudge_count + 1
  WHERE id = p_participant_id
    AND event_id = p_event_id
    AND (
      last_nudged_at IS NULL
      OR last_nudged_at < NOW() - INTERVAL '48 hours'
    )
  RETURNING last_nudged_at INTO claimed_at;

  RETURN claimed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_participant_nudge(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_participant_nudge(UUID, UUID) TO service_role;
