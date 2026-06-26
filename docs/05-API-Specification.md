# LetsSplyt — API Specification
**Version:** 1.0 | **Date:** May 2026

---

## OpenAPI Contract

This document is the human-readable API specification. A machine-readable OpenAPI 3.1 spec is generated from the TypeScript types in `/shared/api-spec/letssplyt.openapi.yaml`.

**Critical rule:** When you add or modify an endpoint, update BOTH this document AND the OpenAPI spec. The OpenAPI spec is used to:
- Validate backend responses against the contract in CI
- Generate typed API clients for the mobile app
- Detect drift between mobile and backend at compile time

If the TypeScript shared types and this document contradict each other, the TypeScript types win.

---

## How to Read This Document

Every endpoint the LetsSplyt backend exposes is listed here. Implement each one exactly as specified — same path, same method, same response shape. The mobile app's typed API layer (`/shared/types/api.types.ts`) is generated from these shapes.

### Notation

- `[AUTH]` — requires valid JWT access token in `Authorization: Bearer <token>` header
- `[PAYER]` — additionally requires the authenticated user to be the payer of the referenced event
- `[PARTICIPANT]` — additionally requires the authenticated user to be a participant in the referenced event
- `[NO AUTH]` — public endpoint, no token required
- `[TWILIO SIG]` — no JWT, but must validate Twilio request signature (`X-Twilio-Signature` header)
- `→ ASK USER` — pause and ask the user for this value before implementing

### Standard Error Response (all endpoints)

```typescript
// All errors return this shape
interface ErrorResponse {
  error: {
    code: string;      // machine-readable, e.g. "OTP_RATE_LIMITED"
    message: string;   // human-readable
    details?: unknown; // optional extra context
  };
}
```

Never expose stack traces, SQL errors, or internal paths in error responses.

### Standard Success Envelope

Endpoints returning a single resource use the resource directly. Endpoints returning lists use:

```typescript
interface ListResponse<T> {
  data: T[];
  count: number;
}
```

---

## Base URL

```
Development:  http://localhost:3000/api/v1
Staging:      https://[staging-railway-url]/api/v1
Production:   https://[→ ASK USER: your Railway production URL]/api/v1
```

All routes below are relative to `/api/v1`.

---

## Authentication Endpoints

### POST `/auth/otp/request`
**Auth:** `[NO AUTH]` | **Rate limit:** 5 per phone/hour, 20 per IP/hour

Request a 6-digit OTP via Twilio Verify (WhatsApp-first for international, SMS for US).

**Request body:**
```typescript
{
  phone_e164: string;   // E.164 format, validated with libphonenumber
  channel?: "sms" | "whatsapp";  // default: auto (Twilio decides)
}
```

**Response `200`:**
```typescript
{
  sent: true;
  channel: "sms" | "whatsapp";
  expires_in_seconds: 600;  // OTP valid for 10 minutes
}
```

**Error codes:**
- `INVALID_PHONE` 400 — phone failed E.164 validation
- `OTP_RATE_LIMITED` 429 — too many requests for this phone
- `IP_RATE_LIMITED` 429 — too many requests from this IP
- `OTP_UNAVAILABLE` 403 — unable to send OTP (reason withheld from caller) // Generic code — never reveal opt-out status to callers. Log the real reason server-side only.

---

### POST `/auth/otp/verify`
**Auth:** `[NO AUTH]` | **Rate limit:** 3 attempts per phone per 10 minutes

Verify OTP. On success, creates or retrieves user, issues JWT pair.

**Request body:**
```typescript
{
  phone_e164: string;
  code: string;              // 6-digit OTP
  display_name?: string;     // required only if new user (first registration)
  context?: "login" | "join_event";  // default: "login"
  join_token?: string;       // required if context = "join_event"
  device_id?: string;        // stable mobile device UUID (SecureStore) — upserts device_sessions on success
  platform?: "ios" | "android";
}
```

**Device registration note:** When `device_id` and `platform` are present, the backend upserts `device_sessions` with `last_otp_verified_at`. Failures are logged and **do not** fail OTP verify — login must succeed even if the migration/table is missing in dev.

**Response `200`:**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "display_name": "string",
    "avatar_colour": "#4F46E5",
    "is_new_user": false
  }
}
```
// phone_e164 is intentionally NOT returned — it is never stored in plaintext. Client already knows the phone they entered.
// `is_new_user: true` means the mobile app should navigate to `PushPermissionScreen` after login. `is_new_user: false` means existing user — navigate directly to HomeScreen.
// `avatar_colour` is set to a random hex colour on first registration.

**Error codes:**
- `INVALID_CODE` 400 — wrong OTP
- `CODE_EXPIRED` 400 — OTP expired
- `OTP_MAX_ATTEMPTS` 429 — too many failed attempts, phone locked for 10 min
- `NAME_REQUIRED` 400 — new user but display_name not provided

---

### POST `/auth/token/refresh`
**Auth:** `[NO AUTH]` | **Rate limit:** 10 per device per hour

Exchange a refresh token for a new access + refresh token pair. Old refresh token is immediately invalidated (rotation).

**Request body:**
```typescript
{
  refresh_token: string;
}
```

**Response `200`:**
```typescript
{
  access_token: string;
  refresh_token: string;   // new token — client must replace stored token
}
```

**Error codes:**
- `INVALID_REFRESH_TOKEN` 401 — token not found or already used
- `REFRESH_TOKEN_EXPIRED` 401 — 30-day TTL exceeded

**Session handling note:** On 401 `INVALID_REFRESH_TOKEN`, the client must force logout (clear SecureStore, navigate to PhoneEntryScreen). On network error, retry up to 3 times before forcing logout. Never silently swallow a 401 — the user must re-authenticate.

---

### DELETE `/auth/session`
**Auth:** `[AUTH]`

Logout — invalidates current refresh token on server.

**Request body:** none

**Response `204`:** no body

---

## User & Profile Endpoints

### GET `/users/me`
**Auth:** `[AUTH]`

// Phone numbers are NEVER returned in API responses. Callers already know the phone (they entered it); the backend stores only `phone_hash` and `phone_encrypted`.

**Response `200`:**
```typescript
{
  id: string;
  display_name: string;
  avatar_colour: string;
  avatar_url: string | null;
  total_events_created: number;
  total_events_joined: number;
  created_at: string;
  push_notifications_enabled: boolean;
  payment_alert_notifications_enabled: boolean;
  share_alert_notifications_enabled: boolean;
}
```

`GET /users/me` falls back gracefully if notification preference columns are missing (pre-migration DBs).

---

### PATCH `/users/me`
**Auth:** `[AUTH]`

Update display name, avatar colour, or notification preferences. Push token registration is a separate concern — use `POST /users/me/push-token` instead.

**Request body (all fields optional):**
```typescript
{
  display_name?: string;       // max 50 chars
  avatar_colour?: string;      // hex colour e.g. "#6366F1"
  push_notifications_enabled?: boolean;   // master toggle (Settings screen)
  payment_alert_notifications_enabled?: boolean;
  share_alert_notifications_enabled?: boolean;
}
```

When `push_notifications_enabled` is set, the backend mirrors the value to payment/share alert flags (single-toggle UX on mobile).

**Response `200`:** updated user object (same shape as GET /users/me)

**Display name side effects:** When `display_name` is provided, the backend updates `users.display_name` then syncs **all** `participants` rows where `user_id = req.user.id` to the same value (service role). This keeps stored participant names aligned for SMS, breakdown pages, and Supabase Realtime member-list updates. Event detail APIs also resolve live `users.display_name` for linked participants on read — see canonical participant shape below.

---

### POST `/users/me/push-token`
**Auth:** `[AUTH]`

Registers or updates the Expo push token for this device. The `device_id` allows multiple devices per user. Overwrites the existing token for this `device_id` if one exists.

**Request body:**
```typescript
{
  device_id: string;    // unique device identifier (from expo-device)
  token: string;        // Expo push token
  platform: "ios" | "android";
}
```

**Response `200`:**
```typescript
{ ok: true; }
```

**Error codes:**
- `INVALID_TOKEN` 400 — token format is invalid

---

### GET `/users/me/notifications`
**Auth:** `[AUTH]`

Returns the in-app notification inbox for the authenticated user. Unread items are those with `read_at IS NULL` created within the last 30 days. Read items remain visible for 24 hours after `read_at`.

**Response `200`:**
```typescript
{
  notifications: InboxNotification[];
  unread_count: number;  // unread rows in 30-day window (matches badge)
}

