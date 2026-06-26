# LetsSplyt — Integration Contracts
**Version:** 1.0 | **Date:** June 2026
**Purpose:** Exact API contracts for every external service LetsSplyt depends on. A developer reading this document must be able to make a working API call to any service without reading the provider's full documentation.

---

## How to Use This Document

Each of the nine sections below covers one external service. Every section contains:

- What LetsSplyt uses the service for
- Which environments use it and how they differ
- How credentials are obtained (all via Doppler env vars)
- The exact npm package and version range to install
- Every API call the app makes, with the full request shape, response shape, and error codes
- TypeScript code you can compile and run

**Rule:** If this document conflicts with a provider's own documentation, this document reflects what LetsSplyt actually does. Use this as the implementation reference, not the provider's general docs.

---

## Integration 1 — Custom OTP + SMS Provider Factory

### What LetsSplyt Uses It For

Generates, stores (hashed), and verifies 6-digit OTP codes for app login/register and web join. OTP delivery uses the configured SMS provider — not Twilio Verify.

Implementation: `backend/src/infrastructure/otp/otp.service.ts` (`sendOTP`, `verifyOTP`, `purgeExpiredOTPs`).

SMS transport: `createSMSProvider()` in `backend/src/infrastructure/sms/factory.ts`:

| `SMS_PROVIDER` | Adapter | Use |
|---|---|---|
| `twilio` (default) | `TwilioSMSProvider` | Twilio Programmable Messaging |
| `telnyx` | `TelnyxSMSProvider` | Telnyx Messages API (SMS only) |

All outbound messages use `sendOutboundMessage()` in `outbound-messaging.service.ts`.

### Environment variables (Doppler)

```bash
PII_HMAC_SALT=...
SMS_PROVIDER=twilio|telnyx
OTP_DEV_BYPASS=true|false
MESSAGING_DEV_BYPASS=true|false
# Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WHATSAPP_NUMBER
# Telnyx: TELNYX_API_KEY, TELNYX_FROM_NUMBER
```

`TWILIO_VERIFY_SERVICE_SID` is removed.

### Database — otp_verifications

Migration `20260623000000_otp_verifications.sql`. Codes stored as HMAC-SHA256 hashes only.

QStash: `POST /api/v1/jobs/purge-expired-otps` schedule `*/15 * * * *` → `{ ok: true, deleted: N }`.

### OTP errors

`INVALID_CODE` 400, `CODE_EXPIRED` 400, `OTP_MAX_ATTEMPTS` 429.

### Telnyx webhooks

`POST {APP_URL}/api/v1/webhooks/telnyx/messaging` — see `docs/Telnyx Implementation/Telnyx-Setup-Guide.md` §9.

---

## Integration 2 — Outbound Messaging (Twilio + Telnyx)

### What LetsSplyt Uses It For

Sends payment-request SMS after split confirm, OTP codes (Integration 1), nudge reminders, and STOP/START confirmation replies. Transport is **`SMS_PROVIDER`** via `createSMSProvider()` — not hardcoded Twilio.

### Message Flow

```
1. Split confirmed by payer
2. A3 composes personalised message text for each participant
3. Backend assembles message + breakdown link (GET /split/:token)
4. sendOutboundMessage() per participant (opt-out check first)
5. Provider delivery webhook updates notification_log + participants
```

**Twilio path:** SMS for US/CA; WhatsApp-first for international with SMS fallback. Webhooks: `/api/v1/webhooks/twilio/delivery`, `/webhooks/twilio/opt-out`.

**Telnyx path:** SMS only. Webhook: `/api/v1/webhooks/telnyx/messaging` (`message.finalized`, `message.received`).

### Which Environments

| Environment | Behaviour |
|-------------|-----------|
| Development | `SMS_PROVIDER=telnyx` + on-net numbers, or `twilio` + magic numbers. `MESSAGING_DEV_BYPASS=true` skips provider API (logs only). |
| Staging | LIVE credentials; real messages. Telnyx toll-free verified for off-net. |
| Production | LIVE credentials; Twilio 10DLC or Telnyx campaign registered. |

### Authentication

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15005550006          # dev magic number; real purchased number in staging/prod
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxx   # optional: use Messaging Service for A2P compliance
```

### SDK / Library

```bash
npm install twilio@^5.0.0
```

Same package as Twilio Verify. The client handles both.

### Key API Calls

#### Call 1: Send a Message (Message.create)

Called once per participant when `POST /events/:eventId/messages/send` is processed.

**Request shape:**
```typescript
client.messages.create({
  from: process.env.TWILIO_PHONE_NUMBER,   // your Twilio number in E.164 format
  // OR use a Messaging Service SID for A2P compliance:
  // messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  to: '+15550001234',                       // participant's phone in E.164
  body: 'Hey Marcus! Thanks for coming...\n\nYour share is $32.50.\n\nSee full split: https://letssplyt.app/split/abc123token\n\nPay here:\nVenmo: venmo://...',
  // Text-only delivery — breakdown is a link in the body, NOT MMS mediaUrl
  statusCallback: `${process.env.APP_URL}/api/v1/webhooks/twilio/delivery`,
});
```

**No MMS:** LetsSplyt does not pass `mediaUrl` on payment-request messages. The full group split table is served at `GET /split/:token` (per-participant secret token in `participants.breakdown_token`). This avoids MMS carrier failures and per-segment MMS pricing. If a future feature needs MMS, it would be a separate explicit product decision — not a silent fallback.

**Response shape (Twilio SDK object):**
```typescript
{
  sid: 'SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',   // Message SID — store in notification_log.twilio_sid
  accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  from: '+15005550006',
  to: '+15550001234',
  body: 'Hey Marcus!...',
  status: 'queued',                            // initial status — real status comes via webhook
  direction: 'outbound-api',
  dateCreated: Date,
  dateUpdated: Date,
  errorCode: null,
  errorMessage: null,
  uri: '/2010-04-01/Accounts/AC.../Messages/SM...',
}
```

**What LetsSplyt stores after this call:**
- `notification_log.twilio_sid = sid` — for delivery tracking via webhook
- `participants.message_sent_at = NOW()` — timestamp of send
- `notification_log.status = 'sent'` — updated to 'delivered' or 'failed' via webhook

#### Call 2: Status Callback Webhook

Twilio POSTs delivery status updates to your backend at the URL provided in `statusCallback`. This is an inbound webhook, not an outbound API call.

**Endpoint:** `POST /api/v1/webhooks/twilio/delivery`

**What Twilio sends** (Content-Type: `application/x-www-form-urlencoded`):
```
MessageSid=SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MessageStatus=delivered
To=%2B15550001234
From=%2B15005550006
AccountSid=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Delivery status values and their meaning:**

| Status | Meaning | App Action |
|--------|---------|------------|
| `queued` | Accepted by Twilio, not yet sent | No action needed |
| `sending` | Being transmitted to carrier | No action needed |
| `sent` | Accepted by carrier | No action needed |
| `delivered` | Confirmed delivery to handset | Update `notification_log.status = 'delivered'` and `notification_log.delivered_at = NOW()` |
| `failed` | Failed before reaching carrier | Update `participants.message_failed = TRUE`, fire analytics event `message_delivery_failed` |
| `undelivered` | Carrier rejected (unreachable number, opt-out, etc.) | Same as `failed` |

**Webhook handler (must validate Twilio signature):**

```typescript
// backend/src/modules/webhooks/twilio-delivery.controller.ts
import twilio from 'twilio';
import express, { Request, Response } from 'express';

export async function handleDeliveryWebhook(req: Request, res: Response): Promise<void> {
  // 1. Validate Twilio signature FIRST — reject without processing if invalid
  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const webhookUrl = `${process.env.APP_URL}/api/v1/webhooks/twilio/delivery`;

  const isValid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    twilioSignature,
    webhookUrl,
    req.body as Record<string, string>,
  );

  if (!isValid) {
    res.status(403).json({ error: 'Invalid Twilio signature' });
    return;
  }

  const { MessageSid, MessageStatus } = req.body as {
    MessageSid: string;
    MessageStatus: string;
  };

  // 2. Update notification_log
  await updateNotificationLog(MessageSid, MessageStatus);

  // 3. On failure, update participants and fire analytics
  if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
    await markParticipantMessageFailed(MessageSid);
    void writeAnalyticsEvent('message_delivery_failed', { twilioSid: MessageSid });
  }

  // 4. Return empty 200 — Twilio expects this
  res.status(200).send('');
}
```

### Environment Behaviour

