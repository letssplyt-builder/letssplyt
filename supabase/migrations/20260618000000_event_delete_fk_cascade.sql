-- Support hard delete of draft events (messages_sent_at IS NULL) via FK cascades.
-- Service layer still deletes notification_log / settlement_log explicitly pre-delete.

ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_event_id_fkey;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_participant_id_fkey;

ALTER TABLE notification_log
  ADD CONSTRAINT notification_log_participant_id_fkey
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;

ALTER TABLE settlement_log
  DROP CONSTRAINT IF EXISTS settlement_log_event_id_fkey;

ALTER TABLE settlement_log
  ADD CONSTRAINT settlement_log_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

ALTER TABLE sms_opt_outs
  DROP CONSTRAINT IF EXISTS sms_opt_outs_event_id_fkey;

ALTER TABLE sms_opt_outs
  ADD CONSTRAINT sms_opt_outs_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
