# LetsSplyt — System Architecture
**Version:** 1.0 | **Date:** June 2026

---

## Table of Contents
1. System Overview
2. Architecture Decision: Modular Monorepo
3. Service Responsibilities
4. Complete Data Flow — Receipt to SMS
5. Technology Stack
6. Environment Topology
7. Monorepo Structure
8. Cross-Cutting Concerns

---

## 1. System Overview

LetsSplyt is a mobile bill-splitting application that takes a group dining event from a single photograph of the receipt to individualised, delivered payment requests — in one creator-initiated flow. The system is built around three AI agents that handle the genuinely hard parts (reading any receipt via computer vision, calculating fair per-person splits with proportional tax and tip, and composing country-aware personalised payment messages), and a set of loosely coupled backend services that orchestrate the complete lifecycle: group formation, receipt capture, split calculation, message delivery, and settlement tracking. All outbound payment messages are delivered server-side via Twilio in a single creator action, with per-recipient delivery tracking returned to the mobile app in real time.

**The core insight that shapes every architectural decision:** participants never need an account, an app install, or any prior relationship with the payer's tools. A person who joins via QR scan in a browser, receives a payment request by SMS, taps a Venmo link, and pays — all without ever downloading LetsSplyt — is a fully supported first-class participant. This zero-onboarding-for-recipients constraint drives the separation between the registered-user data path (Supabase Auth, JWT, app deep links) and the guest data path (browser OTP, `guest_pii` table, Twilio SMS delivery).

---

## 2. Architecture Decision: Modular Monorepo

### Why Modular Monorepo — Not Microservices, Not Separate Repos

**Not microservices:** A true microservices architecture requires independent deployment pipelines, inter-service network contracts, distributed tracing, and service discovery — all of which add operational complexity that is not warranted at MVP scale. The 7-service model described in this document refers to logical service boundaries within a single deployed Node.js process, not separate deployable units. Each "service" is a TypeScript module with its own folder, its own tests, and clear ownership boundaries. When traffic justifies it, the split points are already designed in — extracting `notifications/` into a standalone process requires changing only the import and adding a message queue; no business logic changes.

**Not separate repos:** Separate repositories for mobile and backend create type drift — the same `Participant` type gets defined twice and diverges over time. A shared `/shared` package in a monorepo makes a schema change propagate everywhere the TypeScript compiler can see. One `tsc` run across the entire workspace catches every type mismatch before it reaches staging.

**Modular monorepo chosen because:** It delivers the discipline of microservices (clear ownership, independent testability, explicit interfaces) with the simplicity of a monolith (shared types, single CI pipeline, zero network overhead between services). At MVP, the right abstraction is a module boundary, not a network boundary.

### The Three Top-Level Folders

```
letssplyt/
  mobile/      ← Expo React Native application (iOS + Android)
  backend/     ← Node.js Express API server
  shared/      ← TypeScript types shared between mobile and backend
```

Every data shape that crosses the mobile/backend boundary lives in `shared/`. Neither `mobile/` nor `backend/` defines its own version of a shared type. This is enforced by TypeScript imports — `mobile/src/modules/events/events.api.ts` imports `CreateEventResponse` from `@shared/types/api.types`, not from a local file. If the backend changes the response shape, the compiler immediately flags every mobile call site that needs updating.

### The shared/ Folder as the Type Contract

`shared/` contains no runtime logic — only TypeScript type definitions and interfaces. It is the formal contract between the mobile client and the backend API. The types it defines include:

- `auth.types.ts` — User, Session, OTPRequest
- `event.types.ts` — Event, EventStatus, JoinToken
- `participant.types.ts` — Participant, JoinMethod, PaymentStatus, SettlementTransition
- `settlement.types.ts` — SettlementAction, SettlementLogEntry
- `receipt.types.ts` — ReceiptItem, ItemAssignment, ParseResult
- `message.types.ts` — MessagePackage, DeliveryChannel
- `analytics.types.ts` — AnalyticsEvent, FunnelCheckpoint, AnalyticsEventName (typed union)
- `payment.types.ts` — PaymentHandle, PaymentProvider
- `api.types.ts` — Request and response shapes for every backend endpoint

The `PaymentStatus` type in `participant.types.ts` is the single definition of the settlement state machine. It is used by the backend state machine, the mobile settlement UI, and the analytics event catalogue — the same type, compiled once.

### When This Would Evolve to Microservices

The modular monorepo is designed to be split at well-defined seams when traffic warrants it. The thresholds that would trigger extraction:

- **Notification Service** — extract first, when SMS/push volume causes latency on the main API thread. Extraction: move `notifications/` to a separate Railway service, replace direct function calls with a Redis Pub/Sub message.
- **AI Orchestrator** — extract when AI call volume requires independent rate-limiting, retry budgets, or a different runtime (e.g. Python for model inference). The `infrastructure/llm/factory.ts` abstraction layer means the extraction point is already defined.
- **Analytics Service** — extract when analytics write volume creates database contention with transactional writes. The `analytics_events` table is already partitioned by month to support high write throughput.

The design principle is: extract a service when its failure or resource consumption threatens another service's availability, not before.

---

## 3. Inter-Service Communication Model

**Inter-Service Communication Model:** All 7 services run as TypeScript modules within a single Node.js Express process. They are NOT separate deployable microservices. Communication between services is via direct TypeScript function imports — there is no HTTP between services, no message broker, and no Redis Pub/Sub for intra-process calls. This was an explicit MVP decision to reduce operational complexity.

The term 'event bus' in this document refers to an in-process Node.js `EventEmitter` used for loose coupling between modules — NOT Redis Pub/Sub. The EventEmitter pattern is used only for non-critical async side effects (e.g. writing analytics events after a payment is confirmed). All synchronous business logic uses direct function calls.

---

## 4. Service Responsibilities

The backend is organised into 7 logical services (modules), each with a defined ownership boundary. The rule for each service: it owns what is listed, does not touch what is not listed, and calls other services only through their public TypeScript interfaces — never directly querying another service's tables.

### Auth Service
**Owns:** OTP generation and verification, JWT issuance, refresh token rotation, biometric unlock coordination, session lifecycle, device session records.

