-- In-app notification center (distinct from notification_log delivery tracking).

CREATE TABLE user_notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   UUID        REFERENCES events(id) ON DELETE SET NULL,
  type       TEXT        NOT NULL CHECK (type IN (
    'member_paid',
    'event_fully_settled',
    'member_paid_all',
    'added_to_event',
    'nudge',
    'share_ready',
    'share_edited'
  )),
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_notifications_user_created
  ON user_notifications(user_id, created_at DESC);

CREATE INDEX idx_user_notifications_user_unread
  ON user_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_notifications_select_own ON user_notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY user_notifications_update_own ON user_notifications
  FOR UPDATE
  USING (user_id = auth.uid());