**Development:** The `statusCallback` URL will not be reachable from Twilio (it's `localhost`). Use ngrok or Cloudflare Tunnel during development if you need to test delivery webhooks:

```bash
npx ngrok http 3000
# Then set APP_URL=https://[your-ngrok-id].ngrok.io temporarily
```

Alternatively, skip delivery webhook testing in development and rely on staging.

**Staging/Production:** The Railway backend URL is reachable. Configure the status callback in the Twilio console as a fallback (in addition to the `statusCallback` field in each message).

### Opt-Out Webhook Registration (TCPA Requirement)

1. Log into Twilio Console → Messaging → Services → [your service]
2. Under 'Inbound Settings', set the Incoming Message Webhook URL to:
   - Production: `https://[your-domain]/api/v1/webhooks/twilio/opt-out`
   - Staging: `https://[staging-domain]/api/v1/webhooks/twilio/opt-out`
   - HTTP method: POST
3. For A2P 10DLC campaigns, also register the opt-out keywords in Campaign Manager
4. Twilio automatically handles STOP/UNSTOP at the carrier level, AND sends a webhook to your URL

The webhook handler validates the Twilio signature and hashes the phone number before storing in `sms_opt_outs`.

```typescript
// POST /api/v1/webhooks/twilio/stop handler (full implementation):

import twilio from 'twilio';
import { hashPhone } from '../../infrastructure/security/sanitize';

// Step 1: Verify Twilio signature FIRST — before any DB work
const isValid = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  req.headers['x-twilio-signature'] as string,
  `${process.env.APP_URL}/webhooks/twilio/stop`,
  req.body
);
if (!isValid) return res.status(403).send('Forbidden');

// Step 2: Resolve phone hash from the incoming From field
const incomingPhone = req.body.From as string; // E.164 from Twilio
const phoneHash = hashPhone(incomingPhone);     // SHA-256 HMAC

// Step 3: Update participants — mark ALL pending/self_reported participants for this phone as opted_out
const { data: updatedParticipants } = await supabaseAdmin
  .from('participants')
  .update({ payment_status: 'opted_out', opted_out_at: new Date().toISOString() })
  .in('payment_status', ['pending', 'self_reported'])
  .eq('phone_hash', phoneHash)
  .select('id, event_id, payment_status');

// Step 4: Update sms_opt_outs table — upsert record
await supabaseAdmin
  .from('sms_opt_outs')
  .upsert({ phone_hash: phoneHash, opted_out_at: new Date().toISOString() }, { onConflict: 'phone_hash' });

// Step 5: Update users table — set is_opted_out flag if user exists
await supabaseAdmin
  .from('users')
  .update({ is_opted_out: true })
  .eq('phone_hash', phoneHash);

// Step 6: Write to settlement_log for each participant updated in step 3
for (const participant of updatedParticipants ?? []) {
  await insertSettlementLog({
    participant_id: participant.id,
    event_id: participant.event_id,
    from_status: participant.payment_status,
    to_status: 'opted_out',
    changed_by: 'twilio_stop',
    note: 'STOP received via SMS',
  });
}

// Step 7: Return TwiML response (Twilio expects XML)
res.set('Content-Type', 'text/xml');
res.send(`<Response><Message>You have been unsubscribed from LetsSplyt notifications. Reply START to resubscribe.</Message></Response>`);
```

**Notes:**
- The `opted_out_at` column must exist on the `participants` table (add to `04-Data-Architecture.md` if missing).
- Use `APP_ENV` (not `NODE_ENV`) for any environment checks — Railway sets `NODE_ENV=production` on ALL deployments including staging.

### Error Handling

| Twilio Error Code | Meaning | App Behaviour |
|-------------------|---------|---------------|
| `21211` | Invalid phone number | Log error; mark `participants.message_failed = TRUE`; do not retry |
| `21610` | Attempted to send to a number that has replied STOP | This should never happen if `checkOptOut()` is called first — if it does, immediately insert into `sms_opt_outs` |
| `21614` | Not a mobile number (landline) | Mark as failed; no retry |
| `30003` | Unreachable destination | Mark as failed |
| `30006` | Landline or unreachable carrier | Mark as failed |
| `20429` | Rate limit exceeded | Back off 60 seconds, retry |

### TypeScript Code Example

```typescript
// backend/src/modules/messages/messages.service.ts

import twilio from 'twilio';
import { checkOptOut } from '../notifications/notifications.service';
import { AppError } from '../../infrastructure/errors';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

export interface SendMessageResult {
  participantId: string;
  status: 'sent' | 'skipped_opt_out' | 'skipped_no_phone' | 'failed';
  twilioSid?: string;
  errorCode?: number;
}

export async function sendSplitMessage(
  participantId: string,
  phoneE164: string | null,
  messageText: string,   // must already include See full split: {breakdown_url} from message-assembler
): Promise<SendMessageResult> {
  // Guard: no phone = cash participant, skip
  if (!phoneE164) {
    return { participantId, status: 'skipped_no_phone' };
  }

  // Guard: check opt-out BEFORE any Twilio call — TCPA compliance
  try {
    await checkOptOut(phoneE164);  // throws OptOutError if opted out
  } catch (err) {
    if (err instanceof OptOutError) {
      return { participantId, status: 'skipped_opt_out' };
    }
    throw err;
  }

  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phoneE164,
      body: messageText,
      statusCallback: `${process.env.APP_URL}/api/v1/webhooks/twilio/delivery`,
    });

    // Store the SID in notification_log for delivery tracking
    await logNotification({
      participantId,
      twilioSid: message.sid,
      status: 'sent',
    });

    return { participantId, status: 'sent', twilioSid: message.sid };
  } catch (err: unknown) {
    const twilioErr = err as { code?: number; message?: string };
    return {
      participantId,
      status: 'failed',
      errorCode: twilioErr.code,
    };
  }
}
```

---

## Integration 3 — Supabase Auth (Session Management)

### What LetsSplyt Uses It For

Manages authenticated sessions after OTP verification succeeds. Supabase Auth issues JWTs (access tokens and refresh tokens) that the mobile app uses to authenticate every API call. Supabase Auth does **not** do the OTP — Twilio Verify does that. Supabase Auth only manages what happens after OTP succeeds.

### The Auth Flow (Critical to Understand)

```
1. User enters phone → backend calls Twilio Verify (Integration 1) to send OTP
2. User enters OTP  → backend calls Twilio Verify to check OTP
3. OTP is valid     → backend calls supabase.auth.admin.createUser() or generateLink()
4. Supabase issues JWT pair → backend returns access_token + refresh_token to mobile app
5. Mobile stores refresh_token in Expo SecureStore (never AsyncStorage)
6. Every API call includes: Authorization: Bearer <access_token>
7. 2 minutes before access token expires: mobile calls POST /auth/token/refresh
8. Backend calls supabase.auth.admin.getUserById() or verifies JWT locally
```

### Which Environments

| Environment | Supabase Project | Key Type |
|-------------|-----------------|----------|
| Development | `letssplyt-dev` | Publishable (anon) key on client; Secret key on server |
| Staging | `letssplyt-staging` | Same pattern — separate project |
| Production | `letssplyt-production` | Same pattern — Supabase Pro for daily backups |

Each environment is a completely separate Supabase project with separate credentials. Never use production Supabase keys in development.

### Authentication

```bash
# All environments — both keys required in backend
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_eyJ...    # anon key — safe for client-side, enforces RLS
SUPABASE_SECRET_KEY=sb_secret_eyJ...              # service role key — bypasses RLS, backend only
```

The `SUPABASE_SECRET_KEY` (service role) must **never** be sent to or exposed to the mobile app. It bypasses all RLS policies. Use it only in the Node.js backend for admin operations.

### SDK / Library

```bash
npm install @supabase/supabase-js@^2.0.0
```

Two client instances are required:

```typescript
// backend/src/infrastructure/supabase.ts

import { createClient } from '@supabase/supabase-js';

// Public client — respects RLS — use for most reads/writes in the context of a user
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_PUBLISHABLE_KEY!,
);

// Admin client — bypasses RLS — use only for auth admin operations and guest_pii
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
```

### Session Configuration

| Parameter | Value | Notes |
|-----------|-------|-------|
| Access token TTL | 15 minutes | Configured in Supabase Dashboard → Auth → JWT Settings |
| Refresh token TTL | 30 days | Same location |
| Refresh token rotation | Enabled | Issue new refresh token on every use, invalidate old one |
| Storage on mobile | Expo SecureStore | Never localStorage, never AsyncStorage |

Configure JWT expiry in the Supabase Dashboard before launch. The defaults (1 hour access, 60 day refresh) are too long for a financial app.

### Key API Calls

#### Call 1: Create User (after first OTP verification)

Called when a phone number is verified for the first time. Creates the Supabase Auth user and your `users` table row atomically.

```typescript
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  phone: '+15550001234',
  phone_confirm: true,            // mark phone as already verified (we verified via Twilio)
  user_metadata: {
    display_name: 'Marcus',       // stored in auth.users.raw_user_meta_data
  },
});
// data.user.id → UUID — this is the user's ID used everywhere in your DB
// Insert a row in your users table using data.user.id as the id
```

**Response shape:**
```typescript
{
  data: {
    user: {
      id: 'uuid-string',
      phone: '+15550001234',
      phone_confirmed_at: '2026-06-01T...',
      created_at: '2026-06-01T...',
      user_metadata: { display_name: 'Marcus' },
      app_metadata: {},
    }
  },
  error: null  // or AuthError object if something went wrong
}
```

#### Call 2: Generate Session (get tokens for existing user)

Phone-only LetsSplyt users have no real email. Session creation uses an **internal email** (`{userId}@letssplyt.internal`) plus `generateLink` + `verifyOtp`. **Do not use `createSession()`** — it is not available in `@supabase/supabase-js@2.49` and the REST `/auth/v1/admin/users/{id}/sessions` endpoint returns 404.

**Canonical implementation:** `backend/src/infrastructure/supabase-auth.ts` → `createAdminSession(userId)`.

```typescript
// 1. Ensure auth user has internal email (set on createUser for new users)
const email = await ensureInternalEmail(userId); // e.g. "uuid@letssplyt.internal"

// 2. Admin generateLink → hashed_token
const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email,
});

// 3. Exchange token for session
const { data: verifyData } = await supabaseAdmin.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'email',
});

// verifyData.session.access_token / refresh_token → return to mobile
```

**New user profile write:** After `createUser`, insert into `public.users` via RPC `upsert_user_profile_on_auth` (migration `20260608000000_users_auth_registration.sql`). Direct INSERT via service role can fail RLS (`42501`) without the migration.

#### Call 3: Get User by ID

Used in JWT verification middleware to confirm the user still exists and isn't deleted.

```typescript
const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
// data.user → full user object, or null if not found
// If not found or error: return 401
```

#### Call 4: Update User

Used for `PATCH /users/me` to update phone or metadata in Supabase Auth.

```typescript
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
  user_metadata: { display_name: newName },
});
```

#### Call 5: Delete User (GDPR erasure)

Called from `DELETE /users/me`.

```typescript
const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);
// Also soft-delete your users table row and hard-delete payment_handles
```

### Error Handling

| Error | Meaning | App Behaviour |
|-------|---------|---------------|
| `AuthApiError: User already registered` | Phone already has an account | Proceed as login, not registration |
| `AuthApiError: Invalid JWT` | Token is malformed or tampered | Return 401; force re-auth |
| `AuthApiError: JWT expired` | Access token past 15-minute TTL | Return 401; client should refresh |
| `AuthApiError: Refresh token not found` | Refresh token used, expired, or revoked | Return 401; force logout on client |
| Network timeout | Supabase unreachable | Return 503; do not issue partial sessions |

### TypeScript Code Example

```typescript
// backend/src/modules/auth/auth.service.ts — after OTP verify resolves userId:

import { createAdminSession } from '../../infrastructure/supabase-auth';

const session = await createAdminSession(resolved.userId);
return {
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_in: session.expires_in,
  user: { id: resolved.userId, display_name: resolved.userDisplayName, ... },
};
```

See `auth.service.ts` (`verifyOtpAndCreateSession`, `upsertPublicUserProfile`) and `supabase-auth.ts` for the full flow.

---

## Integration 4 — Supabase Storage (Receipt Images)

### What LetsSplyt Uses It For

Stores receipt images uploaded by the payer before AI parsing. Images are stored in a private bucket, accessed via short-lived signed URLs. The signed URL is passed to the AI provider (Integration 5 or 6) for vision analysis.

### Which Environments

Same Supabase projects as Integration 3. One bucket per project:

| Environment | Supabase Project | Bucket Name |
|-------------|-----------------|-------------|
| Development | `letssplyt-dev` | `receipts` |
| Staging | `letssplyt-staging` | `receipts` |
| Production | `letssplyt-production` | `receipts` |

### Authentication

Same credentials as Integration 3 — `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Storage operations use the admin client (service role) because RLS on the bucket is enforced via policies that check the payer's user ID.

### SDK / Library

```bash
npm install @supabase/supabase-js@^2.0.0
```

Same package. Storage is part of the Supabase SDK.

### Upload Flow

```
1. Mobile captures image with Expo Camera or image picker
2. Mobile compresses image to <500KB JPEG (target; enforce max 10MB pre-compression client-side)
3. Mobile POSTs image as multipart/form-data to backend: POST /events/:eventId/receipt/scan
4. Backend receives the file buffer
5. Backend calls storage.from('receipts').upload() with the buffer
6. Supabase Storage returns the file path
7. Backend creates a signed URL with 1-hour TTL
8. Backend passes the signed URL to A1 (Gemini vision call in dev; Anthropic in prod)
   NOTE: Anthropic does NOT accept URLs — it requires base64. See Integration 6 for the conversion.
9. A1 parses the receipt image
10. Backend returns parsed items to client
```

### Bucket Configuration

Create the bucket in Supabase Dashboard → Storage → New Bucket:
- Bucket name: `receipts`
- Public: **No** (private bucket — use signed URLs)
- File size limit: 10MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

**RLS policy on storage bucket** (only the event's payer can upload to their event folder):

```sql
-- In Supabase Dashboard → Storage → receipts bucket → Policies
-- INSERT policy: payer can upload to their own event folder
CREATE POLICY "payer_upload_receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM events WHERE payer_id = auth.uid()
  )
);

