# LetsSplyt — SMS Provider Refactor: Cursor Instructions

> **Superseded for implementation planning** by:
> - `E11-S03-Architecture.md` (architecture)
> - `E11-S03-Implementation-Spec.md` (granular engineering checklist)
> - `docs/12-Build-Sequence.md` stories E11-S03 through E11-S07
>
> This file remains useful as background context. Do not implement from this file alone — it has gaps (webhooks, web join, WhatsApp, error codes, wrong filenames) addressed in the docs above.

**Purpose:** Refactor the SMS layer from a hardcoded Twilio implementation to a configurable provider factory that supports both Twilio and Telnyx.

**When you have finished all steps in this document**, run the full test suite and confirm every acceptance criterion in the final section passes before closing this task.

---

## Context

The current implementation uses Twilio for two SMS operations:
1. **OTP verification** — via Twilio Verify (`TWILIO_VERIFY_SERVICE_SID`), which costs $0.058 per verification
2. **Payment request SMS** — via Twilio Programmable Messaging, which costs $0.0079 per message

This refactor replaces Twilio Verify with a custom OTP system (generates a 6-digit code, stores it in Supabase, delivers it via the configured SMS provider). This reduces OTP cost from $0.058 to $0.004 when using Telnyx — a 93% reduction.

**The refactor does NOT change any mobile app code.** All changes are confined to the backend.

---

## Architecture Overview

```
SMS_PROVIDER env var (twilio | telnyx)
        │
        ▼
createSMSProvider()  ─── factory function, mirrors createLLMProvider()
        │
        ├── TwilioSMSProvider   ─── wraps twilio npm package, sends via Programmable Messaging
        └── TelnyxSMSProvider  ─── wraps telnyx npm package, sends via Messages API

OTP flow (replaces Twilio Verify):
  1. Backend generates 6-digit code
  2. Stores SHA-256 hash of code in otp_verifications table (10-min TTL)
  3. Sends plaintext code to user via createSMSProvider().sendSMS()
  4. On verification, re-hash input code and compare — delete row on success
```

---

## Step 1 — Install Telnyx SDK

In `backend/`:

```bash
npm install telnyx
```

Verify in `backend/package.json` that `"telnyx"` appears in `dependencies`.

---

## Step 2 — Create the SMS Provider Interface

**Create file:** `backend/src/infrastructure/sms/types.ts`

```typescript
export interface SendSMSResult {
  messageId: string;
}

export interface SMSProvider {
  /**
   * Send a plain SMS to a single recipient.
   * @param to   E.164 phone number, e.g. "+14155550123"
   * @param body Message body, max 160 chars for single-segment SMS
   */
  sendSMS(to: string, body: string): Promise<SendSMSResult>;
}
```

---

## Step 3 — Create the Twilio SMS Provider

**Create file:** `backend/src/infrastructure/sms/providers/twilio.provider.ts`

This replaces the old direct Twilio Programmable Messaging calls. It does NOT use Twilio Verify — OTP is now handled by the custom OTP service (Step 6).

```typescript
import twilio from 'twilio';
import type { SMSProvider, SendSMSResult } from '../types';

export class TwilioSMSProvider implements SMSProvider {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        'TwilioSMSProvider requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER'
      );
    }

    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  async sendSMS(to: string, body: string): Promise<SendSMSResult> {
    const message = await this.client.messages.create({
      from: this.fromNumber,
      to,
      body,
    });

    return { messageId: message.sid };
  }
}
```

---

## Step 4 — Create the Telnyx SMS Provider

**Create file:** `backend/src/infrastructure/sms/providers/telnyx.provider.ts`