interface InboxNotification {
  id: string;
  type: 'member_paid' | 'event_fully_settled' | 'member_paid_all' | 'added_to_event' | 'nudge' | 'share_ready' | 'share_edited';
  title: string;
  body: string;
  event_id: string | null;
  read_at: string | null;
  created_at: string;
  is_read: boolean;      // derived: read_at !== null
}
```

---

### GET `/users/me/notifications/unread-count`
**Auth:** `[AUTH]`

Badge count for the notification bell (unread rows in the 30-day window).

**Response `200`:**
```typescript
{ unread_count: number; }
```

---

### PATCH `/users/me/notifications/:id/read`
**Auth:** `[AUTH]`

Marks a single inbox row as read (`read_at = NOW()`). Idempotent only before first read — second call returns `404 NOT_FOUND`.

**Response `200`:**
```typescript
{ ok: true; unread_count: number; }
```

**Error codes:**
- `NOT_FOUND` 404 — notification not found or already read

---

### GET `/users/me/data`
**Auth:** `[AUTH]` | **Rate limit:** 1 request per user per 24 hours

GDPR right of access — returns all data held about the user.

**Rate limit headers returned:**
```
X-RateLimit-Limit: 1
X-RateLimit-Remaining: 0
X-RateLimit-Reset: [unix timestamp]
```

**On limit exceeded — `429 Too Many Requests`:**
```typescript
{ "error": "EXPORT_RATE_LIMITED", "reset_at": "ISO timestamp" }
```

**Response `200`:**
```typescript
{
  user: User;
  payment_handles: PaymentHandle[];   // handles decrypted for export
  events_created: Event[];
  events_participated: Event[];
  settlement_log: SettlementLogEntry[];
  analytics_events_count: number;     // count only, not raw events
  exported_at: string;
}
```

---

### GET `/users/me/balance`
**Auth:** `[AUTH]`

Returns the authenticated user's net balance across all events — amounts others owe them minus amounts they owe others. **`owed_to_you` includes every outstanding obligation on events the user created:** registered members (`user_id` set) and pure guests (`user_id` null, e.g. manual add / SMS guests). Guests never contribute to `you_owe` (guests cannot be logged-in viewers). Aligns with the combined total shown in the Home balance hero above the Members | Guests toggle.

**Response `200`:**
```json
{
  "net_balance_minor_units": 1500,
  "currency": "USD",
  "owed_to_you": 4500,
  "you_owe": 3000
}
```

**Response `200` (no events):**
```json
{ "net_balance_minor_units": 0, "currency": "USD", "owed_to_you": 0, "you_owe": 0 }
```

// Note: Positive `net_balance_minor_units` means others owe you; negative means you owe others.
// MVP: US market only — `currency` is always `"USD"`. Multi-currency deferred post-MVP.
// Built in: E09-S02

---

### GET `/users/me/counterparties`
**Auth:** `[AUTH]` | **Built in:** E09-S02

Powers the Home dashboard **Members** and **Guests** toggles. All amounts in USD minor units (cents). Only **outstanding** obligations included in list totals (`payment_status` IN `pending`, `disputed`; `amount_owed` NOT NULL). `confirmed`, `self_reported`, and `settled` rows are excluded from net totals.

**Query params:**
- `kind`: `"members"` | `"guests"` (required)

**Response `200` when `kind=members`:**
```typescript
{
  owe_you: Array<{
    user_id: string;
    display_name: string;
    avatar_colour: string;
    net_amount_minor_units: number;   // always > 0
  }>;
  you_owe: Array<{
    user_id: string;
    display_name: string;
    avatar_colour: string;
    net_amount_minor_units: number;   // always > 0 (absolute value; client shows as "you owe")
  }>;
}
```

**Net calculation (per registered counterparty):**
`net = Σ(amount_owed where viewer is payer and counterparty is participant) − Σ(amount_owed where counterparty is payer and viewer is participant)`, counting only direct payer↔participant links. If `net > 0` → `owe_you`. If `net < 0` → `you_owe`. If `net === 0` → **omit** from both arrays.

**Response `200` when `kind=guests`:**
```typescript
{
  guests: Array<{
    guest_key: string;              // phone_hash for phone guests; participant_id for name-only
    kind: "phone" | "name_only";
    display_name: string;
    amount_minor_units: number;     // total outstanding to viewer (viewer is always payer)
    event_id?: string;              // name_only only — for direct navigation to Event Detail
    participant_id?: string;        // name_only only
  }>;
}
```

**Guest rules:**
- Only participants with `user_id = null` on events where `events.payer_id = viewer`.
- **Settled / confirmed** guest obligations excluded entirely.
- **Phone guests:** aggregate rows sharing the same `guest_pii.phone_hash` into one `guest_key`.
- **Name-only guests:** one row per `participant_id` (no aggregation); include `event_id` + `participant_id` for client deep-link.

---

### DELETE `/users/me`
### POST `/users/me/delete`
**Auth:** `[AUTH]`

Both routes invoke the same handler. Mobile uses **POST** `/users/me/delete` with JSON body (reliable on React Native). **DELETE** `/users/me` accepts the same `{ confirm: true }` body.

GDPR right to erasure. Tombstones the user row, hard-deletes payment handles, anonymises linked participant names, removes device sessions and in-app notifications, deletes the Supabase Auth user.

**Precondition:** `GET /users/me/balance` must show `you_owe === 0`. Otherwise **409** `OUTSTANDING_BALANCE`.

**Request body:**
```typescript
{
  confirm: true;   // explicit confirmation required
}
```

**Response `200`:**
```typescript
{
  deleted: true;
  anonymised_participant_records: number;
}
```

**Error codes:**
- `OUTSTANDING_BALANCE` 409 — `you_owe > 0`; body includes `{ you_owe, currency }`
- `USER_ANONYMISE_FAILED` 500 — tombstone update failed (see server logs)
- `VALIDATION_ERROR` 400 — `confirm` missing or not `true`

**Tombstone behaviour:** `phone_hash` → `DELETED-{random hex}`; `display_name` → `Deleted User`; `deleted_at` set; `phone_encrypted` → NULL when column allows, else `'DELETED'` fallback; optional `name_encrypted` wipe when column exists.

---

## Payment Handle Endpoints

### GET `/users/me/handles`
**Auth:** `[AUTH]`

**Response `200`:**
```typescript
{
  data: Array<{
    id: string;
    provider: "venmo" | "paypal" | "cashapp" | "zelle" | "wise" | "upi" | "bank_transfer" | "other";
    handle_display: string;   // DECRYPTED — only returned to owner, never logged
    display_order: number;
    is_active: boolean;
    created_at: string;
  }>;
}
```

---

### POST `/users/me/handles`
**Auth:** `[AUTH]`

Add a payment handle. Encrypt before storing.

**Request body:**
```typescript
{
  provider: "venmo" | "paypal" | "cashapp" | "zelle" | "wise" | "upi" | "bank_transfer" | "other";
  handle: string;         // plaintext — service encrypts before DB insert
  display_order?: number; // default 0
}
```

**Response `201`:**
```typescript
{
  id: string;
  provider: string;
  handle_display: string;
  display_order: number;
}
```

**Error codes:**
- `DUPLICATE_PROVIDER` 409 — user already has an active handle for this provider
- `INVALID_HANDLE` 400 — handle fails format validation for the provider

---

### PATCH `/users/me/handles/:handleId`
**Auth:** `[AUTH]` | Owner only (service must verify handle belongs to auth user)

**Request body (all optional):**
```typescript
{
  handle?: string;
  display_order?: number;
  is_active?: boolean;
}
```

**Response `200`:** updated handle object

---

### DELETE `/users/me/handles/:handleId`
**Auth:** `[AUTH]` | Owner only

Sets `is_active = false` (soft delete). Does not hard-delete — needed for historical message audit.

**Response `204`:** no body

---

## Event Endpoints

### GET `/events`
**Auth:** `[AUTH]`

Returns all events the user is payer of or participant in, sorted by created_at desc.

// Cursor-based pagination preferred over offset — consistent results under concurrent inserts.
// Mobile Events tab uses two sections: `role=creator` ("Events you created") and `role=participant` ("Events you joined"). Settled events collapsed client-side per section.

**Query params:**
- `status`: filter by event status (optional)
- `role`: `"creator"` | `"participant"` | `"all"` (default: `"all"`)
- `cursor`: string (optional) — opaque cursor from previous response (base64 encoded last event ID + created_at)
- `limit`: number (optional) — default 20, max 50

// Note: Use `data` key for all list responses, not the resource name.

**Response `200`:**
```typescript
{
  data: Array<{
    id: string;
    title: string;
    event_date: string | null;
    status: EventStatus;       // 'open' | 'locked' | 'settled' | 'cancelled' | 'archived' — NOTE: 'calculating' and 'sent' are NOT valid events.status values
    ai_stage: string;          // 'none' | 'parsing' | 'parsed' | 'calculating' | 'calculated' | 'messaging' | 'complete' | 'failed'
    total_amount: number | null;
    currency: string;
    participant_count: number;
    settled_count: number;
    role: "creator" | "participant";
    /** Participant list only — viewer's payment_status on this event (for Active/Settled toggle). */
    viewer_payment_status?: string | null;
    created_at: string;
  }>;
  count: number;
  next_cursor: string | null;  // null means no more pages; opaque base64 token
  has_more: boolean;
}
```

---

### POST `/events`
**Auth:** `[AUTH]` | **Rate limit:** 20 per user per hour

Create a new event. Automatically generates a join token (24-hour TTL).

**Request body:**
```typescript
{
  title: string;          // max 100 chars
  event_date?: string;    // ISO 8601 date e.g. "2026-06-15"
}
```

**Response `201`:**
```typescript
{
  event: Event;
  join_token: string;
  join_url: string;       // e.g. https://[APP_DOMAIN]/join/[token]
  qr_data: string;        // same as join_url — encode this into QR
}
```

---

### GET `/events/:eventId`
**Auth:** `[AUTH]` | Must be payer or participant

Full event detail with participants and settlement status.

**Response `200`:**
```typescript
{
  event: {
    id: string;
    title: string;
    event_date: string | null;
    status: EventStatus;       // 'open' | 'locked' | 'settled' | 'cancelled' | 'archived' — NOTE: 'calculating' and 'sent' are NOT events.status values; 'archived' = creator has archived the event from their history (does not affect participant views)
    ai_stage: string;          // 'none' | 'parsing' | 'parsed' | 'parsed_confirmed' | 'calculating' | 'calculated' | 'messaging' | 'complete' | 'failed' — use this (not status) to track AI processing progress
    total_amount: number | null;
    currency: string;
    split_mode: string | null;   // 'equal' | 'portion' | 'itemised' | null
    payer: { id: string; display_name: string; avatar_colour: string; };
    tax_amount_minor_units: number | null;     // null until A1 parses
    tip_amount_minor_units: number | null;     // null until A1 parses
    fees_amount_minor_units: number | null;    // null until A1 parses; sum of additional surcharges
    locale: string;                            // for formatting amounts (e.g. 'en-US', 'ja-JP')
    last_parse_attempt_id: string | null;      // needed by client for receipt confirm
    split_mode: "'equal' | 'portion' | 'itemised' | null";  // null until creator chooses
    locked_at: string | null;
    messages_sent_at: string | null;
    fully_settled_at: string | null;
    created_at: string;
  };
  // participants array includes the organiser (payer) as the first row on new events.
  // POST /events auto-inserts the payer as a participant (join_method='qr_app', user_id=payer_id).
  // is_organiser is true when participants.user_id === event.payer_id.
  // display_name: for rows with user_id set, resolved from users.display_name (live profile);
  // for pure guests (user_id null), from participants.display_name (join/add snapshot).
  participants: Array<{
    id: string;
    user_id: string | null;   // null for pure guests; used client-side to gate Dispute swipe
    display_name: string;
    join_method: JoinMethod;   // 'qr_app' | 'qr_web' | 'manual_phone' | 'manual_name_only'
    amount_owed: number | null;  // null until A2 (split calculation) completes; clients should show a skeleton/loading state when null
    payment_status: PaymentStatus;  // 'pending' | 'self_reported' | 'payer_marked' | 'confirmed' | 'disputed' | 'opted_out' | 'settled'
    is_organiser?: boolean;   // true for the payer's own row; used for UI badge and remove guard
    is_self?: boolean;        // true for the authenticated viewer's row (participant Event Detail UI)
    message_delivered_at: string | null;
    self_reported_at: string | null;
    self_reported_method: string | null;  // payment method when participant self-reported or payer marked paid
    last_nudged_at: string | null;
    nudge_count: number;
    opted_out_at: string | null;
  }>;
  join_token: {             // payer only, and only when event status = "open"
    token: string;
    join_url: string;
    expires_at: string;
    is_active: boolean;
  } | null;
  my_items?: Array<{        // participant view; itemised splits only, when viewer's amount_owed is set
    id: string;
    name: string;
    share_amount: number;
    is_shared: boolean;
  }>;
  summary: {
    total: number;
    collected: number;
    outstanding: number;
    confirmed_count: number;
    pending_count: number;
  } | null;
  receipt_review?: {          // payer only; present when ai_stage is 'parsed' or 'parsed_confirmed' and receipt_scan_attempted
    items: Array<{
      name: string;
      unit_price: number;
      quantity: number;
      confidence?: 'high' | 'low';
    }>;
    additional_charges: Array<{
      name: string;
      amount: number;
      confidence?: 'high' | 'low';
    }>;
    discounts: Array<{
      name: string;
      type: 'percent' | 'amount';
      value: number;
    }>;
    tax_amount: number;
    tip_amount: number;
    fees_amount: number;
    discount_amount: number;
    currency: string;
  };
}
```

`receipt_review` is built from `receipt_items` (food vs `is_fee` rows), `receipt_discounts`, plus `events.tax_amount` / `tip_amount` / `fees_amount` / `discount_amount`. Used by Item Review pull-to-refresh and Event Detail **Review items** / **Edit share** CTAs. Does **not** re-run A1.

---

### PATCH `/events/:eventId`
**Auth:** `[AUTH]` | `[PAYER]` | Only while status = "open" or "locked"

**Request body (all optional):**
```typescript
{
  title?: string;
  event_date?: string;
}
```

**Response `200`:** updated event object

---

### POST `/events/:eventId/lock`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be in "open" status

Lock the group. Expires the active join token. No new participants can join after this.

**Request body:** none

**Response `200`:**
```typescript
{
  event_id: string;
  status: "locked";
  locked_at: string;
  participant_count: number;
}
```

**Error codes:**
- `ALREADY_LOCKED` 409 — event already locked (or status not `open`)
- `MINIMUM_PARTICIPANTS_REQUIRED` 400 — cannot lock with fewer than 2 participants (organiser + ≥1 other)

---

### POST `/events/:eventId/reopen`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be in "locked" status

Reopen the join window for 24 hours. Generates a new join token.

**Request body:** none

**Response `200`:**
```typescript
{
  join_token: string;
  join_url: string;
  expires_at: string;    // 24 hours from now
}
```

---

### POST `/events/:eventId/expenses/reset`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be `status = "locked"` | Blocked after `messages_sent_at` is set

Clears all expense and split data for the event so the creator can start again with **Scan receipt** or **Enter total**. Participants and join tokens are **not** deleted.

**Side effects:**
- Deletes all `receipt_items` for the event (`item_assignments` cascade)
- Clears event receipt/AI fields: `total_amount`, `tax_amount`, `tip_amount`, `fees_amount`, `discount_amount`, `split_mode`, `receipt_scan_attempted`, `ai_parse_success`, `ai_parse_confidence`, `last_parse_attempt_id`, `ai_stage → 'none'`
- Clears participant split fields: `amount_owed`, `payment_status → 'pending'`, message/self-report/confirm timestamps
- Deletes `ai_audit_log` rows for the event
- Deletes receipt images from Storage bucket `receipts/{eventId}/` (best-effort)

Implemented via Postgres function `reset_event_expenses_data(p_event_id)` when the migration is applied; otherwise falls back to equivalent row updates. Verifies the event is fully cleared before returning success.

**Request body:** none

**Response `200`:**
```typescript
{
  reset: true;
  event_id: string;
  ai_stage: 'none';
}
```

**Error codes:**
- `EVENT_NOT_LOCKED` 409 — event is not in `locked` status
- `MESSAGES_ALREADY_SENT` 409 — `messages_sent_at` is set; cannot reset after send
- `NOTHING_TO_RESET` 400 — no receipt scan, totals, or AI stage data to clear
- `RESET_FAILED` 500 — expense data could not be fully cleared (check migrations / logs)
- `FORBIDDEN` 403 — caller is not the payer

---

### DELETE `/events/:eventId`
**Auth:** `[AUTH]` | `[PAYER]` | Allowed only when `messages_sent_at` IS NULL

Hard-deletes the event and cascaded child rows (participants, join tokens, receipt items, assignments, audit log). Also deletes `guest_pii` rows for event participants, `notification_log` / `settlement_log` rows for the event, and all objects under Storage `receipts/{eventId}/`.

**Response `204`:** no body

**Error codes:**
- `EVENT_MESSAGES_ALREADY_SENT` 409 — payment request messages were already sent
- `FORBIDDEN` 403 — caller is not the payer
- `NOT_FOUND` 404 — event does not exist or already deleted

---

## Participant Endpoints

### Canonical Participant Response Shape

All participant list responses across every endpoint use this schema. Never deviate from this shape.

```typescript
// Canonical participant shape in ALL API responses:
interface ParticipantResponse {
  id: string;                // participants.id (not user_id)
  user_id: string | null;    // null for guests
  display_name: string;      // registered (user_id set): live users.display_name; guest: participants.display_name snapshot
  join_method: 'qr_app' | 'qr_web' | 'manual_phone' | 'manual_name_only';
  payment_status: 'pending' | 'self_reported' | 'payer_marked' | 'confirmed' | 'disputed' | 'opted_out' | 'settled';
  // All 7 payment_status values:
  //   pending         — awaiting payment
  //   self_reported   — legacy intermediate (app self-report now sets confirmed directly)
  //   payer_marked    — payer marked participant as paid; if participant had previously self_reported, backend auto-advances to confirmed (synchronous return is payer_marked; Realtime subscription delivers the confirmed transition)
  //   confirmed       — payment accepted (self-report, mark-paid, or legacy confirm)
  //   disputed        — payer disputed a confirmed/self_reported payment; participant may self-report again
  //   opted_out       — participant sent STOP via SMS; no further Twilio messages will be sent to them
  //   settled         — final settled state; event-level settlement complete
  amount_owed: number | null;  // null until A2 (split calculation) completes; clients should show a skeleton/loading state when null
  opted_out_at: string | null; // ISO8601 timestamp when participant opted out via STOP; null if not opted out
  // NEVER include: phone_hash, phone_encrypted, guest_pii_token
  // Phone numbers are NEVER returned in API responses. Callers already know the phone (they entered it); the backend stores only `phone_hash` and `phone_encrypted`.
}
```

### GET `/events/:eventId/participants`
**Auth:** `[AUTH]` | Must be payer or participant

**Response `200`:** list of participant objects (canonical shape above)

**NEVER included in response (stripped by PII middleware before response leaves backend):**
- `phone_e164` — internal only
- `phone_hash` — internal only
- `name_encrypted` — internal only
- `guest_pii_token` — internal only

---

### POST `/events/:eventId/participants`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be in "open" status

Manually add a participant. Payer vouches — no OTP required for join.

**Registered-user linking (`join_method: "manual_phone"` only):**
When `phone_e164` is provided, the server hashes it with `hashPhone()` and queries `users` by `phone_hash`. If a registered user exists:
- Inserts `participants` with `user_id` set, `guest_pii_token = null`, `join_method = 'manual_phone'`
- Uses payer-supplied `display_name` for the member list
- Does **not** create a `users` row and does **not** send OTP
- That user sees the event via `GET /events?role=all` (joined events) on next login

If no registered user exists:
- Inserts `guest_pii` (hashed + encrypted phone) and `participants` with `user_id = null`
- Phone is available for outbound SMS via `resolveParticipantPhone` at message time
- Account creation remains OTP-only (QR join / app registration)

Duplicate detection checks both `participants.user_id` (registered) and `guest_pii.phone_hash` (guests) within the event.

**Request body:**
```typescript
{
  display_name: string;
  phone_e164?: string;        // omit for name-only (cash) participant
  join_method: "manual_phone" | "manual_name_only";
  send_invite_sms?: boolean;  // default true if phone provided; checks opt-out before sending
}
```

**Response `201`:**
```typescript
{
  participant: Participant;
  invite_sent: boolean;
}
```

**Error codes:**
- `DUPLICATE_PHONE` 409 — phone already in this event
- `OTP_UNAVAILABLE` 403 — unable to send invite (reason withheld from caller) // Generic code — never reveal opt-out status to callers. Log the real reason server-side only.
- `GROUP_LOCKED` 409 — event is locked

---

### DELETE `/events/:eventId/participants/:participantId`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be in "open" status (before lock)

**Response `204`:** no body

**Error codes:**
- `GROUP_IS_LOCKED` 400 — cannot remove after lock
- `CANNOT_REMOVE_ORGANISER` 400 — payer cannot remove their own row
- `CANNOT_REMOVE_ACTIVE_PARTICIPANT` 400 — only `payment_status='pending'` rows can be removed
- `NOT_FOUND` 404

---

## Browser Join Endpoints

These endpoints serve the browser join flow. The GET renders HTML; the POST endpoints return JSON.

**Security note (CSRF):** Browser join POST endpoints (`POST /join/:token/otp/request` and `POST /join/:token/otp/verify`) use the double-submit cookie pattern for CSRF protection. The server sets `csrf_token` cookie on `GET /join/:token`. Subsequent POST requests must include `X-CSRF-Token: {value}` header matching the cookie value. Mobile API endpoints (under `/api/v1/`) are excluded from CSRF checks — they use JWT Bearer tokens.

### GET `/join/:token`
**Auth:** `[NO AUTH]`

Renders the browser join page HTML. Check token validity — if expired or revoked, render an "expired" page with event title and payer name. Sets `csrf_token` cookie for CSRF protection of subsequent POST requests.

**→ Note:** This endpoint returns HTML, not JSON. Use Express `res.render()` or inline HTML template. The page must include the TCPA consent text from `09-Security-And-Privacy.md` Section 6 (DPDP Consent) near the phone number field. The page must work without JavaScript disabled (progressive enhancement).

---

### GET `/join/:token/status`
**Auth:** `[NO AUTH]`

Polled by the web page to detect when the event is locked (show "Waiting for bill..." state).

**Response `200`:**
```typescript
{
  event_status: "open" | "locked";
  event_title: string;
}
```

---

### POST `/join/:token/check`
**Auth:** `[NO AUTH]` | **Rate limit:** 10 per IP per minute

Validate the join token and accept the phone number to be verified. Does NOT reveal whether the phone is registered.

// Never reveal phone registration status before OTP verification. Return generic 200 regardless of match. The 'mode' field is set AFTER OTP verification, not before.

**Request body:**
```typescript
{ phone_e164: string; }
```

**Response (always 200, regardless of phone match):**
```typescript
{
  proceed: true;
  event_title: string;     // always return — used in page copy
  payer_name: string;      // payer's first name
}
```

**Note:** The `mode` field (`"new_user"` | `"returning_user"`) and any personalised greeting are only revealed AFTER OTP verification succeeds (see `POST /join/:token/otp/verify`). This endpoint must never expose whether the phone number is registered in LetsSplyt.

---

### POST `/join/:token/otp/request`
**Auth:** `[NO AUTH]` | **Rate limit:** 3 requests per phone per 10 min, 20 per IP per hour
**CSRF:** Include `X-CSRF-Token` header (double-submit cookie pattern)

Send OTP to the number provided in the browser join form. Checks opt-out before sending.

**Request body:**
```typescript
{ phone_e164: string; }
```

**Response `200`:** same shape as `POST /auth/otp/request`

**Error codes:**
- `TOO_MANY_REQUESTS` 429

---

### POST `/join/:token/otp/verify`
**Auth:** `[NO AUTH]` | **Rate limit:** 3 per phone per 10 minutes
**CSRF:** Include `X-CSRF-Token` header (double-submit cookie pattern)

Verify OTP, **create or resolve a `users` account** (same as app registration), and add the person to the event as a participant with `user_id` set. Legacy guest participant rows for the same phone are upgraded to `user_id` on verify.

**Display name persistence:** The browser `display_name` (carried from the join form through a hidden field on the OTP page) is written to `users.display_name` on registration via `resolveUserAfterOtp`. If a profile already exists with a placeholder name (`LetsSplyt User`) or empty name, the web-entered name replaces it. The same name is stored on `participants.display_name` for new inserts; when upgrading a pure-guest row, `participants.display_name` is updated to the web-entered name. Existing real names are not overwritten.

**Idempotent join:** If the phone is already a registered user linked to this event, returns success without creating a duplicate. Pure-guest rows (payer manual add) still receive OTP on re-submit so the account can be created and linked.

**Request body:**
```typescript
{
  phone_e164: string;
  code: string;
  display_name: string;   // required (was: first_name + last_name)
}
```

**Response `200`:**
```typescript
{
  participant_id: string;
  event_id: string;
  is_existing_user: boolean;
  event: {
    title: string;
    payer_name: string;
    member_count: number;
  };
  members: Array<{ display_name: string; }>;   // show in joined confirmation page
}
```

**Error codes:**
- `TOKEN_EXPIRED` 410 — join window closed
- `TOKEN_REVOKED` 410 — group locked
- `DUPLICATE_PHONE` 409 — already in this event
- `NAME_REQUIRED` 400 — new user but display_name not provided
- `INVALID_OTP` 400 — wrong OTP code
- `EVENT_LOCKED` 409 — event is locked, no longer accepting new participants

---

## App Member Join Endpoints

### GET `/join/:token/preview`
**Auth:** `[NO AUTH]` | **Built in:** E06-S02

Lightweight preview for `AppJoinScreen` before the user taps Join.

**Response `200`:**
```typescript
{
  eventName: string;
  creatorName: string;
  joinable: boolean;   // true when token valid and event status is open
  pageKind: "form" | "expired" | "locked" | "not_found";
}
```

---

### POST `/join/:token/app-join`
**Auth:** `[AUTH]` | **Built in:** E06-S02

In-app join when Universal Link opens LetsSplyt. Creates participant with `join_method = 'qr_app'` and `user_id = req.user.id`. Writes funnel checkpoint `join_confirmed`.

**Response `201`:**
```typescript
{
  eventId: string;
  eventName: string;
  amount_owed: null;
  participantId: string;
}
```

**Error codes:**
- `GROUP_IS_LOCKED` 400 — event not accepting new members
- `ALREADY_JOINED` 409 — user already a participant
- `TOKEN_EXPIRED` 410 — join link expired
- `TOKEN_NOT_FOUND` 404 — invalid token

---

### POST `/join/:token` (legacy alias)
**Auth:** `[NO AUTH]` (public endpoint)

Used by App Members who scan a QR code and the Universal Link opens the app. The app resolves the `join_token` from the URL and calls this endpoint with the user's authenticated uid. Sets `join_method = 'qr_app'`.

**Note:** The `scan_count` on the `event_join_tokens` table is incremented on every call (including repeat scans by the same user).

**Request body:**
```typescript
{
  user_id: string;   // authenticated user's Supabase uid
}
```

**Response `200`:**
```typescript
{
  event_id: string;
  participant_id: string;
  join_method: "qr_app";
}
```

**Error codes:**
- `EVENT_LOCKED` 409 — event is locked, no longer accepting new participants
- `ALREADY_JOINED` 409 — user is already a participant in this event

---

## Receipt Endpoints

### Implemented v1 routes (E07-S01 / E07-S02)

Mobile upload + parse uses these paths under `/api/v1`:

#### POST `/api/v1/receipts/upload-url`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be `locked`

**Request:** `{ event_id: string }`

**Response `200`:** `{ upload_url, storage_path, upload_token }` — client uploads JPEG to Storage bucket `receipts` at `storage_path`.

#### POST `/api/v1/receipts/parse`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be `locked`

Runs A1 with atomic idempotency (`ai_stage`). Returns major-unit amounts (not minor units).

**Request:** `{ event_id: string, storage_path: string }`

**Response `200`:**
```typescript
{
  items: Array<{
    name: string;
    unit_price: number;      // major units (e.g. 12.50)
    quantity: number;
    confidence?: 'high' | 'low';
  }>;
  additional_charges: Array<{
    name: string;            // e.g. "SVC Fee", "City Fee"
    amount: number;
    confidence?: 'high' | 'low';
  }>;
  tax_amount: number;
  tip_amount: number;
  fees_amount: number;       // sum(additional_charges.amount); also stored on events.fees_amount
  total_amount: number;
  currency: string;          // ISO 4217
  storage_path: string;
}
```

**Persistence:** Food lines → `receipt_items` (`is_fee = false`). Each `additional_charges` entry → `receipt_items` (`is_fee = true`) plus aggregate on `events.fees_amount`. Tax/tip → `events.tax_amount` / `events.tip_amount` only.

**Error codes:** `ALREADY_PROCESSING` 409, `PARSE_FAILED` 500 (whole receipt still fails — e.g. empty JSON, no items after normalization, whole-receipt unreadable), `RECEIPT_UNREADABLE` 400, `AI_QUOTA_EXCEEDED` 503

**Parse resilience:** Per-line Zod issues (invalid `id`, zero price, garbled names) are normalized before validation — see `receipt-parser.normalize.ts` in `docs/07-AI-Agent-Specification.md` §3. Failed attempts log `error_code` in `ai_audit_log` (often a Zod JSON array when normalization did not apply).

**Dev:** `A1_DEV_STUB=true` (non-production) skips the LLM and returns fixture data.

#### POST `/api/v1/receipts/confirm`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be `locked`

Payer confirms (and optionally edits) parsed receipt lines before split assignment. Human checkpoint before A2.

**Request:**
```typescript
{
  event_id: string;
  items: Array<{ id?: string; name: string; price: number; quantity: number }>;
  additional_charges: Array<{ name: string; amount: number }>;
  discounts: Array<{ name: string; type: 'percent' | 'amount'; value: number }>;
  tax: number;
  fees: number;   // must equal sum(additional_charges) ± 0.02
  tip: number;
  discount_total: number; // must equal sequentially resolved sum of discounts on items subtotal ± 0.02
}
```

**Total formula:** `total_amount = max(0, sum(items) − discount_total + fees + tax + tip)`.

**Discount resolution (server and mobile must match `shared/utils/receiptDiscounts.ts`):**
- **percent:** `remaining_subtotal × (value / 100)`, rounded to 2 dp
- **amount:** fixed `value`, capped at `remaining_subtotal`
- Multiple discounts apply **sequentially** (each reduces the remaining subtotal for the next)
- Empty-name or zero-value discounts are omitted by the mobile client before submit

**Atomic guard:** `UPDATE events SET ai_stage = … WHERE id = event_id AND ai_stage IN ('parsed', 'parsed_confirmed', 'calculated', 'calculating')`.

- First confirm (`ai_stage = 'parsed'`) → sets `parsed_confirmed`.
- Re-edit after split calculate (`calculated` / `calculating`) → **keeps** current `ai_stage` so Fair play can reload existing assignments.

**Item sync (preserves `item_assignments`):** Does **not** delete all `receipt_items` on every confirm.

- **Food lines:** `UPDATE` rows when the client sends the same `id`; `INSERT` new rows; `DELETE` only food rows removed from the payload. Stable ids keep `item_assignments` rows (FK `ON DELETE CASCADE` would otherwise wipe assignments).
- **Fee lines:** delete all existing `is_fee = true` rows for the event, then insert fresh surcharge rows from `additional_charges`.
- **Discounts:** delete all `receipt_discounts` for the event, then insert from payload.

Also updates `events.total_amount`, `tax_amount`, `tip_amount`, `fees_amount`, `discount_amount`, `receipt_scan_attempted`, `ai_parse_success`.

**Response `200`:**
```typescript
{ confirmed: true; total_amount: number; }
```

**Error codes:** `INVALID_AI_STAGE` 400 (not in `parsed` / `parsed_confirmed` / `calculated` / `calculating`), `EVENT_NOT_LOCKED` 400, `VALIDATION_ERROR` 400 (e.g. fees or `discount_total` mismatch), `FORBIDDEN` 403

---

### POST `/events/:eventId/receipt/scan`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be "locked" | **Rate limit:** 5 per event per hour

Upload receipt image. Calls A1 (Gemini) synchronously, waits for the response, and returns the full parsed result. Does NOT run A2 yet.

**Request:** `multipart/form-data`
```
image: File    (JPEG, PNG, WebP; max 10MB after client-side compression)
```

// Note: This endpoint is synchronous — it sets `ai_stage = 'parsing'`, calls A1, and returns 200 with the full parse result. Clients should use a 30-second timeout for this request. If the LLM times out, the server returns 504.

**Response `200`:**
```json
{
  "parse_attempt_id": "uuid",
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "unit_price": 1200,
      "quantity": 1,
      "confidence_score": 0.95,
      "is_low_confidence": false
    }
  ],
  "subtotal_minor_units": 4500,
  "tax_minor_units": 400,
  "fees_minor_units": 200,
  "tip_minor_units": 300,
  "total_minor_units": 5200,
  "additional_charges": [
    { "name": "SVC Fee", "amount_minor_units": 200, "confidence_score": 0.92 }
  ],
  "currency": "USD",
  "locale": "en-US",
  "low_confidence_item_count": 0
}
```

**Error codes:**
- `RECEIPT_UNREADABLE` 422 — A1 returned unreadable after 3 retries
- `RECEIPT_TOO_LARGE` 422 — receipt image is oversized
- `TOO_MANY_ITEMS` 422 — receipt has more items than the system supports
- `RECEIPT_ALREADY_PROCESSING` 409 — event ai_stage is already in 'parsing'; concurrent scan rejected
- `PARSE_FAILED` 500 — all retries exhausted
- `IMAGE_TOO_LARGE` 413 — image exceeds 10MB
- `WRONG_EVENT_STATUS` 409 — event not in "locked" status

---

### POST `/events/:eventId/receipt/confirm`
**Auth:** `[AUTH]` | `[PAYER]`

Payer confirms (and optionally edits) the parsed items. This is the human checkpoint — A2 cannot run until this is called.

// Note: This endpoint validates `parse_attempt_id` and triggers A2; sets `ai_stage = 'calculating'`.

**Request body:**
```typescript
{
  parse_attempt_id: string;  // required; must match events.last_parse_attempt_id. If stale, returns 409 STALE_PARSE_ATTEMPT
  items: Array<{
    id: string;              // existing ID from parse, or new UUID for manually added items
    name: string;            // item name (was: description)
    unit_price: number;      // per-item price in minor currency units (was: price)
    quantity: number;
    confidence_score: number;  // 0.00–1.00
    is_low_confidence: boolean;
    is_tax?: boolean;
    is_tip?: boolean;
  }>;
  tax: number;
  tip: number;
  fees: number;              // sum of additional surcharge lines; stored as events.fees_amount
  additional_charges?: Array<{ name: string; amount: number }>;
  total: number;
  currency: string;
  entry_method: "receipt_scan" | "manual";
}
```

**Response `200`:**
```typescript
{
  confirmed: true;
  receipt_item_ids: string[];   // IDs of stored receipt_items rows
  total: number;
}
```

**Error codes:**
- `STALE_PARSE_ATTEMPT` 409 — `parse_attempt_id` doesn't match `events.last_parse_attempt_id`; a newer parse superseded this one

---

## Split Endpoints

### POST `/events/:eventId/split/calculate`
**Auth:** `[AUTH]` | `[PAYER]` | Receipt must be confirmed

Run A2. Provide item assignments (drag-and-drop, NLP, or even/custom mode).

// Note: A2 is triggered after receipt confirmation (POST /receipt/confirm sets ai_stage = 'calculating'). The split calculate endpoint refines/overrides A2 assignments.
// split_mode valid values: 'equal' | 'portion' | 'itemised' (use these — 'portions' and 'even' are invalid)

**Request body:**
```typescript
{
  split_mode: "equal" | "itemised" | "portion";

  // For split_mode = "itemised":
  assignments?: Array<{
    item_id: string;
    participant_ids: string[];   // item split equally among these
  }>;
  nlp_instruction?: string;      // natural language e.g. "Rohan had the pasta"

  // For split_mode = "equal":
  // No extra fields needed

  // For split_mode = "portion":
  manual_splits?: Array<{
    participant_id: string;
    value: number;   // weight/portion (e.g. 1.0 = one share, 0.5 = half share)
  }>;

  // For all modes where receipt wasn't scanned:
  manual_total?: number;    // required if entry_method was "manual"
}
```

**Response `200`:**
```typescript
{
  splits: Array<{
    participant_id: string;
    display_name: string;
    amount_owed: number;
    item_names: string[];     // items assigned to this person (for A3 context)
  }>;
  total_check: number;        // sum of all amount_owed — must equal event total
  unassigned_item_ids: string[];  // items A2 couldn't assign (payer must manually assign)
  confidence: number;
  requires_review: boolean;
}
```

**Error codes:**
- `RECEIPT_NOT_CONFIRMED` 409 — human checkpoint not passed
- `SUM_INVARIANT_VIOLATED` 500 — internal arithmetic error (should never happen; log + alert)
- `UNRESOLVED_ASSIGNMENTS` 400 — unassigned_item_ids is non-empty; payer must assign before confirming

---

### POST `/events/:eventId/split/confirm`
**Auth:** `[AUTH]` | `[PAYER]`

Payer reviews and confirms the calculated split. Writes `amount_owed` to all participant rows.

**Allowed `events.status`:** `locked` (pre-send) or `sent` (post-send revision via **Edit share** → Split entry → Review split → confirm). Returns `409 EVENT_NOT_LOCKED` for any other status.

**Pre-send:** advances `ai_stage` to `"calculated"`.

**Post-send** (`messages_sent_at` set): keeps `ai_stage` at `"complete"`. Participants whose amounts change (and are not already confirmed/settled) get `payment_status = pending`, `revision_count` incremented, and `original_amount_owed` set on first revision. Caller should then invoke `POST /splits/resend` (mobile does this automatically from Review split **Save and notify →**).

**Edit lock (post-send):** Returns `409 SETTLEMENTS_IN_PROGRESS` if any participant has `payment_status` in `self_reported`, `confirmed`, or `settled`. Disputing a self-report (back to `pending`) clears the lock when no other blocking statuses remain.

**Request body:**
```typescript
{
  splits: Array<{
    participant_id: string;
    amount_owed: number;   // payer may have edited individual amounts
  }>;
}
```

**Response `200`:**
```typescript
{
  confirmed: true;
  event_status: string;     // "locked" pre-send or "sent" post-send
  ai_stage: "calculated" | "complete";
  splits: Array<{ participant_id: string; amount_owed: number; }>;
}
```

**Error codes:**
- `SUM_MISMATCH` 400 — split total does not match event total
- `PARTICIPANT_ALREADY_CONFIRMED` 409 — attempted to change amount for confirmed/settled participant
- `SETTLEMENTS_IN_PROGRESS` 409 — post-send edit blocked (self-reported or confirmed payment exists)

---

### POST `/events/:eventId/splits/resend`
**Auth:** `[AUTH]` | `[PAYER]` | Event must be `sent` with `messages_sent_at` set

Send revision SMS/WhatsApp to participants affected by a post-send `split/confirm`. Does **not** run A3 — uses `message-assembler` with lead-in **"Your share has been updated."**

**Selection:** participants where `payment_status = pending` AND `revision_count > 0`, excluding the payer.

**Request body:** none

**Response `200`:** same shape as `POST /messages/send` (`sent_count`, `skipped_count`, `failed_count`, `results`, `event_status: "sent"`).

---

## Message Endpoints

### GET `/events/:eventId/messages/preview`
**Auth:** `[AUTH]` | `[PAYER]` | Split must be confirmed

Generate per-participant message previews (without sending). Runs A3 composition but does not trigger Twilio. Ensures each participant has a `breakdown_token` and returns the assembled URL.

**Response `200`:**
```typescript
{
  previews: Array<{
    participant_id: string;
    display_name: string;
    amount_owed: number;
    message_text: string;    // full composed SMS body (includes See full split: line)
    channel: "whatsapp" | "sms";
    breakdown_url: string;   // https://{APP_DOMAIN}/split/{breakdown_token}
    payment_links: Array<{
      provider: string;
      url: string;
      label: string;
    }>;
  }>;
}
```

---

### POST `/events/:eventId/messages/send`
**Auth:** `[AUTH]` | `[PAYER]` | **Rate limit:** 3 per event per 24 hours

Send all participant messages via Twilio as **text-only SMS/WhatsApp** (no `mediaUrl` / MMS). Each body includes the participant's `breakdown_url` line. Checks opt-out for every number before sending.

**Request body:** none (uses confirmed split data)

**Response `200`:**
```typescript
{
  sent_count: number;
  skipped_count: number;       // opted-out or name-only participants
  failed_count: number;
  results: Array<{
    participant_id: string;
    status: "sent" | "skipped_opt_out" | "skipped_no_phone" | "failed";
    twilio_sid?: string;
  }>;
  event_status: "sent";
}
```

---

### POST `/events/:eventId/messages/nudge/:participantId`
**Auth:** `[AUTH]` | `[PAYER]` | **Rate limit:** 1 per participant per 48 hours

Send a reminder message to a specific participant. Checks opt-out before sending.

**Request body:** none

**Response `200`:**
```typescript
{
  sent: boolean;
  channel: "whatsapp" | "sms";
  twilio_sid?: string;
  next_nudge_available_at: string;   // ISO 8601 — when 48-hour cooldown expires
}
```

**Error codes:**
- `NUDGE_COOLDOWN` 429 — still within 48-hour cooldown; includes `next_nudge_available_at` in body (NOT `next_available_at`) — TTL is 48 hours
- `PARTICIPANT_OPTED_OUT` 403 — cannot nudge opted-out number
- `PARTICIPANT_SETTLED` 409 — participant already confirmed paid

---

### GET `/split/:token`
**Auth:** none (public capability URL — unguessable per-participant token)

Server-rendered HTML breakdown page linked from SMS (`See full split: …`). Registered on Express at `/split` (not under `/api/v1`).

**Response `200`:** HTML document with event title, payer name, table of **all** participants (including organiser), item summaries, formatted amounts. Token holder's row marked `(you)` and highlighted; payer row marked `(organiser)`. No phone numbers.

**Response `404`:** Friendly HTML "not found" page for invalid token, deleted event, or missing data.

**Security:** Token is 18-byte `base64url` stored in `participants.breakdown_token`. Do not log full URLs in analytics. Cleared on expenses reset.

---

## Settlement Endpoints

### Shared Type: SettlementLogEntry

```typescript
interface SettlementLogEntry {
  id: string;             // uuid
  event_id: string;       // uuid
  participant_id: string; // uuid
  from_status: 'pending' | 'self_reported' | 'payer_marked' | 'confirmed' | 'disputed' | 'opted_out' | 'settled';
  to_status: 'pending' | 'self_reported' | 'payer_marked' | 'confirmed' | 'disputed' | 'opted_out' | 'settled';
  changed_by: 'creator' | 'participant' | 'system' | 'twilio_stop';
  note: string | null;
  created_at: string;     // ISO8601
}
```

---

### GET `/settlement/owed-to-me`
**Auth:** `[AUTH]`

Returns all amounts owed TO the authenticated user (i.e. where they are the event creator/payer).

**Response `200`:**
```json
{
  "data": [
    {
      "event_id": "uuid",
      "event_title": "string",
      "participant_id": "uuid",
      "participant_display_name": "string",
      "amount_minor_units": 1500,
      "currency": "USD",
      "payment_status": "pending | self_reported | payer_marked | confirmed | disputed | opted_out | settled",
      "settled_at": "ISO8601 | null"
    }
  ],
  "total_owed_minor_units": 4500,
  "currency": "USD"
}
```

---

### GET `/settlement/i-owe`
**Auth:** `[AUTH]`

Returns all amounts the authenticated user owes to others.

**Note:** `creator_payment_handles` contains DECRYPTED handles for display — the backend decrypts before returning.

**Response `200`:**
```json
{
  "data": [
    {
      "event_id": "uuid",
      "event_title": "string",
      "payer_display_name": "string",
      "amount_minor_units": 800,
      "currency": "USD",
      "payment_status": "pending | self_reported | payer_marked | confirmed | disputed | opted_out | settled",
      "creator_payment_handles": [
        { "provider": "venmo", "handle_display": "string" }
      ]
    }
  ],
  "total_owe_minor_units": 800,
  "currency": "USD"
}
```

---

### GET `/settlement/member/:userId`
**Auth:** `[AUTH]` | **Built in:** E09-S02

Member detail screen (registered counterparty). Only events with a **direct payer↔participant** relationship between viewer and `:userId`.

**Response `200`:**
```typescript
{
  counterparty: {
    user_id: string;
    display_name: string;
    avatar_colour: string;
  };
  net_amount_minor_units: number;   // signed: positive = they owe you net
  currency: "USD";
  outstanding: Array<{
    event_id: string;
    event_title: string;
    event_date: string | null;
    amount_minor_units: number;
    direction: "owed_to_me" | "i_owe";
    payment_status: PaymentStatus;
    participant_id: string;         // row to act on in Event Detail / settlement APIs
  }>;
  history: Array<{
    event_id: string;
    event_title: string;
    event_date: string | null;
    amount_minor_units: number;
    direction: "owed_to_me" | "i_owe";
    payment_status: PaymentStatus;    // confirmed, settled, or zero outstanding
    participant_id: string;
  }>;
}
```

**Client:** Render `outstanding` expanded; `history` behind "See more events" (collapsed by default).

**Alias:** `GET /settlement/person/:userId` MAY redirect or duplicate this shape for backward compatibility.

---

### GET `/settlement/guest/:phoneHash`
**Auth:** `[AUTH]` | **Built in:** E09-S02

Guest detail screen for **phone guests** aggregated by `guest_pii.phone_hash`. Viewer must be payer on all returned events.

**Response `200`:**
```typescript
{
  display_name: string;             // from most recent participant row
  amount_minor_units: number;       // total outstanding
  currency: "USD";
  outstanding: Array<{
    event_id: string;
    event_title: string;
    amount_minor_units: number;
    payment_status: PaymentStatus;
    participant_id: string;
  }>;
  history: Array<{
    event_id: string;
    event_title: string;
    amount_minor_units: number;
    payment_status: PaymentStatus;
    participant_id: string;
  }>;
}
```

**Note:** Name-only guests do not call this endpoint — client navigates directly to `GET /events/:id` using `event_id` from `GET /users/me/counterparties?kind=guests`.

---

// participant_id in path enforces authorization at route level — backend verifies caller owns or created the event containing this participant.
// Settlement endpoint URL pattern: POST /settlement/:participantId/self-report | POST /settlement/:participantId/confirm | POST /settlement/:participantId/dispute

### POST `/events/:eventId/settlement/:participantId/self-report`
**Auth:** `[AUTH]` | `[PARTICIPANT]`

Participant marks themselves as paid. Sets `payment_status` to **`confirmed`** immediately (also sets `self_reported_at`, `self_reported_method`, `confirmed_at`). Valid from `pending` or `disputed`.

**Request body:**
```typescript
{
  payment_method: "venmo" | "paypal" | "cashapp" | "zelle" | "wise" | "cash" | "bank_transfer" | "other";
  note?: string;   // max 200 chars, optional free text
}
```

**Response `200`:**
```typescript
{
  participant_id: string;
  payment_status: "confirmed";
  self_reported_at: string;
  confirmed_at: string;
  event_fully_settled: boolean;
}
```

---

### POST `/events/:eventId/settlement/:participantId/confirm`
**Auth:** `[AUTH]` | `[PAYER]`

**Legacy:** Payer confirms a row still in `self_reported`. App self-report no longer uses this path (self-report → `confirmed` directly). Retained for backward compatibility and manual DB states.

**Request body:** none

**Response `200`:**
```typescript
{
  participant_id: string;
  payment_status: "confirmed";
  confirmed_at: string;
  event_fully_settled: boolean;   // true if this was the last pending participant
}
```

**Response `409`:** `INVALID_PAYMENT_STATUS` when row is not `self_reported`.

---

### POST `/events/:eventId/settlement/:participantId/dispute`
**Auth:** `[AUTH]` | `[PAYER]`

Payer disputes a **confirmed** or **self_reported** payment. Sets `payment_status` to **`disputed`** (clears `confirmed_at`). Notifies participant.

**Request body:**
```typescript
{
  note?: string;   // reason for dispute (shown to participant in push notification)
}
```

**Response `200`:**
```typescript
{
  participant_id: string;
  payment_status: "disputed";
  disputed_count: number;
}
```

---

### POST `/events/:eventId/settlement/cash/:participantId`
**Auth:** `[AUTH]` | `[PAYER]` | **Built in:** E09-S01 (remaining)

Payer marks a participant as paid (cash, Zelle, or any external method). `pending` → `payer_marked` → `confirmed`.

**Request body:**
```typescript
{
  payment_method: "cash" | "zelle" | "bank_transfer" | "other";
  note?: string;
}
```

**Response `200`:**
```typescript
{
  participant_id: string;
  payment_status: "payer_marked";
  event_fully_settled: boolean;
}
```

---

### Counterparty bulk settlement (E09-S02)

One-tap actions across **all direct outstanding participant rows** for a registered member or phone guest. Each updated row writes its own `settlement_log` entry. Skips rows whose status no longer matches (partial success; no whole-batch 500).

#### POST `/settlement/member/:userId/self-report-all`
**Auth:** `[AUTH]` | **Participant** owes counterparty `:userId`

**Net settlement alias** (`memberNetSettle`): offsets mutual `owed_to_me` rows via `payerConfirmOffset`, then self-reports all `i_owe` rows (`pending`/`disputed` → `confirmed`). Requires `payment_method` when net amount owed to counterparty is negative.

**Request body:** same as per-event self-report (`payment_method`, optional `note`).

**Response `200`:**
```typescript
{
  updated_count: number;
  results: Array<{
    event_id: string;
    participant_id: string;
    payment_status: "confirmed";
  }>;
}
```

#### POST `/settlement/member/:userId/confirm-all`
**Auth:** `[AUTH]` | `[PAYER]` — counterparty owes viewer

**Legacy:** Bulk `self_reported` → `confirmed` for `owed_to_me` rows still in `outstanding[]`. Returns `updated_count: 0` when app self-report already confirmed rows (typical).

**Response `200`:**
```typescript
{
  updated_count: number;
  events_fully_settled: string[];
  results: Array<{ event_id: string; participant_id: string; payment_status: "confirmed" }>;
}
```

#### POST `/settlement/member/:userId/dispute-all`
**Auth:** `[AUTH]` | `[PAYER]`

Bulk `confirmed` or `self_reported` → `disputed` for all `owed_to_me` rows (includes `history[]` — confirmed rows are not in `outstanding[]`).

**Request body:** `{ note?: string }`

**Response `200`:**
```typescript
{ updated_count: number; results: Array<{ event_id: string; participant_id: string; payment_status: "disputed" }> }
```

#### POST `/settlement/member/:userId/mark-paid-all`
**Auth:** `[AUTH]` | `[PAYER]`

Bulk mark paid for every `pending` `owed_to_me` row (`payer_marked` → `confirmed`).

**Request body:** `{ payment_method: "cash" | "zelle" | "bank_transfer" | "other"; note?: string }`

**Response `200`:**
```typescript
{
  updated_count: number;
  events_fully_settled: string[];
  results: Array<{ event_id: string; participant_id: string; payment_status: "confirmed" }>;
}
```

#### POST `/settlement/guest/:phoneHash/confirm-all`
#### POST `/settlement/guest/:phoneHash/dispute-all`
#### POST `/settlement/guest/:phoneHash/mark-paid-all`

Same semantics as member bulk endpoints; viewer must be payer on all rows; match `phone_hash`. No `self-report-all` (guests without app accounts).

---

## Background Job Consumer Endpoints

These endpoints are called by Upstash QStash, not by the mobile app. All require QStash signature verification via the `X-Qstash-Signature` header (verified using `QSTASH_CURRENT_SIGNING_KEY`). They are not JWT-authenticated.

**Important:** These endpoints use the `/jobs/...` prefix, NOT `/api/v1/jobs/...`. They are only reachable by QStash (verified by `QSTASH_CURRENT_SIGNING_KEY`). They MUST NOT be under `/api/v1/` which is the client-facing prefix.

### POST `/jobs/nudge-check`
**Auth:** QStash signature (`X-Qstash-Signature` header)

**Request body:**
```typescript
{
  eventId: string;
  participantIds?: string[];
}
```

**Response `200`:**
```typescript
{ nudged: number; skipped: number; }
```

**Validation:** Verify QStash signature using `QSTASH_CURRENT_SIGNING_KEY`.

---

### POST `/jobs/purge-guest-pii`
**Auth:** QStash signature

**Request body:**
```typescript
{ batchSize?: number; }
```

**Response `200`:**
```typescript
{ purged: number; }
```

---

### POST `/jobs/create-analytics-partition`
**Auth:** QStash signature

**Request body:**
```typescript
{ year: number; month: number; }
```

**Response `200`:**
```typescript
{ partition: string; created: boolean; }
```

---

## Analytics Endpoint

### POST `/analytics/events`
**Auth:** `[AUTH]` or anonymous (user_id optional) | **Rate limit:** 200 per session per minute

Log a single analytics event. Mobile app calls this for every tracked action. See `10-Engineering-Operations.md` Section 5 for full event name list.

**Request body:**
```typescript
{
  event_name: AnalyticsEventName;  // from analytics.types.ts union
  session_id: string;
  anonymous_id?: string;
  properties: Record<string, unknown>;
  platform: "ios" | "android" | "web";
  app_version: string;
  timestamp: string;   // ISO 8601 — client timestamp; server stores server time too
}
```

**Response `202`:** accepted (fire-and-forget; don't block UI on this)

---

## Webhook Endpoints

These are called by Twilio, not by the app. Validate `X-Twilio-Signature` header on every request using the Twilio SDK's `validateRequest` helper. Reject with 403 if signature invalid.

### POST `/webhooks/twilio/opt-out`
**Auth:** `[TWILIO SIG]`

Fired when anyone replies STOP (or STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) to any of your messages.

**Twilio sends:** `application/x-www-form-urlencoded` with fields including `From` (the phone number that replied STOP).

**What the handler must do (in this order):**
1. Validate Twilio signature
2. Normalise `From` to E.164
3. `INSERT INTO sms_opt_outs` (on conflict do nothing)
4. `UPDATE users SET is_opted_out = TRUE` where phone matches (if registered user)
5. `UPDATE participants SET opted_out_at = NOW()` for all active participant records
6. Return `200` with empty TwiML response: `<Response></Response>`

**Response `200`:** TwiML `<Response></Response>` — tells Twilio not to send an auto-reply

---

### POST `/webhooks/twilio/delivery`
**Auth:** `[TWILIO SIG]`

Delivery status callback for each message sent. Twilio calls this for `delivered`, `failed`, `undelivered`.

**What the handler must do:**
1. Validate Twilio signature
2. Extract `MessageSid`, `MessageStatus`, `To`
3. Update `notification_log.status` and `delivered_at` for the matching `twilio_sid`
4. If status = `failed` or `undelivered`: update `participants.message_failed = TRUE`, fire analytics event `message_delivery_failed`
5. Return `200` with empty body

**→ Note:** Twilio must be configured to POST to `[YOUR_BACKEND_URL]/api/v1/webhooks/twilio/delivery` for every message. Set this in Twilio Console → Phone Numbers → your number → Messaging → Status Callback URL. Ask the user for the production backend URL when configuring this.

---

## Static Pages (Express routes, return HTML)

| Route | Purpose | Auth |
|-------|---------|------|
| `GET /privacy` | Privacy policy page | `[NO AUTH]` |
| `GET /terms` | Terms of service page | `[NO AUTH]` |
| `GET /join/:token` | Browser join invitation page | `[NO AUTH]` |

## Infrastructure / Well-Known Endpoints

### GET `/.well-known/apple-app-site-association`
**Auth:** `[NO AUTH]` | **Content-Type:** `application/json`

Apple App Site Association JSON (served as static file from `backend/public/.well-known/`). Required for Universal Links (iOS). Must be served without redirect and without `.json` extension.

---

### GET `/.well-known/assetlinks.json`
**Auth:** `[NO AUTH]` | **Content-Type:** `application/json`

Android Digital Asset Links JSON. Required for App Links (Android). The backend serves this as a static JSON file from `backend/public/.well-known/`.

---

---

## Summary Table

| Method | Path | Auth | Rate Limit |
|--------|------|------|------------|
| POST | /auth/otp/request | NO AUTH | 5/phone/hr |
| POST | /auth/otp/verify | NO AUTH | 3/phone/10min |
| POST | /auth/token/refresh | NO AUTH | 10/device/hr |
| DELETE | /auth/session | AUTH | — |
| GET | /users/me | AUTH | — |
| PATCH | /users/me | AUTH | — |
| POST | /users/me/push-token | AUTH | — |
| GET | /users/me/notifications | AUTH | — |
| GET | /users/me/notifications/unread-count | AUTH | — |
| PATCH | /users/me/notifications/:id/read | AUTH | — |
| GET | /users/me/balance | AUTH | — |
| GET | /users/me/counterparties | AUTH | — |
| GET | /users/me/data | AUTH | 1/user/24hr |
| DELETE | /users/me | AUTH | `{ confirm: true }` |
| POST | /users/me/delete | AUTH | `{ confirm: true }` |
| GET | /users/me/handles | AUTH | — |
| POST | /users/me/handles | AUTH | — |
| PATCH | /users/me/handles/:id | AUTH | — |
| DELETE | /users/me/handles/:id | AUTH | — |
| GET | /events | AUTH | — |
| POST | /events | AUTH | 20/user/hr |
| GET | /events/:id | AUTH | — |
| PATCH | /events/:id | AUTH | — |
| POST | /events/:id/lock | AUTH PAYER | — |
| POST | /events/:id/reopen | AUTH PAYER | — |
| DELETE | /events/:id | AUTH PAYER | — |
| GET | /events/:id/participants | AUTH | — |
| POST | /events/:id/participants | AUTH PAYER | — |
| DELETE | /events/:id/participants/:pid | AUTH PAYER | — |
| POST | /join/:token | NO AUTH | — |
| GET | /join/:token | NO AUTH | — |
| GET | /join/:token/status | NO AUTH | — |
| POST | /join/:token/check | NO AUTH | 10/IP/min |
| POST | /join/:token/otp/request | NO AUTH | 3/phone/10min, 20/IP/hr |
| POST | /join/:token/otp/verify | NO AUTH | 3/phone/10min |
| GET | /join/:token/preview | NO AUTH | — |
| POST | /join/:token/app-join | AUTH | — |
| GET | /split/:token | NO AUTH | — |
| POST | /events/:id/receipt/scan | AUTH PAYER | 5/event/hr |
| POST | /events/:id/receipt/confirm | AUTH PAYER | — |
| POST | /events/:id/split/calculate | AUTH PAYER | — |
| POST | /events/:id/split/confirm | AUTH PAYER | — |
| POST | /events/:id/splits/resend | AUTH PAYER | — |
| GET | /events/:id/messages/preview | AUTH PAYER | — |
| POST | /events/:id/messages/send | AUTH PAYER | 3/event/24hr |
| POST | /events/:id/messages/nudge/:pid | AUTH PAYER | 1/participant/48hr |
| GET | /settlement/owed-to-me | AUTH | — |
| GET | /settlement/i-owe | AUTH | — |
| GET | /settlement/member/:userId | AUTH | — |
| GET | /settlement/guest/:phoneHash | AUTH | — |
| GET | /settlement/person/:userId | AUTH | — (alias of member detail) |
| POST | /events/:id/settlement/:pid/self-report | AUTH PARTICIPANT | — |
| POST | /events/:id/settlement/:pid/confirm | AUTH PAYER | — |
| POST | /events/:id/settlement/:pid/dispute | AUTH PAYER | — |
| POST | /events/:id/settlement/cash/:pid | AUTH PAYER | — |
| POST | /settlement/member/:userId/self-report-all | AUTH PARTICIPANT | — |
| POST | /settlement/member/:userId/confirm-all | AUTH PAYER | — |
| POST | /settlement/member/:userId/dispute-all | AUTH PAYER | — |
| POST | /settlement/member/:userId/mark-paid-all | AUTH PAYER | — |
| POST | /settlement/guest/:phoneHash/confirm-all | AUTH PAYER | — |
| POST | /settlement/guest/:phoneHash/dispute-all | AUTH PAYER | — |
| POST | /settlement/guest/:phoneHash/mark-paid-all | AUTH PAYER | — |
| POST | /analytics/events | AUTH or ANON | 200/session/min |
| POST | /webhooks/twilio/opt-out | TWILIO SIG | — |
| POST | /webhooks/twilio/delivery | TWILIO SIG | — |
| POST | /jobs/nudge-check | QSTASH SIG | — |
| POST | /jobs/purge-guest-pii | QSTASH SIG | — |
| POST | /jobs/create-analytics-partition | QSTASH SIG | — |
| GET | /.well-known/apple-app-site-association | NO AUTH | — |
| GET | /.well-known/assetlinks.json | NO AUTH | — |

---

*All request/response types must be reflected in `/shared/types/api.types.ts`. If a field is added here, add the corresponding TypeScript type. If the type changes, the API spec is the source of truth.*