-- SELECT policy: payer can read their own receipts
CREATE POLICY "payer_read_receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM events WHERE payer_id = auth.uid()
  )
);
```

### File Naming Convention

```
{event_id}/{timestamp}_{random}.jpg

Example:
3fa85f64-5717-4562-b3fc-2c963f66afa6/1717200000000_a8b3c4d5.jpg
```

Generate with:
```typescript
const fileName = `${eventId}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
```

### Key API Calls

#### Call 1: Upload File

```typescript
const { data, error } = await supabaseAdmin.storage
  .from('receipts')
  .upload(fileName, fileBuffer, {
    contentType: 'image/jpeg',
    upsert: false,              // never overwrite existing files
  });
// data.path → the stored file path, e.g. '3fa85f.../1717200000000_a8b3.jpg'
// error → null on success, StorageError on failure
```

**Response shape on success:**
```typescript
{
  data: {
    path: '3fa85f64-.../1717200000000_a8b3c4d5.jpg',
    id: 'uuid',
    fullPath: 'receipts/3fa85f64-.../1717200000000_a8b3c4d5.jpg',
  },
  error: null,
}
```

#### Call 2: Create Signed URL (for AI access)

```typescript
const { data, error } = await supabaseAdmin.storage
  .from('receipts')
  .createSignedUrl(filePath, 3600);   // 3600 seconds = 1 hour TTL
// data.signedUrl → the URL to pass to A1
```

**Response shape on success:**
```typescript
{
  data: {
    signedUrl: 'https://[project].supabase.co/storage/v1/object/sign/receipts/...',
  },
  error: null,
}
```

#### Call 3: Delete File (GDPR erasure)

```typescript
const { data, error } = await supabaseAdmin.storage
  .from('receipts')
  .remove([filePath]);  // array of paths to delete
```

### Error Handling

| Error | Meaning | App Behaviour |
|-------|---------|---------------|
| `StorageError: The object exceeded the maximum allowed size` | File > 10MB | Return `413 IMAGE_TOO_LARGE` — client should compress further |
| `StorageError: Duplicate` | File path already exists | Generate a new path (randomness should prevent this) |
| `StorageError: Invalid MIME type` | Not JPEG/PNG/WebP | Return `400 INVALID_FILE_TYPE` |
| Network timeout | Supabase unreachable | Return `503`; client can retry the entire upload |

### TypeScript Code Example

```typescript
// backend/src/modules/ai/receipt-parser/receipt-upload.service.ts

import { supabaseAdmin } from '../../infrastructure/supabase';
import { randomBytes } from 'crypto';
import { AppError } from '../../infrastructure/errors';

export async function uploadReceiptImage(
  eventId: string,
  fileBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<{ filePath: string; signedUrl: string }> {
  const ext = mimeType.split('/')[1];
  const fileName = `${eventId}/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('receipts')
    .upload(fileName, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError || !uploadData) {
    throw new AppError('UPLOAD_FAILED', uploadError?.message ?? 'Upload failed');
  }

  const { data: urlData, error: urlError } = await supabaseAdmin.storage
    .from('receipts')
    .createSignedUrl(uploadData.path, 3600);

  if (urlError || !urlData) {
    throw new AppError('SIGNED_URL_FAILED', urlError?.message ?? 'Could not create signed URL');
  }

  return {
    filePath: uploadData.path,
    signedUrl: urlData.signedUrl,
  };
}