```typescript
import Telnyx from 'telnyx';
import type { SMSProvider, SendSMSResult } from '../types';

export class TelnyxSMSProvider implements SMSProvider {
  private client: Telnyx;
  private fromNumber: string;

  constructor() {
    const apiKey = process.env.TELNYX_API_KEY;
    const fromNumber = process.env.TELNYX_FROM_NUMBER;

    if (!apiKey || !fromNumber) {
      throw new Error(
        'TelnyxSMSProvider requires TELNYX_API_KEY and TELNYX_FROM_NUMBER'
      );
    }

    this.client = new Telnyx(apiKey);
    this.fromNumber = fromNumber;
  }

  async sendSMS(to: string, body: string): Promise<SendSMSResult> {
    const response = await this.client.messages.send({
      from: this.fromNumber,
      to,
      text: body,
    });

    return { messageId: response.data.id };
  }
}
```

**Note on Telnyx error codes:**
- `401` — invalid API key
- `403` — phone number not assigned to a messaging profile
- `422` — invalid phone number format (must be E.164)
- `429` — rate limited; respect the `Retry-After` header

---

## Step 5 — Create the SMS Provider Factory

**Create file:** `backend/src/infrastructure/sms/factory.ts`

This mirrors the pattern of `backend/src/infrastructure/llm/factory.ts`.

```typescript
import type { SMSProvider } from './types';
import { TwilioSMSProvider } from './providers/twilio.provider';
import { TelnyxSMSProvider } from './providers/telnyx.provider';

let instance: SMSProvider | null = null;

/**
 * Returns a singleton SMSProvider based on the SMS_PROVIDER environment variable.
 * Supported values: 'twilio' (default) | 'telnyx'
 *
 * Mirrors the pattern of createLLMProvider() in infrastructure/llm/factory.ts.
 * NEVER instantiate SMS providers directly — always use this factory.
 */
export function createSMSProvider(): SMSProvider {
  if (instance) return instance;

  const provider = process.env.SMS_PROVIDER ?? 'twilio';

  switch (provider) {
    case 'telnyx':
      instance = new TelnyxSMSProvider();
      break;
    case 'twilio':
      instance = new TwilioSMSProvider();
      break;
    default:
      throw new Error(
        `Unknown SMS_PROVIDER: "${provider}". Supported values: "twilio", "telnyx"`
      );
  }

  return instance;
}

/** Reset the singleton — for use in tests only */
export function resetSMSProvider(): void {
  instance = null;
}
```

---

## Step 6 — Create the Custom OTP Service

This replaces Twilio Verify entirely. OTP codes are generated, stored, and verified in our own backend.

### 6a — Supabase Migration

**Create file:** `supabase/migrations/YYYYMMDDHHMMSS_create_otp_verifications.sql`

Replace `YYYYMMDDHHMMSS` with the current timestamp (e.g. `20260614120000`).

```sql
-- OTP verification codes
-- Replaces Twilio Verify. Codes are stored hashed, expire in 10 minutes,
-- and are deleted immediately on successful verification.
CREATE TABLE otp_verifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash    TEXT        NOT NULL,
  code_hash     TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at   TIMESTAMPTZ,
  attempt_count INTEGER     NOT NULL DEFAULT 0
);

-- Index for phone_hash lookups (used during verification)
CREATE INDEX idx_otp_verifications_phone_hash ON otp_verifications(phone_hash);

-- Index for cleanup job (expired rows)
CREATE INDEX idx_otp_verifications_expires_at ON otp_verifications(expires_at);

-- Enable RLS — only service role can access this table
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS policies needed; all access is via service role key in the backend
```

Run this migration:
```bash
supabase db push
```

### 6b — OTP Service

**Create file:** `backend/src/infrastructure/otp/otp.service.ts`

