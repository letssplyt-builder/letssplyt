-- Device trust metadata for OTP verify and biometric enrollment tracking.

ALTER TABLE device_sessions
  ADD COLUMN IF NOT EXISTS last_otp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS biometric_enrolled_at TIMESTAMPTZ;
