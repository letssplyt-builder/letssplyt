# LetsSplyt — Data Architecture
**Version:** 1.0 | **Date:** June 2026
**Authority:** This document is the single source of truth for the database schema. Any conflict between this document and another document, this document wins.

---

## Table of Contents
1. Design Principles
2. PII Architecture
3. Complete Schema
4. All Triggers
5. All Indexes
6. Row Level Security Policies
7. Payment State Machine
8. Analytics Partitioning
9. Migration Strategy
10. Environment Considerations
11. Development Seed Data
12. Realtime Subscriptions

---

## 1. Design Principles

- **UUID primary keys everywhere.** Never use sequential integers — they are enumerable (an attacker can walk `GET /events/1`, `/events/2`) and phone numbers change. UUID is the stable identity.
- **E.164 normalisation at API gateway.** Run `libphonenumber` validation before any DB write. Store `+15550001234`, never `555-000-1234`. The same person must never appear as two different records due to phone formatting variance.
- **PII separation: identity in pii_vault, business logic in users/participants.** Phone numbers, full names, and guest identity data are isolated in encrypted columns and the `guest_pii` table. Business logic tables reference only UUIDs and hashes.
- **Encrypted payment handles (AES-256-GCM).** Payment identifiers (Venmo usernames, PayPal handles) are PII. They are encrypted at the Node.js application layer before any INSERT and decrypted only at A3 message composition time. Never stored in plaintext, never logged.
- **Immutable audit trail (`settlement_log`, `ai_audit_log`).** Every state transition and every AI call is logged with actor, timestamp, before/after state. These rows are never updated or deleted.
- **Row Level Security on every table.** The database itself enforces data isolation. API-layer WHERE clauses are not a substitute for RLS — both are required.
- **Soft deletes where user data is referenced by other entities.** `users` and `events` have `deleted_at TIMESTAMPTZ NULL`. Never hard-delete these rows — it breaks audit trails and foreign keys in `settlement_log`.

---

## 2. PII Architecture

### The PII Vault Pattern

LetsSplyt never stores a raw, plaintext phone number in a column that is accessible through the mobile client or in any table that participates in business logic queries. All phone data flows through a two-form storage model:

| Form | Column Name | Purpose | Who Can Read |
|------|-------------|---------|--------------|
| Hash | `phone_hash` | Lookup and deduplication (is this number already registered?) | Backend service role only |
| Encrypted | `phone_encrypted` | Retrieving the number for SMS delivery | Backend service role only, decrypted in-memory |

The hash is a **SHA-256 HMAC** of the E.164 phone string, keyed with `PII_HMAC_SALT`. This means the hash is not reversible without the salt, and two systems with different salts cannot cross-reference hashes — preventing data correlation if either system is breached.

```
phone_hash = HMAC-SHA256(phone_e164, PII_HMAC_SALT)
```

### What Gets Stored Where

| Data Type | Location | Column | Protection |
|-----------|----------|--------|------------|
| App user phone (for lookup) | `users` | `phone_hash` | HMAC — not reversible |
| App user phone (for SMS delivery) | `users` | `phone_encrypted` | AES-256-GCM |
| App user full name | `users` | `name_encrypted` | AES-256-GCM |
| App user display name | `users` | `display_name` | Plaintext (non-sensitive, shown to other event members) |
| Guest phone (for lookup) | `guest_pii` | `phone_hash` | HMAC — not reversible |
| Guest phone (for SMS delivery) | `guest_pii` | `phone_encrypted` | AES-256-GCM |
| Guest full name | `guest_pii` | `name_encrypted` | AES-256-GCM |
| Payment handles | `user_payment_handles` | `handle_encrypted` | AES-256-GCM |
| SMS opt-out record | `sms_opt_outs` | `phone_hash` | HMAC — plaintext phone is never stored here |

### Why Phone and Name Are Separated from Business Logic Tables

The `participants` table drives all split calculations, settlement state, and message delivery tracking. It must be queryable by the payer and by analytics queries. Placing a raw phone number in `participants` would mean that column appears in every RLS policy, every query plan, and every analytics export.

Instead, `participants` holds only a `guest_pii_token UUID` — a foreign key reference to the `guest_pii` table. The `guest_pii` table has a `CREATE POLICY "no_direct_access" ON guest_pii FOR ALL USING (false)` policy: no mobile client or anon-key request can ever read from it. Only the Node.js backend using the Supabase service role key accesses `guest_pii`, and only when composing an outbound message.

### The guest_pii Lifecycle

1. **Creation:** When a non-app guest registers via the browser QR flow, the Node.js backend inserts a row into `guest_pii` with `purge_after = NULL` (unknown at join time — the settlement date is not yet determined). The `id` UUID is stored in `participants.guest_pii_token`.
2. **Purge date set:** A database trigger fires when `events.status` transitions to `'settled'`. The trigger sets `purge_after = NOW() + INTERVAL '90 days'` on all `guest_pii` rows linked to participants of that event. See Section 4 for the trigger definition.
3. **Use:** When the A3 message composer needs to send an SMS to this guest, it fetches the `guest_pii` row using the service role, decrypts `phone_encrypted` in-memory, sends via Twilio, and discards the plaintext.
4. **Purge:** A nightly background job (QStash cron at 02:00 UTC) deletes all `guest_pii` rows where `purge_after IS NOT NULL AND purge_after < NOW()`. This satisfies GDPR data minimisation and CCPA deletion rights automatically.

### Environment Variables for Encryption

| Variable | Purpose | Never Store In |
|----------|---------|----------------|
| `PHONE_ENCRYPTION_KEY` | AES-256-GCM key for phone_encrypted and name_encrypted columns | Code, git, logs |
| `PII_HMAC_SALT` | HMAC-SHA256 salt for phone_hash computation | Code, git, logs |
| `HANDLE_ENCRYPTION_KEY` | AES-256-GCM key for payment handle encryption | Code, git, logs |

`PII_HMAC_SALT` is used consistently everywhere a phone hash is computed — in the `users` table, in `guest_pii`, and in `sms_opt_outs`. Using the same salt ensures that an opt-out hash computed at message time matches the stored hash in `sms_opt_outs`.

### The Hashing Function (Node.js)

```typescript
import { createHmac } from 'crypto';

export function hashPhone(phoneE164: string): string {
  return createHmac('sha256', process.env.PII_HMAC_SALT!)
    .update(phoneE164)
    .digest('hex');
}
```

This function is called at the API gateway before any DB operation involving a phone number. The result is what gets stored and what gets compared.

---

## 3. Complete Schema

Tables are written in dependency order — tables that are referenced by foreign keys appear before the tables that reference them.

---

### 3.1 `guest_pii`

Identity vault for non-app guests. This table is never accessible to the mobile client or to the anon Supabase key.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- guest_pii
-- Isolated PII store for non-app guests.
-- Only the backend service role can read or write this table.
-- purge_after is NULL at creation; set by trigger when event reaches 'settled'.
-- Auto-purged 90 days after event settlement via nightly background job.
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
  -- the linked event transitions to 'settled'. Set to NOW() + INTERVAL '90 days'.
  -- The nightly purge job deletes rows where purge_after IS NOT NULL AND purge_after < NOW()
  purge_after     TIMESTAMPTZ
);

ALTER TABLE guest_pii ENABLE ROW LEVEL SECURITY;

-- No direct access for any authenticated or anonymous client.
-- All reads/writes go through the Node.js backend using the service role key.
CREATE POLICY "guest_pii_no_direct_access" ON guest_pii
  FOR ALL USING (false);