// Used in GDPR deletion flow
export async function deleteReceiptImage(filePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from('receipts')
    .remove([filePath]);

  if (error) {
    // Log but do not throw — deletion failure should not block GDPR response
    logger.error('Failed to delete receipt image', { filePath, error: error.message });
  }
}
```

---

## Integration 5 — Google Gemini API (A1 + A2 + A3 in Dev/Staging)

### What LetsSplyt Uses It For

Powers all three AI agents (A1 receipt parsing, A2 split calculation, A3 message composition) in development and staging environments. Gemini 2.5 Flash is chosen for its generous free tier, fast response time, and multimodal support (vision).

### Which Environments

| Environment | AI Provider | Model |
|-------------|------------|-------|
| Development | Gemini | `gemini-2.5-flash` |
| Staging | Gemini | `gemini-2.5-flash` |
| Production | Anthropic Claude | `claude-haiku-4-5-20251001` (see Integration 6) |

Environment variable that controls the switch:
```bash
AI_PROVIDER_A1=gemini    # or 'anthropic' in production
AI_MODEL_A1=gemini-2.5-flash
AI_PROVIDER_A2=gemini
AI_MODEL_A2=gemini-2.5-flash
AI_PROVIDER_A3=gemini
AI_MODEL_A3=gemini-2.5-flash
```

### Authentication

```bash
GEMINI_API_KEY=AIzaSy...    # from aistudio.google.com → Get API key
```

Obtain from Google AI Studio (aistudio.google.com). The free tier grants 15 RPM and 1 million tokens per minute on Gemini 2.5 Flash. No credit card required for the free tier.

### SDK / Library

```bash
npm install @google/generative-ai@^0.21.0
```

### Key API Calls

#### Call 1: Vision Call (A1 — Receipt Parsing)

Sends a receipt image + parsing prompt to Gemini. The image is sent as base64-encoded inline data (Gemini does not fetch from URLs in the standard SDK).

**Important for A1:** The signed URL from Supabase Storage must be downloaded and converted to base64 before sending to Gemini. The Gemini SDK sends image data as `inlineData`, not as a URL.

```typescript
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const result = await model.generateContent({
  contents: [
    {
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64ImageString,   // base64 encoded, NOT a URL
          },
        },
        {
          text: receiptParserPrompt,  // from receipt-parser.prompt.ts
        },
      ],
    },
  ],
  generationConfig: {
    maxOutputTokens: 1024,
  },
});
```

**Response shape:**
```typescript
{
  response: {
    text(): string,            // call result.response.text() to get the text output
    usageMetadata: {
      promptTokenCount: number,
      candidatesTokenCount: number,
      totalTokenCount: number,
    },
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text: '{ "items": [...] }' }],
        },
        finishReason: 'STOP',
        safetyRatings: [...],
      }
    ],
  }
}
```

Extract the response text with `result.response.text()`.

#### Call 2: Text-Only Call (A2 — Split Calculation, A3 — Message Composition)

Same structure but without the image part.

```typescript
const result = await model.generateContent({
  contents: [
    {
      role: 'user',
      parts: [
        { text: splitCalculatorPrompt },   // or message composer prompt
      ],
    },
  ],
  generationConfig: {
    maxOutputTokens: 512,   // A2: 512; A3: 200
  },
});

const text = result.response.text();
```

### Rate Limits

| Tier | RPM (Requests per Minute) | Notes |
|------|--------------------------|-------|
| Free tier | 15 RPM | Sufficient for dev/staging with low concurrency |
| Pay-as-you-go | 2000 RPM | Enable billing in Google Cloud to unlock |

For staging, the free tier is sufficient. If staging tests hit rate limits, add a short delay between AI calls or upgrade to pay-as-you-go.

### Error Handling

| HTTP Status / Error | Meaning | App Behaviour |
|---------------------|---------|---------------|
| `429 Too Many Requests` | Rate limit exceeded | Wait 60 seconds, retry with exponential backoff |
| `503 Service Unavailable` | Gemini overloaded | Retry with backoff (the LLM harness handles this with 3 retries) |
| `400 Bad Request` | Invalid request (e.g. image too large, malformed prompt) | Log error; throw `AppError('PARSE_FAILED', ...)` |
| Empty `candidates` array | Safety filter blocked response | Log; retry once with slightly different prompt framing; if still empty, throw |
| Response timeout (>30 seconds) | Gemini hung | Abort using `AbortController`; retry |

Timeout for all Gemini calls: **30 seconds**. Set in the provider adapter via `AbortController`.

### TypeScript Code Example

The `GeminiAdapter` from `07-AI-Agent-Specification.md` Section 2 is the canonical implementation. Here is the complete standalone version for reference:

```typescript
// backend/src/infrastructure/llm/providers/gemini.adapter.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMMessage, LLMResponse } from '../llm.provider';

export class GeminiAdapter implements LLMProvider {
  readonly supportsVision = true;
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly model: string) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions,   // { maxTokens: number; timeoutMs: number; temperature?: number }
  ): Promise<LLMResponse> {
    const { maxTokens, timeoutMs = 30_000 } = options;
    const genModel = this.genAI.getGenerativeModel({
      model: this.model,
      generationConfig: { maxOutputTokens: maxTokens },
    });

    // Flatten LLMMessage[] into Gemini parts format
    const parts = messages.flatMap(m =>
      typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map(block =>
            block.type === 'image'
              ? { inlineData: { mimeType: block.mimeType, data: block.base64 } }
              : { text: block.text }
          )
    );

    const resolvedTimeout = timeoutMs ?? 30_000;
    const abortPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini timeout after ' + resolvedTimeout + 'ms')), resolvedTimeout)
    );

    const result = await Promise.race([
      genModel.generateContent({ contents: [{ role: 'user', parts }] }),
      abortPromise,
    ]);

    const text = result.response.text();
    const usage = result.response.usageMetadata;

    return {
      text,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      },
      modelUsed: this.model,
    };
  }
}

// How A1 fetches the image before calling Gemini:
export async function fetchSignedUrlAsBase64(signedUrl: string): Promise<{
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}> {
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from signed URL: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await response.arrayBuffer();
  return {
    base64: Buffer.from(buffer).toString('base64'),
    mimeType: contentType as 'image/jpeg' | 'image/png' | 'image/webp',
  };
}
```

---

## Integration 6 — Anthropic Claude API (A1 + A2 + A3 in Production)

### What LetsSplyt Uses It For

Powers all three AI agents in production. Claude Haiku 4.5 is chosen for its lowest hallucination rate on financial documents (receipts), fast response time, and low cost per token. It is the production-only replacement for Gemini.

### Which Environments

| Environment | Uses Anthropic? |
|-------------|----------------|
| Development | No (uses Gemini) |
| Staging | No (uses Gemini) |
| Production | Yes |

Production env vars:
```bash
AI_PROVIDER_A1=anthropic
AI_MODEL_A1=claude-haiku-4-5-20251001
AI_PROVIDER_A2=anthropic
AI_MODEL_A2=claude-haiku-4-5-20251001
AI_PROVIDER_A3=anthropic
AI_MODEL_A3=claude-haiku-4-5-20251001
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MONTHLY_SPEND_LIMIT=100         # dollars — set in Anthropic console
```

### Authentication

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...    # from console.anthropic.com → API Keys
```

Obtain from Anthropic Console (console.anthropic.com). Set a spending cap of $100/month in the console under Billing → Spending Limits before deploying to production.

### SDK / Library

```bash
npm install @anthropic-ai/sdk@^0.30.0
```

### Key API Calls

#### Call 1: Vision Call (A1 — Receipt Parsing)

**Critical difference from Gemini:** Anthropic's vision API requires **base64-encoded image data**, not a URL. The backend must:
1. Get the signed URL from Supabase Storage
2. Download the image from that URL
3. Convert to base64
4. Send the base64 data to Anthropic

This conversion is the responsibility of the backend before calling the AI provider. The `AnthropicAdapter` handles the base64 format internally — the harness just passes `LLMImageBlock` objects with `base64` and `mimeType`.

**Request shape:**
```typescript
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',       // 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
            data: base64ImageString,        // base64 encoded image data, NOT a URL
          },
        },
        {
          type: 'text',
          text: receiptParserPrompt,
        },
      ],
    },
  ],
});
```

**Response shape:**
```typescript
{
  id: 'msg_01XFDUDYJgAACzvnptvVoYEL',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: '{ "items": [...], "total": 64.50 }',
    }
  ],
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn',
  usage: {
    input_tokens: 1024,
    output_tokens: 512,
  },
}
```

Extract with: `response.content[0].type === 'text' ? response.content[0].text : ''`

