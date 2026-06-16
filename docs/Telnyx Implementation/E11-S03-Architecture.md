# E11-S03 — SMS Provider Abstraction & Telnyx Migration
## Architecture Document

**Status:** Planning (pre-implementation)  
**Epic:** E11 — Account Management (extended)  
**Stories:** E11-S03 through E11-S07  
**Audience:** Product, architecture review, implementation agents  
**Related:** `Telnyx-Setup-Guide.md`, `SMS-Provider-Refactor-Cursor.md`, `docs/06-Integration-Contracts.md`

---

## 1. Problem Statement

LetsSplyt’s backend hardcodes Twilio in three places:

| Capability | Current implementation | Cost driver |
|---|---|---|
| OTP (app auth) | Twilio Verify API | ~$0.058 / verification |
| OTP (web join) | Twilio Verify API (separate module) | Same |
| Payment / nudge SMS | Twilio Programmable Messaging (+ WhatsApp fallback) | ~$0.0079 / SMS segment |

As usage grows, Twilio Verify dominates OTP cost. Telnyx offers ~$0.004/SMS with no separate “verify” product — custom OTP + Telnyx SMS is ~93% cheaper for OTP.

**Goal:** Introduce a **provider-agnostic messaging layer** so `SMS_PROVIDER=twilio|telnyx` switches transport with **zero mobile changes** and **zero API contract changes**.

---

## 2. Design Principles