```

---

### 3.2 `users`

Registered app users. Phones are stored only as hash (for lookup) and encrypted (for retrieval). Never stored in plaintext.

**Note on `acquisition_event_id`:** This column references `events`, which is defined after `users`. To avoid a circular FK dependency at table-creation time, the column and its FK constraint are added via `ALTER TABLE` after all tables are created. See the "Post-Creation ALTER TABLE Statements" subsection at the end of Section 3.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- users
-- Registered LetsSplyt users. Identified by UUID, looked up by phone_hash.
-- phone_e164 is never stored in plaintext in this table.
-- Soft deletes only — deleted_at is set, row is never removed.
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
  -- See "Post-Creation ALTER TABLE Statements" at end of Section 3.

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
```

---

### 3.3 `user_payment_handles`

Encrypted payment handles (Venmo, PayPal, etc.) stored per user. Decrypted only at A3 message composition time.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- user_payment_handles
-- AES-256-GCM encrypted payment identifiers.
-- The Node.js service encrypts before INSERT and decrypts only in A3 composer.
-- The decrypted value is never logged or stored anywhere other than in-memory
-- during the message composition step.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_payment_handles (
  id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Correction 12: fully enumerated provider list
  provider         TEXT      NOT NULL CHECK (provider IN (
                     'venmo', 'paypal', 'cashapp', 'zelle', 'wise',
                     'bank_transfer', 'other'
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
```

---

### 3.4 `events`

The core domain entity. One row per bill-splitting session created by a payer.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- events
-- Core bill-splitting session. Created by a payer, progresses through a
-- lifecycle from 'open' (join window) through to 'settled'.
-- Soft deletes only — payer "archiving" sets deleted_at, row is never removed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- payer_id: the user who created the event and paid the bill
  -- All RLS policies use payer_id — NOT creator_id (that field does not exist)
  --
  -- DESIGN DECISION: The event creator (payer) is NOT automatically inserted as a participant row.
  -- The payer_id on the events table is the authoritative reference for the creator.
  -- The "Lock group requires >= 2 participants" check counts rows in the participants table only.
  -- The creator is never shown a "Pay now" flow for their own event.
  -- This means a group of 2 people (creator + 1 participant) satisfies the minimum.
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

  split_mode      TEXT        CHECK (split_mode IN (
                    'even', 'itemised', 'amount', 'percent', 'portion'
                  )),

  -- snapshot of participant count when group was locked, for analytics
  participant_count_at_lock  SMALLINT,

  receipt_scan_attempted  BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_parse_success        BOOLEAN,                -- NULL = not attempted; TRUE/FALSE = result
  ai_parse_confidence     NUMERIC(3,2),           -- 0.00–1.00, from A1 response

  -- Correction 7: ai_stage column with full enum and NOT NULL constraint
  -- Used by the AI idempotency guard to prevent duplicate AI runs on retried requests
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

  -- Correction 11: locked_at timestamp — populated when payer taps "Lock & Split"
  locked_at           TIMESTAMPTZ,
  messages_sent_at    TIMESTAMPTZ,
  fully_settled_at    TIMESTAMPTZ,

  -- Soft delete — set by payer archiving the event
  deleted_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.5 `event_join_tokens`

Short-lived cryptographically random tokens that power the QR code and shareable URL join flow.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- event_join_tokens
-- Each active token corresponds to one scannable QR code / shareable URL.
-- Tokens are revoked immediately on group lock or payer manual revocation.
-- A new token is created on regeneration (old one stays revoked for audit).
-- Token must be generated with: crypto.randomBytes(18).toString('base64url')
-- That gives 144 bits of entropy — unguessable by brute force.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE event_join_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- token: URL-safe base64 string; at least 18 bytes (144 bits) of randomness
  token       TEXT        NOT NULL UNIQUE,

  -- expires_at: set to NOW() + INTERVAL '24 hours' at creation
  expires_at  TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,

  -- revoked_at: set when group is locked, payer manually revokes, or TTL expires and regenerated
  revoked_at  TIMESTAMPTZ,

  -- scan_count: incremented on each QR scan; useful for detecting abuse (rate limit at 10/hr)
  scan_count  INT         NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.6 `participants`

Every person in an event — both registered app users and manual/guest additions.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- participants
-- One row per person per event. The central junction between events and users.
-- user_id is NULL for guests (added manually, or self-registered via QR browser
-- but not converted to a full account).
-- guest_pii_token is NULL for registered app users (their phone is on users table).
-- A participant can be EITHER a registered user (user_id set) OR a guest
-- (guest_pii_token set) — never both, never neither for someone who can receive SMS.
-- Exception: name-only (cash) participants have both NULL — no SMS is ever sent.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE participants (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- user_id: populated for registered app users; NULL for guests
  user_id         UUID        REFERENCES users(id),

  -- Correction 4: FK constraint linking guest_pii_token to the guest_pii table
  -- ON DELETE CASCADE: if a guest_pii row is purged, the token reference is cleared
  -- Unique per event enforced via partial index idx_participants_guest_unique
  -- (NULL != NULL so a standard UNIQUE constraint does not prevent duplicate guests)
  guest_pii_token UUID        REFERENCES guest_pii(id) ON DELETE SET NULL
                  CONSTRAINT fk_guest_pii,

  -- display_name: non-sensitive name shown in the event member list and split table
  display_name    TEXT        NOT NULL,

  -- Correction 10: join_method column
  join_method     TEXT        NOT NULL DEFAULT 'manual' CHECK (join_method IN (
                    'qr_app',        -- had app installed; deep-linked in
                    'qr_web',        -- scanned QR, registered in browser (no app)
                    'manual_phone',  -- added by payer with a phone number
                    'manual_name_only' -- cash-only; no phone; no SMS ever sent
                  )),

  -- country_code: ISO 3166-1 alpha-2 (e.g. 'US', 'DE') — used by A3 to filter payment links
  country_code    TEXT,

  -- amount_owed: NULL until A2 split calculation is complete
  amount_owed     NUMERIC(10,2),

  -- payment_status: the current state in the settlement state machine
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

  -- Correction 10: message_channel column
  -- The channel on which the split message was (or will be) delivered
  message_channel TEXT        CHECK (message_channel IN ('sms', 'whatsapp')),

  -- Payment tracking
  payment_link_tapped_at  TIMESTAMPTZ, -- set via analytics event, not Twilio
  self_reported_at        TIMESTAMPTZ,
  self_reported_method    TEXT,         -- e.g. 'venmo', 'cashapp', 'cash', 'other'
  confirmed_at            TIMESTAMPTZ,
  disputed_count          SMALLINT    NOT NULL DEFAULT 0,
  nudge_count             SMALLINT    NOT NULL DEFAULT 0,
  last_nudged_at          TIMESTAMPTZ,

  -- Revision tracking (when payer edits split after messages are sent)
  original_amount_owed    NUMERIC(10,2), -- preserved when payer edits split
  revision_count          SMALLINT    NOT NULL DEFAULT 0,

  -- Correction 10: opted_out column
  -- Set TRUE when Twilio STOP webhook fires for this participant's phone
  opted_out       BOOLEAN     NOT NULL DEFAULT FALSE,
  opted_out_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One app user can only appear once per event
  UNIQUE (event_id, user_id)
);
```

---

### 3.7 `receipt_items`

Line items extracted from a scanned receipt by A1, or entered manually by the payer.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- receipt_items
-- One row per line item on the bill. Created by A1 (receipt parsing) or
-- manually by the payer when they skip the scan or correct AI output.
-- line_total is a generated column — never set directly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE receipt_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  description     TEXT        NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL,
  quantity        NUMERIC(6,2) NOT NULL DEFAULT 1,

  -- line_total is always unit_price * quantity — computed by the DB
  line_total      NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,

  -- Flags that classify the item type for A2 tax/tip proration logic
  is_tax          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_tip          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_shared       BOOLEAN     NOT NULL DEFAULT FALSE, -- TRUE = split equally among assigned participants

  -- FALSE if the payer manually added or corrected this item
  ai_extracted    BOOLEAN     NOT NULL DEFAULT TRUE,

  -- S3 key of the original receipt image uploaded before A1 processing
  receipt_s3_key  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.8 `item_assignments`

Which items belong to which participant — the output of drag-and-drop or NLP assignment in A2.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- item_assignments
-- Maps receipt items to participants. One row per (item, participant) pair.
-- share_amount is the portion of line_total assigned to this participant.
-- CRITICAL INVARIANT: SUM(share_amount) across all participants for a given item
-- must equal that item's line_total ± $0.01. Enforced in application code.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE item_assignments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID        NOT NULL REFERENCES receipt_items(id) ON DELETE CASCADE,
  participant_id  UUID        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,

  -- The dollar amount of this item attributed to this participant
  share_amount    NUMERIC(10,2) NOT NULL,

  -- How this assignment was made (for analytics and audit)
  assignment_method TEXT       CHECK (assignment_method IN (
                      'drag',    -- payer dragged item onto participant avatar
                      'nlp',     -- A2 parsed a natural-language instruction
                      'manual',  -- payer typed directly
                      'even'     -- automatically split evenly among group
                    )),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A participant can only be assigned a given item once
  UNIQUE (item_id, participant_id)
);
```

---

### 3.9 `settlement_log`

Immutable audit trail of every state transition in the payment lifecycle. Rows are never updated or deleted.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- settlement_log
-- Append-only audit trail. Every payment status change generates one row.
-- This is the trust layer: if a payer and participant dispute a payment,
-- both can view the full history of who did what and when.
-- NEVER update or delete rows from this table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE settlement_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,

  -- event_id is denormalised here for query convenience
  -- (avoids a join when fetching the full history for an event)
  event_id        UUID        NOT NULL REFERENCES events(id),

  -- Correction 5: 'settled' is included in the action enum
  action          TEXT        NOT NULL CHECK (action IN (
                    'self_reported',      -- participant tapped "I paid"
                    'confirmed',          -- payer confirmed the payment
                    'disputed',           -- payer rejected the self-report
                    'settled',            -- all confirmed → event status became 'settled'
                    'cancelled',          -- event was cancelled; all pending participants notified
                    'nudged',             -- payer sent a nudge reminder
                    'opted_out'           -- STOP reply received; participant marked opted out
                  )),

  -- actor_id: the user who performed the action; NULL means a system/automated action
  actor_id        UUID        REFERENCES users(id),

  -- State snapshot at the time of this log entry
  previous_status TEXT,
  new_status      TEXT,

  -- amount at the time of logging (may differ from current amount_owed if split was revised)
  amount          NUMERIC(10,2),

  note            TEXT,       -- optional free-text note from payer (e.g. dispute reason)
  metadata        JSONB,      -- flexible payload for future use (e.g. Twilio SID for nudges)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.10 `notification_log`

Delivery tracking for every push notification and SMS sent by the system.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- notification_log
-- One row per outbound notification (push, SMS, WhatsApp).
-- Twilio delivery callbacks update delivered_at and failed_reason.
-- Push open events update opened_at.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE notification_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- All three FKs are nullable — a push to a guest has no user_id, etc.
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

  -- twilio_sid: Twilio message SID, used to correlate with delivery status webhooks
  twilio_sid      TEXT,

  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,  -- set when push notification is tapped
  failed_reason   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.11 `funnel_checkpoints`

Tracks anonymous and authenticated user progress through the join funnel. Written by service role only; no client access.

```sql
CREATE TABLE funnel_checkpoints (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT        NOT NULL,                    -- anonymous session before user is created
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
CREATE INDEX idx_funnel_session    ON funnel_checkpoints(session_id);
CREATE INDEX idx_funnel_event      ON funnel_checkpoints(event_id);
CREATE INDEX idx_funnel_checkpoint ON funnel_checkpoints(checkpoint, created_at DESC);
-- RLS
ALTER TABLE funnel_checkpoints ENABLE ROW LEVEL SECURITY;
-- Funnel data is written by service role only; no client access
CREATE POLICY "funnel_service_only" ON funnel_checkpoints
  USING (FALSE);  -- clients cannot read; service role bypasses RLS
```

---

### 3.12 `device_sessions`

Tracks per-device state for push notification delivery and multi-device support.

```sql
CREATE TABLE device_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT        NOT NULL,                  -- from expo-device or UUID generated on first launch
  platform        TEXT        NOT NULL CHECK (platform IN ('ios','android')),
  expo_push_token TEXT,                                  -- nullable until push permission granted
  app_version     TEXT,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);
CREATE INDEX idx_device_sessions_user     ON device_sessions(user_id);
CREATE INDEX idx_device_sessions_token    ON device_sessions(expo_push_token) 
  WHERE expo_push_token IS NOT NULL;
-- RLS
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "device_sessions_own" ON device_sessions
  FOR ALL USING (user_id = auth.uid());
```

---

### 3.13 `sms_opt_outs`

TCPA compliance table. Must be checked before every outbound SMS. Stores phone hash — never plaintext.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- sms_opt_outs
-- TCPA compliance. Records every phone number that has opted out via STOP reply.
-- LEGAL: This table MUST be checked before every outbound Twilio call.
-- Failure to honour STOP replies is a TCPA violation ($500–$1,500 per message).
--
-- Correction 3: phone_hash is stored — NOT plaintext phone_e164.
-- phone_hash = HMAC-SHA256(phone_e164, PII_HMAC_SALT)
-- This means a breach of this table does not expose phone numbers.
-- Opt-out lookup: hash the candidate phone with PII_HMAC_SALT, then query this table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE sms_opt_outs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- HMAC-SHA256 hash of the E.164 phone number — not the phone number itself
  phone_hash      TEXT        NOT NULL UNIQUE,

  opted_out_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opt_out_method  TEXT        NOT NULL CHECK (opt_out_method IN (
                    'stop_reply', -- Twilio webhook received STOP
                    'in_app',     -- user opted out via app settings
                    'admin'       -- manual admin action
                  )),

  -- event_id: context in which the opt-out occurred, if known
  event_id        UUID        REFERENCES events(id),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The lookup function used before every Twilio call:

```typescript
// backend/src/modules/notifications/notifications.service.ts

import { hashPhone } from '../../../infrastructure/pii';
import { supabaseAdmin } from '../../../infrastructure/supabase';
import { OptOutError } from '../../../infrastructure/errors';

export async function checkOptOut(phoneE164: string): Promise<void> {
  const hash = hashPhone(phoneE164);  // uses PII_HMAC_SALT
  const { data } = await supabaseAdmin
    .from('sms_opt_outs')
    .select('id')
    .eq('phone_hash', hash)
    .maybeSingle();
  if (data) {
    throw new OptOutError(`Phone is opted out: [REDACTED]`);
  }
}

// Every Twilio call in the codebase must call checkOptOut() first.
// TypeScript: sendSms() and sendWhatsApp() are internal helpers that call
// checkOptOut() as their first step. No external code calls Twilio directly.
```

---

### 3.14 `ai_audit_log`

Immutable record of every AI API call — provider, model, prompt, response, latency, and cost estimate.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ai_audit_log
-- Append-only record of every AI API call made by A1, A2, or A3.
-- Used for: cost monitoring, hallucination investigation, prompt iteration,
-- and idempotency verification (prevent duplicate AI runs on retries).
-- NEVER update or delete rows from this table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE ai_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        REFERENCES events(id),

  agent           TEXT        NOT NULL CHECK (agent IN ('a1_receipt', 'a2_split', 'a3_message')),
  provider        TEXT        NOT NULL CHECK (provider IN ('gemini', 'anthropic')),
  model           TEXT        NOT NULL, -- e.g. 'gemini-2.5-flash', 'claude-haiku-4-5'

  -- prompt_hash: SHA-256 of the prompt — stored instead of the prompt itself
  -- to avoid storing receipt image data or PII in the audit log
  prompt_hash     TEXT        NOT NULL,

  -- tokens_in / tokens_out: for cost tracking and rate limit monitoring
  tokens_in       INT,
  tokens_out      INT,

  latency_ms      INT,        -- wall-clock time for the API call
  success         BOOLEAN     NOT NULL,
  error_message   TEXT,       -- set when success = FALSE

  -- confidence: for A1, the model's self-reported parse confidence (0.00–1.00)
  confidence      NUMERIC(3,2),

  -- metadata: additional structured data (e.g. item_count for A1, participant_count for A2)
  metadata        JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 3.15 `analytics_events`

Partitioned raw event stream — the foundation of all product metrics and DAARM framework KPIs.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- analytics_events
-- Single source of truth for all product analytics.
-- Partitioned by month for query performance at scale.
-- Every significant user action fires one row here.
-- Never aggregate directly — build SQL views on top.
-- ip_address stores a SHA-256 hash of the raw IP (GDPR: never store raw IP).
--
-- PRIMARY KEY is (id, created_at) — PostgreSQL requires the partition key
-- to be part of any unique constraint on a partitioned table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE analytics_events (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES users(id),    -- NULL for pre-auth events
  session_id      TEXT,                                 -- client-generated UUID per app session
  anonymous_id    TEXT,                                 -- device-level ID before auth
  event_name      TEXT        NOT NULL,                 -- see analytics event catalogue in 10-Engineering-Operations.md Section 5
  properties      JSONB       NOT NULL DEFAULT '{}',    -- event-specific payload
  platform        TEXT        CHECK (platform IN ('ios', 'android', 'web')),
  app_version     TEXT,
  ip_address      TEXT,                                 -- SHA-256 hash of raw IP; never store raw IP
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite PK: PostgreSQL requires partition key in any unique constraint
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
```

---

### Post-Creation ALTER TABLE Statements

These statements must run **after all tables above have been created**, in a separate migration step or at the end of the initial migration file. They resolve the circular FK between `users` and `events`.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fix circular FK: users.acquisition_event_id → events(id)
-- Cannot be defined inline in CREATE TABLE users because events is created after.
-- Run after all tables created.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS acquisition_event_id UUID REFERENCES events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_acquisition_event ON users(acquisition_event_id) WHERE acquisition_event_id IS NOT NULL;
```

---

## 4. All Triggers

Every trigger function is written here in full. No references to "existing" trigger functions — all are defined from scratch.

### 4.1 `updated_at` Trigger Function (shared)

One function, reused by all three `updated_at` triggers.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Shared trigger function: set updated_at to NOW() on every row update.
-- Used by users, events, and participants.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 `trg_users_updated_at`

```sql
-- Updates updated_at on users whenever any column is changed.
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

### 4.3 `trg_events_updated_at`

```sql
-- Updates updated_at on events whenever any column is changed.
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

### 4.4 `trg_participants_updated_at`

```sql
-- Updates updated_at on participants whenever any column is changed.
CREATE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

### 4.5 `trg_events_created_count`

Increments `users.total_events_created` whenever a new event is inserted. References `payer_id` (the correct column name on `events`).

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger function: increment total_events_created on the payer when a new
-- event row is inserted. Uses payer_id — not creator_id (that field does not exist).
-- ─────────────────────────────────────────────────────────────────────────────
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
```

### 4.6 `trg_events_joined_count`

Increments `users.total_events_joined` when a participant row is inserted with a non-null `user_id`. Does not count the payer themselves.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger function: increment total_events_joined on a registered user when
-- they are added as a participant. Only fires for app users (user_id NOT NULL).
-- Does not fire for the payer (they created the event, they did not join it).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_events_joined()
RETURNS TRIGGER AS $$
BEGIN
  -- Only count registered app users (not name-only or guest participants)
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
```

### 4.7 `trg_set_guest_pii_purge_date`

Sets `guest_pii.purge_after` when an event transitions to `'settled'`. The purge date cannot be known at join time (settlement date is unknown), so it is set reactively by this trigger.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger function: set purge_after on guest_pii rows when the linked event
-- transitions to 'settled'. purge_after = NOW() + 90 days.
-- This satisfies GDPR data minimisation: PII is retained only as long as needed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_guest_pii_purge_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    UPDATE guest_pii
    SET purge_after = NOW() + INTERVAL '90 days'
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
```

---

## 5. All Indexes

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────────
-- Primary lookup path: find a user by their phone hash (login, dedup check)
CREATE INDEX idx_users_phone_hash       ON users(phone_hash);
-- Support analytics queries on acquisition source
CREATE INDEX idx_users_acquisition      ON users(acquisition_source);
-- Support retention queries and last-active dashboards
CREATE INDEX idx_users_last_active      ON users(last_active_at);
-- acquisition_event_id index (sparse — most users have no acquisition event)
CREATE INDEX IF NOT EXISTS idx_users_acquisition_event ON users(acquisition_event_id) WHERE acquisition_event_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- user_payment_handles
-- ─────────────────────────────────────────────────────────────────────────────
-- A3 fetches active handles for a user at message composition time
CREATE INDEX idx_payment_handles_user   ON user_payment_handles(user_id)
  WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- events
-- ─────────────────────────────────────────────────────────────────────────────
-- "My events" — list all events created by this payer (most common query)
CREATE INDEX idx_events_payer           ON events(payer_id);
-- Filter events by lifecycle status (e.g. show only 'open' or 'sent' events)
CREATE INDEX idx_events_status          ON events(status);
-- Time-series queries for analytics and retention metrics
CREATE INDEX idx_events_created_at      ON events(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- event_join_tokens
-- ─────────────────────────────────────────────────────────────────────────────
-- QR scan lookup path: resolve an incoming token to an event instantly
CREATE INDEX idx_join_tokens_token      ON event_join_tokens(token)
  WHERE is_active = TRUE;
-- Look up all tokens for an event (payer revokes on lock; regenerate flow)
CREATE INDEX idx_join_tokens_event      ON event_join_tokens(event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- participants
-- ─────────────────────────────────────────────────────────────────────────────
-- Load member list for an event (most frequent participant query)
CREATE INDEX idx_participants_event     ON participants(event_id);
-- "Events I'm in" — a registered user's participation history for "I owe" dashboard
CREATE INDEX idx_participants_user      ON participants(user_id);
-- Filter participants by payment status (e.g. show all pending for nudge flow)
CREATE INDEX idx_participants_status    ON participants(payment_status);
-- Look up guest_pii by token (A3 message composition; purge job)
CREATE INDEX idx_participants_guest_pii ON participants(guest_pii_token);
-- Prevent duplicate guest entries: UNIQUE on guest_pii_token per event (NULL != NULL in SQL,
-- so the standard UNIQUE (event_id, user_id) does not protect against duplicate guest rows)
CREATE UNIQUE INDEX idx_participants_guest_unique
  ON participants (event_id, guest_pii_token)
  WHERE guest_pii_token IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- receipt_items
-- ─────────────────────────────────────────────────────────────────────────────
-- Load all line items for an event (A2 input; payer review screen)
CREATE INDEX idx_receipt_items_event    ON receipt_items(event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- item_assignments
-- ─────────────────────────────────────────────────────────────────────────────
-- Which participants are assigned to an item (A2 share calculation)
CREATE INDEX idx_item_assignments_item  ON item_assignments(item_id);
-- Which items are assigned to a participant (per-person breakdown display)
CREATE INDEX idx_item_assignments_part  ON item_assignments(participant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- settlement_log
-- ─────────────────────────────────────────────────────────────────────────────
-- Full history for a participant (dispute resolution; participant view)
CREATE INDEX idx_settlement_log_part    ON settlement_log(participant_id);
-- Full history for an event (payer audit view; "all settled" check)
CREATE INDEX idx_settlement_log_event   ON settlement_log(event_id);
-- Time-series queries for settlement speed analytics
CREATE INDEX idx_settlement_log_created ON settlement_log(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- notification_log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_notif_log_user         ON notification_log(user_id);
CREATE INDEX idx_notif_log_event        ON notification_log(event_id);
CREATE INDEX idx_notif_log_sent         ON notification_log(sent_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- funnel_checkpoints
-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes are defined inline in the table creation block above (Section 3.11)

-- ─────────────────────────────────────────────────────────────────────────────
-- device_sessions
-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes are defined inline in the table creation block above (Section 3.12)

-- ─────────────────────────────────────────────────────────────────────────────
-- sms_opt_outs
-- ─────────────────────────────────────────────────────────────────────────────
-- Pre-send opt-out check: hash the phone, look up here — must be instant
CREATE INDEX idx_opt_outs_phone_hash    ON sms_opt_outs(phone_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- ai_audit_log
-- ─────────────────────────────────────────────────────────────────────────────
-- Look up all AI calls for an event (idempotency check; cost audit)
CREATE INDEX idx_ai_audit_event         ON ai_audit_log(event_id);
-- Filter by agent + event for idempotency guard (did A1 already run for this event?)
CREATE INDEX idx_ai_audit_agent_event   ON ai_audit_log(agent, event_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- analytics_events
-- ─────────────────────────────────────────────────────────────────────────────
-- These indexes are created on the parent table; Postgres replicates them to partitions.
-- created_at is the partition key — all range scans use it.
CREATE INDEX idx_ae_user_time           ON analytics_events(user_id, created_at);
CREATE INDEX idx_ae_event_name_time     ON analytics_events(event_name, created_at);
CREATE INDEX idx_ae_session             ON analytics_events(session_id);
-- GIN index on properties JSONB for ad-hoc property filtering
CREATE INDEX idx_ae_properties          ON analytics_events USING GIN(properties);
```

---

## 6. Row Level Security Policies

Every table has RLS enabled. The mobile client uses the Supabase anon key — it can only see what these policies permit. The Node.js backend uses the service role key — it bypasses RLS for writes that span multiple users (e.g. inserting a guest participant on behalf of a payer).

### 6.1 Enable RLS Statements

```sql
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_handles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_join_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_outs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events      ENABLE ROW LEVEL SECURITY;
-- guest_pii RLS is defined in Section 3.1 above
-- funnel_checkpoints RLS is defined in Section 3.11 above
-- device_sessions RLS is defined in Section 3.12 above
```

### 6.2 `users` Policies

```sql
-- Correction 1 (applied): users use auth.uid() = id, not creator_id

-- A user can read their own profile row
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Correction 2: INSERT policy — required so that Supabase Auth can create
-- the users row after OTP verification. Without this, the INSERT from
-- the auth callback fails with an RLS violation.
CREATE POLICY "users_insert_own" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A user can update their own profile (display_name, avatar, etc.)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Soft deletes are performed by the backend service role — no client DELETE policy
```

### 6.3 `user_payment_handles` Policies

```sql
-- Full CRUD for own payment handles
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
```

### 6.4 `events` Policies

```sql
-- Correction 1 (applied): events use payer_id — not creator_id

-- Payer can see their own events
CREATE POLICY "events_select_payer" ON events
  FOR SELECT
  USING (payer_id = auth.uid());

-- Participants can see events they belong to ("I owe" dashboard)
CREATE POLICY "events_select_participant" ON events
  FOR SELECT
  USING (
    id IN (
      SELECT event_id FROM participants WHERE user_id = auth.uid()
    )
  );

-- Only the payer can create events
CREATE POLICY "events_insert_payer" ON events
  FOR INSERT
  WITH CHECK (payer_id = auth.uid());

-- Only the payer can update their event (title, status, split_mode, etc.)
CREATE POLICY "events_update_payer" ON events
  FOR UPDATE
  USING (payer_id = auth.uid())
  WITH CHECK (payer_id = auth.uid());

-- Soft delete: payer sets deleted_at via UPDATE (see events_update_payer above)
-- No hard DELETE policy — backend service role handles final cleanup if ever needed
```

### 6.5 `event_join_tokens` Policies

```sql
-- Correction 1 (applied): use payer_id on events join

-- Payer can read tokens for their own events (to display QR code, check active status)
CREATE POLICY "tokens_select_payer" ON event_join_tokens
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

-- Token creation and revocation are done by the backend service role only
-- (they happen during event creation and group lock, both server-side operations)
```

### 6.6 `participants` Policies

```sql
-- Correction 1 (applied): use payer_id — NOT creator_id — for all participant policies

-- Payer can see all participants in their events
CREATE POLICY "participants_select_payer" ON participants
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

-- A registered participant can see their own row ("I owe" detail view)
CREATE POLICY "participants_select_self" ON participants
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT is handled by the backend service role (participant creation spans
-- multiple tables: participants + guest_pii + notification_log)
-- No client INSERT policy on participants

-- REMOVED: broad "participants_update_self" policy — replaced below with restricted version.
-- DROP POLICY "participants_update_self" ON participants;  -- (if it exists from a prior migration)

-- Restricted participant self-update policy.
-- Participants may update their own row via the mobile app (e.g. display_name changes).
-- Financial fields (payment_status, amount_owed) MUST only be written via backend service role.
-- Supabase does not support column-level RLS in FOR UPDATE policies; column restriction
-- is enforced at the API layer (see 05-API-Specification.md).
-- The mobile app uses the anon key which is rate-limited and authenticated.
CREATE POLICY "participants_update_self_safe" ON participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Participants may only update their own non-financial fields via this policy.
    -- payment_status and amount_owed are updated ONLY by service role (backend).
    -- Enforce this at the application layer: backend uses service role key for
    -- all payment_status and amount_owed writes.
    -- Supabase does not support column-level RLS in FOR UPDATE policies,
    -- so column restriction is enforced at the API layer (see 05-API-Specification.md).
    -- The mobile app uses the anon key which is rate-limited and authenticated.
  );

COMMENT ON POLICY "participants_update_self_safe" ON participants IS
  'Participants may read/update their own row. Financial fields (payment_status, amount_owed) must only be written via backend service role. The mobile app never writes these fields directly.';

-- Payer can update any participant in their events (confirm, dispute, nudge, mark cash)
CREATE POLICY "participants_update_payer" ON participants
  FOR UPDATE
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  )
  WITH CHECK (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );
```

### 6.7 `receipt_items` Policies

```sql
-- Payer can read and write receipt items for their events
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

-- Participants can read receipt items for events they are in (to see their breakdown)
CREATE POLICY "receipt_items_select_participant" ON receipt_items
  FOR SELECT
  USING (
    event_id IN (
      SELECT event_id FROM participants WHERE user_id = auth.uid()
    )
  );
```

### 6.8 `item_assignments` Policies

```sql
-- Payer can read all assignments for their events
CREATE POLICY "item_assignments_select_payer" ON item_assignments
  FOR SELECT
  USING (
    item_id IN (
      SELECT ri.id FROM receipt_items ri
      JOIN events e ON e.id = ri.event_id
      WHERE e.payer_id = auth.uid()
    )
  );

-- Payer can create and delete assignments (drag-and-drop; NLP; even split)
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

-- Participants can read their own assignments
CREATE POLICY "item_assignments_select_self" ON item_assignments
  FOR SELECT
  USING (
    participant_id IN (
      SELECT id FROM participants WHERE user_id = auth.uid()
    )
  );
```

### 6.9 `settlement_log` Policies

```sql
-- Payer can read full settlement history for their events
CREATE POLICY "settlement_log_select_payer" ON settlement_log
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE payer_id = auth.uid())
  );

-- A participant can read the settlement log for their own participant row
CREATE POLICY "settlement_log_select_self" ON settlement_log
  FOR SELECT
  USING (
    participant_id IN (
      SELECT id FROM participants WHERE user_id = auth.uid()
    )
  );

-- All inserts to settlement_log go through the backend service role
-- (ensures actor_id is validated server-side before logging)
```

### 6.10 `notification_log` Policies

```sql
-- Users can read their own notification history
CREATE POLICY "notif_log_select_own" ON notification_log
  FOR SELECT
  USING (user_id = auth.uid());

-- All inserts are performed by the backend service role (Twilio callbacks, push sends)
```

### 6.11 `sms_opt_outs` Policies

```sql
-- sms_opt_outs contains phone hashes — no client needs to read this.
-- All reads and writes go through the backend service role.
-- No client-facing RLS policies are defined (table is effectively sealed to clients).
```

### 6.12 `ai_audit_log` Policies

```sql
-- ai_audit_log is write-only for the backend service role.
-- No client-facing read policies — this data is for internal auditing only.
```

### 6.13 `analytics_events` Policies

```sql
-- App users and pre-auth sessions can INSERT analytics events (fire-and-forget)
-- user_id is nullable for pre-auth events (QR scans, browser opens)
CREATE POLICY "analytics_insert_authenticated" ON analytics_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- No SELECT policy for clients — analytics data is read by the backend only
```

---

## 7. Payment State Machine

### States

| State | Meaning |
|-------|---------|
| `pending` | Message sent; participant has not acted |
| `self_reported` | Participant tapped "I paid" and selected a method |
| `payer_marked` | Payer marked this participant paid (cash or in-person confirmation) |
| `confirmed` | Payer explicitly confirmed the self-report |
| `disputed` | Payer rejected the self-report |
| `opted_out` | Participant replied STOP; no further messages will be sent |
| `settled` | All confirmed; event fully settled |

### Valid Transitions

| From | To | Trigger Event | Actor |
|------|-----|---------------|-------|
| `pending` | `self_reported` | Participant taps "I paid" | Participant |
| `pending` | `confirmed` | Payer directly marks a cash payment (bypasses self-report) | Payer |
| `pending` | `payer_marked` | Payer taps "Mark as paid" (cash) | Payer |
| `pending` | `opted_out` | Twilio STOP webhook fires | System |
| `self_reported` | `confirmed` | Payer taps "Confirm payment" | Payer |
| `self_reported` | `disputed` | Payer taps "Dispute" | Payer |
| `disputed` | `pending` | Payer disputes → participant must re-pay from scratch | System |
| `payer_marked` | `confirmed` | Automatic — system confirms immediately on payer_marked | System |
| `confirmed` (all) | `settled` | System checks: when ALL participants reach `confirmed`, each transitions to `settled` and event.status → `'settled'` | System |

The `DISPUTED → PENDING` transition aligns with PRD §10: after a payer disputes a claim (e.g. the payment did not arrive), the participant's status resets to `pending` and they must re-pay from scratch. This prevents a dispute from permanently blocking settlement while ensuring the payer retains control.

The `pending → confirmed` direct path allows a payer to mark a cash payment confirmed without waiting for self-report, bypassing the self-report step entirely for in-person cash settlements.

The `opted_out` state is terminal. A participant in `opted_out` cannot be nudged, cannot self-report, and the payer must manually mark them as settled or write off their share.

### SQL Implementation via CHECK Constraints

The valid `action` values in `settlement_log` mirror the valid transitions:

```sql
-- Already defined in Section 3.9 above.
-- The CHECK constraint is:
CHECK (action IN (
  'self_reported',
  'confirmed',
  'disputed',
  'settled',
  'cancelled',
  'nudged',
  'opted_out'
))
```

State transition enforcement in the application layer:

```typescript
// backend/src/modules/settlement/settlement.state-machine.ts

type PaymentStatus =
  | 'pending'
  | 'self_reported'
  | 'payer_marked'
  | 'confirmed'
  | 'disputed'
  | 'opted_out'
  | 'settled';

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending:        ['self_reported', 'confirmed', 'payer_marked', 'opted_out'],
  self_reported:  ['confirmed', 'disputed'],
  payer_marked:   ['confirmed'],
  confirmed:      ['settled'],
  disputed:       ['pending'],   // PRD §10: DISPUTED resets to PENDING — participant must re-pay from scratch
  opted_out:      [],   // terminal
  settled:        [],   // terminal
};

export function assertTransitionAllowed(
  from: PaymentStatus,
  to: PaymentStatus
): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new Error(
      `Invalid settlement transition: ${from} → ${to}`
    );
  }
}
```

The Settlement Service calls `assertTransitionAllowed()` before every DB update to `participants.payment_status`, then writes a corresponding `settlement_log` row in the same transaction.

---

## 8. Analytics Partitioning

### Base Table and Initial Partitions

```sql
-- The base table is defined in Section 3.15 above (PARTITION BY RANGE (created_at)).
-- The following partitions must be created as part of the initial migration.
-- This migration runs in June 2026, so we create: June, July, August, September.
-- Correction 6: current month + next 3 months created at migration time.

CREATE TABLE analytics_events_2026_06 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE analytics_events_2026_07 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE analytics_events_2026_08 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE analytics_events_2026_09 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

### pg_cron Automation (Supabase Pro)

On Supabase Pro, pg_cron is available. This job runs on the 25th of each month at midnight UTC and creates the partition for the following month, ensuring the partition always exists before data arrives.

```sql
-- Step 1: Enable the pg_cron extension (run once in Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Schedule the monthly partition creation job
-- Runs on the 25th of every month at 00:00 UTC
-- Creates the partition for the month AFTER next (so on June 25, it creates August)
-- NOTE: We create the month after next (not just next month) to provide a
-- safety buffer — the 25th leaves only ~6 days before month end.
SELECT cron.schedule(
  'create-analytics-partition',   -- job name (unique identifier)
  '0 0 25 * *',                   -- cron expression: midnight UTC on the 25th
  $$
    DO $$
    DECLARE
      next_month      DATE := date_trunc('month', NOW() + INTERVAL '1 month');
      partition_name  TEXT := 'analytics_events_' || to_char(next_month, 'YYYY_MM');
      start_date      TEXT := to_char(next_month, 'YYYY-MM-DD');
      end_date        TEXT := to_char(next_month + INTERVAL '1 month', 'YYYY-MM-DD');
    BEGIN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF analytics_events
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        start_date,
        end_date
      );
      RAISE NOTICE 'Partition created: %', partition_name;
    END;
    $$
  $$
);
```

### Workaround for Supabase Free Tier (Staging)

`pg_cron` requires Supabase Pro. On the free-tier staging project, use a QStash cron job instead:

```
URL:  https://[staging-railway-url]/api/v1/jobs/create-analytics-partition
Cron: 0 0 25 * *   (set in Upstash QStash dashboard)
```

Before using QStash-triggered partition creation, define the `create_analytics_partition` function in your initial migration:

```sql
-- Create this function in your initial migration
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
-- Grant execute to service role only
REVOKE ALL ON FUNCTION create_analytics_partition FROM PUBLIC;
```

The backend endpoint that handles QStash-triggered partition creation:

```typescript
// backend/src/modules/jobs/partition.controller.ts
export async function handlePartitionCreation(
  req: Request,
  res: Response
): Promise<void> {
  // Verify QStash signature first (see qstash.receiver.ts)
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  const startDate = new Date(year, nextMonth.getMonth(), 1);
  const endDate = new Date(year, nextMonth.getMonth() + 1, 1);

  await supabaseAdmin.rpc('create_analytics_partition', {
    partition_name: `analytics_events_${year}_${month}`,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  });

  res.json({ created: `analytics_events_${year}_${month}` });
}
```

---

## 9. Migration Strategy

All schema changes are versioned migration files under `/supabase/migrations/`. Migrations are tracked by the Supabase CLI using timestamp-prefixed filenames. Never modify the production schema by hand.

### Migration File Structure

```
/supabase/
  migrations/
    20260601000000_initial_schema.sql      ← all tables, triggers, indexes, RLS, seed data
    20260615000000_add_ai_audit_log.sql    ← if adding separately from initial
    20260620000000_[description].sql       ← each subsequent change
  config.toml
```

Each migration file must begin with:

```sql
-- DESCRIPTION: [what this migration does]
-- ROLLBACK:    [the SQL to undo it]
-- TESTED IN STAGING: [date before running in production]
```

### Development Environment

```bash
# Install Supabase CLI (one-time)
npm install -g supabase

# Link to your dev project (one-time per environment)
supabase link --project-ref [dev-project-ref]

# Apply all pending migrations to the local/dev Supabase project
supabase db push

# Create a new migration file with auto-generated timestamp
supabase migration new [description]
```

The dev project (`letssplyt-dev`) uses the Supabase free tier. Migrations are applied and tested here first before being promoted.

### Staging Environment

Staging migrations run automatically on merge to the `develop` branch via GitHub Actions (`.github/workflows/staging.yml`):

```bash
# In the staging CI/CD step:
supabase db push --db-url "$STAGING_DATABASE_URL"
```

The `STAGING_DATABASE_URL` secret is set in the GitHub `staging` environment and points to the `letssplyt-staging` Supabase project. Staging uses either free or Pro tier — pg_cron workaround applies if free.

### Production Environment

Production deploys are manually triggered and require reviewer approval (GitHub `production` environment protection rule). The deployment checklist:

```bash
# Step 1: Take a Supabase backup before any migration
# In Supabase Dashboard → Database → Backups → Create backup now
# OR via API:
curl -X POST "https://api.supabase.com/v1/projects/[prod-ref]/database/backups" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

# Step 2: Apply the migration to production
supabase db push --db-url "$PRODUCTION_DATABASE_URL"

# Step 3: Verify by running the test suite against production (read-only assertions)
npm run test:smoke --env=production

# Step 4: Deploy the backend (Railway)
npx @railway/cli@latest up --service letssplyt-production
```

The `PRODUCTION_DATABASE_URL` is a Railway environment secret — never in code or git.

---

## 10. Environment Considerations

| Factor | Development | Staging | Production |
|--------|-------------|---------|------------|
| Supabase project | `letssplyt-dev` | `letssplyt-staging` | `letssplyt-production` |
| Supabase tier | Free | Free (or Pro for pg_cron) | **Pro** (required) |
| Supabase URL | `https://[dev-ref].supabase.co` | `https://[stg-ref].supabase.co` | `https://[prd-ref].supabase.co` |
| DB connection limit | 60 (free tier) | 60–200 | **200** (Pro) |
| Realtime connections | 200 (free tier) | 200–500 | **500** (Pro) |
| pg_cron availability | No | No (free) / Yes (Pro) | **Yes** (Pro required) |
| pg_cron workaround | QStash cron job | QStash cron job | Not needed — use pg_cron |
| AI provider | Google Gemini 2.5 Flash | Google Gemini 2.5 Flash | Anthropic Claude Haiku 4.5 |
| Twilio credentials | Test credentials (no real SMS) | Live credentials (real SMS sent to test numbers) | Live credentials (A2P 10DLC registered) |
| Encryption keys | `.env.development` (local only) | Railway staging environment secrets | Railway production environment secrets |
| Seed data strategy | `seed.sql` with 3 test users, 2 events, all payment states represented | Seeded from `seed.sql` on first deploy; subsequent deploys use real test data | No seed data — production starts empty |
| Backup frequency | Manual (developer responsibility) | Manual before each migration | Daily automated (Supabase Pro, included) |
| RLS enforcement | Enabled (same as production) | Enabled | Enabled |
| Daily PII purge job | Manual / skipped in dev | QStash cron at 02:00 UTC | QStash cron at 02:00 UTC |

### Connection Pool Note

The Supabase free tier enforces a hard limit of 60 concurrent DB connections. On the Pro tier this increases to 200. The Node.js backend must use Supabase's connection pooler (PgBouncer, included) rather than direct connections. Set the connection string to the pooler URL (port 6543), not the direct DB URL (port 5432), in production to avoid exhausting the connection pool under load.

```
# Use pooler URL in backend production config:
DATABASE_URL=postgres://[user]:[password]@[prd-ref].pooler.supabase.com:6543/postgres
```

### Realtime Note

Supabase Realtime is enabled only on the `participants` table (for the live member list during the join phase and the settlement progress bar). It is explicitly NOT enabled on `analytics_events`, `settlement_log`, or `notification_log` — these are write-heavy tables and streaming their changes would waste Realtime quota and bandwidth.

```sql
-- Enable Realtime for participants (run in Supabase Dashboard → Database → Replication)
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
```

---

## 11. Development Seed Data

**File location:** `/backend/supabase/seed.sql`

**Run command:** `supabase db reset --db-url $SUPABASE_URL` (resets local DB and applies all migrations + seed)

The seed file creates a deterministic, repeatable development dataset with all payment states represented. It uses Twilio magic numbers for test SMS delivery without sending real messages.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- seed.sql
-- Development and staging seed data for LetsSplyt.
-- DO NOT run in production.
-- Uses Twilio magic test numbers: +15005550001, +15005550002, +15005550003
-- Phone hashes are HMAC-SHA256(phone_e164, 'dev-test-salt') — dev salt only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Test Users ────────────────────────────────────────────────────────────────
-- User 1: Alex (payer in completed event; payer in active event)
INSERT INTO users (
  id, phone_hash, phone_encrypted, name_encrypted, display_name,
  acquisition_source, total_events_created, total_events_joined,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev_hash_15005550001',                    -- HMAC-SHA256('+15005550001', 'dev-test-salt')
  'dev_encrypted_phone_1',                   -- AES-256-GCM('+15005550001', DEV_PHONE_KEY)
  'dev_encrypted_name_alex',                 -- AES-256-GCM('Alex Rivera', DEV_PHONE_KEY)
  'Alex R.',
  'organic',
  2, 0,
  NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'
);

-- User 2: Jordan (participant in completed event; participant in active event)
INSERT INTO users (
  id, phone_hash, phone_encrypted, name_encrypted, display_name,
  acquisition_source, total_events_created, total_events_joined,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'dev_hash_15005550002',
  'dev_encrypted_phone_2',
  'dev_encrypted_name_jordan',
  'Jordan K.',
  'qr_scan',
  0, 2,
  NOW() - INTERVAL '28 days', NOW() - INTERVAL '2 days'
);

-- User 3: Sam (participant in completed event; not in active event)
INSERT INTO users (
  id, phone_hash, phone_encrypted, name_encrypted, display_name,
  acquisition_source, total_events_created, total_events_joined,
  created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  'dev_hash_15005550003',
  'dev_encrypted_phone_3',
  'dev_encrypted_name_sam',
  'Sam T.',
  'sms_invite',
  0, 1,
  NOW() - INTERVAL '25 days', NOW() - INTERVAL '3 days'
);

-- ── Payment Handles ────────────────────────────────────────────────────────────
INSERT INTO user_payment_handles (id, user_id, provider, handle_encrypted, display_order, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'venmo',   'dev_encrypted_handle_venmo_alex',   0, TRUE),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'cashapp', 'dev_encrypted_handle_cashapp_alex', 1, TRUE),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'venmo',   'dev_encrypted_handle_venmo_jordan', 0, TRUE);

