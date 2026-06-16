-- Custom OTP verification codes (replaces Twilio Verify)
CREATE TABLE otp_verifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash    TEXT        NOT NULL,
  code_hash     TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at   TIMESTAMPTZ,
  attempt_count INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX idx_otp_verifications_phone_hash ON otp_verifications(phone_hash);
CREATE INDEX idx_otp_verifications_expires_at ON otp_verifications(expires_at);

ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