1. **Single factory** — `createSMSProvider()` is the only place providers are instantiated (mirrors `createLLMProvider()`).
2. **Separate concerns** — OTP *logic* (generate, hash, verify, rate-limit) lives in `otp.service.ts`; OTP *delivery* uses the SMS provider.
3. **Transport vs compliance** — Delivery status and STOP/START handling are shared services; each provider has a thin webhook adapter.
4. **Backward compatibility** — `SMS_PROVIDER=twilio` preserves today’s behavior including WhatsApp-first for international numbers.
5. **Fail-safe rollout** — Twilio remains configured in Doppler as fallback until Telnyx is validated per environment.
6. **No PII in logs** — Phone numbers and OTP codes never logged; only `messageId`, `phoneHash`, error codes.

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│  auth.service.ts          join-otp.ts                                   │
│       │                        │                                        │
│       └──────────┬─────────────┘                                        │
│                  ▼                                                      │
│         otp.service.ts  (sendOTP / verifyOTP / purgeExpiredOTPs)        │
│                  │                                                      │
│  send.service.ts │  settlement.service.ts (nudges)                     │
│       │          │                                                      │
│       └──────────┴──────────► outbound-messaging.service.ts           │
│                               (dev bypass, statusCallback URL)          │
│                                      │                                  │
├──────────────────────────────────────┼──────────────────────────────────┤
│                         ABSTRACTION  ▼                                  │
│                    createSMSProvider()  ◄── SMS_PROVIDER env            │
│                           │                                             │
│              ┌────────────┴────────────┐                                │
│              ▼                         ▼                                │
│     TwilioSMSProvider          TelnyxSMSProvider                        │
│     (SMS + WhatsApp)           (SMS only)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                         WEBHOOK LAYER                                   │
│  POST /api/v1/webhooks/twilio/*     POST /api/v1/webhooks/telnyx/*      │
│  (signature validate)               (IP allowlist + optional Ed25519)   │
│       │                                    │                            │
│       └────────────┬───────────────────────┘                            │
│                    ▼                                                    │
│     messaging-delivery.service.ts   messaging-inbound.service.ts        │
│     (notification_log + participants)  (STOP / START / HELP)            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Interfaces

### 4.1 `SMSProvider` (outbound transport)

Located: `backend/src/infrastructure/sms/types.ts`

```typescript
export type MessageChannel = 'sms' | 'whatsapp';

export interface SendOutboundMessageParams {
  toE164: string;           // E.164, decrypted just before call
  body: string;
  preferredChannel: MessageChannel;
  statusCallbackUrl?: string; // Provider posts delivery updates here
}

export interface SendOutboundMessageResult {
  messageId: string;          // Stored in notification_log.twilio_sid (provider-agnostic ID)
  channel: MessageChannel;    // Actual channel used after fallback
}

export interface SMSProvider {
  readonly name: 'twilio' | 'telnyx';
  sendOutboundMessage(params: SendOutboundMessageParams): Promise<SendOutboundMessageResult>;
}
```

**Why not `sendSMS(to, body)` only?**  
Payment messages use WhatsApp-first routing for non-US numbers when on Twilio. The interface must carry `preferredChannel` and return `actualChannel` so `notification_log.channel` and `participants.message_channel` stay accurate.

### 4.2 Provider capabilities matrix

| Capability | TwilioSMSProvider | TelnyxSMSProvider |
|---|---|---|
| US/CA SMS | ✓ `TWILIO_PHONE_NUMBER` | ✓ `TELNYX_FROM_NUMBER` |
| International SMS | ✓ | ✓ (carrier rates apply) |
| WhatsApp | ✓ `TWILIO_WHATSAPP_NUMBER` + SMS fallback | ✗ — always SMS |
| Delivery callback URL | ✓ per-message `statusCallback` | ✓ Telnyx webhook on Messaging Profile |
| OTP via Verify API | ✗ (removed — custom OTP) | ✗ |

**Product decision (v1 Telnyx):** When `SMS_PROVIDER=telnyx`, international participants receive **SMS only** (no WhatsApp). US MVP focus; document in Privacy Policy. Twilio path unchanged.

### 4.3 `OutboundMessagingService` (facade)

Located: `backend/src/infrastructure/notification/outbound-messaging.service.ts`

Single entry point replacing `sendTwilioMessage()`:

- Applies `isMessagingDevBypassEnabled()` → synthetic `messageId`
- Builds provider-specific `statusCallbackUrl` from `APP_URL` + active provider
- Calls `createSMSProvider().sendOutboundMessage()`
- **Never** stores `phoneE164` beyond the synchronous call stack

---

## 5. OTP Architecture (replaces Twilio Verify)

### 5.1 Flow

```
POST /auth/otp/request
  → normalise phone, hashPhone → phoneHash
  → check sms_opt_outs
  → checkOtpRequestRate(phoneHash)     [existing in-memory limiter]
  → otp.service.sendOTP(phoneHash, phoneE164)
       → generate crypto.randomInt 6-digit code
       → hash code with HMAC-SHA256(PII_HMAC_SALT)
       → INSERT otp_verifications (delete prior unused rows for phone)
       → createSMSProvider().sendOutboundMessage({ preferredChannel: sms })
  → return { sent, channel, expires_in_seconds: 600 }

POST /auth/otp/verify
  → otp.service.verifyOTP(phoneHash, code)
       → throws AppError with EXISTING codes (see §5.3)
  → session creation (unchanged)
```

Web join (`join-otp.ts`) calls the **same** `otp.service` — no duplicate OTP implementation.

### 5.2 Database: `otp_verifications`

| Column | Purpose |
|---|---|
| `phone_hash` | Lookup key (HMAC from `hashPhone`) |
| `code_hash` | HMAC-SHA256 of 6-digit code — never plaintext |
| `expires_at` | 10 minutes from creation |
| `attempt_count` | Wrong guesses (max 5) |
| `verified_at` | Unused in MVP — row deleted on success |

RLS enabled, **no user policies** — service role only.

Indexes: `phone_hash`, `expires_at` (cleanup job).

### 5.3 Error code contract (must not change)

Mobile (`OTPVerifyScreen`, `api.ts`) and API spec depend on these:

| Condition | HTTP | `error.code` |
|---|---|---|
| Wrong code | 400 | `INVALID_CODE` |
| Expired / no row | 400 | `CODE_EXPIRED` |
| Max verify attempts | 429 | `OTP_MAX_ATTEMPTS` |
| Rate limited (request) | 429 | `OTP_RATE_LIMITED` |
| Opted out | 200 body | `reason: OTP_UNAVAILABLE` on request |
| Send failure | 503 | `OTP_UNAVAILABLE` |

`verifyOTP()` throws `AppError` with these codes — **not** generic 401 Unauthorized.

### 5.4 Rate limiting strategy

| Layer | Mechanism | Scope |
|---|---|---|
| IP | `authRateLimiter` on auth routes | Per IP |
| Phone request | `checkOtpRequestRate(phoneHash)` in-memory | 5/hour |
| Phone verify | `recordFailedOtpVerify(phoneHash)` in-memory | Existing |
| OTP attempts | `otp_verifications.attempt_count` | 5 per code |

**Do not** add a second DB-based OTP request counter in `otp.service` — duplicates in-memory limiter and causes confusing double limits.

### 5.5 Dev bypass (unchanged behavior)

| Flag / condition | OTP send | OTP verify | Messaging |
|---|---|---|---|
| `isOtpDevBypassEnabled()` | Skip send, log phoneHash | Any 6-digit code | N/A |
| `isMessagingDevBypassEnabled()` | N/A | N/A | Skip send, fake SID |

WhatsApp channel on auth OTP request: when bypass active, return `channel: 'sms'`. When live on Twilio, Twilio may return `whatsapp` — custom OTP always sends SMS for codes (WhatsApp OTP removed with Verify).

**Auth OTP channel parameter:** `sendOtp(phone, channel)` — for custom OTP, `channel` only affects **response metadata** when we cannot honor WhatsApp; log if `channel === 'whatsapp'` and provider is Telnyx or custom OTP (SMS-only). Mobile may still show “sent via WhatsApp” only when Twilio path existed — with custom OTP, always SMS.

---

## 6. Outbound Messaging (payment + nudge)

### 6.1 Call sites (all must migrate)

| File | Function | Notes |
|---|---|---|
| `send.service.ts` | `sendEventMessages`, `resendMessagesForParticipants` | Primary send path |
| `settlement.service.ts` | nudge participant | Same message assembly |

Replace `sendTwilioMessage(...)` → `sendOutboundMessage(...)` from facade.

### 6.2 Status callback URLs

| Provider | Delivery webhook path |
|---|---|
| Twilio | `{APP_URL}/api/v1/webhooks/twilio/delivery` (existing) |
| Telnyx | Messaging Profile webhook → `{APP_URL}/api/v1/webhooks/telnyx/messaging` |

`APP_URL` must be public HTTPS in staging/prod (not localhost). Same rule as today for Twilio.

### 6.3 `notification_log.twilio_sid`

Column name is legacy. **Store Telnyx message ID in the same column** for v1. Optional future migration: `provider_message_id` + `sms_provider` column. Not in scope for E11-S03–S07.

---

## 7. Webhook Architecture

### 7.1 Shared delivery handler

`messaging-delivery.service.ts`:

```typescript
applyDeliveryUpdate(messageId: string, mappedStatus: 'sent' | 'delivered' | 'failed' | 'bounced'): Promise<void>
```

Logic copied from `twilio.controller.ts` `handleTwilioDelivery`:
- UPDATE `notification_log` by `twilio_sid = messageId`
- ON `delivered` → SET `participants.message_delivered_at`
- ON `failed` | `bounced` → SET `participants.message_failed = true`

Twilio and Telnyx controllers only parse provider payload → call shared service.

### 7.2 Telnyx delivery mapping

| Telnyx `message.finalized` | `to[0].status` | Mapped status |
|---|---|---|
| finalized | `delivered` | `delivered` |
| finalized | `delivery_failed` | `failed` |
| `message.sent` | — | no DB update (optional log) |

Respond `200` within 5 seconds; process async if needed.

### 7.3 Inbound SMS (STOP / START / HELP)

**Gap in current codebase:** START re-subscribe is documented in legal text but **not implemented**. E11-S06 adds it.

`messaging-inbound.service.ts`:

| Keyword | Action |
|---|---|
| `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT` | `processSmsStopOptOut(phoneE164)` (existing) |
| `START`, `UNSTOP` | `processSmsStartOptIn(phoneE164)` (new) |
| `HELP`, `INFO` | Log only; optional static reply SMS |

| Provider | Inbound route |
|---|---|
| Twilio | `POST /api/v1/webhooks/twilio/opt-out` (and `/stop`) — existing |
| Telnyx | Same unified webhook `POST /api/v1/webhooks/telnyx/messaging` — parse `event_type: message.received` |

Telnyx inbound response: plain text body (not TwiML).

### 7.4 Webhook security

| Provider | Method |
|---|---|
| Twilio | `X-Twilio-Signature` via `validateTwilioWebhook` (existing) |
| Telnyx MVP | IP allowlist `192.76.120.192/27` middleware |
| Telnyx post-MVP | Ed25519 signature verification (Telnyx public key) |

Register routes **before** auth middleware (same as Twilio today). Also mount at `/webhooks/telnyx` for parity with `/webhooks/twilio`.

---

## 8. Background Jobs

### 8.1 OTP cleanup (new)

- Route: `POST /api/v1/jobs/purge-expired-otps`
- Handler: `purgeExpiredOTPs()` from `otp.service.ts`
- Protection: `verifyQStashMiddleware` (same as `purge-guest-pii`)
- Schedule: QStash every 15 minutes `*/15 * * * *`

### 8.2 E12 health check (coordination)

E12-S01 health probe must check **active** SMS provider:
- `twilio` → existing Twilio account fetch
- `telnyx` → Telnyx API lightweight call (e.g. list messaging profiles or balance)

Document in E12-S01 prompt when E11-S07 completes.

---

## 9. Environment Variables

### 9.1 New

| Variable | Required when | Description |
|---|---|---|
| `SMS_PROVIDER` | Always | `twilio` (default) or `telnyx` |
| `TELNYX_API_KEY` | `telnyx` | API key from Telnyx portal |
| `TELNYX_FROM_NUMBER` | `telnyx` | E.164 sender |

### 9.2 Retained

| Variable | Used by |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | TwilioSMSProvider |
| `TWILIO_PHONE_NUMBER` | Twilio SMS ( **not** `TWILIO_FROM_NUMBER`) |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp |
| `APP_URL` | Status callbacks + webhook URL construction |

### 9.3 Removed after migration

| Variable | Reason |
|---|---|
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify retired |
| `TWILIO_USE_LIVE_VERIFY` | No longer applicable |
| `TWILIO_TEST_VERIFY_SERVICE_SID` constant usage | Remove from `twilio.ts` |

### 9.4 Doppler rollout order

1. Deploy code with `SMS_PROVIDER=twilio` (no behavior change except custom OTP — see rollout §10)
2. Add Telnyx vars without switching provider
3. Switch `SMS_PROVIDER=telnyx` in dev → staging → prod (after 10DLC)

---

## 10. Rollout Strategy

### Phase A — Code deploy, Twilio transport (E11-S03, S04)

- Factory + Twilio provider wrap existing `twilio-messaging.ts` logic
- Custom OTP live (Verify removed)
- `SMS_PROVIDER=twilio` — payment messages identical to today
- **Risk:** OTP path changes (custom vs Verify) — heavy test coverage required

### Phase B — Telnyx outbound (E11-S05)

- `SMS_PROVIDER=telnyx` in dev (on-net two-number testing)
- Payment + nudge via Telnyx

### Phase C — Telnyx webhooks (E11-S06)

- Delivery tracking + STOP/START on Telnyx
- Staging toll-free verification

### Phase D — Production (E11-S07)

- 10DLC approved, production Messaging Profile
- Smoke scripts green, legal docs synced (Telnyx Privacy variant)

### Rollback

Set `SMS_PROVIDER=twilio` in Doppler + redeploy. Custom OTP still works with Twilio transport. Twilio Verify is **not** restored — rollback is transport-only.

---

## 11. What Does NOT Change

| Layer | Change |
|---|---|
| Mobile app | None |
| API request/response shapes | None |
| `POST /auth/otp/request`, `POST /auth/otp/verify` | Same bodies and codes |
| Web join HTML forms | Same — backend join-otp uses shared OTP service |
| Supabase Realtime delivery UI | Same — still driven by `participants` columns |
| `splitCalculator`, PII vault, RLS | None |

---

## 12. Story Map

| Story | Delivers |
|---|---|
| **E11-S03** | SMS types, factory, Twilio provider, outbound facade, deprecate direct `twilio-messaging` imports |
| **E11-S04** | `otp_verifications` migration, `otp.service`, auth + join integration, unit tests |
| **E11-S05** | Telnyx provider, migrate send.service + settlement.service, provider tests |
| **E11-S06** | Shared delivery/inbound services, Telnyx webhook routes, START opt-in, webhook tests |
| **E11-S07** | QStash OTP cleanup job, docs (06, 10, 12), smoke scripts, legal sync, rollout checklist |

**Implementation detail:** See `E11-S03-Implementation-Spec.md`.

---

## 13. Risk Register

| Risk | Mitigation |
|---|---|
| Custom OTP breaks mobile error handling | Map exact `AppError` codes; run existing otp-verify integration tests |
| Telnyx webhook incomplete → delivery UI stuck | Shared delivery service + parity tests with Twilio handler |
| International users lose WhatsApp on Telnyx | Document; Twilio fallback; future WhatsApp provider |
| START not implemented | E11-S06 explicitly adds `processSmsStartOptIn` |
| Double rate limits | Single in-memory limiter before `sendOTP` |
| `twilio_sid` naming confusion | Document; store any provider ID; rename deferred |
| 10DLC blocks prod SMS | Staging TFN path; keep Twilio creds in Doppler |
| Long payment SMS multi-segment billing | Accept; monitor Telnyx message log |

---

*Document version: 1.0 — 2026-06-07*
