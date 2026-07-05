-- DESCRIPTION: Atomic OTP attempt increment (audit H4 — no read-then-write race).
-- ROLLBACK:    DROP FUNCTION IF EXISTS public.increment_otp_attempt(UUID);

CREATE OR REPLACE FUNCTION public.increment_otp_attempt(p_otp_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE otp_verifications
  SET attempt_count = attempt_count + 1
  WHERE id = p_otp_id
    AND attempt_count < 5
  RETURNING attempt_count INTO updated_count;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_otp_attempt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_otp_attempt(UUID) TO service_role;