#### Call 2: Text-Only Call (A2 — Split Calculation, A3 — Message Composition)

Same structure but without the image block:

```typescript
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 512,           // A2: 512 tokens; A3: 200 tokens
  messages: [
    {
      role: 'user',
      content: splitCalculatorPrompt,   // plain string for text-only calls
    },
  ],
});
```

### Signed URL to Base64 Conversion

This conversion must happen in the backend before calling Anthropic. It must not happen in the mobile app (the mobile app never touches the AI API directly).

```typescript
// backend/src/modules/ai/receipt-parser/receipt-parser.preprocess.ts

export async function downloadAndConvertToBase64(signedUrl: string): Promise<{
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}> {
  const response = await fetch(signedUrl, {
    signal: AbortSignal.timeout(10_000),   // 10-second timeout for the download
  });

  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
  }

  const contentType = (response.headers.get('content-type') ?? 'image/jpeg')
    .split(';')[0]
    .trim() as 'image/jpeg' | 'image/png' | 'image/webp';

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { base64, mimeType: contentType };
}
```

### Rate Limits and Cost Management

| Limit | Value | Notes |
|-------|-------|-------|
| Default RPM | 4000 (Haiku) | More than sufficient for MVP traffic |
| Token rate limit | 400,000 tokens per minute | Monitor via response headers |
| Spending cap | $100/month | Set in Anthropic console — hard blocks when hit |
| Approximate cost | ~$0.001 per receipt parse | Estimate; actual depends on receipt complexity |

Monitor token usage in the `ai_audit_log` table. Alert via Sentry if total tokens per day exceeds a threshold that would hit the monthly cap.

### Error Handling

| HTTP Status | Error Type | Meaning | App Behaviour |
|-------------|-----------|---------|---------------|
| `529` | `overloaded_error` | Anthropic servers overloaded | Retry with exponential backoff (handled by harness) |
| `429` | `rate_limit_error` | Token or request rate limit hit | Back off 60 seconds; retry; log |
| `400` | `invalid_request_error` | Malformed request (bad base64, unsupported model) | Log full error; do NOT retry; throw `AppError` |
| `401` | `authentication_error` | Invalid API key | Alert on-call immediately; do not retry |
| `500` | `api_error` | Anthropic internal error | Retry once after 5 seconds |

Timeout for Anthropic calls: **60 seconds** (vision calls with large receipts can be slow). Text-only calls should complete in under 10 seconds.

### TypeScript Code Example

```typescript
// backend/src/infrastructure/llm/providers/anthropic.adapter.ts

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMResponse } from '../llm.provider';

export class AnthropicAdapter implements LLMProvider {
  readonly supportsVision = true;
  private readonly client: Anthropic;

  constructor(private readonly model: string) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,   // SDK reads ANTHROPIC_API_KEY by default; explicit is clearer
    });
  }

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<LLMResponse> {
    const { maxTokens = 4096, timeoutMs = 60_000, temperature = 0 } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: maxTokens,
          messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string'
              ? m.content
              : m.content.map(block =>
                  block.type === 'image'
                    ? {
                        type: 'image' as const,
                        source: {
                          type: 'base64' as const,
                          media_type: block.mimeType,
                          data: block.base64,
                        },
                      }
                    : { type: 'text' as const, text: block.text }
                ),
          })),
        },
        { signal: controller.signal },
      );

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        text,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        modelUsed: response.model,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

---

## Integration 7 — Upstash Redis (Caching and Rate Limiting)

### What LetsSplyt Uses It For

Two primary uses: (1) OTP rate limiting — tracking how many OTP requests a phone number or IP has made in the current window, and (2) nudge cooldown tracking — preventing repeated nudges to the same participant within 48 hours.

### Which Environments

| Environment | Upstash Database | Notes |
|-------------|-----------------|-------|
| Development | `letssplyt-redis-dev` | Free tier; shared with staging is acceptable |
| Staging | `letssplyt-redis-dev` | Can share dev database — data is ephemeral |
| Production | `letssplyt-redis-production` | Isolated database; pay-as-you-go |

```bash
# Development and staging share:
UPSTASH_REDIS_REST_URL=https://[dev-database-id].upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# Production uses separate database:
UPSTASH_REDIS_REST_URL=https://[prod-database-id].upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

### Authentication

Credentials from Doppler:

```bash
UPSTASH_REDIS_REST_URL=https://[database-id].upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxx
```

Obtain from Upstash Console (console.upstash.com) → Redis → your database → REST API section.

### SDK / Library

```bash
npm install @upstash/redis@^1.34.0
```

Upstash Redis uses a REST API — no TCP connections, no persistent connections, works in serverless and Railway. The SDK wraps the REST API.

### Connection

```typescript
// backend/src/infrastructure/redis.ts

import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

### Key Usage Patterns

#### Pattern 1: OTP Rate Limiting

Track how many OTP requests have been made from a phone or IP within a time window. Checked **before** calling Twilio.

```typescript
// Key: otpReq:{phoneHash} — how many OTP requests this phone made in the last hour
// Key: otpCheck:{phoneHash} — how many OTP check attempts in the last 10 minutes

// Check and increment atomically:
const requestCount = await redis.incr(`otpReq:${phoneHash}`);
if (requestCount === 1) {
  // First request in this window — set the expiry
  await redis.expire(`otpReq:${phoneHash}`, 3600);   // 1 hour window
}
if (requestCount > 5) {
  throw new AppError('OTP_RATE_LIMITED', 'Too many OTP requests. Try again in 1 hour.');
}
```

Full rate limiting keys:

| Key Pattern | TTL | Limit | Purpose |
|------------|-----|-------|---------|
| `otpReq:{sha256(phoneE164)}` | 3600s (1 hour) | 5 | OTP requests per phone per hour |
| `otpCheck:{sha256(phoneE164)}` | 600s (10 min) | 3 | OTP check attempts per phone per 10 min |
| `otpIp:{sha256(ip)}` | 3600s (1 hour) | 20 | OTP requests per IP per hour |

Use `sha256(phoneE164)` as the key suffix — never the raw phone number. Same hashing function used in the analytics PII scrubber.

#### Pattern 2: Nudge Cooldown

Prevent the payer from nudging the same participant more than once in 24 hours.

```typescript
// Set on nudge send:
await redis.set(`nudge:${participantId}`, '1', { ex: 172800 });   // EX 172800 = 48 hours

// Check before allowing nudge:
const cooldownActive = await redis.get(`nudge:${participantId}`);
if (cooldownActive !== null) {
  // Get TTL to tell the user when they can nudge again
  const ttl = await redis.ttl(`nudge:${participantId}`);
  const nextAvailableAt = new Date(Date.now() + ttl * 1000);
  throw new AppError('NUDGE_COOLDOWN', `Cooldown active`, { nextAvailableAt });
}
```

Key pattern: `nudge:{participantId}` (UUID, not PII — safe to log).

#### Pattern 2b: `buildNudgeMessage` — Nudge SMS Text Builder

```typescript
// File: backend/src/modules/messages/nudge.builder.ts

export function buildNudgeMessage(params: {
  participantDisplayName: string;   // already sanitized
  payerDisplayName: string;         // already sanitized
  amountFormatted: string;          // e.g. "$12.50" — from formatCurrency()
  paymentHandles: Array<{ provider: string; handleDisplay: string }>;
  eventTitle: string;
}): string

// Returns: a plain-text SMS string, max 160 characters (single SMS segment)
// Example: "Hi Alex! Pawan is waiting for your $12.50 from Dinner at Nobu. Pay via Venmo @pawan or CashApp $pawan"
// If handles exceed character limit, include only the first one with "& more in the app"
```

#### Pattern 3: Session Caching (Optional)

Supabase handles session management. Redis session caching is **not required** and should not be implemented unless profiling reveals Supabase JWT verification is a bottleneck. Do not add complexity before it is needed.

### Error Handling

| Error | Meaning | App Behaviour |
|-------|---------|---------------|
| Connection refused / timeout | Upstash unreachable | **Do not block the user** — if Redis is down, allow the request but log the failure. Rate limiting failing open is better than the app being down. |
| `WRONGTYPE` | Wrong Redis type for key | Bug — log and alert; should not happen in normal operation |
| Token auth failure | Invalid `UPSTASH_REDIS_REST_TOKEN` | Log and alert; Redis will be effectively unavailable |

Rate limiting should fail open (allow the request) if Redis is unreachable. This is a conscious tradeoff: briefly allowing extra OTP requests is less harmful than blocking all logins.

### TypeScript Code Example

```typescript
// backend/src/modules/auth/auth.middleware.ts

import { redis } from '../../infrastructure/redis';
import { createHash } from 'crypto';
import { AppError } from '../../infrastructure/errors';
import type { Request, Response, NextFunction } from 'express';