```typescript
import crypto from 'crypto';
import { supabaseAdmin } from '../supabase';
import { createSMSProvider } from '../sms/factory';
import { Errors } from '../errors';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_WINDOW_MINUTES = 60;
const OTP_RATE_LIMIT_MAX_PER_WINDOW = 5;

/**
 * Hash a phone number or OTP code for storage.
 * Uses the same HMAC-SHA256 pattern as the PII vault for phone hashes.
 */
function hashForOTP(value: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(value).digest('hex');
}

/**
 * Generate and send a 6-digit OTP to the given phone number.
 *
 * @param phoneHash  SHA-256 HMAC of the recipient's phone number (from PII vault)
 * @param phoneE164  E.164 phone number for SMS delivery (decrypted from PII vault — discard after use)
 */
export async function sendOTP(phoneHash: string, phoneE164: string): Promise<void> {
  const salt = process.env.PII_HMAC_SALT!;

  // Rate limit: max OTP_RATE_LIMIT_MAX_PER_WINDOW attempts per phone per window
  const windowStart = new Date(
    Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const { count } = await supabaseAdmin
    .from('otp_verifications')
    .select('*', { count: 'exact', head: true })
    .eq('phone_hash', phoneHash)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= OTP_RATE_LIMIT_MAX_PER_WINDOW) {
    throw Errors.TooManyRequests('Too many OTP requests. Please wait before trying again.');
  }

  // Delete any existing unused OTPs for this phone (prevents confusion)
  await supabaseAdmin
    .from('otp_verifications')
    .delete()
    .eq('phone_hash', phoneHash)
    .is('verified_at', null);

  // Generate a cryptographically random 6-digit code
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashForOTP(code, salt);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  // Store the hashed code
  const { error: insertError } = await supabaseAdmin
    .from('otp_verifications')
    .insert({ phone_hash: phoneHash, code_hash: codeHash, expires_at: expiresAt });

  if (insertError) throw Errors.Internal('Failed to create OTP');

  // Send the plaintext code via SMS
  const sms = createSMSProvider();
  await sms.sendSMS(phoneE164, `Your LetsSplyt verification code is: ${code}. Valid for ${OTP_TTL_MINUTES} minutes.`);
}

/**
 * Verify an OTP code submitted by the user.
 *
 * @param phoneHash  SHA-256 HMAC of the phone number
 * @param code       6-digit code as entered by the user
 * @returns true if valid; throws AppError if invalid or expired
 */
export async function verifyOTP(phoneHash: string, code: string): Promise<true> {
  const salt = process.env.PII_HMAC_SALT!;
  const codeHash = hashForOTP(code, salt);
  const now = new Date().toISOString();

  // Find a valid, unused, non-expired OTP for this phone
  const { data: otpRow, error } = await supabaseAdmin
    .from('otp_verifications')
    .select('id, code_hash, expires_at, attempt_count, verified_at')
    .eq('phone_hash', phoneHash)
    .is('verified_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !otpRow) {
    throw Errors.Unauthorized('OTP expired or not found. Please request a new code.');
  }

  if (otpRow.attempt_count >= OTP_MAX_ATTEMPTS) {
    // Delete the exhausted OTP
    await supabaseAdmin.from('otp_verifications').delete().eq('id', otpRow.id);
    throw Errors.Unauthorized('Too many incorrect attempts. Please request a new code.');
  }

  if (otpRow.code_hash !== codeHash) {
    // Increment attempt counter
    await supabaseAdmin
      .from('otp_verifications')
      .update({ attempt_count: otpRow.attempt_count + 1 })
      .eq('id', otpRow.id);
    throw Errors.Unauthorized('Incorrect verification code.');
  }

  // Code is correct — mark as verified and delete
  await supabaseAdmin
    .from('otp_verifications')
    .delete()
    .eq('id', otpRow.id);

  return true;
}

/**
 * Cleanup job: delete all expired, unverified OTPs.
 * Call this from a QStash scheduled job (e.g. every 15 minutes).
 */
export async function purgeExpiredOTPs(): Promise<number> {
  const now = new Date().toISOString();
  const { count, error } = await supabaseAdmin
    .from('otp_verifications')
    .delete({ count: 'exact' })
    .lt('expires_at', now)
    .is('verified_at', null);

  if (error) throw Errors.Internal('Failed to purge expired OTPs');
  return count ?? 0;
}
```

---

## Step 7 — Update the Auth Service

