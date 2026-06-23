-- DESCRIPTION: Complete initial LetsSplyt database schema — all tables, indexes,
--              triggers, RLS policies, analytics partitions, and Realtime publication.
--              Sourced from docs/04-Data-Architecture.md (authoritative).
-- ROLLBACK:    Drop all objects in reverse dependency order (tables CASCADE removes
--              triggers, policies, and partitions). Not automated — run manually if needed.
-- TESTED IN STAGING: [pending]

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- optional; pgcrypto is primary

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 3: Complete Schema (dependency order)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.1 guest_pii
-- Isolated PII store for non-app guests.
-- Only the backend service role can read or write this table.
-- purge_after is NULL at creation; set by trigger when event reaches 'settled'.
-- Auto-purged 30 days after event settlement via nightly background job.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE guest_pii (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- phone_hash: HMAC-SHA256(phone_e164, PII_HMAC_SALT) — used for dedup and opt-out lookup
  phone_hash      TEXT        NOT NULL,
  -- phone_encrypted: AES-256-GCM encrypted E.164 phone — decrypted only at SMS send time
  phone_encrypted TEXT        NOT NULL,
  -- name_encrypted: AES-256-GCM encrypted full name — decrypted only at message composition time
  name_encrypted  TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- purge_after: NULL at creation; set by trg_set_guest_pii_purge_date trigger when
  -- the linked event transitions to 'settled'. Set to NOW() + INTERVAL '30 days'.
  -- The nightly purge job deletes rows where purge_after IS NOT NULL AND purge_after < NOW()
  purge_after     TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.2 users
-- Registered LetsSplyt users. Identified by UUID, looked up by phone_hash.
-- phone_e164 is never stored in plaintext in this table.
-- Soft deletes only — deleted_at is set, row is never removed.
-- acquisition_event_id added via ALTER TABLE after all tables created.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Phone stored in two forms: hash for lookup, encrypted for retrieval.
  -- Neither is a raw E.164 string.
  phone_hash            TEXT        UNIQUE NOT NULL,
  phone_encrypted       TEXT        NOT NULL,

  -- name_encrypted: AES-256-GCM encrypted full name (used in message composition)
  name_encrypted        TEXT,

  -- display_name is non-sensitive — shown to other event members (e.g. "Alex R.")
  display_name          TEXT        NOT NULL,

  avatar_colour         TEXT        NOT NULL DEFAULT '#6366F1', -- hex colour for generated avatar
  avatar_url            TEXT,                                   -- optional uploaded image

  -- Acquisition tracking — set at registration, never updated
  acquisition_source    TEXT        CHECK (acquisition_source IN (
                          'organic', 'qr_scan', 'sms_invite', 'referral'
                        )),
  -- acquisition_event_id: FK to events(id) added via ALTER TABLE after all tables created.

  -- Activation milestone timestamps
  first_event_at        TIMESTAMPTZ,   -- when they created their first event
  last_active_at        TIMESTAMPTZ,   -- updated on every app open

  -- Denormalised counters — updated via DB triggers (see Section 4)
  total_events_created  INT         NOT NULL DEFAULT 0,
  total_events_joined   INT         NOT NULL DEFAULT 0,

  -- Global SMS opt-out flag — set when Twilio STOP webhook fires
  is_opted_out          BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Soft delete — set by DELETE /users/me; row is never hard-deleted
  deleted_at            TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.3 user_payment_handles
-- AES-256-GCM encrypted payment identifiers.
-- The Node.js service encrypts before INSERT and decrypts only in A3 composer.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_payment_handles (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  provider         TEXT      NOT NULL CHECK (provider IN (
                     'venmo', 'paypal', 'cashapp', 'zelle', 'wise',
                     'upi', 'bank_transfer', 'other'
                   )),

  -- handle_encrypted: the encrypted payment handle string (e.g. "@username", "$cashtag")
  -- Format: iv_hex:auth_tag_hex:ciphertext_hex (see infrastructure/encryption.ts)
  handle_encrypted TEXT      NOT NULL,

  -- display_order: lower number shown first in the message payment links
  display_order    SMALLINT  NOT NULL DEFAULT 0,
  is_active        BOOLEAN   NOT NULL DEFAULT TRUE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.4 events
-- Core bill-splitting session. Created by a payer, progresses through a
-- lifecycle from 'open' (join window) through to 'settled'.
-- Soft deletes only — payer "archiving" sets deleted_at, row is never removed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- payer_id: the user who created the event and paid the bill
  -- All RLS policies use payer_id — NOT creator_id (that field does not exist)
  payer_id        UUID        NOT NULL REFERENCES users(id),

  title           TEXT        NOT NULL,
  event_date      DATE,

  -- total_amount is NULL until the payer enters it manually or receipt is scanned
  total_amount    NUMERIC(10,2),
  currency        TEXT        NOT NULL DEFAULT 'USD',

  status          TEXT        NOT NULL DEFAULT 'open' CHECK (status IN (
                    'open',        -- join window open; no split yet
                    'locked',      -- group locked; receipt not yet processed
                    'calculating', -- A1/A2 running
                    'sent',        -- messages sent to all participants
                    'settled',     -- all participants confirmed paid
                    'archived'     -- payer archived / soft-deleted
                  )),

  -- 'equal' = everyone pays the same; 'portion' = custom amounts per person;
  -- 'itemised' = items assigned to individuals.
  split_mode      VARCHAR(10)  CHECK (split_mode IN (
                    'equal', 'portion', 'itemised'
                  )),

  -- snapshot of participant count when group was locked, for analytics
  participant_count_at_lock  SMALLINT,

  receipt_scan_attempted  BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_parse_success        BOOLEAN,                -- NULL = not attempted; TRUE/FALSE = result
  ai_parse_confidence     NUMERIC(3,2),           -- 0.00–1.00, from A1 response

  ai_stage        TEXT        NOT NULL DEFAULT 'none' CHECK (ai_stage IN (
                    'none',        -- no AI processing started
                    'parsing',     -- A1 receipt parsing in progress
                    'parsed',      -- A1 complete
                    'calculating', -- A2 split calculation in progress
                    'calculated',  -- A2 complete
                    'messaging',   -- A3 message composition in progress
                    'complete',    -- all AI agents finished successfully
                    'failed'       -- one or more agents failed; check ai_audit_log
                  )),

  -- Performance metrics (populated on transition; used for analytics)
  time_to_lock_seconds  INT,   -- seconds from event created_at to locked_at
  time_to_send_seconds  INT,   -- seconds from locked_at to messages_sent_at

  tax_amount              NUMERIC(10,2),                       -- extracted by A1; NULL until parsed
  tip_amount              NUMERIC(10,2),                       -- extracted by A1; NULL until parsed
  locale                  VARCHAR(10)  NOT NULL DEFAULT 'en-US', -- detected from receipt by A1
  last_parse_attempt_id   UUID,                                 -- set by A1 on scan

  locked_at           TIMESTAMPTZ,
  messages_sent_at    TIMESTAMPTZ,
  fully_settled_at    TIMESTAMPTZ,

  -- Soft delete — set by payer archiving the event
  deleted_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.5 event_join_tokens
-- Each active token corresponds to one scannable QR code / shareable URL.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE event_join_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- token: URL-safe base64 string; at least 18 bytes (144 bits) of randomness
  token       TEXT        NOT NULL UNIQUE,

  -- expires_at: set to NOW() + INTERVAL '24 hours' at creation
  expires_at  TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,

  -- revoked_at: set when group is locked, payer manually revokes, or TTL expires
  revoked_at  TIMESTAMPTZ,

  -- scan_count: incremented on each QR scan
  scan_count  INT         NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.6 participants
-- One row per person per event. The central junction between events and users.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- user_id: populated for registered app users; NULL for guests
  user_id         UUID        REFERENCES users(id),

  guest_pii_token UUID        CONSTRAINT fk_guest_pii REFERENCES guest_pii(id) ON DELETE SET NULL,

  -- display_name: non-sensitive name shown in the event member list and split table
  display_name    TEXT        NOT NULL,

  join_method     TEXT        NOT NULL DEFAULT 'manual' CHECK (join_method IN (
                    'qr_app',        -- had app installed; deep-linked in
                    'qr_web',        -- scanned QR, registered in browser (no app)
                    'manual_phone',  -- added by payer with a phone number
                    'manual_name_only' -- cash-only; no phone; no SMS ever sent
                  )),

  -- country_code: ISO 3166-1 alpha-2 (e.g. 'US', 'DE')
  country_code    TEXT,

  -- amount_owed: NULL until A2 split calculation is complete
  amount_owed     NUMERIC(10,2),

  payment_status  TEXT        NOT NULL DEFAULT 'pending' CHECK (payment_status IN (
                    'pending',
                    'self_reported',
                    'payer_marked',
                    'confirmed',
                    'disputed',
                    'opted_out',
                    'settled'
                  )),

  -- Message delivery tracking (populated from Twilio status callbacks)
  message_sent_at       TIMESTAMPTZ,
  message_delivered_at  TIMESTAMPTZ,
  message_failed        BOOLEAN     NOT NULL DEFAULT FALSE,

  message_channel TEXT        CHECK (message_channel IN ('sms', 'whatsapp')),

  -- Payment tracking
  payment_link_tapped_at  TIMESTAMPTZ,
  self_reported_at        TIMESTAMPTZ,
  self_reported_method    TEXT,
  confirmed_at            TIMESTAMPTZ,
  disputed_count          SMALLINT    NOT NULL DEFAULT 0,
  nudge_count             SMALLINT    NOT NULL DEFAULT 0,
  last_nudged_at          TIMESTAMPTZ,

  -- Revision tracking
  original_amount_owed    NUMERIC(10,2),
  revision_count          SMALLINT    NOT NULL DEFAULT 0,

  opted_out       BOOLEAN     NOT NULL DEFAULT FALSE,
  opted_out_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One app user can only appear once per event
  UNIQUE (event_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.7 receipt_items
-- One row per line item on the bill.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE receipt_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  name            TEXT        NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL,
  quantity        NUMERIC(6,2) NOT NULL DEFAULT 1,

  -- line_total is always unit_price * quantity — computed by the DB
  line_total      NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,

  confidence_score  NUMERIC(3,2)  NOT NULL DEFAULT 1.00,
  is_low_confidence BOOLEAN       NOT NULL DEFAULT false,

  is_tax          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_tip          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_shared       BOOLEAN     NOT NULL DEFAULT FALSE,

  ai_extracted    BOOLEAN     NOT NULL DEFAULT TRUE,

  receipt_s3_key  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.8 item_assignments
-- Maps receipt items to participants.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE item_assignments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID        NOT NULL REFERENCES receipt_items(id) ON DELETE CASCADE,
  participant_id  UUID        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,

  share_amount    NUMERIC(10,2) NOT NULL,

  assignment_method TEXT       CHECK (assignment_method IN (
                      'drag',
                      'nlp',
                      'manual',
                      'even'
                    )),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (item_id, participant_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.9 settlement_log
-- Append-only audit trail. NEVER update or delete rows from this table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE settlement_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,

  event_id        UUID        NOT NULL REFERENCES events(id),

  action          TEXT        NOT NULL CHECK (action IN (
                    'self_reported',
                    'confirmed',
                    'disputed',
                    'settled',
                    'cancelled',
                    'nudged',
                    'opted_out'
                  )),

  actor_id        UUID        REFERENCES users(id),

  from_status     TEXT        CHECK (from_status IN (
                    'pending','self_reported','payer_marked','confirmed',
                    'disputed','opted_out','settled'
                  )),
  to_status       TEXT        CHECK (to_status IN (
                    'pending','self_reported','payer_marked','confirmed',
                    'disputed','opted_out','settled'
                  )),

  amount          NUMERIC(10,2),

  note            TEXT,
  metadata        JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.10 notification_log
-- One row per outbound notification (push, SMS, WhatsApp).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE notification_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id         UUID        REFERENCES users(id),
  event_id        UUID        REFERENCES events(id),
  participant_id  UUID        REFERENCES participants(id),

  type            TEXT        NOT NULL CHECK (type IN (
                    'welcome_push',
                    'split_received_push',
                    'split_received_sms',
                    'payment_self_report_push',
                    'payment_confirmed_push',
                    'payment_disputed_push',
                    'nudge_push',
                    'nudge_sms',
                    'revision_push',
                    'revision_sms',
                    'all_settled_push'
                  )),

  channel         TEXT        CHECK (channel IN ('push', 'sms', 'whatsapp')),
  status          TEXT        CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),

  twilio_sid      TEXT,

  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  failed_reason   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.11 funnel_checkpoints
-- Tracks anonymous and authenticated user progress through the join funnel.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE funnel_checkpoints (
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.12 device_sessions
-- Tracks per-device state for push notification delivery.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE device_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT        NOT NULL,
  platform        TEXT        NOT NULL CHECK (platform IN ('ios','android')),
  expo_push_token TEXT,
  app_version     TEXT,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.13 sms_opt_outs
-- TCPA compliance. Records every phone number that has opted out via STOP reply.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE sms_opt_outs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  phone_hash      TEXT        NOT NULL UNIQUE,

  opted_out_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opt_out_method  TEXT        NOT NULL CHECK (opt_out_method IN (
                    'stop_reply',
                    'in_app',
                    'admin'
                  )),

  event_id        UUID        REFERENCES events(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.14 ai_audit_log
-- Append-only record of every AI API call made by A1, A2, or A3.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ai_audit_log (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID         REFERENCES events(id) ON DELETE CASCADE,
  agent       VARCHAR(2)   NOT NULL CHECK (agent IN ('A1','A2','A3')),
  provider    TEXT         NOT NULL,
  model_used  TEXT         NOT NULL,
  input_hash  TEXT,
  output_hash TEXT,
  input_tokens  INT,
  output_tokens INT,
  latency_ms    INT,
  attempts      SMALLINT    NOT NULL DEFAULT 1,
  success       BOOLEAN     NOT NULL,
  error_code    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.15 analytics_events
-- Partitioned raw event stream — foundation of all product metrics.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE analytics_events (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES users(id),
  session_id      TEXT,
  anonymous_id    TEXT,
  event_name      TEXT        NOT NULL,
  properties      JSONB       NOT NULL DEFAULT '{}',
  platform        TEXT        CHECK (platform IN ('ios', 'android', 'web')),
  app_version     TEXT,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Post-Creation ALTER TABLE Statements
-- Fix circular FK: users.acquisition_event_id → events(id)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS acquisition_event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 5: All Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- users
CREATE INDEX idx_users_phone_hash       ON users(phone_hash);
CREATE INDEX idx_users_acquisition      ON users(acquisition_source);
CREATE INDEX idx_users_last_active      ON users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_users_acquisition_event ON users(acquisition_event_id) WHERE acquisition_event_id IS NOT NULL;

-- user_payment_handles
CREATE INDEX idx_payment_handles_user   ON user_payment_handles(user_id)
  WHERE is_active = TRUE;

-- events
CREATE INDEX idx_events_payer           ON events(payer_id);
CREATE INDEX idx_events_status          ON events(status);
CREATE INDEX idx_events_created_at      ON events(created_at);

-- event_join_tokens
CREATE INDEX idx_join_tokens_token      ON event_join_tokens(token)
  WHERE is_active = TRUE;
CREATE INDEX idx_join_tokens_event      ON event_join_tokens(event_id);

-- participants
CREATE INDEX idx_participants_event     ON participants(event_id);
CREATE INDEX idx_participants_user      ON participants(user_id);
CREATE INDEX idx_participants_status    ON participants(payment_status);
CREATE INDEX idx_participants_guest_pii ON participants(guest_pii_token);
CREATE UNIQUE INDEX idx_participants_guest_unique
  ON participants (event_id, guest_pii_token)
  WHERE guest_pii_token IS NOT NULL;

-- receipt_items
CREATE INDEX idx_receipt_items_event    ON receipt_items(event_id);

-- item_assignments
CREATE INDEX idx_item_assignments_item  ON item_assignments(item_id);
CREATE INDEX idx_item_assignments_part  ON item_assignments(participant_id);

-- settlement_log
CREATE INDEX idx_settlement_log_part    ON settlement_log(participant_id);
CREATE INDEX idx_settlement_log_event   ON settlement_log(event_id);
CREATE INDEX idx_settlement_log_created ON settlement_log(created_at);

-- notification_log
CREATE INDEX idx_notif_log_user         ON notification_log(user_id);
CREATE INDEX idx_notif_log_event        ON notification_log(event_id);
CREATE INDEX idx_notif_log_sent         ON notification_log(sent_at);

-- funnel_checkpoints (inline in Section 3.11)
CREATE INDEX idx_funnel_session    ON funnel_checkpoints(session_id);
CREATE INDEX idx_funnel_event      ON funnel_checkpoints(event_id);
CREATE INDEX idx_funnel_checkpoint ON funnel_checkpoints(checkpoint, created_at DESC);

-- device_sessions (inline in Section 3.12)
CREATE INDEX idx_device_sessions_user     ON device_sessions(user_id);
CREATE INDEX idx_device_sessions_token    ON device_sessions(expo_push_token)
  WHERE expo_push_token IS NOT NULL;

-- sms_opt_outs
CREATE INDEX idx_opt_outs_phone_hash    ON sms_opt_outs(phone_hash);

-- ai_audit_log
CREATE INDEX idx_ai_audit_event         ON ai_audit_log(event_id);
CREATE INDEX idx_ai_audit_agent_event   ON ai_audit_log(agent, event_id);

-- analytics_events
CREATE INDEX idx_ae_user_time           ON analytics_events(user_id, created_at);
CREATE INDEX idx_ae_event_name_time     ON analytics_events(event_name, created_at);
CREATE INDEX idx_ae_session             ON analytics_events(session_id);
CREATE INDEX idx_ae_properties          ON analytics_events USING GIN(properties);

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 4: All Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 Shared trigger function: set updated_at to NOW() on every row update.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4.2 trg_users_updated_at
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 4.3 trg_events_updated_at
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 4.4 trg_participants_updated_at
CREATE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 4.5 trg_events_created_count
CREATE OR REPLACE FUNCTION increment_events_created()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET total_events_created = total_events_created + 1
  WHERE id = NEW.payer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_events_created_count
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION increment_events_created();

-- 4.6 trg_events_joined_count
CREATE OR REPLACE FUNCTION increment_events_joined()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_id != (
    SELECT payer_id FROM events WHERE id = NEW.event_id
  ) THEN
    UPDATE users
    SET total_events_joined = total_events_joined + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_events_joined_count
  AFTER INSERT ON participants
  FOR EACH ROW
  EXECUTE FUNCTION increment_events_joined();

-- 4.7 trg_set_guest_pii_purge_date
CREATE OR REPLACE FUNCTION set_guest_pii_purge_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    UPDATE guest_pii
    SET purge_after = NOW() + INTERVAL '30 days'
    WHERE id IN (
      SELECT guest_pii_token FROM participants
      WHERE event_id = NEW.id AND guest_pii_token IS NOT NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_set_guest_pii_purge_date
  AFTER UPDATE ON events
  FOR EACH ROW
  WHEN (NEW.status = 'settled' AND OLD.status IS DISTINCT FROM 'settled')
  EXECUTE FUNCTION set_guest_pii_purge_date();

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 8: Analytics Partitioning
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_analytics_partition(
  partition_name TEXT,
  start_date DATE,
  end_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$;

REVOKE ALL ON FUNCTION create_analytics_partition FROM PUBLIC;

CREATE TABLE analytics_events_2026_06 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE analytics_events_2026_07 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE analytics_events_2026_08 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE analytics_events_2026_09 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 6: Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

-- 6.1 Enable RLS Statements
ALTER TABLE guest_pii              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_handles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_join_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_checkpoints     ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_outs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events       ENABLE ROW LEVEL SECURITY;

-- guest_pii (Section 3.1)
CREATE POLICY "guest_pii_no_direct_access" ON guest_pii
  FOR ALL USING (false);

-- 6.2 users Policies
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6.3 user_payment_handles Policies
CREATE POLICY "handles_select_own" ON user_payment_handles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "handles_insert_own" ON user_payment_handles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "handles_update_own" ON user_payment_handles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "handles_delete_own" ON user_payment_handles
  FOR DELETE
  USING (user_id = auth.uid());

-- 6.4 events Policies
CREATE POLICY "events_select_payer" ON events
  FOR SELECT
  USING (payer_id = auth.uid());

CREATE POLICY "events_select_participant" ON events
  FOR SELECT
  USING (
    id IN (
      SELECT event_id FROM participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "events_insert_payer" ON events
  FOR INSERT
  WITH CHECK (payer_id = auth.uid());

CREATE POLICY "events_update_payer" ON events
  FOR UPDATE
  USING (payer_id = auth.uid())
  WITH CHECK (payer_id = auth.uid());

-- 6.5 event_join_tokens Policies
CREATE POLICY "tokens_select_payer" ON event_join_tokens
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

-- 6.6 participants Policies
CREATE POLICY "participants_select_payer" ON participants
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

CREATE POLICY "participants_select_self" ON participants
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "participants_update_self_safe" ON participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
  );

COMMENT ON POLICY "participants_update_self_safe" ON participants IS
  'Participants may read/update their own row. Financial fields (payment_status, amount_owed) must only be written via backend service role. The mobile app never writes these fields directly.';

CREATE POLICY "participants_update_payer" ON participants
  FOR UPDATE
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

-- 6.7 receipt_items Policies
CREATE POLICY "receipt_items_select_payer" ON receipt_items
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_items_insert_payer" ON receipt_items
  FOR INSERT
  WITH CHECK (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_items_update_payer" ON receipt_items
  FOR UPDATE
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_items_delete_payer" ON receipt_items
  FOR DELETE
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

CREATE POLICY "receipt_items_select_participant" ON receipt_items
  FOR SELECT
  USING (
    event_id IN (
      SELECT event_id FROM participants WHERE user_id = auth.uid()
    )
  );

-- 6.8 item_assignments Policies
CREATE POLICY "item_assignments_select_payer" ON item_assignments
  FOR SELECT
  USING (
    item_id IN (
      SELECT ri.id FROM receipt_items ri
      JOIN events e ON e.id = ri.event_id
      WHERE e.payer_id = auth.uid()
    )
  );

CREATE POLICY "item_assignments_insert_payer" ON item_assignments
  FOR INSERT
  WITH CHECK (
    item_id IN (
      SELECT ri.id FROM receipt_items ri
      JOIN events e ON e.id = ri.event_id
      WHERE e.payer_id = auth.uid()
    )
  );

CREATE POLICY "item_assignments_delete_payer" ON item_assignments
  FOR DELETE
  USING (
    item_id IN (
      SELECT ri.id FROM receipt_items ri
      JOIN events e ON e.id = ri.event_id
      WHERE e.payer_id = auth.uid()
    )
  );

CREATE POLICY "item_assignments_select_self" ON item_assignments
  FOR SELECT
  USING (
    participant_id IN (
      SELECT id FROM participants WHERE user_id = auth.uid()
    )
  );

-- 6.9 settlement_log Policies
CREATE POLICY "settlement_log_select_payer" ON settlement_log
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

CREATE POLICY "settlement_log_select_self" ON settlement_log
  FOR SELECT
  USING (
    participant_id IN (
      SELECT id FROM participants WHERE user_id = auth.uid()
    )
  );

-- 6.10 notification_log Policies
CREATE POLICY "notif_log_select_own" ON notification_log
  FOR SELECT
  USING (user_id = auth.uid());

-- 6.11 sms_opt_outs — no client-facing policies (service role only)

-- 6.12 ai_audit_log — no client-facing policies (service role only)

-- 6.13 analytics_events Policies
CREATE POLICY "analytics_insert_authenticated" ON analytics_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- funnel_checkpoints (Section 3.11)
CREATE POLICY "funnel_service_only" ON funnel_checkpoints
  USING (FALSE);

-- device_sessions (Section 3.12)
CREATE POLICY "device_sessions_own" ON device_sessions
  FOR ALL USING (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Section 12: Realtime Subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