function hashForRedis(value: string): string {
  return createHash('sha256')
    .update(value + process.env.ANALYTICS_SALT!)
    .digest('hex')
    .slice(0, 32);   // truncate to 32 chars — still sufficient entropy for a Redis key
}

export async function otpRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { phone_e164 } = req.body as { phone_e164?: string };
  const ip = req.ip ?? 'unknown';

  if (!phone_e164) {
    next();
    return;
  }

  const phoneKey = `otpReq:${hashForRedis(phone_e164)}`;
  const ipKey = `otpIp:${hashForRedis(ip)}`;

  try {
    // Increment both counters atomically
    const [phoneCount, ipCount] = await Promise.all([
      redis.incr(phoneKey),
      redis.incr(ipKey),
    ]);

    // Set TTL on first increment only
    if (phoneCount === 1) await redis.expire(phoneKey, 3600);
    if (ipCount === 1)    await redis.expire(ipKey, 3600);

    if (phoneCount > 5) {
      res.status(429).json({ error: { code: 'OTP_RATE_LIMITED', message: 'Too many requests for this number.' } });
      return;
    }
    if (ipCount > 20) {
      res.status(429).json({ error: { code: 'IP_RATE_LIMITED', message: 'Too many requests.' } });
      return;
    }
  } catch (redisErr) {
    // Redis unavailable — fail open (allow the request through)
    logger.warn('Redis rate limit check failed — failing open', { error: redisErr });
  }

  next();
}

export async function setNudgeCooldown(participantId: string): Promise<void> {
  await redis.set(`nudge:${participantId}`, '1', { ex: 172800 });   // 48-hour cooldown
}

export async function checkNudgeCooldown(participantId: string): Promise<void> {
  const active = await redis.get(`nudge:${participantId}`);
  if (active !== null) {
    const ttl = await redis.ttl(`nudge:${participantId}`);
    const nextAvailableAt = new Date(Date.now() + ttl * 1000);
    throw new AppError('NUDGE_COOLDOWN', 'Nudge cooldown active', { nextAvailableAt });
  }
}
```

---

## Integration 8 — Upstash QStash (Background Job Queue)

### What LetsSplyt Uses It For

Schedules and delivers background jobs: nudge reminder checks (48 hours after messages sent), nightly guest PII purges, and monthly analytics partition creation. QStash is HTTP-based and serverless-compatible — it POSTs to your backend URL after a delay rather than requiring a persistent worker.

### Which Environments

| Environment | Queue Name | Notes |
|-------------|-----------|-------|
| Development | `letssplyt-dev` | Jobs may be tested locally with ngrok for the callback URL |
| Staging | `letssplyt-staging` | Real jobs, real delays |
| Production | `letssplyt-production` | Isolated queue; separate from staging |

Queue names are logical labels — in practice you use one QStash account and separate jobs by environment via the callback URL (which points to the correct environment's backend).

### Authentication

```bash
QSTASH_TOKEN=eyJ...                      # from Upstash Console → QStash → Tokens
QSTASH_CURRENT_SIGNING_KEY=sig_xxx...    # from Upstash Console → QStash → Signing Keys
QSTASH_NEXT_SIGNING_KEY=sig_yyy...       # rotated periodically by Upstash
```

`QSTASH_TOKEN` is used by the producer (your code publishing jobs).
`QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are used by the consumer (your webhook handler verifying the request came from QStash).

### SDK / Library

```bash
npm install @upstash/qstash@^2.7.0
```

### Key API Calls

#### Call 1: Publish a Job (Producer)

Called after `POST /events/:eventId/messages/send` completes to schedule the 48-hour nudge check.

**Request:**
```typescript
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

await qstash.publishJSON({
  url: `${process.env.APP_URL}/api/v1/jobs/nudge-check`,
  body: {
    eventId: 'uuid-string',
    jobType: 'nudge_reminder',
  },
  delay: 60 * 60 * 48,    // 172800 seconds = 48 hours
  retries: 3,              // QStash retries on non-2xx response, with exponential backoff
});
```

**Response shape:**
```typescript
{
  messageId: 'msg_xxxxxxxxxxxxxxxxxx',   // QStash job ID — log this for debugging
}
```

**Other job schedules:**

```typescript
// Guest PII purge — scheduled via QStash cron in Upstash Dashboard
// URL: https://your-backend.railway.app/api/v1/jobs/purge-guest-pii
// Cron: 0 2 * * *   (daily at 02:00 UTC)

// Analytics partition creation — scheduled via QStash cron
// URL: https://your-backend.railway.app/api/v1/jobs/create-analytics-partition
// Cron: 0 0 25 * *  (monthly on the 25th at 00:00 UTC)
```

Set these crons in the Upstash Console → QStash → Schedules → New Schedule. QStash cron requires a paid Upstash plan.

#### Call 2: Verify QStash Signature (Consumer)

Every job consumer endpoint must verify the request came from QStash before processing. This prevents spoofed requests.

```typescript
import { Receiver } from '@upstash/qstash';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const isValid = await receiver.verify({
  signature: req.headers['upstash-signature'] as string,
  body: JSON.stringify(req.body),    // must be the raw body string, not re-serialised
});

if (!isValid) {
  res.status(403).json({ error: 'Invalid QStash signature' });
  return;
}
```

**Important:** The body passed to `receiver.verify()` must be the **raw request body as a string**, not `JSON.stringify(req.body)` if the body has already been parsed by Express. Use a raw body middleware for QStash webhook endpoints:

```typescript
// In app.ts — add before the JSON body parser for /api/v1/jobs/* routes
app.use('/api/v1/jobs', express.raw({ type: 'application/json' }));
// Then in the handler: const rawBody = req.body.toString();
// const parsedBody = JSON.parse(rawBody);
```

### Job Types and Definitions

| Job Type | Endpoint | Trigger | Delay | Retry Policy |
|----------|---------|---------|-------|-------------|
| `nudge_reminder` | `POST /api/v1/jobs/nudge-check` | After messages sent | 48 hours | 3 retries, exponential backoff |
| `guest_pii_purge` | `POST /api/v1/jobs/purge-guest-pii` | QStash cron: daily 02:00 UTC | 0 (immediate) | 3 retries |
| `analytics_partition_create` | `POST /api/v1/jobs/create-analytics-partition` | QStash cron: 25th of each month 00:00 UTC | 0 (immediate) | 2 retries |

### Retry Policy and Dead Letter Queue

QStash retries jobs that return a non-2xx response:
- Attempt 1: immediate
- Attempt 2: 1 minute later
- Attempt 3: 10 minutes later

After 3 failed attempts, the job goes to the QStash dead letter queue (DLQ). Monitor the DLQ in the Upstash Console. Set up an email alert in Upstash for DLQ entries. A nudge job in the DLQ means affected participants may not receive their reminder — check and replay manually.

### Error Handling

| Error | Meaning | App Behaviour |
|-------|---------|---------------|
| Non-2xx response from consumer endpoint | Job processing failed | QStash retries up to 3 times |
| Signature verification fails | Spoofed or tampered request | Return 403; log the attempt |
| `eventId` not found in DB | Event deleted between enqueue and execution | Return 200 (silently discard — job is stale) |
| Nudge cooldown active for participant | Already nudged recently | Skip this participant; return 200 |
| QStash API rate limit | Too many publishes | Unlikely in this app — QStash has generous limits |

Consumer endpoints must return 200 even when a job is skipped (e.g. event already settled, participant already paid). A non-2xx triggers a retry, which wastes resources. Return 200 with a body explaining the skip for debugging.

### TypeScript Code Example

