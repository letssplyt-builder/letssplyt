# E11-S03–S07 — SMS Provider Migration
## Senior Software Engineer Implementation Specification

**Status:** Planning (pre-implementation)  
**Architecture reference:** `E11-S03-Architecture.md`  
**Operational reference:** `Telnyx-Setup-Guide.md`

This document is the **authoritative implementation checklist**. Each task has explicit files, dependencies, tests, and verification commands. Do not start coding until this spec and the architecture doc are agreed.

---

## Table of Contents

1. [Dependency graph](#1-dependency-graph)
2. [E11-S03 — SMS abstraction foundation](#2-e11-s03--sms-abstraction-foundation)
3. [E11-S04 — Custom OTP service](#3-e11-s04--custom-otp-service)
4. [E11-S05 — Telnyx provider + outbound migration](#4-e11-s05--telnyx-provider--outbound-migration)
5. [E11-S06 — Webhooks + inbound compliance](#5-e11-s06--webhooks--inbound-compliance)
6. [E11-S07 — Jobs, docs, smoke, rollout](#6-e11-s07--jobs-docs-smoke-rollout)
7. [Complete file manifest](#7-complete-file-manifest)
8. [Test matrix](#8-test-matrix)
9. [Verification commands](#9-verification-commands)
10. [Pre-implementation checklist for Pawan](#10-pre-implementation-checklist-for-pawan)

---

## 1. Dependency graph

```
E11-S03 (factory + Twilio provider + facade)
    │
    ├──► E11-S04 (OTP service — uses factory for send)
    │         │
    │         └──► E11-S05 (Telnyx provider — uses same factory)
    │                   │
    │                   └──► E11-S06 (webhooks need live messageIds from both providers)
    │                             │
    │                             └──► E11-S07 (cleanup job, docs, rollout)
```

**Rule:** Complete and test each story before the next. E11-S04 can ship with `SMS_PROVIDER=twilio` before Telnyx exists.

---

## 2. E11-S03 — SMS abstraction foundation

### 2.1 Goal

Introduce provider factory and Twilio adapter that **preserves 100% of current** `twilio-messaging.ts` behavior. No OTP or Telnyx changes in this story.

### 2.2 Tasks

#### T-S03-01 — Install dependencies

```bash
cd backend && npm install telnyx
```

- Verify `telnyx` in `backend/package.json` dependencies (Telnyx provider class stubbed or not exported until S05 — OK to add package now).

#### T-S03-02 — Create SMS module skeleton

| File | Action |
|---|---|
| `backend/src/infrastructure/sms/types.ts` | Create `MessageChannel`, `SendOutboundMessageParams`, `SendOutboundMessageResult`, `SMSProvider` |
| `backend/src/infrastructure/sms/factory.ts` | `createSMSProvider()`, `resetSMSProvider()` singleton |
| `backend/src/infrastructure/sms/providers/twilio.provider.ts` | Implement `TwilioSMSProvider` |
| `backend/src/infrastructure/sms/providers/telnyx.provider.ts` | **Stub only** — `throw new Error('Telnyx provider not configured until E11-S05')` OR empty class not registered in factory yet |

**TwilioSMSProvider implementation notes:**

- Move logic from `twilio-messaging.ts` verbatim:
  - `TWILIO_PHONE_NUMBER` (not `TWILIO_FROM_NUMBER`)
  - `TWILIO_WHATSAPP_NUMBER`
  - WhatsApp-first with SMS fallback for `preferredChannel === 'whatsapp'`
  - `statusCallback` when `statusCallbackUrl` provided and `APP_URL` is public HTTPS
- Use `twilioClient` from `infrastructure/twilio.ts` (keep singleton client for now)
- Return `{ messageId: message.sid, channel }`

#### T-S03-03 — Outbound messaging facade

| File | Action |
|---|---|
| `backend/src/infrastructure/notification/outbound-messaging.service.ts` | Create |

```typescript
export interface OutboundMessageResult {
  messageId: string;
  channel: MessageChannel;
}

export async function sendOutboundMessage(
  phoneE164: string,
  preferredChannel: MessageChannel,
  body: string,
): Promise<OutboundMessageResult>
```

Implementation:
1. If `isMessagingDevBypassEnabled()` → `createDevBypassMessageSid()` + return preferred channel normalized
2. `const provider = createSMSProvider()`
3. Build `statusCallbackUrl`:
   - `twilio` → `{APP_URL}/api/v1/webhooks/twilio/delivery`
   - `telnyx` → `{APP_URL}/api/v1/webhooks/telnyx/messaging` (used in S05)
4. Call `provider.sendOutboundMessage({ toE164: phoneE164, body, preferredChannel, statusCallbackUrl })`
5. Do not retain `phoneE164` in closure after return

#### T-S03-04 — Wire factory default

- `process.env.SMS_PROVIDER ?? 'twilio'`
- Unknown value → throw at factory init (fail fast on boot if misconfigured)

#### T-S03-05 — Deprecate direct import path (no callers yet)

- Add comment atop `twilio-messaging.ts`: `@deprecated use outbound-messaging.service`
- **Do not delete** `twilio-messaging.ts` until S05 migrates callers

#### T-S03-06 — Unit tests

| Test file | Cases |
|---|---|
| `backend/src/__tests__/unit/infrastructure/sms/factory.test.ts` | default twilio; telnyx throws or not registered; unknown throws; singleton; reset |
| `backend/src/__tests__/unit/infrastructure/sms/providers/twilio.provider.test.ts` | SMS US; WhatsApp path; WhatsApp fail → SMS fallback; statusCallback omitted on localhost; returns sid |
| `backend/src/__tests__/unit/infrastructure/notification/outbound-messaging.service.test.ts` | dev bypass; delegates to factory; builds correct callback URL |

#### T-S03-07 — Mock updates

| File | Action |
|---|---|
| `backend/src/__tests__/mocks/twilio.mock.ts` | Ensure messages.create still mocked for Twilio provider tests |
| `backend/src/__tests__/setup.ts` | Add `process.env.SMS_PROVIDER = 'twilio'` |

### 2.3 Acceptance criteria (E11-S03)

- [ ] `npm run build` in `backend/` passes
- [ ] All new unit tests pass
- [ ] `grep -r "new TwilioSMSProvider\|new TelnyxSMSProvider" backend/src` → only `factory.ts`
- [ ] **No production call sites changed yet** — send.service still uses `sendTwilioMessage` (intentional)
- [ ] Existing full backend test suite still green

### 2.4 Definition of done

Pawan confirms S03 → mark `[x]` in BUILD-PROGRESS, commit `E11-S03: SMS provider abstraction foundation`.

---

## 3. E11-S04 — Custom OTP service

### 3.1 Goal

Replace Twilio Verify in **both** `auth.service.ts` and `join-otp.ts` with shared `otp.service.ts`. OTP delivered via `createSMSProvider()` (Twilio transport when `SMS_PROVIDER=twilio`).

### 3.2 Tasks

#### T-S04-01 — Migration

| File | Content |
|---|---|
| `supabase/migrations/20260623000000_otp_verifications.sql` | Table per architecture doc §5.2 |

Run locally: `supabase db push` (or migration repair if needed).

Update `backend/src/__tests__/unit/migrations/migration-manifest.test.ts` if manifest test exists.

#### T-S04-02 — OTP service

| File | Action |
|---|---|
| `backend/src/infrastructure/otp/otp.service.ts` | Create |

**Constants:** `OTP_TTL_MINUTES = 10`, `OTP_MAX_ATTEMPTS = 5`

**`hashOtpCode(code: string)`:** `crypto.createHmac('sha256', process.env.PII_HMAC_SALT!).update(code).digest('hex')`

**`sendOTP(phoneHash: string, phoneE164: string, options?: { channel?: MessageChannel })`:**

1. **Do not** implement DB rate limit counter — rely on caller’s `checkOtpRequestRate`
2. Delete unused OTP rows: `phone_hash` match, `verified_at` IS NULL
3. `crypto.randomInt(100000, 999999)` → string code
4. INSERT `otp_verifications`
5. Build SMS body: `Your LetsSplyt verification code is: ${code}. Valid for 10 minutes. Reply STOP to opt out.`
6. `createSMSProvider().sendOutboundMessage({ toE164: phoneE164, body, preferredChannel: 'sms' })` — OTP always SMS
7. Never log code or phoneE164

**`verifyOTP(phoneHash: string, code: string): Promise<void>`:**

| Case | Throw |
|---|---|
| No row / expired | `AppError('CODE_EXPIRED', ..., 400)` |
| `attempt_count >= 5` | Delete row → `AppError('OTP_MAX_ATTEMPTS', ..., 429)` |
| Wrong code | Increment attempt → `AppError('INVALID_CODE', ..., 400)` |
| Correct | Delete row → return |

**`purgeExpiredOTPs(): Promise<number>`** — delete where `expires_at < now()` and `verified_at` IS NULL

#### T-S04-03 — Auth service integration

| File | Remove | Add |
|---|---|---|
| `auth.service.ts` | `twilioClient.verify.*`, `verifyTwilioCode`, `getVerifyServiceSid` imports for OTP | `sendOTP`, `verifyOTP` from otp.service |

**`sendOtp()` changes:**

- After rate limit + opt-out checks + dev bypass block:
  - `await sendOTP(phoneHash, phoneE164)` 
  - Return `{ sent: true, channel: 'sms', expires_in_seconds: 600, account_exists }`
- Remove WhatsApp Verify channel fallback (60212) — document: custom OTP is SMS-only
- If client sends `channel: 'whatsapp'`, still send SMS; optionally log info (do not fail)

**`verifyOtpAndCreateSession()` changes:**

- Replace `verifyTwilioCode` with `verifyOTP` in try/catch — map thrown codes (already correct AppErrors)
- Keep `recordFailedOtpVerify` on `INVALID_CODE` if currently wired

#### T-S04-04 — Join OTP integration

| File | Action |
|---|---|
| `join-otp.ts` | Replace Twilio Verify with `sendOTP` / `verifyOTP` |

**`sendOtp(phoneE164)`:**

- Keep opt-out + rate limit + dev bypass
- Call `sendOTP(phoneHash, phoneE164)`
- On provider failure → `{ sent: false, reason: 'OTP_UNAVAILABLE' }` (catch non-AppError)

**`verifyTwilioCodeForJoin` → rename to `verifyOtpCodeForJoin`:**

- Dev bypass: `/^[0-9]{6}$/`
- Live: `try { await verifyOTP(phoneHash, code); return true } catch { return false }` for join flow OR propagate `CODE_EXPIRED` etc. if web join should show errors — **check join-web.service.ts**

Read `join-web.service.ts`: if join only checks boolean, keep boolean wrapper; if it needs error messages, align with web HTML error display.

#### T-S04-05 — Cleanup twilio.ts

| File | Action |
|---|---|
| `infrastructure/twilio.ts` | Remove `getVerifyServiceSid`, `TWILIO_TEST_VERIFY_SERVICE_SID`, `TWILIO_VERIFY_SERVICE_SID` export |
| Keep | `twilioClient` for TwilioSMSProvider |

#### T-S04-06 — Env cleanup

| File | Action |
|---|---|
| `backend/.env.example` | Remove `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_USE_LIVE_VERIFY`; add `SMS_PROVIDER=twilio` |
| `backend/src/__tests__/setup.ts` | Remove `TWILIO_VERIFY_SERVICE_SID` |

#### T-S04-07 — Unit & integration tests

| Test file | Cases |
|---|---|
| `backend/src/__tests__/unit/infrastructure/otp/otp.service.test.ts` | 9 cases from refactor doc + exact error codes |
| `backend/src/__tests__/unit/auth/auth.service.test.ts` | Update mocks: no Twilio Verify; mock `sendOTP`/`verifyOTP` or factory |
| `backend/src/__tests__/integration/auth/otp-verify.test.ts` | INVALID_CODE, CODE_EXPIRED, OTP_MAX_ATTEMPTS |
| `backend/src/__tests__/unit/join/join.service.test.ts` | Join OTP uses otp.service |
| `backend/src/__tests__/integration/join/web-join.test.ts` | Web join OTP flow |
| `backend/src/__tests__/unit/infrastructure/twilio.test.ts` | **Delete** or rewrite — only client smoke if needed |

#### T-S04-08 — Grep gate

```bash
grep -r "TWILIO_VERIFY\|verify\.v2\|getVerifyServiceSid" backend/src
# Must return nothing outside __tests__ archives (or zero)
```

### 3.3 Acceptance criteria (E11-S04)

- [ ] `supabase db push` applies `otp_verifications` migration
- [ ] App OTP request + verify work with dev bypass (any 6 digits)
- [ ] Web join OTP send + verify work in integration tests
- [ ] Error codes: `INVALID_CODE`, `CODE_EXPIRED`, `OTP_MAX_ATTEMPTS`, `OTP_RATE_LIMITED` unchanged
- [ ] No `TWILIO_VERIFY_SERVICE_SID` in backend source
- [ ] OTP codes never stored plaintext in DB (verify via unit test inspecting insert payload)
- [ ] Full backend test suite green

---

## 4. E11-S05 — Telnyx provider + outbound migration

### 4.1 Goal

Implement `TelnyxSMSProvider`, register in factory, migrate all `sendTwilioMessage` call sites to `sendOutboundMessage`.

### 4.2 Tasks

#### T-S05-01 — Telnyx provider

| File | Action |
|---|---|
| `backend/src/infrastructure/sms/providers/telnyx.provider.ts` | Full implementation |

```typescript
// telnyx v6 API
const response = await this.client.messages.send({
  from: this.fromNumber,
  to: params.toE164,
  text: params.body,
});
const messageId = response.data?.id ?? response.id; // verify against installed SDK in unit test
```

**Behavior:**

- `preferredChannel === 'whatsapp'` → log warn once, send SMS anyway
- `statusCallbackUrl` → Telnyx uses Messaging Profile webhook (not per-message param); no-op in provider but document in comment
- Map Telnyx errors to thrown `AppError` or let bubble with logging:
  - 401 → misconfiguration
  - 403 → number not on profile
  - 422 → `INVALID_PHONE`
  - 429 → retry guidance in logs

Env: `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`

#### T-S05-02 — Factory registration

```typescript
case 'telnyx':
  instance = new TelnyxSMSProvider();
  break;
```

#### T-S05-03 — Migrate call sites

| File | Change |
|---|---|
| `send.service.ts` | `sendTwilioMessage` → `sendOutboundMessage` (2 call sites) |
| `settlement.service.ts` | Same (nudge path) |
| Update result typing | `twilioResult.sid` → `result.messageId` locally, still store as `twilio_sid` in DB |

#### T-S05-04 — Remove deprecated module

| File | Action |
|---|---|
| `twilio-messaging.ts` | Delete after migration OR re-export from facade for one release — prefer **delete** if all callers migrated |

#### T-S05-05 — Tests

| Test file | Cases |
|---|---|
| `telnyx.provider.test.ts` | send params; messageId; missing env throws |
| `send.service.test.ts` | Mock `sendOutboundMessage` instead of `sendTwilioMessage` |
| `settlement.service.test.ts` | Same |
| `factory.test.ts` | Telnyx instance when env set |

#### T-S05-06 — Manual dev test (document in story notes)

Per `Telnyx-Setup-Guide.md` §3.6 — on-net two Telnyx numbers, `SMS_PROVIDER=telnyx`.

### 4.3 Acceptance criteria (E11-S05)

- [ ] `SMS_PROVIDER=telnyx` → payment send + nudge use Telnyx SDK (mocked in CI)
- [ ] `SMS_PROVIDER=twilio` → behavior identical to pre-migration (including WhatsApp routing)
- [ ] `grep sendTwilioMessage backend/src` → zero (except tests/comments)
- [ ] notification_log rows populated with Telnyx message IDs when on Telnyx
- [ ] Full backend test suite green

---

## 5. E11-S06 — Webhooks + inbound compliance

### 5.1 Goal

Delivery tracking and STOP/START work for **both** providers. Telnyx webhook reaches parity with Twilio controller.

### 5.2 Tasks

#### T-S06-01 — Shared delivery service

| File | Action |
|---|---|
| `backend/src/infrastructure/notification/messaging-delivery.service.ts` | Create `applyDeliveryUpdate(messageId, mappedStatus)` |

Extract body from `twilio.controller.ts` lines 81–122.

#### T-S06-02 — Refactor Twilio controller

| File | Action |
|---|---|
| `twilio.controller.ts` | `handleTwilioDelivery` → parse Twilio payload, call `applyDeliveryUpdate` |

No behavior change — existing tests must pass unchanged.

#### T-S06-03 — START opt-in (new)

| File | Action |
|---|---|
| `backend/src/infrastructure/notification/process-sms-opt-in.ts` | Create `processSmsStartOptIn(phoneE164)` |

Actions:
1. DELETE from `sms_opt_outs` where `phone_hash`
2. UPDATE `users` SET `is_opted_out = false` where `phone_hash`
3. Do **not** auto-revert `participants.payment_status` from `opted_out` (user must re-join event) — document this product rule

#### T-S06-04 — Shared inbound service

| File | Action |
|---|---|
| `backend/src/infrastructure/notification/messaging-inbound.service.ts` | Create |

```typescript
export async function handleInboundSmsKeyword(fromE164: string, body: string): Promise<InboundSmsAction>
```

Normalize body: trim, uppercase, first word.

| Keyword set | Handler |
|---|---|
| STOP variants | `processSmsStopOptOut` |
| START, UNSTOP | `processSmsStartOptIn` |
| HELP, INFO | `{ type: 'help' }` |

Refactor `twilio.controller.ts` `handleTwilioOptOut` to use inbound service for STOP (keep TwiML response).

#### T-S06-05 — Telnyx webhook controller

| File | Action |
|---|---|
| `backend/src/modules/webhooks/telnyx.controller.ts` | Create handlers |
| `backend/src/modules/webhooks/telnyx.routes.ts` | Router |
| `backend/src/middleware/telnyx-ip-guard.ts` | IP allowlist (optional skip when `APP_ENV=development`) |

Routes:
- `POST /messaging` on router mounted at `/api/v1/webhooks/telnyx` and `/webhooks/telnyx`

**Telnyx event types:**

| `event_type` | Action |
|---|---|
| `message.finalized` | Map status → `applyDeliveryUpdate` |
| `message.received` | Parse `from`, `text` → `handleInboundSmsKeyword` → plain text reply |
| Others | 200 ignore |

**Inbound reply text (not TwiML):**

- STOP: `You have been unsubscribed from LetsSplyt notifications. Reply START to resubscribe.`
- START: `You have been resubscribed to LetsSplyt SMS notifications.`
- HELP: `LetsSplyt help: builder@letssplyt.com. Reply STOP to opt out.`

Telnyx may require specific response format — verify Telnyx docs for inbound MO reply; adjust controller to return JSON or plain text per API.

#### T-S06-06 — Register routes

| File | Action |
|---|---|
| `app.ts` | `app.use('/api/v1/webhooks/telnyx', telnyxWebhookRouter)` and `/webhooks/telnyx` mirror |

#### T-S06-07 — Tests

| Test file | Cases |
|---|---|
| `messaging-delivery.service.test.ts` | delivered updates participant; failed sets message_failed |
| `process-sms-opt-in.test.ts` | START removes sms_opt_outs row |
| `messaging-inbound.service.test.ts` | STOP/START/HELP keyword parsing |
| `telnyx.webhook.test.ts` | finalized delivered; inbound STOP; invalid IP 403 |
| `twilio.webhook.test.ts` | Still passes (regression) |

#### T-S06-08 — Settlement log metadata

Update `processSmsStopOptOut` metadata `changed_by: 'twilio_stop'` → `'sms_stop'` (or keep for backward compat — prefer generic `'sms_stop'`).

### 5.3 Acceptance criteria (E11-S06)

- [ ] Telnyx `message.finalized` delivered → `participants.message_delivered_at` set (integration test with mocked DB)
- [ ] Telnyx inbound STOP → `sms_opt_outs` row + Twilio STOP still works
- [ ] Telnyx inbound START → opt-out removed
- [ ] DeliveryTrackingScreen realtime path unchanged (manual or component test note)
- [ ] Webhook responds < 5s (200 immediately for Telnyx if processing async)
- [ ] Full backend test suite green

---

## 6. E11-S07 — Jobs, docs, smoke, rollout

### 6.1 Goal

Operational completeness: cleanup job, documentation, smoke scripts, legal sync, rollout checklist.

### 6.2 Tasks

#### T-S07-01 — QStash OTP cleanup job

| File | Action |
|---|---|
| `backend/src/modules/jobs/purge-otp.job.ts` | Handler calling `purgeExpiredOTPs` |
| `jobs.controller.ts` | Export handler |
| `jobs.routes.ts` | `POST /purge-expired-otps` + `verifyQStashMiddleware` |

Schedule in QStash dashboard: `*/15 * * * *` → `{APP_URL}/api/v1/jobs/purge-expired-otps`

#### T-S07-02 — Documentation updates

| Document | Sections to update |
|---|---|
| `docs/06-Integration-Contracts.md` | Replace Twilio Verify section with Custom OTP + SMS Provider factory; add Telnyx Integration 3; update env vars |
| `docs/03-System-Architecture.md` | Messaging layer diagram |
| `docs/04-Data-Architecture.md` | `otp_verifications` table |
| `docs/05-API-Specification.md` | OTP section — remove Twilio Verify references |
| `docs/09-Security-And-Privacy.md` | OTP hashing, Telnyx as subprocessor |
| `docs/10-Engineering-Operations.md` | Health check SMS provider probe note for E12 |
| `docs/11-Setup-Guide.md` | Doppler vars |
| `CLAUDE.md` | SMS factory in tech stack bullet |

#### T-S07-03 — Legal content sync

| File | Action |
|---|---|
| `mobile/scripts/sync-legal-docs.mjs` | Add Telnyx Privacy/Terms sources OR merge Telnyx processor into main legal docs |
| Run sync | Update `privacyPolicySections.ts` if switching to Telnyx variant for production |

**Decision point for Pawan:** Ship Telnyx Privacy variant at Telnyx switch date.

#### T-S07-04 — Smoke scripts

| Script | Updates |
|---|---|
| `backend/scripts/smoke-messages-preview.ts` | Works with `SMS_PROVIDER`; note Telnyx on-net numbers in dev |
| Add `backend/scripts/smoke-otp-telnyx.ts` (optional) | Request OTP + verify against dev second number |

#### T-S07-05 — CI / test setup

| File | Action |
|---|---|
| `backend/src/__tests__/setup.ts` | `SMS_PROVIDER=twilio` default; Telnyx tests set env locally |
| `backend/src/__tests__/mocks/telnyx.mock.ts` | Optional mock module |

#### T-S07-06 — Rollout checklist (run per environment)

Copy from `Telnyx-Setup-Guide.md` §9 + architecture §10.

#### T-S07-07 — E12-S01 coordination note

Add to `12-Build-Sequence.md` E12-S01 prompt:

> Health check `sms` probe: if `SMS_PROVIDER=twilio` check Twilio account; if `telnyx` check Telnyx API. Report `checks.sms_provider` and `checks.sms: ok|error`.

### 6.3 Acceptance criteria (E11-S07)

- [ ] QStash job registered and returns `{ ok: true, deleted: N }`
- [ ] `docs/06-Integration-Contracts.md` describes factory + both providers
- [ ] `grep TWILIO_VERIFY backend` → empty
- [ ] Smoke script passes on dev with `SMS_PROVIDER=telnyx` (on-net) OR documented skip
- [ ] Rollout checklist attached in BUILD-PROGRESS notes
- [ ] Full backend + mobile test suites green (mobile unchanged — should be identical)

---

## 7. Complete file manifest

### New files

```
backend/src/infrastructure/sms/types.ts
backend/src/infrastructure/sms/factory.ts
backend/src/infrastructure/sms/providers/twilio.provider.ts
backend/src/infrastructure/sms/providers/telnyx.provider.ts
backend/src/infrastructure/otp/otp.service.ts
backend/src/infrastructure/notification/outbound-messaging.service.ts
backend/src/infrastructure/notification/messaging-delivery.service.ts
backend/src/infrastructure/notification/messaging-inbound.service.ts
backend/src/infrastructure/notification/process-sms-opt-in.ts
backend/src/middleware/telnyx-ip-guard.ts
backend/src/modules/webhooks/telnyx.controller.ts
backend/src/modules/webhooks/telnyx.routes.ts
backend/src/modules/jobs/purge-otp.job.ts
supabase/migrations/20260623000000_otp_verifications.sql

backend/src/__tests__/unit/infrastructure/sms/factory.test.ts
backend/src/__tests__/unit/infrastructure/sms/providers/twilio.provider.test.ts
backend/src/__tests__/unit/infrastructure/sms/providers/telnyx.provider.test.ts
backend/src/__tests__/unit/infrastructure/otp/otp.service.test.ts
backend/src/__tests__/unit/infrastructure/notification/outbound-messaging.service.test.ts
backend/src/__tests__/unit/infrastructure/notification/messaging-delivery.service.test.ts
backend/src/__tests__/unit/infrastructure/notification/messaging-inbound.service.test.ts
backend/src/__tests__/unit/infrastructure/notification/process-sms-opt-in.test.ts
backend/src/__tests__/unit/webhooks/telnyx.webhook.test.ts
backend/src/__tests__/mocks/telnyx.mock.ts (optional)
```

### Modified files

```
backend/src/modules/auth/auth.service.ts
backend/src/modules/join/join-otp.ts
backend/src/modules/messages/send.service.ts
backend/src/modules/settlement/settlement.service.ts
backend/src/modules/webhooks/twilio.controller.ts
backend/src/infrastructure/twilio.ts
backend/src/infrastructure/notification/process-sms-opt-out.ts (metadata)
backend/src/app.ts
backend/src/modules/jobs/jobs.routes.ts
backend/src/modules/jobs/jobs.controller.ts
backend/package.json
backend/.env.example
backend/src/__tests__/setup.ts
backend/src/__tests__/unit/auth/auth.service.test.ts
backend/src/__tests__/integration/auth/otp-verify.test.ts
backend/src/__tests__/unit/join/join.service.test.ts
backend/src/__tests__/integration/join/web-join.test.ts
backend/src/__tests__/unit/messages/send.service.test.ts
backend/src/__tests__/unit/settlement/settlement.service.test.ts
backend/src/__tests__/unit/webhooks/twilio.webhook.test.ts
backend/scripts/smoke-messages-preview.ts
docs/06-Integration-Contracts.md (+ others listed in T-S07-02)
docs/12-Build-Sequence.md
BUILD-PROGRESS.md
```

### Deleted files (E11-S05)

```
backend/src/infrastructure/notification/twilio-messaging.ts
backend/src/__tests__/unit/infrastructure/twilio.test.ts (if Verify-only)
```

---

## 8. Test matrix

| Area | Unit | Integration | Manual |
|---|---|---|---|
| SMS factory | factory.test.ts | — | — |
| Twilio provider | twilio.provider.test.ts | — | Twilio test creds (optional) |
| Telnyx provider | telnyx.provider.test.ts | — | On-net dev numbers |
| Outbound facade | outbound-messaging.test.ts | messages-send integration | smoke-messages-preview |
| OTP service | otp.service.test.ts | otp-verify.test.ts | Dev bypass |
| Auth OTP | auth.service.test.ts | otp-verify.test.ts | Physical device |
| Join OTP | join.service.test.ts | web-join.test.ts | Web join page |
| Twilio webhooks | twilio.webhook.test.ts | — | ngrok + Twilio console |
| Telnyx webhooks | telnyx.webhook.test.ts | — | ngrok + Telnyx log |
| START opt-in | process-sms-opt-in.test.ts | — | Reply START staging |
| Nudge SMS | settlement.service.test.ts | settlement.test.ts | — |
| Mobile | — | — | No changes — regression only |

**Coverage targets:** `otp.service.ts` — aim for 100% branch coverage (security-sensitive). Factory/providers — all branches.

---

## 9. Verification commands

Run after each story:

```bash
# Backend unit + integration
cd backend && npm test

# TypeScript
cd backend && npm run build

# Grep gates (after S04)
grep -r "TWILIO_VERIFY\|verify\.v2" backend/src --include='*.ts' | grep -v __tests__

# Grep gates (after S05)
grep -r "sendTwilioMessage" backend/src --include='*.ts' | grep -v __tests__

# Grep gates (after S03)
grep -r "new TwilioSMSProvider\|new TelnyxSMSProvider" backend/src --include='*.ts' | grep -v factory.ts

# Mobile regression
cd mobile && npm test
```

---

## 10. Pre-implementation checklist for Pawan

Before agent starts E11-S03 code:

- [ ] **Product sign-off:** Telnyx = SMS-only for international (no WhatsApp) when `SMS_PROVIDER=telnyx`
- [ ] **Product sign-off:** Custom OTP = SMS-only (no WhatsApp OTP) for all providers
- [ ] **Product sign-off:** START re-subscribe does not auto-reactivate event participants
- [ ] Telnyx account created; dev API key in Doppler (can wait until S05)
- [ ] Two Telnyx dev numbers purchased (on-net testing)
- [ ] Decide legal doc switch date for Telnyx Privacy variant
- [ ] Confirm Epic 11 story split (S03–S07) before E12-S01

---

*Document version: 1.0 — 2026-06-07*