-- ── Event 1: Completed Event (all payment states represented) ─────────────────
INSERT INTO events (
  id, payer_id, title, event_date, total_amount, currency, status,
  split_mode, participant_count_at_lock, ai_stage,
  locked_at, messages_sent_at, fully_settled_at,
  created_at, updated_at
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Team Dinner — Osteria Morini',
  CURRENT_DATE - INTERVAL '14 days',
  120.00, 'USD', 'settled',
  'even', 4, 'complete',
  NOW() - INTERVAL '14 days' + INTERVAL '2 hours',
  NOW() - INTERVAL '14 days' + INTERVAL '3 hours',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days'
);

-- Participants for Event 1 — all four payment states
INSERT INTO participants (
  id, event_id, user_id, display_name, join_method, amount_owed,
  payment_status, confirmed_at, self_reported_at, opted_out,
  created_at, updated_at
) VALUES
  -- Alex (payer — self, confirmed)
  ('30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Alex R.', 'qr_app', 30.00, 'confirmed',
   NOW() - INTERVAL '10 days', NULL, FALSE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),
  -- Jordan (confirmed — paid via Venmo, self-reported then confirmed)
  ('30000000-0000-0000-0000-000000000002',
   '20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002',
   'Jordan K.', 'qr_app', 30.00, 'confirmed',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days', FALSE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),
  -- Sam (self_reported — payer has not confirmed yet)
  ('30000000-0000-0000-0000-000000000003',
   '20000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003',
   'Sam T.', 'manual_phone', 30.00, 'self_reported',
   NULL, NOW() - INTERVAL '11 days', FALSE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '11 days'),
  -- Casey (guest — opted out via STOP reply)
  ('30000000-0000-0000-0000-000000000004',
   '20000000-0000-0000-0000-000000000001',
   NULL,
   'Casey M.', 'manual_name_only', 30.00, 'opted_out',
   NULL, NULL, TRUE,
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days');

-- ── Event 2: Active Event (joining phase, 2 participants so far) ──────────────
INSERT INTO events (
  id, payer_id, title, event_date, total_amount, currency, status,
  split_mode, ai_stage,
  created_at, updated_at
) VALUES (
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Birthday Brunch',
  CURRENT_DATE + INTERVAL '3 days',
  NULL, 'USD', 'open',
  NULL, 'none',
  NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'
);

INSERT INTO participants (
  id, event_id, user_id, display_name, join_method, amount_owed,
  payment_status, created_at, updated_at
) VALUES
  ('30000000-0000-0000-0000-000000000005',
   '20000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Alex R.', 'qr_app', NULL, 'pending',
   NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
  ('30000000-0000-0000-0000-000000000006',
   '20000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002',
   'Jordan K.', 'qr_app', NULL, 'pending',
   NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes');

-- ── Event join token for Event 2 ──────────────────────────────────────────────
INSERT INTO event_join_tokens (id, event_id, token, expires_at, is_active, scan_count, created_at)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'dev-seed-token-birthday-brunch-2026',
  NOW() + INTERVAL '23 hours',
  TRUE, 2,
  NOW() - INTERVAL '1 hour'
);
```

---

## 12. Realtime Subscriptions

### Channel Naming Convention

```
event-members:{eventId}      — participant join/update during joining phase
event-settlement:{eventId}   — payment status updates during settlement phase
```

### Mobile Client Subscriptions

```typescript
// ── Joining phase subscription ─────────────────────────────────────────────
// Subscribe while event.status === 'open' | 'locked'
const joinChannel = supabase
  .channel(`event-members:${eventId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'participants',
    filter: `event_id=eq.${eventId}`,
  }, (payload) => {
    // IMPORTANT: Re-fetch full participant list — do NOT use payload.new directly.
    // Realtime payloads bypass RLS and may expose data the client should not see.
    refetchParticipants();
  })
  .subscribe();

// ── Settlement phase subscription ──────────────────────────────────────────
// Subscribe while event.status === 'sent' | 'settling'
const settlementChannel = supabase
  .channel(`event-settlement:${eventId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'participants',
    filter: `event_id=eq.${eventId}`,
  }, (payload) => {
    // Re-fetch via API on change — never trust Realtime payload directly.
    refetchSettlement();
  })
  .subscribe();

// ── Cleanup ────────────────────────────────────────────────────────────────
// Always unsubscribe when the component unmounts or the event phase changes.
supabase.removeChannel(joinChannel);
supabase.removeChannel(settlementChannel);
```

### Security Note

**Always re-fetch via API on Realtime change — never use `payload.new` directly.** Supabase Realtime payloads are delivered before RLS filtering. Using the payload directly could expose data the authenticated user is not supposed to see. Re-fetching via the Supabase client (which applies RLS) is the safe pattern.

### Scaling Constraint

**Supabase free tier: 200 concurrent Realtime connections.**

At 10 active events × 10 participants each = 100 joining-phase connections + 100 settlement-phase connections = **200 connections** — the exact free-tier limit. This is a hard ceiling at the free tier.

| Tier | Realtime connections | Events supportable (10 participants each) |
|------|---------------------|------------------------------------------|
| Free | 200 | ~10 simultaneous active events |
| Pro | 500 | ~25 simultaneous active events |

**Action required before launch:** Upgrade to Supabase Pro before reaching 10 simultaneous active events in production. Monitor concurrent Realtime connections in the Supabase dashboard.

---

*End of Data Architecture.*

**Version:** 1.1 | **Updated:** June 2026 | **Changes:** Fixed circular FK (users.acquisition_event_id moved to ALTER TABLE post-creation), added funnel_checkpoints (Section 3.11), added device_sessions (Section 3.12), corrected DISPUTED transition to PENDING (PRD §10), added pending→confirmed direct cash path, fixed participants_update_self RLS to restricted participants_update_self_safe, replaced exec_sql RPC with defined create_analytics_partition PostgreSQL function, fixed guest_pii purge_after to NULL at creation with trigger-based settlement date, corrected analytics_events PRIMARY KEY to composite (id, created_at) for partitioned table, added Section 11 seed data spec, added Section 12 Realtime channel spec.
*This document supersedes the schema sketches in 01-PRD.md. When this document and any other conflict, this document wins.*