```typescript
// backend/src/modules/jobs/nudge.controller.ts

import { Receiver } from '@upstash/qstash';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { checkOptOut } from '../notifications/notifications.service';
import { sendSplitMessage } from '../messages/messages.service';
import { setNudgeCooldown } from '../../infrastructure/redis';
import type { Request, Response } from 'express';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function handleNudgeCheck(req: Request, res: Response): Promise<void> {
  // 1. Verify QStash signature
  const rawBody = (req.body as Buffer).toString('utf-8');  // raw middleware applied upstream
  const isValid = await receiver.verify({
    signature: req.headers['upstash-signature'] as string,
    body: rawBody,
  });

  if (!isValid) {
    res.status(403).json({ error: 'Invalid QStash signature' });
    return;
  }

  const { eventId } = JSON.parse(rawBody) as { eventId: string };

  // 2. Load pending participants for this event
  const { data: participants, error } = await supabaseAdmin
    .from('participants')
    .select('id, display_name, payment_status, last_nudged_at, guest_pii_token, user_id')
    .eq('event_id', eventId)
    .in('payment_status', ['pending', 'self_reported']);

  if (error || !participants) {
    // Return 200 — don't trigger a retry for a DB error; log instead
    logger.error('handleNudgeCheck: DB query failed', { eventId, error });
    res.json({ nudged: 0, skipped: 0, reason: 'db_error' });
    return;
  }

  // 3. If event is fully settled, skip the whole job
  if (participants.length === 0) {
    res.json({ nudged: 0, skipped: 0, reason: 'all_settled' });
    return;
  }

  let nudgedCount = 0;
  let skippedCount = 0;

  for (const participant of participants) {
    // Check 24-hour cooldown via Redis
    try {
      const cooldownKey = `nudge:${participant.id}`;
      const active = await redis.get(cooldownKey);
      if (active !== null) { skippedCount++; continue; }
    } catch (_) {
      // Redis unavailable — proceed without cooldown check (fail open)
    }

    // Get phone from guest_pii or users table
    // Import resolveParticipantPhone from backend/src/infrastructure/security/sanitize.ts
    // This function decrypts participant.phone_encrypted using PHONE_ENCRYPTION_KEY.
    // If phone_encrypted is null (App Member), the phone is retrieved via
    // supabaseAdmin.auth.admin.getUserById(participant.user_id) and the returned
    // phone is used only within scope — never stored.
    const phoneE164 = await resolveParticipantPhone(participant);
    if (!phoneE164) { skippedCount++; continue; }

    // Check opt-out
    try {
      await checkOptOut(phoneE164);
    } catch {
      skippedCount++;
      continue;
    }

    // Build nudge message and send
    const nudgeText = buildNudgeMessage({
      participantDisplayName: sanitizePromptInput(participant.display_name, { maxLength: 100 }),
      payerDisplayName: sanitizePromptInput(payer.display_name, { maxLength: 100 }),
      amountFormatted: formatCurrency(participant.amount_owed_minor_units / 100, event.currency, event.locale),
      paymentHandles: payer.paymentHandles.map(h => ({
        provider: h.provider,
        handleDisplay: h.handle_display  // already decrypted
      })),
      eventTitle: event.title
    });
    await sendSplitMessage(participant.id, phoneE164, nudgeText);
    await setNudgeCooldown(participant.id);

    nudgedCount++;
  }

  res.json({ nudged: nudgedCount, skipped: skippedCount });
}
```

---

## Integration 9 — Expo Push Notifications (Payment Alerts)

### What LetsSplyt Uses It For

Sends Expo push notifications and writes parallel **in-app inbox** rows (`user_notifications`) for registered app users. Push supplements Twilio SMS — guests receive SMS only.

**Active triggers (E10-S02 as built):**

| Trigger | Recipient | Inbox `type` | Push `data.type` |
|---|---|---|---|
| Member self-reports (per event) | Creator | `member_paid` | `member_paid` |
| Event fully settled | Creator | `event_fully_settled` | `event_fully_settled` |
| Bulk self-report all | Creator | `member_paid_all` | `member_paid_all` |
| Manual add registered user | Member | `added_to_event` | `added_to_event` |
| Organizer nudge | Member | `nudge` | `nudge` |
| Messages sent (first) | Member | `share_ready` | `share_ready` |
| Share revised post-send | Member | `share_edited` | `share_edited` |

**Not sent (removed from MVP policy):** push to member on creator payment confirm; push to creator "tap to confirm" on self-report.

**In-app inbox API:** `GET /users/me/notifications`, `GET /users/me/notifications/unread-count`, `PATCH /users/me/notifications/:id/read`. Mobile bell badge reads `unread_count`; mark-read uses `apiPatchAuth`.

**Important distinction:** Push notifications supplement Twilio messages — they do not replace them. Guests (without the app) receive Twilio SMS only. App users receive Twilio SMS plus push/inbox for relevant events.

### Which Environments

| Environment | Push Notifications | Behaviour |
|-------------|-------------------|-----------|
| Development | Disabled | Log the notification text to console instead of sending |
| Staging | Enabled | Real push notifications to real devices |
| Production | Enabled | Real push notifications |

In development, guard every push call with:
```typescript
// Use APP_ENV, NOT NODE_ENV — Railway sets NODE_ENV=production on ALL deployments including staging.
// APP_ENV is set by Doppler and correctly reflects development | staging | production.
if (process.env.APP_ENV === 'development') {
  logger.info('[DEV] Push notification (not sent):', { token, message });
  return;
}
```

### Registration Flow

```
1. App launches → mobile calls Notifications.getExpoPushTokenAsync()
2. Mobile receives an Expo push token (e.g. 'ExponentPushToken[xxx...]')
3. Mobile sends token to backend: POST /users/me/push-token with { device_id, token, platform }
4. Backend upserts into device_sessions table (one row per device per user — see server-side handler below)
5. Backend uses this token when sending push notifications to this user
6. Token can change on reinstall or permission revoke — update on every app launch
```

**Server-side push token registration handler (`POST /users/me/push-token`):**

```typescript
// POST /users/me/push-token handler:
const { device_id, token, platform } = req.body;

// Upsert into device_sessions table (one row per device per user)
await supabase
  .from('device_sessions')
  .upsert({
    user_id: req.user.id,
    device_id,
    push_token: token,
    platform,
    last_seen: new Date().toISOString(),
  }, {
    onConflict: 'user_id,device_id'  // unique constraint
  });
```

> **Note:** The `device_sessions` table (defined in 04-Data-Architecture.md) stores one row per device per user. This allows multi-device support — a user with both iPhone and Android receives push notifications on all registered devices.

### Authentication

Expo Push API does not require authentication for standard push notifications (it uses the token to identify the target device). For enhanced deliverability and analytics, use Expo's enhanced push service with an access token, but this is optional at MVP.

No server-side API key is needed for basic push. The Expo push token obtained from the device is the authentication mechanism.

### SDK / Library

**Backend (for sending):**
```bash
npm install expo-server-sdk@^3.10.0
```

**Mobile (for receiving token):**
```bash
npx expo install expo-notifications expo-device
```

### Key API Calls

#### Call 1: Get Push Token (Mobile)

```typescript
// mobile/src/modules/notifications/notifications.setup.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulators cannot receive push notifications
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    // User denied — store null, do not retry aggressively
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  return tokenData.data;   // e.g. 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
}
```

Send the token to the backend after obtaining it, and again on every app launch (tokens can change):

```typescript
// After login or on app foreground
const token = await registerForPushNotifications();
if (token) {
  await updateUserPushToken(token);  // calls POST /users/me/push-token with { device_id, token, platform }
}
```

#### Call 2: Send Push Notification (Backend)

Sends push notifications to one or more device tokens. Batch up to 100 tokens per request.

```typescript
// backend/src/modules/notifications/notifications.service.ts

import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { AppError } from '../../infrastructure/errors';

const expo = new Expo();

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;   // deep link data, event IDs, etc.
}

export async function sendPushNotification(
  expoPushToken: string | null,
  payload: PushNotificationPayload,
): Promise<void> {
  if (process.env.APP_ENV === 'development') {
    logger.info('[DEV] Push notification suppressed', { expoPushToken, payload });
    return;
  }

  if (!expoPushToken) {
    logger.info('No push token for user — skipping push notification');
    return;
  }

  if (!Expo.isExpoPushToken(expoPushToken)) {
    logger.warn('Invalid Expo push token format', { token: expoPushToken });
    await clearInvalidToken(expoPushToken);
    return;
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  };

  const chunks = expo.chunkPushNotifications([message]);

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    await handlePushTickets(tickets, [expoPushToken]);
  }
}

export async function sendBatchPushNotifications(
  recipients: Array<{ userId: string; token: string }>,
  payload: PushNotificationPayload,
): Promise<void> {
  if (process.env.APP_ENV === 'development') {
    logger.info('[DEV] Batch push suppressed', { count: recipients.length });
    return;
  }

  const messages: ExpoPushMessage[] = recipients
    .filter(r => Expo.isExpoPushToken(r.token))
    .map(r => ({
      to: r.token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

  // Expo requires batches of max 100
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    await handlePushTickets(
      tickets,
      recipients.map(r => r.token),
    );
  }
}
```

#### Call 3: Handle Push Tickets and Receipts

After sending, Expo returns tickets. Tickets with `status === 'error'` must be handled. For `DeviceNotRegistered` errors, remove the token from the database.

```typescript
async function handlePushTickets(
  tickets: ExpoPushTicket[],
  tokens: string[],
): Promise<void> {
  const receiptIds: string[] = [];

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === 'ok') {
      receiptIds.push(ticket.id);
    } else if (ticket.status === 'error') {
      const token = tokens[i];
      logger.warn('Push ticket error', { token, error: ticket.details?.error });

      if (ticket.details?.error === 'DeviceNotRegistered') {
        // Token is stale — remove from DB
        await clearInvalidToken(token ?? '');
      }
    }
  }

  // Optionally: fetch receipts to confirm delivery (do this asynchronously)
  // expo.getPushNotificationReceiptsAsync(receiptIds) — check receipt.status
}

async function clearInvalidToken(token: string): Promise<void> {
  await supabaseAdmin
    .from('device_sessions')
    .update({ push_token: null })
    .eq('push_token', token);
}
```