**Does NOT own:** User profile data, payment handles, event data, participant records.

**Calls:** Supabase Auth (phone OTP), Twilio Verify (OTP delivery), Redis (rate limit counters per phone and per IP).

**Key constraint:** Auth Service is a security boundary. It never passes authentication decisions to other services — every other service validates the JWT itself via the `authenticate` middleware. Auth Service also enforces OTP rate limits: max 3 attempts per phone per 10 minutes, max 5 OTP requests per phone per hour, max 20 OTP requests per IP per hour.

---

### Profile Service
**Owns:** User display name, avatar, payment handles (Venmo, PayPal, Cash App, Zelle, Wise, UPI), acquisition source tracking, opt-out status.

**Does NOT own:** Event data, participant records, settlement state, authentication tokens.

**Calls:** `infrastructure/encryption.ts` (AES-256-GCM encrypt on write, decrypt only at A3 message composition time — the Profile Service never returns decrypted handles to the mobile client).

**Key constraint:** Payment handles are encrypted at rest before the INSERT. The Profile Service stores `handle_encrypted`. The only code that ever calls `decryptHandle()` is `message-composer.service.ts` (the A3 agent), and only at message send time. Decrypted values are never logged, never returned in API responses, and never stored after use.

---

### Event Service
**Owns:** Event lifecycle (open → locked → calculating → sent → settled → archived), event join tokens (creation, expiry, revocation), the group lock gate, participant list management, manual participant addition (registered-user linking by `phone_hash` or `guest_pii` for pure guests), the reopen window after locking.

**Registration rule:** OTP verification (web join or app auth) creates or resolves a `users` row via `resolveUserAfterOtp` and upgrades legacy `guest_pii` participant rows. Pure guests exist only for payer manual add without OTP.

**Does NOT own:** Receipt parsing (AI Orchestrator), split calculation (AI Orchestrator), message composition and delivery (Message Service), settlement state transitions (Settlement Service), push notifications (Notification Service).

**Calls:** Supabase Realtime (publishes participant changes so the mobile member list updates live), Redis (join token TTL, lock state), Auth Service (verify payer JWT on all mutating operations).

**Key constraint:** The "Scan receipt & split" action is disabled at the API level — `POST /events/:id/scan` returns 409 unless `events.status = 'locked'`. Group lock is the hard gate. Locking immediately expires the current join token and sets `event_join_tokens.is_active = false`.

---

### AI Orchestrator
**Owns:** The three AI agents (A1, A2, A3), LLM provider selection (Gemini 2.5 Flash in dev/staging, Claude Haiku 4.5 in production), AI idempotency guard, receipt image upload to Supabase Storage, per-agent retry logic and rate limiting.

**Does NOT own:** Message delivery (Notification Service), participant records (Event Service), payment handle decryption orchestration (it calls Profile Service to fetch handles, which calls `decryptHandle` internally).