**File to modify:** `backend/src/modules/auth/auth.service.ts`

### Remove
- All imports of `twilio` for Verify (`TWILIO_VERIFY_SERVICE_SID`)
- All calls to `client.verify.v2.services(...).verifications.create()`
- All calls to `client.verify.v2.services(...).verificationChecks.create()`

### Replace with
```typescript
// At top of file — add these imports
import { sendOTP, verifyOTP } from '../../infrastructure/otp/otp.service';
import { resolveParticipantPhone } from '../../infrastructure/security/resolveParticipantPhone';
```

**For the "send OTP" path** (e.g. during registration or login when the user submits their phone number):

```typescript
// BEFORE (Twilio Verify):
// await twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
//   .verifications.create({ to: phoneE164, channel: 'sms' });

// AFTER (custom OTP):
// phoneHash and phoneE164 come from the PII vault pattern already in the service
await sendOTP(phoneHash, phoneE164);
// phoneE164 must not be stored, logged, or returned after this call
```

**For the "verify OTP" path** (when the user submits the 6-digit code):

```typescript
// BEFORE (Twilio Verify):
// const check = await twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
//   .verificationChecks.create({ to: phoneE164, code });
// if (check.status !== 'approved') throw Errors.Unauthorized('Invalid code');

// AFTER (custom OTP):
await verifyOTP(phoneHash, code);
// verifyOTP throws AppError on failure; reaching this line means success
```

**Remove `TWILIO_VERIFY_SERVICE_SID` from all env reads in this file.** It is no longer used.

---

## Step 8 — Update the Messages Service

**File to modify:** `backend/src/modules/messages/messages.service.ts`

### Remove
- Direct instantiation of `twilio(accountSid, authToken)`
- Direct calls to `twilioClient.messages.create()`

### Replace with
```typescript
// At top of file — add this import
import { createSMSProvider } from '../../infrastructure/sms/factory';

// When sending a payment request SMS:
// BEFORE:
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
// await twilioClient.messages.create({ from: process.env.TWILIO_FROM_NUMBER!, to: phoneE164, body: messageText });

// AFTER:
const sms = createSMSProvider();
const result = await sms.sendSMS(phoneE164, messageText);
// result.messageId can be stored for delivery tracking
```

Do not change the message content, recipient resolution, or any business logic — only the transport layer changes.

---

## Step 9 — Add Telnyx Webhook Handler

**Create file:** `backend/src/modules/messages/telnyx-webhook.handler.ts`

This receives delivery receipts from Telnyx. The handler must respond within 5 seconds.

```typescript
import { Router, Request, Response } from 'express';

export const telnyxWebhookRouter = Router();

telnyxWebhookRouter.post('/webhooks/telnyx/messaging', (req: Request, res: Response) => {
  // Acknowledge immediately — process async to meet 5-second response requirement
  res.sendStatus(200);

  const event = req.body?.data;
  if (!event) return;

  switch (event.event_type) {
    case 'message.sent':
      // Message accepted by carrier — no action required
      break;

    case 'message.finalized': {
      const payload = event.payload;
      const toArray = payload?.to;
      if (!Array.isArray(toArray) || toArray.length === 0) break;

      const status: string = toArray[0]?.status; // 'delivered' | 'delivery_failed'
      const messageId: string = payload?.id;

      if (status === 'delivery_failed') {
        // Log the failure for monitoring
        // Use writeAuditLog() from infrastructure/llm/ai-audit.ts pattern
        // Do NOT log the phone number — log only messageId and error reason
        const errorCode: string = toArray[0]?.carrier?.error_code ?? 'unknown';
        console.error(`[telnyx] Delivery failed: messageId=${messageId} errorCode=${errorCode}`);
      }
      break;
    }

    default:
      // Ignore all other event types
      break;
  }
});
```

**Register this router in `backend/src/app.ts`:**

