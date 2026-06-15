-- Allow GDPR tombstone on account deletion (E11-S02).
-- Rollback: ALTER TABLE users ALTER COLUMN phone_encrypted SET NOT NULL;
-- (Only safe if no deleted rows have phone_encrypted IS NULL.)

ALTER TABLE users
  ALTER COLUMN phone_encrypted DROP NOT NULL;