**Calls:** `infrastructure/llm/factory.ts` (resolves the correct AI provider from environment), Supabase Storage (upload receipt image, generate S3 URL), `receipt_items` table (write A1 output), `item_assignments` table (write A2 output), Profile Service (fetch payer's payment handles for A3 input).

**Key constraint:** Agents run in a linear synchronous pipeline — A1 output feeds A2 input, A2 output feeds A3 input. The `events.ai_stage` column (`none → parsing → parsed → calculating → calculated → messaging → complete → failed`) is the idempotency guard: if the process crashes mid-pipeline, resuming will check `ai_stage` and skip already-completed stages rather than re-invoking expensive AI calls or double-writing database records. Application code uses atomic `UPDATE ... WHERE ai_stage='X'` to transition states — never read-then-write. Only the admin script `backend/scripts/reset-ai-stage.ts` can reset `failed → none`.

---

### Notification Service
**Owns:** All outbound communication (SMS, WhatsApp, push notifications), opt-out enforcement, nudge cooldown enforcement, delivery status tracking, `sms_opt_outs` table, `notification_log` table.

**Does NOT own:** Message content generation (AI Orchestrator / Message Service), participant payment status (Settlement Service).

**Calls:** Twilio Programmable Messaging (SMS/WhatsApp delivery), Expo Push Notifications (push delivery for registered users), Redis (nudge cooldown state), `sms_opt_outs` table (pre-send opt-out check).

**Key constraint:** Every single Twilio API call anywhere in the codebase is gated by `checkOptOut(phoneE164)`, which throws `OptOutError` if the number is in `sms_opt_outs`. This check runs in the Notification Service before any message or nudge is dispatched. It is not optional and not bypassable — the TypeScript wrapper around Twilio makes it structurally impossible to call `sendSms()` without going through this check.

---

### Message Service
**Owns:** Split image generation (each participant's message image with their row highlighted), payment deep link construction (country-filtered per-provider URLs), message package assembly, the share queue, post-send edit coordination with selective resend logic.

**Does NOT own:** AI text generation (AI Orchestrator), Twilio dispatch (Notification Service), payment handle storage (Profile Service).

**Calls:** AI Orchestrator (A3 personalised greeting text), Notification Service (hands off assembled message packages for delivery), `libphonenumber-js` (country detection for payment link filtering).

**Key constraint:** Payment link generation is entirely config-driven from `payment-methods.config.ts`. Adding a new payment provider or a new country requires only a config change — no code changes to Message Service or any other service. The country-to-provider mapping (`US → Venmo, Zelle, Cash App, PayPal`; `non-US → PayPal, Wise, Cash`) lives in `COUNTRY_PAYMENT_CONFIG` and is evaluated per participant at message generation time.

---

### Settlement Service
**Owns:** The participant payment state machine (all valid state transitions), settlement log writes, dispute handling, the two-party confirmation model (participant self-reports, payer confirms or disputes), nudge job scheduling via QStash, and **cross-event counterparty aggregation** for the Home dashboard (`GET /users/me/balance`, `GET /users/me/counterparties`, `GET /settlement/member/:userId`, `GET /settlement/guest/:phoneHash`).

**Does NOT own:** Delivery of notifications (Notification Service), event-level status aggregation (Event Service computes `events.status = 'settled'` when all participants reach `settled`). Settlement **actions** (confirm, nudge, self-report) are invoked from Event Detail — Home is a read-only router to counterparties and events.

**Counterparty aggregation (E09-S02):** For registered members, compute per-counterparty **net** across all shared events using direct payer↔participant links only: `net = Σ(they owe you) − Σ(you owe them)`. Positive → `owe_you`; negative → `you_owe`; zero → omitted. For guests, list only pure guests (`participants.user_id IS NULL`) with outstanding amounts where the viewer is payer; phone guests aggregated by `guest_pii.phone_hash`; name-only guests one row per participant. Not a Splitwise running ledger — event-scoped obligations with net display for UX.

**Calls:** `settlement.state-machine.ts` (enforces that only valid transitions compile — TypeScript's `SettlementTransition` union type makes invalid transitions a compilation error), `settlement_log` table (every state change writes an audit row with actor_id, previous status, new status, and timestamp), Notification Service (triggers push to payer on self-report, push to participant on confirmation/dispute), QStash (enqueues nudge check job 48 hours after messages sent).

**Valid state transitions:**
```
PENDING       → SELF_REPORTED  (participant taps "I've paid")
PENDING       → PAYER_MARKED   (payer marks cash/manual payment)
SELF_REPORTED → CONFIRMED      (payer confirms)
SELF_REPORTED → DISPUTED       (payer disputes → returns to PENDING)
PAYER_MARKED  → CONFIRMED      (automatic)
CONFIRMED     → SETTLED        (automatic)
```

---

## 5. Complete Data Flow — Receipt to SMS

This section traces a single complete event from the creator opening the app to the last participant settling. For each step: which service handles it, which database tables are read or written, and which external services are called.

---

**Step 1 — Creator opens the app → auth check**

- **Service:** Auth Service
- **What happens:** The mobile app reads the stored refresh token from Expo SecureStore. If the access token (15-minute TTL) is within 2 minutes of expiry, the app proactively calls `POST /auth/token/refresh`. Auth Service validates the refresh token, issues a new access token and a new refresh token (rotation — old token is invalidated), and returns both. If the refresh token is expired, the user is redirected to `PhoneEntryScreen`.
- **Tables read:** `device_sessions` (validate device_id), `users` (load profile)
- **Tables written:** `device_sessions.last_active_at`, `users.last_active_at`
- **External calls:** None (Supabase Auth handles JWT validation internally)

---

**Step 2 — Creator creates event → token generated**

- **Service:** Event Service
- **What happens:** Creator taps "New event," enters a title (e.g. "Dinner at Nobu"), and optionally an event date. The backend creates an `events` row with `status = 'open'` and immediately creates an `event_join_tokens` row: a cryptographically random 144-bit token (`crypto.randomBytes(18).toString('base64url')`), 24-hour TTL. The mobile app receives the join URL (`https://[domain]/join/[token]`) and displays a QR code encoding that URL, plus a copy/share button. The `event_created` analytics event fires.
- **Tables written:** `events` (INSERT, status='open'), `event_join_tokens` (INSERT, expires_at=NOW()+24hr), `analytics_events` (event_created), `funnel_checkpoints` (creator_activation step 4)
- **External calls:** None

---

**Step 3 — Participant scans QR → web join flow**

- **Service:** Auth Service + Event Service
- **What happens (Path B — no app installed):** The QR scan opens the device browser at `https://[domain]/join/[token]`. The backend validates the token (active, not expired, event not locked). The browser page shows the event name and invites the participant to enter their first name, last name, and phone number. The `browser_invite_viewed` analytics event fires. On phone submission, the backend calls Twilio Verify to send an OTP. Participant enters the OTP — the backend verifies it, looks up the phone hash in `guest_pii`, and either finds an existing guest record or creates a new one. A `participants` row is inserted with `join_method = 'qr_browser_new'` and a `guest_pii_token` FK (not a direct phone column). `guest_browser_joined` fires. The mobile app receives a Supabase Realtime event and updates the live member list.
- **What happens (Path A — app installed):** The OS intercepts the URL via universal link / app link and opens LetsSplyt directly. If the user is logged in, they join with one tap. If their session is expired, a quick OTP re-verifies the existing account (no new account created). `participants` row is inserted with `join_method = 'app_deeplink'` and `user_id` set.
- **Tables read:** `event_join_tokens` (validate token), `guest_pii` (phone dedup lookup), `users` (phone hash lookup for Path A)
- **Tables written:** `guest_pii` (INSERT if new guest), `participants` (INSERT), `analytics_events` (qr_code_scanned, browser_invite_viewed, otp_verified, guest_browser_joined), `event_join_tokens.scan_count` (increment)
- **External calls:** Twilio Verify (OTP delivery)

---

**Step 4 — Creator locks group → validation**

- **Service:** Event Service
- **What happens:** Creator taps "Everyone's here — Lock & split." The backend checks that at least **two** participant rows exist (organiser, auto-inserted on event create, plus at least one other member). It sets `events.status = 'locked'`, records `events.participant_count_at_lock` and `events.time_to_lock_seconds`, and immediately revokes the active join token (`event_join_tokens.is_active = false`, `revoked_at = NOW()`). No new participants can join via QR or URL. The "Scan receipt & split" button becomes enabled on the mobile app. The `group_locked` analytics event fires and the creator_activation funnel checkpoint (step 5) is written.
- **Tables read:** `participants` (count check)
- **Tables written:** `events` (status='locked', locked_at, participant_count_at_lock, time_to_lock_seconds), `event_join_tokens` (is_active=false, revoked_at), `analytics_events` (group_locked), `funnel_checkpoints`
- **External calls:** None

---

**Step 5 — Receipt captured → image pipeline (compression → S3 → URL)**

- **Service:** AI Orchestrator
- **What happens:** Creator photographs the receipt. The mobile app compresses the image (Expo ImageManipulator, target ≤ 800KB) and base64-encodes it, then calls `POST /events/:id/scan`. The backend sets `events.ai_stage = 'parsing'` and `events.receipt_scan_attempted = true`. The receipt image is uploaded to Supabase Storage (S3-compatible) under the key `receipts/[event_id]/[timestamp].jpg`. The storage URL is stored on the `receipt_items` rows that A1 will create. `receipt_scan_started` analytics event fires.
- **Tables written:** `events` (ai_stage='parsing', receipt_scan_attempted=true)
- **External calls:** Supabase Storage (PUT image)

---

**Step 6 — A1 invoked → Gemini (dev) / Claude Haiku (prod) → JSON**

- **Service:** AI Orchestrator (`receipt-parser.service.ts`)
- **What happens:** The AI Orchestrator calls `infrastructure/llm/factory.ts`, which resolves the LLM provider from `NODE_ENV`: Gemini 2.5 Flash in development and staging, Claude Haiku 4.5 in production. The vision AI receives the base64-encoded receipt image with a structured prompt instructing it to extract every line item (name, unit price, quantity), tax, tip, total, and currency as strict JSON. The response is validated against the `ParseResult` TypeScript schema — if validation fails (hallucinated fields, missing total), the orchestrator retries up to 3 times before returning a parse failure. On success, `events.ai_stage` advances to `'parsed'`, `events.ai_parse_success = true`, and `events.ai_parse_confidence` is recorded. Receipt items are written to `receipt_items`. `receipt_parsed_success` or `receipt_parsed_failed` fires.
- **Tables written:** `events` (ai_stage='parsed', ai_parse_success, ai_parse_confidence), `receipt_items` (INSERT — one row per line item, with receipt_s3_key)
- **External calls:** Google Gemini 2.5 Flash API (dev/staging) or Anthropic Claude Haiku 4.5 API (production)

**Why different AI providers per environment:** Gemini 2.5 Flash provides a free tier that covers all development at zero cost (~$0.30/$1.50 per 1M tokens if paid), making it right for iterating on prompts. Claude Haiku 4.5 is used in production because it has the lowest hallucination rate on financial documents in benchmarking (94–97% accuracy on restaurant receipts) — it will not invent prices not on the bill. Financial accuracy in production takes priority over cost optimisation. Cost per event in production: approximately $0.004–$0.006 for all three AI calls combined.

---

**Step 7 — A2 invoked → split calculated**

- **Service:** AI Orchestrator (`split-calculator.service.ts`)
- **What happens:** The creator reviews and optionally edits the parsed items, then selects a split mode. The modes available depend on the path taken: if the receipt was scanned, the creator sees Even, Itemised, Custom ($ Amount, % Percent, ⅟ Portion); if the total was entered manually, the app lands directly on split entry without the mode chooser. A2 receives the items JSON from A1 (or the manually entered total), the participant list, and any item assignments (via drag-and-drop on the mobile UI, or via natural language input which A2 interprets using the same LLM). A2 maps items to participants, prorates tax and tip proportionally, and resolves rounding using the largest remainder method. **Critical invariant:** the sum of all `amount_owed` values must equal `events.total_amount` ±$0.01. This is enforced in code and in evals — financial data cannot have silent rounding errors. `events.ai_stage` advances to `'calculated'`.
- **Tables written:** `participants` (amount_owed set for each), `item_assignments` (INSERT — one row per item-participant pair), `events` (ai_stage='calculated', split_mode)
- **External calls:** Same LLM as A1 (only if natural language assignment is used; pure algorithmic splits make no AI call)

---

**Step 8 — A3 invoked → messages composed**

- **Service:** AI Orchestrator (`message-composer.service.ts`) + Message Service
- **What happens:** For each participant, A3 fetches the payer's payment handles from Profile Service (`decryptHandle()` is called here — the only place in the codebase that decrypts payment handles). A3 determines each participant's country code from their E.164 phone number using `libphonenumber-js` and selects the applicable payment providers from `COUNTRY_PAYMENT_CONFIG`. It constructs payment deep links with the participant's exact `amount_owed` pre-filled. Message Service generates the split table image (participant's own row highlighted in their message). A3 optionally calls the LLM for a personalised greeting. The complete message package (image + text body + payment links) is assembled for each participant and placed in the send queue. `events.ai_stage` advances to `'messaging'`.
- **Tables read:** `participants` (all for this event), `user_payment_handles` (payer's handles, decrypted in-memory only)
- **Tables written:** `events` (ai_stage='messaging')
- **External calls:** Same LLM as A1 (for personalised greeting, optional)

---

**Step 9 — Twilio sends SMS/WhatsApp**

- **Service:** Notification Service
- **What happens:** Creator reviews the message preview carousel (one swipeable card per participant showing exactly what their message will look like). Creator taps "Send to all." The backend processes all N message packages in parallel. For each participant: (1) `checkOptOut(phone)` runs — if opted out, the participant is skipped and marked as `message_failed = true`; (2) Twilio Programmable Messaging is called with `channel = auto` (WhatsApp first, SMS fallback); (3) Twilio returns a message SID, which is stored in `notification_log.twilio_sid`; (4) a Twilio delivery status callback webhook will later update `participants.message_delivered_at`. As each message lands, the mobile app receives a Supabase Realtime update and shows a green check per participant. `events.status` advances to `'sent'`, `events.ai_stage` to `'complete'`, and `events.messages_sent_at` is recorded. `messages_sent` analytics event fires. A nudge check job is enqueued in QStash to fire 48 hours later.
- **Tables written:** `participants` (message_sent_at, delivery_channel), `notification_log` (INSERT per participant), `events` (status='sent', ai_stage='complete', messages_sent_at, time_to_send_seconds), `analytics_events` (messages_sent), `funnel_checkpoints` (creator_activation step 6)
- **External calls:** Twilio Programmable Messaging (one call per participant, parallelised), QStash (enqueue nudge check job with 48-hour delay)

---

**Step 10 — Participant self-reports → state transition**

- **Service:** Settlement Service
- **What happens:** A registered participant opens their "I owe" dashboard in the LetsSplyt app, sees the event, taps "I've paid," and selects the payment method they used. The backend validates the transition (`pending → self_reported`) using the state machine, writes a `settlement_log` row (action='self_reported', actor_id=participant's user_id, previous_status='pending', new_status='self_reported'), updates `participants.payment_status` and `participants.self_reported_at`. Notification Service sends a push notification to the payer: "[Name] says they've paid." `payment_self_reported` analytics event fires.
- **Tables written:** `participants` (payment_status='self_reported', self_reported_at, self_reported_method), `settlement_log` (INSERT), `analytics_events` (payment_self_reported)
- **External calls:** Expo Push Notifications (push to payer)

---

**Step 11 — Creator confirms → settlement log written**

- **Service:** Settlement Service
- **What happens:** The payer sees the notification, opens Event Detail, and taps "Confirm" next to the participant's row. The backend validates the transition (`self_reported → confirmed`), writes a `settlement_log` row (action='payer_confirmed', actor_id=payer's user_id), updates `participants.payment_status = 'confirmed'` and `participants.confirmed_at`. Settlement Service then automatically advances to `settled` (the `confirmed → settled` transition is automatic and immediate). If this was the last pending participant, Event Service updates `events.status = 'settled'` and `events.fully_settled_at`. Notification Service pushes "You're all square!" to the payer and a confirmation push to the participant. `first_payment_confirmed` and (if applicable) `event_fully_settled` analytics events fire. Funnel checkpoint `creator_activation` step 7 (first_payment_received) and step 8 (event_settled) are written.
- **Tables written:** `participants` (payment_status='settled', confirmed_at), `settlement_log` (INSERT — confirmed row, then settled row), `events` (status='settled', fully_settled_at — if all settled), `analytics_events` (payment confirmed, event_fully_settled), `funnel_checkpoints`
- **External calls:** Expo Push Notifications (push to payer and participant)

---

## 6. Technology Stack

| Layer | Technology | Why This Was Chosen | Dev | Staging | Prod |
|---|---|---|---|---|---|
| Mobile | Expo React Native (TypeScript) | One codebase for iOS and Android. Expo provides camera, contacts, share sheet, and push notifications without native configuration. TypeScript enforces shared type safety with the backend — a `Participant` type defined in `/shared` is used by both mobile and backend, catching API contract mismatches at compile time. | Expo Go (hot reload) | Expo EAS build (TestFlight / Android Internal Track) | App Store + Google Play |
| Backend | Node.js + Express (TypeScript) | Fast REST API with WebSocket support. TypeScript on the backend means the same language and shared types across the full stack. Compiled to JavaScript at deploy time — no performance cost. | localhost:3000 | Railway (staging service) | Railway (production service) |
| Database | PostgreSQL via Supabase | Relational integrity is required for financial data (amounts, state machine transitions, audit log). Supabase provides PostgreSQL with Row Level Security (RLS), built-in Auth, Realtime subscriptions, and S3-compatible Storage — all included in the $25/month Pro plan. pgvector is available for the V2 memory agent without a database change. | letssplyt-dev project (Supabase free tier) | letssplyt-staging project | letssplyt-production project (Pro, with daily backups) |
| Cache / Queue | Upstash Redis + QStash | Serverless Redis with no idle cost. Redis is used for OTP rate limit counters, join token TTL enforcement, and nudge cooldown state. QStash (Upstash's HTTP-based job queue) handles background jobs (nudge check at T+48hr, guest PII purge nightly, analytics partition creation monthly) — it is serverless-compatible with Railway, unlike BullMQ which requires a persistent process. | letssplyt-redis-dev (shared with staging) | letssplyt-redis-dev (shared with dev) | letssplyt-redis-production (isolated) |
| File Storage | Supabase Storage (S3-compatible) | Included in the Supabase plan. Stores receipt images (uploaded at scan time, referenced by S3 key in `receipt_items`) and generated split images (per-participant message images from A3). No separate AWS account or billing needed at MVP. | letssplyt-dev Supabase project storage | letssplyt-staging project storage | letssplyt-production project storage |
| Auth | Supabase Auth (Phone OTP) | Phone-native authentication with no email friction. Supabase Auth handles JWT issuance, refresh token management, and OTP delivery (via Twilio Verify integration). The mobile app stores the refresh token in Expo SecureStore — never in AsyncStorage or localStorage. | Twilio test numbers (no real SMS) | Live Twilio credentials (real OTP delivery) | Live Twilio credentials + A2P 10DLC registered |
| AI (dev + staging) | Google Gemini 2.5 Flash | Free tier via Google AI Studio covers all development and staging at zero cost. Fast, accurate for receipt parsing and text generation. Used for A1 (vision), A2 (NLP assignment if used), and A3 (personalised greeting). | ✓ | ✓ | — |
| AI (production) | Anthropic Claude Haiku 4.5 | Chosen for production based on the lowest hallucination rate on financial documents — benchmarked at 94–97% accuracy on restaurant receipts. It will not invent prices not on the bill. Cost: ~$1/$5 per 1M tokens input/output; approximately $0.004–$0.006 per complete event across all three agents. | — | — | ✓ |
| LLM Abstraction | `infrastructure/llm/factory.ts` | A single `createLLMProvider()` function returns the correct LLM adapter based on `NODE_ENV`. Agents call `createLLMProvider()` — they never import Gemini or Anthropic SDKs directly. Swapping the production model requires changing one line in `factory.ts`, not modifying any agent. | Gemini adapter | Gemini adapter | Anthropic adapter |
| Messaging | Twilio Programmable Messaging + Twilio Verify | Verify handles OTP with automatic WhatsApp/SMS channel selection. Programmable Messaging delivers payment request messages using `channel=auto` (WhatsApp first, SMS fallback) — fully TCPA-compliant, no WhatsApp number detection required. A2P 10DLC registration is required for US SMS delivery without carrier filtering. | Test credentials (no real SMS, magic test numbers) | Live credentials (real SMS to real phones) | Live credentials + A2P 10DLC approved |
| Push Notifications | Expo Push Notifications (FCM + APNs) | Free. Expo wraps both Firebase Cloud Messaging (Android) and Apple Push Notification service (iOS) behind a single API. Push tokens are stored in `device_sessions.push_token`. Used for: participant joined, payment self-reported, payment confirmed, payment disputed, nudge prompt, all-settled. | ✓ | ✓ | ✓ |
| Hosting | Railway | $5/month Hobby tier handles MVP. One-click deploy from GitHub. Separate Railway services for staging and production environments. Environment variables are set in the Railway dashboard — never in code or files. | — | Railway staging service | Railway production service |
| Secrets Management | Doppler | All environment variables managed through Doppler, synced to Railway services per environment. Eliminates `.env` files from the repository. Doppler has separate configurations for development, staging, and production — developers can pull their own dev config locally with `doppler run`. | Doppler development config | Doppler staging config | Doppler production config |
| Error Tracking | Sentry | Captures unhandled exceptions and performance traces in production. Sentry breadcrumbs are PII-scrubbed before submission (same scrubber middleware as application logs). Releases are tagged with the deployment version. | — | — | ✓ |
| CI/CD | GitHub Actions | Three workflows: `test.yml` (runs on every push — lint, typecheck, tests, audit), `staging.yml` (auto-deploy to Railway staging on merge to `develop`), `production.yml` (manual trigger only, requires explicit confirmation input, deploys to Railway production). | ✓ | ✓ | ✓ (manual trigger) |
| Phone Normalisation | libphonenumber-js | All phone numbers are normalised to E.164 format (`+15550001234`) before any database write. Runs at the API gateway layer. Also used in A3 to detect country from phone number (correctly distinguishes Canadian +1 numbers from US +1 numbers by area code). | ✓ | ✓ | ✓ |
| Input Validation | Zod | Every API endpoint validates its request body and query parameters with a Zod schema. Unknown fields are rejected. Type inference from Zod schemas drives TypeScript types for request handlers — no separate type definitions needed for request shapes. | ✓ | ✓ | ✓ |
| Encryption | Node.js `crypto` (AES-256-GCM) | Payment handles (Venmo usernames, PayPal handles, etc.) are encrypted before INSERT using AES-256-GCM with a per-value random IV and GCM auth tag. The encryption key (`HANDLE_ENCRYPTION_KEY`) is a separate 32-byte secret, never stored in the database. Decryption happens only in `message-composer.service.ts`, only at message send time, and only in memory. | ✓ | ✓ | ✓ |

---

## 7. Environment Topology

The three environments are fully isolated from each other. No component is shared across environment boundaries except where explicitly noted in the table below (Redis in dev/staging shares an Upstash instance, which is acceptable because no real user data exists in either environment).

| Component | Development | Staging | Production |
|---|---|---|---|
| Backend host | localhost:3000 | Railway letssplyt-staging (https://staging.letssplyt.up.railway.app) | Railway letssplyt-production (https://[domain]) |
| Database | Supabase letssplyt-dev (free tier) | Supabase letssplyt-staging (free or Pro) | Supabase letssplyt-production (Pro — $25/mo, daily backups) |
| AI provider | Gemini 2.5 Flash (Google AI Studio free tier) | Gemini 2.5 Flash (same key as dev) | Anthropic Claude Haiku 4.5 ($100/mo spending limit at launch) |
| Redis | Upstash letssplyt-redis-dev (shared with staging) | Upstash letssplyt-redis-dev (shared with dev) | Upstash letssplyt-redis-production (isolated, pay-as-you-go) |
| QStash | Upstash QStash (dev queue) | Upstash QStash (staging queue) | Upstash QStash (production queue) |
| Twilio credentials | Test credentials — no real SMS sent. Sender: +15005550006 (Twilio magic number). OTPs auto-accepted for test numbers. | Live credentials — real OTPs sent to real phones. Use your own phone for testing. Incurs real Twilio costs. | Live credentials + A2P 10DLC registered and approved. STOP webhook configured. |
| Secrets | Doppler development config | Doppler staging config | Doppler production config |
| Mobile API URL | http://localhost:3000 | https://staging.letssplyt.up.railway.app | https://[domain] |
| Mobile build | Expo Go (development client, hot reload) | Expo EAS build (TestFlight / Android Internal Track) | App Store (iOS) + Google Play (Android) |
| Sentry | Disabled | Disabled | Enabled (production DSN, release tagging) |
| Error behaviour | Verbose stack traces returned to mobile | Structured error shapes, no stack traces | Structured error shapes only. Errors captured by Sentry. |

### Notes on Environment Differences

**AI provider split (Gemini dev / Claude Haiku prod):** This is intentional and permanent, not a cost-saving measure. Gemini 2.5 Flash is used in dev and staging because its free tier makes iteration on prompts free. Claude Haiku 4.5 is used exclusively in production because it has a measurably lower hallucination rate on financial documents. The `infrastructure/llm/factory.ts` abstraction means both environments share the same agent code — only the provider changes.

**Redis shared between dev and staging:** Both environments use `letssplyt-redis-dev` because no real user data exists in either environment, and an Upstash free tier instance is sufficient for both. Production uses an isolated Redis instance because rate limit counters, nudge cooldown state, and join token TTLs for real users must never be affected by development activity. If a developer runs a test that floods rate limit keys, it must not affect production.

**Twilio test credentials in dev:** Twilio test credentials (`TWILIO_ACCOUNT_SID` beginning with `AC` for test mode) accept requests without sending real SMS. The magic sender number `+15005550006` can deliver to Twilio's test recipient numbers (`+15005550001` through `+15005550004`) without any real phone interaction. This means development and unit testing never incur real Twilio charges.

**Staging uses live Twilio:** Staging must use live Twilio credentials (real OTPs, real SMS delivery) because the pre-launch test protocol requires verifying end-to-end delivery, STOP opt-out handling, and WhatsApp channel routing. These cannot be validated with test credentials. Use your own phone number(s) for staging testing.

**Database isolation is strict:** Development data never touches the staging database, and staging data never touches production. Database migrations are always run in staging first, validated against the staging test protocol, then applied to production. Never modify the production schema directly in the Supabase SQL editor.

---

## 8. Monorepo Structure

```
letssplyt/
  mobile/                          ← Expo React Native (TypeScript)
    src/
      modules/
        auth/
          screens/
            PhoneEntryScreen.tsx
            OTPVerifyScreen.tsx
          hooks/
            useAuth.ts
          auth.api.ts              ← typed API calls to backend
        home/
          screens/
            HomeScreen.tsx              ← net balance + Members|Guests toggle
            MemberDetailScreen.tsx      ← registered counterparty drill-down
            GuestDetailScreen.tsx       ← phone-guest drill-down
            PayNowScreen.tsx            ← payer handles when viewer owes
          home.api.ts
        events/
          screens/
            EventsScreen.tsx            ← Created | Joined sections
            EventDetailScreen.tsx       ← joining + settlement actions
            CreateEventScreen.tsx
            QRDisplayScreen.tsx
          hooks/
            useEvent.ts
            useRealtime.ts         ← Supabase Realtime subscription
          events.api.ts
        participants/
          screens/
            AddParticipantScreen.tsx
          participants.api.ts
        receipt/
          screens/
            ReceiptScanScreen.tsx
            ItemReviewScreen.tsx
            SplitEntryScreen.tsx
          receipt.api.ts
        settlement/
          settlement.api.ts             ← event-scoped owed-to-me / i-owe helpers
      shared/
        components/                ← Reusable UI (Button, Card, PhoneInput, etc.)
        hooks/
          useAnalytics.ts          ← typed track() wrapper — fire-and-forget
          useSession.ts            ← session_id management
        navigation/
          AppNavigator.tsx
          types.ts                 ← typed navigation params
        utils/
          format.ts                ← currency, date, phone formatting
          validation.ts            ← Zod schemas for form inputs
    app.json
    package.json
    tsconfig.json                  ← strict: true, all strict flags enabled

  backend/                         ← Node.js Express (TypeScript)
    src/
      modules/
        auth/
          auth.controller.ts       ← Express route handlers
          auth.service.ts          ← Business logic
          auth.middleware.ts       ← OTP rate limiting, JWT validation
          auth.test.ts
        events/
          events.controller.ts
          events.service.ts
          events.test.ts
        participants/
          participants.controller.ts
          participants.service.ts
          participants.test.ts
        settlement/
          settlement.controller.ts
          settlement.service.ts
          settlement.state-machine.ts  ← typed state machine, invalid transitions fail to compile
          settlement.test.ts
        messages/
          messages.controller.ts
          messages.service.ts      ← A3 message package assembly
          messages.test.ts
        ai/
          receipt-parser.service.ts    ← A1: vision AI → items JSON
          split-calculator.service.ts  ← A2: items + participants → per-person amounts
          message-composer.service.ts  ← A3: per-person message packages
          ai.test.ts
        analytics/
          analytics.service.ts     ← writeEvent(), writeFunnelCheckpoint()
          analytics.test.ts
        notifications/
          notifications.service.ts ← Twilio calls, opt-out check (checkOptOut always runs first)
          notifications.test.ts
        jobs/
          nudge.scheduler.ts       ← enqueues QStash nudge job (T+48hr)
          nudge.controller.ts      ← consumer endpoint: POST /api/v1/jobs/nudge-check
          purge.controller.ts      ← consumer endpoint: POST /api/v1/jobs/purge-guest-pii
          partition.controller.ts  ← consumer endpoint: POST /api/v1/jobs/create-analytics-partition
          jobs.routes.ts
          qstash.receiver.ts       ← shared QStash signature verification
        webhooks/
          twilio-opt-out.controller.ts    ← handles Twilio STOP replies
          twilio-delivery.controller.ts   ← handles Twilio delivery status callbacks
      infrastructure/
        supabase.ts                ← Supabase client singleton (anon + service role)
        redis.ts                   ← Upstash Redis client singleton
        twilio.ts                  ← Twilio client singleton
        llm/
          factory.ts               ← createLLMProvider(): returns Gemini (dev) or Anthropic (prod)
          ai-audit.ts              ← writeAuditLog() — fire-and-forget, never throws, called with .catch(console.error)
          providers/
            gemini.adapter.ts      ← Gemini 2.5 Flash adapter (dev/staging)
            anthropic.adapter.ts   ← Claude Haiku 4.5 adapter (production)
        encryption.ts              ← AES-256-GCM encrypt/decrypt for payment handles
        errors.ts                  ← AppError base class (code, message, statusCode, isOperational) + Errors convenience constructors; caught by global error handler which converts isOperational errors to their statusCode and non-operational errors to 500
        logger.ts                  ← structured JSON logger, PII scrubbing
      middleware/
        authenticate.ts            ← JWT validation (runs on all authenticated routes)
        rate-limit.ts              ← per-endpoint rate limiting (Redis-backed)
        validate.ts                ← Zod input validation
        cors.ts                    ← CORS (allowedOrigins from env, never wildcard in prod)
        pii-scrubber.middleware.ts ← strips phones, names from all log output
      config/
        payment-methods.config.ts  ← payment deep link builders + country-provider mapping
      app.ts                       ← Express app setup
      server.ts                    ← HTTP server entry point
    package.json
    tsconfig.json                  ← strict: true
    jest.config.ts

  shared/                          ← Shared TypeScript types (no runtime code)
    types/
      auth.types.ts
      event.types.ts
      participant.types.ts         ← includes PaymentStatus union, SettlementTransition
      settlement.types.ts
      receipt.types.ts
      message.types.ts
      analytics.types.ts           ← AnalyticsEventName typed union (all event names)
      payment.types.ts
      api.types.ts                 ← request/response shapes for every endpoint
    package.json
    tsconfig.json

  docs/                            ← All project documentation
    01-PRD.md
    02-User-Flows.md
    03-System-Architecture.md      ← this file
    04-Setup-Guide.md
    06-Integration-Contracts.md
    07-AI-Agent-Specification.md
    08-Mobile-App-Specification.md
    09-Security-And-Privacy.md
    10-Engineering-Operations.md

  prototype/                       ← HTML prototypes (visual reference only — not deployed)

  supabase/                          ← at repo root (Supabase CLI requires migrations here)
    migrations/                      ← run `supabase migration up` from the repo root
      20260601000000_initial_schema.sql
      20260615000000_[next change].sql
    config.toml
    seed.sql

  .github/
    workflows/
      test.yml                     ← runs on every push (lint, typecheck, tests, npm audit)
      staging.yml                  ← auto-deploy to Railway staging on merge to develop
      production.yml               ← manual trigger only, requires "DEPLOY" confirmation input

  .gitignore                       ← never commit node_modules, dist, .expo, secrets
  .cursorrules                     ← Cursor session instructions (auto-injected)
  package.json                     ← monorepo root (workspaces: mobile, backend, shared)
```

### Key Module Relationships

The `backend/src/modules/` structure is organised by feature domain, not by file type. Each module is independently testable. The boundaries between modules are:

- `auth/` → used by all other modules via the `authenticate` middleware; calls nothing in domain modules
- `events/` → calls `notifications/` (welcome push on join), writes to `analytics/`
- `ai/` → calls `notifications/` (never directly), writes to database tables it owns (receipt_items, item_assignments), reads from `participants/` and `user_payment_handles`
- `settlement/` → calls `notifications/` (push on state transition), calls `jobs/` (schedule nudge), writes `settlement_log`
- `notifications/` → has no upstream callers within business logic; it is called by events, settlement, and jobs. It always calls `checkOptOut()` before Twilio. It calls nothing else.
- `analytics/` → called by all other modules (fire-and-forget); calls nothing

---

## 9. Cross-Cutting Concerns

### Error Handling Strategy

Every call to an external service (Twilio, Gemini, Anthropic, Supabase Storage, QStash) is wrapped in a typed error handler. The system never lets unhandled promise rejections or uncaught exceptions propagate to the HTTP response layer — they are caught, classified, and returned as structured error objects.

Typed error classes live in `backend/src/infrastructure/errors.ts`:
- `AppError` — base class for all custom errors: `code` (machine-readable string), `message`, `statusCode`, `isOperational`. The global error handler middleware converts `isOperational` errors to their `statusCode` and non-operational errors to 500.
- `Errors` — convenience constructors (static factory methods) for all standard error types
- `OptOutError` — thrown when a Twilio message is attempted to an opted-out number; caught by the Notification Service and recorded without crashing
- `RateLimitError` — thrown by rate-limiting middleware; returns HTTP 429 with `Retry-After` header
- `ValidationError` — thrown by Zod validation middleware; returns HTTP 400 with field-level error details
- `NotFoundError` — returns HTTP 404 with resource type
- `UnauthorizedError` — returns HTTP 401; triggers token refresh flow on mobile
- `AIParseError` — thrown by A1 when validation of the JSON response fails; triggers retry up to 3 times before surfacing a parse failure to the creator

`backend/src/infrastructure/llm/ai-audit.ts` exports `writeAuditLog()` — a fire-and-forget audit log writer that uses the service-role Supabase client. It never throws. All call sites use the `.catch(console.error)` pattern to prevent unhandled rejections without blocking the main flow.

API responses always follow a consistent shape: `{ data, error: { code, message } }`. Stack traces are never included in API responses. In production, errors are captured by Sentry with PII scrubbed from the breadcrumb trail.

### Logging

All application logs are structured JSON, written to stdout (Railway captures and displays these). Every log line includes: `level`, `timestamp`, `user_id` (UUID — never phone number), `event_id` (if applicable), `action`, `http_status` (if applicable).

The PII scrubbing middleware (`pii-scrubber.middleware.ts`) runs on all HTTP request/response logging before any log sink receives the data. Rules: replace E.164 phone patterns with `[PHONE REDACTED]`, replace field names `name`, `display_name`, `phone*` with `[REDACTED]`, replace 64-character hex strings (phone hashes) with `[HASH REDACTED]`. UUIDs (user_id, event_id, participant_id) are safe identifiers and are never redacted — they are needed for correlating logs during debugging.

Log retention: Railway 7-day rolling retention for application logs. Sentry error events retained per Sentry plan. Analytics events in the database are the long-term behavioural record.

### Analytics

Every significant user action fires an analytics event. This is not optional — analytics events are the only source of truth for product metrics, conversion funnels, and operational health KPIs. There are no dashboards or tracking pixels; all analytics are first-party and stored in the `analytics_events` table.

Client-side events use a typed `track()` hook that enforces event names against the `AnalyticsEventName` TypeScript union. Adding a new analytics event requires adding it to the union in `shared/types/analytics.types.ts` first — the compiler then flags every call site. Server-side events call `analytics.service.ts` directly. All analytics writes are fire-and-forget — they never block or delay the user action they accompany. If an analytics write fails, the failure is logged silently and the user action proceeds.

The `analytics_events` table is partitioned by month (`analytics_events_2026_05`, etc.) for query performance at scale. A QStash cron job runs on the 25th of each month to create the following month's partition. Funnel checkpoints in `funnel_checkpoints` track conversion at each step of the three primary funnels: Creator Activation (install → first settled event), Guest Conversion (SMS received → becomes a creator), and Browser Join Completion (QR scan → joined).

### TypeScript

TypeScript strict mode is enabled across all three packages (mobile, backend, shared). The `tsconfig.json` settings that are non-negotiable:

- `strict: true` — enables `strictNullChecks`, `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`
- `noUncheckedIndexedAccess: true` — array indexing returns `T | undefined`, preventing index-out-of-bounds bugs in financial calculations
- `exactOptionalPropertyTypes: true` — optional properties are exactly optional, not `T | undefined`
- `noImplicitReturns: true` — every code path in a function must return a value
- `noFallthroughCasesInSwitch: true` — prevents silent fall-through in the settlement state machine switch statements

The shared types package is the contract between layers. A `Participant` type defined once in `/shared/types/participant.types.ts` is used by the mobile UI, the backend service, the API response type, and the analytics event properties. A database schema change propagates to a shared type change, which the TypeScript compiler surfaces as errors in every call site. This is the system's primary defence against API contract drift between mobile and backend.

The rule on `any` is absolute: zero `any` types are permitted anywhere in the codebase. `@typescript-eslint/no-explicit-any` is enforced in the ESLint configuration. Every raw `fetch` call returns a typed response. Every external API response is validated with Zod before being used. Every database query result is typed against the schema types.

---

*This document is the authoritative reference for how LetsSplyt works as a system. Any architectural decision that changes what is described here must be reflected in this document before the change is implemented. If this document conflicts with 01-PRD.md, the decision recorded here is the current one.*