### Error Handling

| Error | Meaning | App Behaviour |
|-------|---------|---------------|
| `DeviceNotRegistered` | Token invalid (app uninstalled or permissions revoked) | Remove token from `device_sessions.push_token` — no further sends to this token |
| `MessageTooBig` | Notification payload exceeds 4KB | Shorten the `body` field; this should not happen with normal messages |
| `MessageRateExceeded` | Too many notifications to one device | Back off; this should not happen at MVP scale |
| `InvalidCredentials` | Expo project ID mismatch | Alert on-call; push will not work until resolved |
| Network error reaching Expo API | Transient failure | Retry once after 2 seconds; log if still failing |

### Notification Types and When They Fire

| Notification Type | Recipient | Trigger | `data` payload |
|------------------|-----------|---------|---------------|
| `split_received_push` | Participant (app user) | After `POST /messages/send` | `{ eventId, participantId, amountOwed }` |
| `payment_self_report_push` | Payer | When participant self-reports | `{ eventId, participantId }` |
| `payment_confirmed_push` | Participant | When payer confirms | `{ eventId, participantId }` |
| `payment_disputed_push` | Participant | When payer disputes | `{ eventId, participantId, note }` |
| `nudge_suggestion_push` | Payer | 48-hour nudge check job fires | `{ eventId, pendingCount }` |
| `all_settled_push` | Payer | When all participants are confirmed | `{ eventId }` |

### TypeScript Code Example — Complete Notification Service

```typescript
// backend/src/modules/notifications/notifications.service.ts

import Expo from 'expo-server-sdk';
import { redis } from '../../infrastructure/redis';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { AppError } from '../../infrastructure/errors';

const expo = new Expo();

// ─── Opt-out check — MUST be called before every Twilio call ───────────────

export class OptOutError extends Error {
  constructor(phone: string) {
    super(`Phone ${phone} has opted out of messages`);
    this.name = 'OptOutError';
  }
}

// sms_opt_outs stores phone_hash only (never plaintext phone). See 04-Data-Architecture.md Section 3.11
async function checkOptOut(phoneE164: string): Promise<boolean> {
  const phoneHash = hashPhone(phoneE164); // SHA-256 HMAC with PII_HMAC_SALT
  const { data } = await supabaseAdmin
    .from('sms_opt_outs')
    .select('id')
    .eq('phone_hash', phoneHash)  // ← phone_hash, NOT phone_e164
    .maybeSingle();
  return data !== null;
}

// ─── Push notification sender ───────────────────────────────────────────────

export async function notifyPaymentSelfReported(
  payerUserId: string,
  eventId: string,
  participantId: string,
  participantName: string,
): Promise<void> {
  const pushToken = await getPushToken(payerUserId);
  if (!pushToken) return;

  await sendPushNotification(pushToken, {
    title: 'Payment received',
    body: `${participantName} says they've paid their share.`,
    data: { eventId, participantId, type: 'payment_self_report_push' },
  });
}

export async function notifyAllSettled(
  payerUserId: string,
  eventId: string,
  totalAmount: number,
): Promise<void> {
  const pushToken = await getPushToken(payerUserId);
  if (!pushToken) return;

  await sendPushNotification(pushToken, {
    title: 'Everyone paid!',
    body: `Your event is fully settled. Total: $${totalAmount.toFixed(2)}.`,
    data: { eventId, type: 'all_settled_push' },
  });
}

async function getPushToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('device_sessions')
    .select('push_token')
    .eq('user_id', userId)
    .not('push_token', 'is', null)
    .order('last_active_at', { ascending: false })
    .limit(1)
    .single();

  return data?.push_token ?? null;
}

async function sendPushNotification(
  token: string,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  if (process.env.APP_ENV === 'development') {
    logger.info('[DEV] Push suppressed', { token, payload });
    return;
  }

  if (!Expo.isExpoPushToken(token)) {
    await clearInvalidToken(token);
    return;
  }

  const [ticket] = await expo.sendPushNotificationsAsync([{
    to: token,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }]);

  if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
    await clearInvalidToken(token);
  }
}

async function clearInvalidToken(token: string): Promise<void> {
  await supabaseAdmin
    .from('device_sessions')
    .update({ push_token: null })
    .eq('push_token', token);
}
```

---

## Environment Variable Reference

All credentials listed in this document. Copy-paste as a template for Doppler, then fill in real values per environment. Never commit populated values to git.

```bash
# ─── Twilio (Verify + Messaging) ─────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # optional

# ─── Supabase (Auth + Storage + Database) ─────────────────────────────────────
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_eyJ...
SUPABASE_SECRET_KEY=sb_secret_eyJ...

# ─── AI Providers ─────────────────────────────────────────────────────────────
GEMINI_API_KEY=AIzaSy...                # dev/staging only
ANTHROPIC_API_KEY=sk-ant-api03-...     # production only
ANTHROPIC_MONTHLY_SPEND_LIMIT=100      # enforce in Anthropic console

# AI provider selection (per agent, per environment)
AI_PROVIDER_A1=gemini                  # 'gemini' in dev/staging; 'anthropic' in production
AI_MODEL_A1=gemini-2.5-flash           # 'claude-haiku-4-5-20251001' in production
AI_PROVIDER_A2=gemini
AI_MODEL_A2=gemini-2.5-flash
AI_PROVIDER_A3=gemini
AI_MODEL_A3=gemini-2.5-flash

# AI harness settings
RECEIPT_PARSE_MAX_RETRIES=3
SPLIT_CALC_MAX_RETRIES=3
MESSAGE_COMPOSE_MAX_RETRIES=3
A1_CONFIDENCE_THRESHOLD=0.80
A1_ITEM_CONFIDENCE_THRESHOLD=0.75
A2_CONFIDENCE_THRESHOLD=0.70

# ─── Upstash Redis ────────────────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://[database-id].upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxx

# ─── Upstash QStash ───────────────────────────────────────────────────────────
QSTASH_TOKEN=eyJ...
QSTASH_CURRENT_SIGNING_KEY=sig_xxx...
QSTASH_NEXT_SIGNING_KEY=sig_yyy...

# ─── Application ──────────────────────────────────────────────────────────────
NODE_ENV=development                   # 'development' | 'staging' | 'production'
APP_URL=https://letssplyt.app          # Full base URL (used for webhook signature verification)
APP_DOMAIN=letssplyt.app               # Domain only (used for CORS, AASA, deep link config)

# Self-generated secrets — see docs/09-Security-And-Privacy.md §3 (Secret generation quick reference)
PHONE_ENCRYPTION_KEY=64-hex-chars      # openssl rand -hex 32  (32 bytes → 64 hex chars)
HANDLE_ENCRYPTION_KEY=64-hex-chars     # openssl rand -hex 32
PII_HMAC_SALT=64-hex-chars             # openssl rand -hex 32
JWT_SECRET=128-hex-chars               # openssl rand -hex 64  (64 bytes → 128 hex chars)
ANALYTICS_SALT=32-hex-chars            # openssl rand -hex 16  (16 bytes → 32 hex chars)
```

---

## Dependency Quick Reference

| Integration | npm Package | Version Range | Install Command |
|------------|------------|---------------|-----------------|
| Twilio Verify + Messaging | `twilio` | `^5.0.0` | `npm install twilio@^5.0.0` |
| Supabase Auth + Storage + DB | `@supabase/supabase-js` | `^2.0.0` | `npm install @supabase/supabase-js@^2.0.0` |
| Google Gemini AI | `@google/generative-ai` | `^0.21.0` | `npm install @google/generative-ai@^0.21.0` |
| Anthropic Claude AI | `@anthropic-ai/sdk` | `^0.30.0` | `npm install @anthropic-ai/sdk@^0.30.0` |
| Upstash Redis | `@upstash/redis` | `^1.34.0` | `npm install @upstash/redis@^1.34.0` |
| Upstash QStash | `@upstash/qstash` | `^2.7.0` | `npm install @upstash/qstash@^2.7.0` |
| Expo Push (backend) | `expo-server-sdk` | `^3.10.0` | `npm install expo-server-sdk@^3.10.0` |
| Expo Push (mobile) | `expo-notifications` | managed by Expo | `npx expo install expo-notifications expo-device` |

---

*All API shapes verified June 2026. Verify SDK changelogs before upgrading any package version — provider SDKs occasionally introduce breaking changes in minor versions.*