```typescript
import { telnyxWebhookRouter } from './modules/messages/telnyx-webhook.handler';

// Add before your authenticated routes
app.use('/', telnyxWebhookRouter);
```

**Important:** The Telnyx webhook endpoint must be public (no authentication middleware). Telnyx sends delivery receipts to this endpoint from their infrastructure.

**Webhook security:** For production, validate that requests come from Telnyx by checking the source IP against Telnyx's published CIDR range (`192.76.120.192/27`). This is optional for MVP but recommended before public launch.

---

## Step 10 — Add a QStash Job for OTP Cleanup

**File to modify:** `backend/src/modules/jobs/` — add a new job handler for OTP cleanup.

**Create file:** `backend/src/modules/jobs/otp-cleanup.job.ts`

```typescript
import { Router, Request, Response } from 'express';
import { purgeExpiredOTPs } from '../../infrastructure/otp/otp.service';

export const otpCleanupRouter = Router();

otpCleanupRouter.post('/jobs/otp-cleanup', async (req: Request, res: Response) => {
  try {
    const deleted = await purgeExpiredOTPs();
    res.json({ ok: true, deleted });
  } catch (err) {
    console.error('[otp-cleanup] Failed:', err);
    res.status(500).json({ ok: false });
  }
});
```

Register this job router in `backend/src/app.ts` alongside other QStash job handlers (the `/jobs/*` route should be protected by QStash signature verification middleware if you have it set up).

Schedule this job in QStash to run every 15 minutes:
- URL: `https://your-backend-url/jobs/otp-cleanup`
- Method: POST
- Schedule: `*/15 * * * *`

---

## Step 11 — Update Doppler Environment Variables

### Variables to ADD in all environments

| Variable | Dev | Staging | Production |
|---|---|---|---|
| `SMS_PROVIDER` | `telnyx` | `telnyx` | `telnyx` |
| `TELNYX_API_KEY` | Dev API key | Staging API key | Prod API key |
| `TELNYX_FROM_NUMBER` | Dev Telnyx number | Staging Telnyx number | Prod Telnyx number |

### Variables to KEEP (still needed if SMS_PROVIDER=twilio is used as fallback)

| Variable | Note |
|---|---|
| `TWILIO_ACCOUNT_SID` | Keep — used when `SMS_PROVIDER=twilio` |
| `TWILIO_AUTH_TOKEN` | Keep — used when `SMS_PROVIDER=twilio` |
| `TWILIO_FROM_NUMBER` | Keep — used when `SMS_PROVIDER=twilio` |

### Variables to REMOVE

| Variable | Reason |
|---|---|
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify is no longer used. Custom OTP replaced it. |

---

## Step 12 — Update TypeScript Types

**File to modify:** `shared/types/` — if a shared `OTPVerification` type is needed

Only needed if the mobile app or shared package references OTP verification state. If the OTP flow is entirely internal to the backend, no shared type changes are required.

---

## Step 13 — Write Tests

### 13a — Unit tests for `otp.service.ts`

**Create file:** `backend/src/__tests__/infrastructure/otp.service.test.ts`

Test cases required:
1. `sendOTP` — generates and stores a hashed OTP, calls `sms.sendSMS` with the plaintext code
2. `sendOTP` — rate-limits after `OTP_RATE_LIMIT_MAX_PER_WINDOW` requests within the window
3. `sendOTP` — deletes existing unused OTP before inserting a new one
4. `verifyOTP` — returns `true` for a correct, non-expired code
5. `verifyOTP` — throws `Unauthorized` for an incorrect code
6. `verifyOTP` — throws `Unauthorized` for an expired OTP
7. `verifyOTP` — throws `Unauthorized` after `OTP_MAX_ATTEMPTS` wrong attempts
8. `verifyOTP` — deletes the OTP row after successful verification
9. `purgeExpiredOTPs` — deletes rows where `expires_at < now()`

Mock `supabaseAdmin` and `createSMSProvider()`. Do not make real network calls in unit tests.

### 13b — Unit tests for `sms/factory.ts`

