-- Notification preference toggles for Settings screen (E11-S02).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS payment_alert_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS share_alert_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
