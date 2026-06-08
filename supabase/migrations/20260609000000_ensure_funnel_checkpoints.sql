-- Fix funnel_checkpoints schema for the web join flow (E06-S01).
-- Some databases have an older funnel_checkpoints table without session_id.
-- This table is analytics-only (no user-facing reads), so replacing a drifted
-- empty/wrong schema is safe in dev and staging.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'funnel_checkpoints'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'funnel_checkpoints'
      AND column_name = 'session_id'
  ) THEN
    DROP TABLE funnel_checkpoints CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS funnel_checkpoints (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT        NOT NULL,
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  event_id      UUID        REFERENCES events(id) ON DELETE SET NULL,
  checkpoint    TEXT        NOT NULL CHECK (checkpoint IN (
                              'join_page_loaded',
                              'phone_entered',
                              'otp_sent',
                              'otp_verified',
                              'name_entered',
                              'join_confirmed',
                              'payment_link_tapped',
                              'self_report_submitted',
                              'app_download_prompted',
                              'app_download_tapped'
                            )),
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_session    ON funnel_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_event      ON funnel_checkpoints(event_id);
CREATE INDEX IF NOT EXISTS idx_funnel_checkpoint ON funnel_checkpoints(checkpoint, created_at DESC);

ALTER TABLE funnel_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'funnel_checkpoints'
      AND policyname = 'funnel_service_only'
  ) THEN
    CREATE POLICY "funnel_service_only" ON funnel_checkpoints
      USING (FALSE);
  END IF;
END $$;