**Create file:** `backend/src/__tests__/infrastructure/sms/factory.test.ts`

Test cases required:
1. Returns `TelnyxSMSProvider` when `SMS_PROVIDER=telnyx`
2. Returns `TwilioSMSProvider` when `SMS_PROVIDER=twilio`
3. Returns `TwilioSMSProvider` when `SMS_PROVIDER` is not set (default)
4. Throws when `SMS_PROVIDER` is set to an unknown value
5. Returns the same singleton instance on repeated calls
6. Returns a new instance after `resetSMSProvider()`

### 13c — Unit tests for providers

**Create file:** `backend/src/__tests__/infrastructure/sms/providers/telnyx.provider.test.ts`

Test cases required:
1. Calls `client.messages.send()` with correct `from`, `to`, and `text`
2. Returns the `messageId` from `response.data.id`
3. Throws when `TELNYX_API_KEY` is not set
4. Throws when `TELNYX_FROM_NUMBER` is not set

Mock the `telnyx` npm module.

---

## Acceptance Criteria

Before marking this task complete, verify ALL of the following:

- [ ] `SMS_PROVIDER=telnyx` in Doppler dev → OTP and payment SMS both route through Telnyx
- [ ] `SMS_PROVIDER=twilio` in Doppler dev → OTP and payment SMS both route through Twilio
- [ ] Changing `SMS_PROVIDER` requires no code changes — only a Doppler update + server restart
- [ ] `TWILIO_VERIFY_SERVICE_SID` is no longer referenced anywhere in the codebase (`grep -r TWILIO_VERIFY_SERVICE_SID backend/src` returns nothing)
- [ ] `createSMSProvider()` is the only place SMS providers are instantiated (`grep -r "new TwilioSMSProvider\|new TelnyxSMSProvider" backend/src` returns only the factory file)
- [ ] Phone numbers are NEVER passed to `sendSMS()` in plaintext from memory — they must be decrypted immediately before the call and the decrypted value discarded immediately after
- [ ] OTP codes are stored only as HMAC-SHA256 hashes in `otp_verifications` — never in plaintext
- [ ] All 9 OTP service tests pass
- [ ] All 6 factory tests pass
- [ ] All 4 Telnyx provider tests pass
- [ ] `supabase db push` applies the migration without errors
- [ ] TypeScript compiles without errors: `npm run build` in `backend/`

---

## File Summary — What to Create

```
backend/src/infrastructure/sms/
├── types.ts                          ← SMSProvider interface (NEW)
├── factory.ts                        ← createSMSProvider() (NEW)
└── providers/
    ├── twilio.provider.ts            ← Twilio adapter (NEW)
    └── telnyx.provider.ts            ← Telnyx adapter (NEW)

backend/src/infrastructure/otp/
└── otp.service.ts                    ← sendOTP, verifyOTP, purgeExpiredOTPs (NEW)

backend/src/modules/messages/
└── telnyx-webhook.handler.ts         ← Delivery receipt handler (NEW)

backend/src/modules/jobs/
└── otp-cleanup.job.ts                ← QStash cleanup job (NEW)

supabase/migrations/
└── YYYYMMDDHHMMSS_create_otp_verifications.sql  ← DB migration (NEW)

backend/src/__tests__/infrastructure/
├── otp.service.test.ts               ← 9 test cases (NEW)
└── sms/
    ├── factory.test.ts               ← 6 test cases (NEW)
    └── providers/
        └── telnyx.provider.test.ts   ← 4 test cases (NEW)
```

## Files to Modify

```
backend/src/modules/auth/auth.service.ts      ← replace Twilio Verify with sendOTP/verifyOTP
backend/src/modules/messages/messages.service.ts ← replace direct twilio.messages with createSMSProvider()
backend/src/app.ts                             ← register telnyxWebhookRouter and otpCleanupRouter
```

---

*Document version: Telnyx refactor v1.0 — 2026-06-14*
