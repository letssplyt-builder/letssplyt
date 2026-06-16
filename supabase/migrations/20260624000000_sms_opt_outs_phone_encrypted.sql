-- sms_opt_outs.phone_encrypted: required for STOP upsert (encrypt at opt-out time).
-- phone_hash remains the lookup key; encrypted value supports audit/recovery workflows.

ALTER TABLE sms_opt_outs
  ADD COLUMN IF NOT EXISTS phone_encrypted TEXT;

-- Backfill not possible without plaintext; new STOP rows set phone_encrypted in processSmsStopOptOut.
-- Remote dev already had NOT NULL; enforce after column exists on fresh installs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sms_opt_outs'
      AND column_name = 'phone_encrypted'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE sms_opt_outs ALTER COLUMN phone_encrypted SET NOT NULL;
  END IF;
END $$;
