# LetsSplyt — Security and Privacy Architecture
**Version:** 1.0 | **Date:** June 2026
**Authority:** This document defines the security model. Any implementation that contradicts this document is a bug.

---

## Table of Contents
1. Threat Model
2. PII Classification and Handling
3. Encryption Key Inventory
4. API Security
5. AI Security
6. Regulatory Compliance
7. Data Retention Schedule
8. Secret Management
9. Incident Response

---

## 1. Threat Model

LetsSplyt handles phone numbers, payment handles (Venmo/PayPal usernames), and financial amounts. It is not a payment processor, but it holds PII that could be exploited for financial fraud, social engineering, or identity correlation if leaked. The following threats are ranked in priority order based on likelihood and impact.

---

### Threat 1 — Database Breach: Attacker Gains Read Access to Supabase

| | |
|---|---|
| **Likelihood** | Medium — Supabase is a shared infrastructure platform; misconfigured RLS policies or a compromised service role key are the most likely vectors |
| **Impact** | Critical — an unprotected database would expose payment handles, phone data, and financial amounts for all users |
| **Primary mitigation** | All phone numbers stored only as HMAC hash (for lookup) and AES-256-GCM ciphertext (for retrieval). All payment handles stored as AES-256-GCM ciphertext. A database dump without the encryption keys yields no useful PII |
| **Secondary mitigation** | Row Level Security enforced on every table. Supabase anon key (used by mobile clients) cannot reach `guest_pii`, `sms_opt_outs`, or `ai_audit_log`. The service role key is held only by the Node.js backend, never by the mobile app |

---

### Threat 2 — API Abuse: Attacker Makes Requests Without a Valid Session

| | |
|---|---|
| **Likelihood** | High — any public-facing API is probed continuously |
| **Impact** | High — unauthenticated access could enumerate events, read participant lists, or trigger AI agent runs that incur cost |
| **Primary mitigation** | Every endpoint requires a valid Supabase JWT in the `Authorization: Bearer` header. The backend calls `supabase.auth.getUser(token)` on every request — it never decodes and trusts the JWT payload without verification |
| **Secondary mitigation** | Per-endpoint rate limiting via Upstash Redis (see Section 4). QR join tokens use 144-bit cryptographic randomness — not sequential IDs — making enumeration attacks computationally infeasible |

---

### Threat 3 — PII Leakage: Phone Numbers or Names Exposed to Other Users

| | |
|---|---|
| **Likelihood** | Medium — API bugs, RLS misconfiguration, or log exposure are common causes |
| **Impact** | High — phone numbers and payment handles are directly exploitable for fraud and phishing |
| **Primary mitigation** | PII scrubbing middleware strips any field matching E.164 phone patterns, `phone_hash`, `phone_encrypted`, `name_encrypted`, or `handle_encrypted` from all API responses before they are sent to clients. Any response containing these fields is treated as a bug (see Section 4) |
| **Secondary mitigation** | RLS policies ensure each user can only query their own profile data and the events/participants they are authorised to see. Participant rows returned to the mobile app contain `display_name` only — never raw phone numbers |

---

### Threat 4 — AI Prompt Injection: Malicious Receipt Content Manipulates AI Behaviour

| | |
|---|---|
| **Likelihood** | Medium — receipt item names and participant names are entirely user-controlled strings that are interpolated into AI prompts |
| **Impact** | Medium — a successful injection could cause the AI to return malformed split data, exfiltrate other prompt contents, or produce abusive output in messages delivered to real phone numbers |
| **Primary mitigation** | All user-controlled strings are sanitised before prompt interpolation: newlines stripped, pipe characters stripped, length truncated. The `sanitiseForPrompt()` function (see Section 5) is called on every string before it enters any prompt |
| **Secondary mitigation** | All AI output is validated against strict TypeScript interfaces before use. Schema validation rejects any response that does not match the expected structure. AI providers never receive phone numbers, payment handles, or full names |

---

### Threat 5 — Account Takeover: Attacker Gains Another User's Session

| | |
|---|---|
| **Likelihood** | Low-Medium — OTP interception (SIM swap) and JWT theft are the primary vectors |
| **Impact** | Critical — a compromised account exposes payment handles and allows the attacker to create events, view financial data, and send messages to the victim's contacts |
| **Primary mitigation** | OTP rate limiting (3 attempts per phone per 10 minutes, 5 requests per phone per hour, 20 requests per IP per hour). Access tokens expire after 15 minutes. Refresh tokens rotate on every use; reuse of an old refresh token invalidates all sessions for that user |
| **Secondary mitigation** | Refresh tokens stored in Expo SecureStore (mobile) or HTTP-only cookie (web) — never in AsyncStorage or localStorage. Biometric unlock gates access to the SecureStore vault without transmitting biometric data off-device |

---

### Threat 6 — Insider Access: Developer Accidentally Sees Production PII

| | |
|---|---|
| **Likelihood** | Medium — developers routinely access logs, Sentry, and dashboards |
| **Impact** | Medium — unintentional exposure of phone numbers and payment handles constitutes a data breach under GDPR and DPDP |
| **Primary mitigation** | Structured logging policy prohibits logging any plaintext phone, payment handle, OTP code, JWT token, or IP address at any log level. The PII scrubbing middleware applies to all log output before it reaches Railway logs or Sentry |
| **Secondary mitigation** | Production encryption keys are held in Doppler and injected at process start — a developer can access the Railway dashboard without seeing key values. Decrypted PII is held in memory for the duration of a single operation and never written to any persistent store |

---

## 2. PII Classification and Handling

### Definition

In this system, PII is any datum that can identify a natural person directly, indirectly, or in combination with other data. The following table is the definitive classification. Any column not listed here is non-PII by default.

| Data Type | Classification | Storage | Who Can Access | Retention |
|---|---|---|---|---|
| Phone number (E.164) | PII — Sensitive | SHA-256 HMAC hash (lookup) + AES-256-GCM encrypted (retrieval). Never stored in plaintext in any table accessible to the mobile client | Account owner only, via backend service role | Until account deletion request (P31) |
| Display name | Non-PII | Plaintext in `users.display_name` and `participants.display_name` | All participants in shared events | Until account deletion |
| Full name | PII — Moderate | AES-256-GCM encrypted in `users.name_encrypted` | Account owner only (used in A3 message composition) | Until account deletion |
| Payment handles | PII — Financial | AES-256-GCM encrypted in `user_payment_handles.handle_encrypted` | Account owner only; decrypted only at A3 message composition, never logged | Until account deletion or user removes handle |
| Receipt image | PII — Transactional | Supabase Storage, accessed only via signed URL with short TTL | Event payer only | 90 days after event settles |
| Guest phone | PII — Sensitive | SHA-256 HMAC hash + AES-256-GCM encrypted in `guest_pii` table, behind a `FOR ALL USING (false)` RLS policy | Backend service role only (never returned to any client) | 90 days after event settles, then hard-deleted by nightly purge job |
| Guest name | PII — Moderate | AES-256-GCM encrypted in `guest_pii.name_encrypted` | Event payer (display_name in participants table only), guest themselves | 90 days after event settles |
| IP addresses | Non-PII (operational) | SHA-256 hash stored in `analytics_events.ip_address`. Raw IP is never written to any table or log | Backend / DevOps only via analytics queries | 2 years (with analytics partition) |
| Analytics events | Non-PII | Hashed user IDs and event metadata only; payment handles never included | Aggregated reporting via backend queries | 2 years, then dropped by monthly partition cleanup |
| SMS opt-out records | PII — Operational | Phone hash only in `sms_opt_outs.phone_hash`. Plaintext phone is not stored in this table | Backend service role only | Permanent (legal requirement: must honour STOP indefinitely) |

### Handling Rules

1. **Plaintext phone numbers are transient.** They exist only in the memory of a running Node.js process while an operation is in flight. They are never written to a database column, log file, Sentry event, or any other persistent store.
2. **Decrypted payment handles are single-use in memory.** The A3 message composer decrypts a handle, builds the payment link, uses the link, and discards the decrypted value. The handle is never stored in a variable that persists beyond the message composition function.
3. **`display_name` is the only name shown across users.** All cross-user name visibility in the app uses `display_name`. Full name (`name_encrypted`) is used only in outbound SMS composition and is not surfaced in the mobile UI for other users to see. For registered members, APIs resolve the live `users.display_name`; `participants.display_name` is a per-event snapshot kept in sync on profile edit.
4. **Guest PII never crosses the API boundary to the mobile client.** The mobile app receives `display_name` in API responses (resolved from `users` for linked members, from `participants` for pure guests). It never receives the decrypted contents of `guest_pii`.

---

## 3. Encryption Key Inventory

All keys are stored in Doppler and injected as `process.env` variables at process startup. No key value appears in code or git at any time.

### Keys

---

#### `HANDLE_ENCRYPTION_KEY`

| Property | Value |
|---|---|
| **Algorithm** | AES-256-GCM |
| **Key size** | 32 bytes (256 bits), stored as 64-character lowercase hex string |
| **What it encrypts** | `user_payment_handles.handle_encrypted` — Venmo/PayPal/CashApp/Zelle/Wise/UPI handles |
| **Development** | Unique value — generated with `openssl rand -hex 32`. Never shared with staging or production |
| **Staging** | Unique value — separate generation. Never shared with development or production |
| **Production** | Unique value — separate generation. Never shared with development or staging |
| **Same value across envs?** | No. Using the same key across environments would mean staging operations could be replayed against production ciphertext. This is a critical isolation requirement |
| **Rotation policy** | Every 6 months, or immediately on any suspected compromise. Rotation procedure: decrypt all `handle_encrypted` rows with the old key, re-encrypt with the new key in a single migration transaction, update Doppler, redeploy |

---

#### `PHONE_ENCRYPTION_KEY`

| Property | Value |
|---|---|
| **Algorithm** | AES-256-GCM |
| **Key size** | 32 bytes (256 bits), stored as 64-character lowercase hex string |
| **What it encrypts** | `users.phone_encrypted`, `users.name_encrypted`, `guest_pii.phone_encrypted`, `guest_pii.name_encrypted` |
| **Development** | Unique value — generated with `openssl rand -hex 32` |
| **Staging** | Unique value — separate generation |
| **Production** | Unique value — separate generation |
| **Same value across envs?** | No. Loss of this key means all encrypted phones become permanently unreadable. Environments must be isolated so a breach in one environment cannot decrypt data from another |
| **Rotation policy** | Every 6 months, or immediately on any suspected compromise. Rotation procedure: decrypt all affected rows with the old key, re-encrypt with the new key in a migration transaction, update Doppler, redeploy. Users will experience no downtime as the migration runs atomically |

---

#### `PII_HMAC_SALT`

| Property | Value |
|---|---|
| **Algorithm** | HMAC-SHA256 |
| **Key size** | 32 bytes (256 bits), stored as 64-character lowercase hex string |
| **What it protects** | Used to compute `phone_hash` values in `users`, `guest_pii`, and `sms_opt_outs`. The salt makes phone hashes non-reversible and prevents cross-system correlation if two systems with different salts are compared |
| **Development** | Unique value |
| **Staging** | Unique value — must differ from development so staging hashes do not match development data |
| **Production** | Unique value |
| **Same value across envs?** | No. Critically, `PII_HMAC_SALT` must be the same within each environment so that an opt-out hash computed at message time matches the stored hash in `sms_opt_outs`. It must differ across environments |
| **Rotation policy** | Unlike encryption keys, the HMAC salt cannot be rotated without rehashing every `phone_hash` column in the database, which requires all users to re-verify their phone. Rotation should only occur after a confirmed breach of the salt. Plan: rehash all values in a migration, update Doppler |

---

#### `JWT_SECRET`

| Property | Value |
|---|---|
| **Algorithm** | HMAC-SHA256 (used by Supabase Auth JWT signing) |
| **Key size** | 64 bytes (512 bits), stored as 128-character lowercase hex string |
| **What it protects** | Signs and verifies all Supabase access tokens and refresh tokens. A compromised JWT_SECRET allows an attacker to forge valid sessions for any user |
| **Development** | Unique value — generated with `openssl rand -hex 64` |
| **Staging** | Unique value |
| **Production** | Unique value |
| **Same value across envs?** | No |
| **Rotation policy** | Immediately on any suspected compromise. Rotation consequence: all active sessions are immediately invalidated — every user is logged out and must re-authenticate via OTP. Announce rotation in advance for planned rotations. Update in Doppler, which triggers a Railway redeploy |

---

#### `ANALYTICS_SALT`

| Property | Value |
|---|---|
| **Algorithm** | SHA-256 (non-keyed, used for one-way hashing only) |
| **Key size** | 16 bytes (128 bits), stored as 32-character lowercase hex string |
| **What it protects** | Used to produce anonymised phone identifiers in analytics events: `SHA-256(phone_e164 + ANALYTICS_SALT)`. Prevents raw phone hashes from appearing in analytics data |
| **Development** | Unique value |
| **Staging** | Unique value |
| **Production** | Unique value |
| **Same value across envs?** | No |
| **Rotation policy** | Rotating breaks continuity of anonymous user tracking in analytics. Rotate only after a breach. No migration needed for historical data — old analytics rows retain the old hash; new events use the new salt |

---

#### `SUPABASE_SECRET_KEY` (Service Role Key)

| Property | Value |
|---|---|
| **Algorithm** | Supabase-managed; JWT signed by Supabase's internal key |
| **Key size** | Managed by Supabase |
| **What it protects** | Grants the Node.js backend full database access, bypassing RLS. This key must never reach the mobile client under any circumstances |
| **Development** | Supabase dev project service role key |
| **Staging** | Supabase staging project service role key |
| **Production** | Supabase production project service role key |
| **Same value across envs?** | No — each Supabase project issues its own service role key |
| **Rotation policy** | Rotation is performed in the Supabase dashboard (Settings → API → Regenerate). Update in Doppler immediately after. This key is not rotated on a schedule by this team; it is rotated immediately on any suspected exposure (e.g. git commit, log leak) |

---

### Encryption Function Implementations

These implementations must be used consistently across the entire codebase. No other AES or HMAC implementations are permitted.

```typescript
// backend/src/infrastructure/encryption.ts

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited string: iv_hex:auth_tag_hex:ciphertext_hex
 * The IV is freshly generated for every call — never reuse an IV.
 *
 * @param plaintext  The string to encrypt
 * @param keyHex     The 64-character hex-encoded 32-byte key
 * @returns          Encrypted string in iv:tag:ciphertext format
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex chars)');
  }
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string produced by encrypt().
 * Throws if the auth tag does not match — indicates tampering or wrong key.
 *
 * @param stored   The iv:tag:ciphertext string from encrypt()
 * @param keyHex   The 64-character hex-encoded 32-byte key
 * @returns        The original plaintext string
 */
export function decrypt(stored: string, keyHex: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:tag:ciphertext');
  }
  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encryptedData).toString('utf8') + decipher.final('utf8');
}

/**
 * Computes an HMAC-SHA256 hash of a phone number using PII_HMAC_SALT.
 * The result is a 64-character lowercase hex string stored as phone_hash.
 * This function is the single canonical implementation — call it everywhere
 * a phone hash must be produced or compared.
 *
 * @param phoneE164  The E.164-normalised phone number (e.g. "+15550001234")
 * @returns          64-character hex HMAC-SHA256 digest
 */
export function hashPhone(phoneE164: string): string {
  const salt = process.env.PII_HMAC_SALT;
  if (!salt) {
    throw new Error('PII_HMAC_SALT is not set — cannot hash phone number');
  }
  return createHmac('sha256', salt).update(phoneE164).digest('hex');
}

// ─── Typed convenience wrappers ───────────────────────────────────────────────

/** Encrypt a payment handle. Uses HANDLE_ENCRYPTION_KEY. */
export function encryptHandle(handle: string): string {
  const key = process.env.HANDLE_ENCRYPTION_KEY;
  if (!key) throw new Error('HANDLE_ENCRYPTION_KEY is not set');
  return encrypt(handle, key);
}

/** Decrypt a payment handle. Uses HANDLE_ENCRYPTION_KEY. */
export function decryptHandle(stored: string): string {
  const key = process.env.HANDLE_ENCRYPTION_KEY;
  if (!key) throw new Error('HANDLE_ENCRYPTION_KEY is not set');
  return decrypt(stored, key);
}

/** Encrypt a phone number or name. Uses PHONE_ENCRYPTION_KEY. */
export function encryptPii(plaintext: string): string {
  const key = process.env.PHONE_ENCRYPTION_KEY;
  if (!key) throw new Error('PHONE_ENCRYPTION_KEY is not set');
  return encrypt(plaintext, key);
}

/** Decrypt a phone number or name. Uses PHONE_ENCRYPTION_KEY. */
export function decryptPii(stored: string): string {
  const key = process.env.PHONE_ENCRYPTION_KEY;
  if (!key) throw new Error('PHONE_ENCRYPTION_KEY is not set');
  return decrypt(stored, key);
}
```

**Usage rules:**

- `encryptHandle()` / `decryptHandle()` — used only in `profile.service.ts` (on handle save) and `message-composer.service.ts` (A3, on message send). Never called in any other file.
- `encryptPii()` / `decryptPii()` — used only in `auth.service.ts` (on registration and phone retrieval) and `notifications.service.ts` (on SMS send for guests). Never called in any other file.
- `hashPhone()` — called at the API gateway for every operation involving a phone number lookup. Never called downstream of the gateway layer.

---

## 4. API Security

### Authentication Model

Every request to the backend (except QStash job callbacks and Twilio webhooks) must carry a valid Supabase JWT.

```
Authorization: Bearer <supabase_access_token>
```

The backend validates this token by calling `supabase.auth.getUser(token)` on every request. This is a server-side call to the Supabase Auth service — it is not a local JWT decode. Local decoding of the JWT payload without verification is forbidden: an attacker who knows the JWT format could construct a payload with an arbitrary `sub` (user ID) and bypass all user-level access controls.

```typescript
// backend/src/middleware/authenticate.ts

import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../infrastructure/errors';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }
  const token = header.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
  // Attach verified user to request — never attach from JWT payload directly
  req.user = { id: data.user.id };
  next();
}
```

### Rate Limiting

All rate limits are enforced using Upstash Redis. Limits are applied per authenticated user ID for routes that require authentication, and per IP address for unauthenticated routes.

| Endpoint | Limit | Window | Lock Duration |
|---|---|---|---|
| `POST /auth/otp/request` | 5 per phone | 1 hour | Remainder of the hour |
| `POST /auth/otp/verify` | 3 per phone | 10 minutes | Remainder of the 10-minute window |
| `POST /auth/otp/verify` (IP) | 20 per IP | 1 hour | Remainder of the hour |
| `POST /events` | 20 per user | 1 hour | — |
| `POST /events/:id/scan` | 5 per event | 1 hour | — |
| `POST /events/:id/send` | 3 per event | 24 hours | — |
| `POST /messages/nudge/:participantId` | 1 per participant | 24 hours | — |
| `GET *` (authenticated) | 200 per user | 1 minute | — |
| `GET /events/:id/join` (QR token scan) | 10 per token | 1 hour | — |
| `/api/v1/jobs/*` (QStash callbacks) | 10 per endpoint | 1 minute | — |

Rate limit responses return HTTP 429 with a `Retry-After` header. Error messages never reveal whether a phone number exists in the system.

### CORS Policy

CORS is configured per environment. Wildcard (`*`) origins are never permitted in any environment.

| Environment | Allowed Origins |
|---|---|
| Development | `http://localhost:3000`, `http://localhost:8081` (Expo Metro), `https://expo.dev` |
| Staging | `https://letssplyt-staging.up.railway.app` (Railway staging URL) |
| Production | `https://tryletssplyt.com` (or the canonical production domain) |

```typescript
// backend/src/middleware/cors.ts

import cors from 'cors';

// Do NOT use NODE_ENV for environment detection — Railway sets NODE_ENV=production
// on ALL deployments including staging. Use APP_ENV (set by Doppler) which correctly
// reflects development | staging | production.
const ALLOWED_ORIGINS: Record<string, string[]> = {
  development: [
    'http://localhost:3000',
    'http://localhost:8081',
    'https://expo.dev',
  ],
  staging: [
    'https://staging.letssplyt.app',
  ],
  production: [
    'https://letssplyt.app',
  ],
};

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Use APP_ENV, NOT NODE_ENV — Railway sets NODE_ENV=production on ALL deployments
    // including staging. APP_ENV is set by Doppler per environment.
    const env = process.env.APP_ENV ?? 'development';
    const allowed = ALLOWED_ORIGINS[env] ?? [];
    // Allow requests with no origin (mobile app native requests, server-to-server)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed in ${env}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### Phone Numbers in URLs

Phone numbers must never appear in URL paths, query strings, or route parameters. All resources are identified by UUIDs. For example:

- Correct: `GET /events/a4f2b7c1-3e8d-4a2f-b1c3-d7e9f0a1b2c3/participants`
- Incorrect: `GET /events/lookup?phone=+15550001234`

If a lookup by phone is required (e.g. the payer manually adding a participant), the phone is passed in the request body, normalised to E.164, hashed, and used only in a server-side database query. The hash and all plaintext phone values are scrubbed from logs before writing.

### PII Scrubbing Middleware

Any API response that contains `phone_e164`, `phone_hash`, `phone_encrypted`, `name_encrypted`, or `handle_encrypted` fields is a bug. The following middleware strips these fields from all outbound responses and all log output as a defence-in-depth measure.

```typescript
// backend/src/middleware/pii-scrubber.ts

import type { Request, Response, NextFunction } from 'express';

/** Fields that must never appear in API responses or log output */
const BLOCKED_FIELDS = new Set([
  'phone_e164',
  'phone_hash',
  'phone_encrypted',
  'name_encrypted',
  'handle_encrypted',
]);

/** E.164 phone pattern — catches any raw phone number in a value */
const PHONE_PATTERN = /\+\d{7,15}/g;

/** 64-character hex string — catches phone_hash or HMAC values */
const HEX64_PATTERN = /\b[0-9a-f]{64}\b/gi;

/**
 * Recursively strips PII fields from any object.
 * Called on response bodies before they are serialised.
 */
export function scrubPii(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj
      .replace(PHONE_PATTERN, '[PHONE REDACTED]')
      .replace(HEX64_PATTERN, '[HASH REDACTED]');
  }
  if (Array.isArray(obj)) {
    return obj.map(scrubPii);
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (BLOCKED_FIELDS.has(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = scrubPii(value);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Express middleware that intercepts res.json() and scrubs PII from the body
 * before it is serialised and sent to the client.
 */
export function piiScrubberMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown): Response {
    const scrubbed = scrubPii(body);
    return originalJson(scrubbed);
  };
  next();
}
```

This middleware is mounted globally in `app.ts`, before all route handlers. It runs after authentication (so `req.user.id` is available for logging correlation) and before the response is written to any log sink.

---

## 5. AI Security

### Prompt Injection Defence

Receipt item descriptions, participant names, and any other user-controlled text that enters an AI prompt is a prompt injection surface. An attacker can set an item description to a string that attempts to override the system prompt, exfiltrate other prompt contents, or produce abusive output in messages delivered to real phone numbers.

The following function is mandatory. It must be called on every user-controlled string before interpolation into any AI prompt — no exceptions.

```typescript
// backend/src/infrastructure/ai-sanitiser.ts

/**
 * Sanitises a user-controlled string for safe interpolation into an AI prompt.
 *
 * - Strips newline characters (\n, \r, \r\n): prevent multi-line prompt injection
 * - Strips pipe characters (|): prevent table-format injection into structured prompts
 * - Strips backtick sequences: prevent code-block injection
 * - Strips sequences that look like prompt delimiters (e.g. "---", "===", "###")
 * - Truncates to maxLength to prevent context-window stuffing attacks
 *
 * @param input      The raw user-controlled string
 * @param maxLength  Maximum allowed length after sanitisation (default: 200)
 * @returns          The sanitised string, safe for prompt interpolation
 */
export function sanitiseForPrompt(input: string, maxLength = 200): string {
  return input
    .replace(/[\r\n]+/g, ' ')           // newlines → single space
    .replace(/\|/g, '')                  // strip pipe characters (table injection)
    .replace(/`+/g, '')                  // strip backtick sequences
    .replace(/^[-=#{*]{3,}$/gm, '')      // strip delimiter-like lines
    .replace(/\s{2,}/g, ' ')             // collapse multiple spaces
    .trim()
    .slice(0, maxLength);
}
```

**Where `sanitiseForPrompt()` must be called:**

- Every `receipt_items.description` before inclusion in an A1 or A2 prompt
- Every `participants.display_name` before inclusion in an A2 or A3 prompt
- Every user-provided `events.title` before inclusion in any prompt
- Every free-text NLP instruction from the payer in A2

### AI Output Validation

The backend never trusts AI output without schema validation. Each agent's expected output is defined as a TypeScript interface, and all AI responses are validated against these interfaces before the data is used. A response that fails validation is treated as a parse failure, not as usable data.

```typescript
// backend/src/modules/ai/ai-output.types.ts

import { z } from 'zod';

// ─── A1: Receipt Parser Output ────────────────────────────────────────────────

export const A1ReceiptItemSchema = z.object({
  description: z.string().min(1).max(200),
  unit_price:  z.number().positive().max(100_000),
  quantity:    z.number().positive().max(999),
  is_tax:      z.boolean(),
  is_tip:      z.boolean(),
  is_shared:   z.boolean(),
});

export const A1OutputSchema = z.object({
  items:       z.array(A1ReceiptItemSchema).min(1).max(200),
  total:       z.number().positive().max(1_000_000),
  confidence:  z.number().min(0).max(1),
  currency:    z.string().length(3),               // ISO 4217 (e.g. "USD")
});

export type A1Output = z.infer<typeof A1OutputSchema>;

export function validateA1Output(raw: unknown): A1Output {
  const result = A1OutputSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`A1 output validation failed: ${result.error.message}`);
  }
  return result.data;
}

// ─── A2: Split Calculator Output ─────────────────────────────────────────────

export const A2ParticipantShareSchema = z.object({
  participant_label: z.string().regex(/^Person \d+$/),  // "Person 1", "Person 2", etc.
  amount_owed:       z.number().nonnegative().max(1_000_000),
});

export const A2OutputSchema = z.object({
  shares:            z.array(A2ParticipantShareSchema).min(1).max(100),
  total_allocated:   z.number().nonnegative().max(1_000_000),
  rounding_note:     z.string().max(200).optional(),
});

export type A2Output = z.infer<typeof A2OutputSchema>;

export function validateA2Output(raw: unknown): A2Output {
  const result = A2OutputSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`A2 output validation failed: ${result.error.message}`);
  }
  // Additional invariant: sum of shares must equal total_allocated ±$0.02
  const sum = result.data.shares.reduce((acc, s) => acc + s.amount_owed, 0);
  if (Math.abs(sum - result.data.total_allocated) > 0.02) {
    throw new Error(
      `A2 output invariant violation: shares sum ${sum} ≠ total_allocated ${result.data.total_allocated}`
    );
  }
  return result.data;
}

// ─── A3: Message Composer Output ─────────────────────────────────────────────

export const A3MessageSchema = z.object({
  // A3 returns a message template with placeholders — names are inserted AFTER validation
  message_body:    z.string().min(10).max(1600),  // Twilio SMS limit: 1600 chars (concatenated)
  payment_links:   z.array(z.string().url()).max(10),
  channel:         z.enum(['sms', 'whatsapp']),
});

export const A3OutputSchema = z.object({
  messages: z.array(A3MessageSchema).min(1).max(100),
});

export type A3Output = z.infer<typeof A3OutputSchema>;

export function validateA3Output(raw: unknown): A3Output {
  const result = A3OutputSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`A3 output validation failed: ${result.error.message}`);
  }
  return result.data;
}
```

### Data Leakage Prevention for AI Providers

AI providers (Google Gemini in development/staging, Anthropic Claude in production) receive only the minimum data required to perform their task. The following rules are absolute:

**AI providers receive:**
- Receipt image (as base64 or signed URL) for A1 parsing
- Line item descriptions, amounts, and quantities for A2 split calculation
- Participant count as a number for A2
- Anonymised participant labels ("Person 1", "Person 2", ... "Person N") for A2 and A3
- Payment link URL templates (without populated handles) for A3

**AI providers must never receive:**
- Phone numbers (E.164, hashed, or encrypted) in any form
- Payment handles (Venmo usernames, PayPal handles, etc.) in any form
- Full names (`name_encrypted` decrypted values)
- User IDs or event IDs that could be correlated with external data

**The A3 name insertion rule:** The A3 message composer receives AI output containing the placeholder label ("Person 1", etc.) and inserts the actual participant `display_name` **after** the AI call returns and the output has been validated. The display name is never passed into the prompt. This prevents the AI provider from receiving names that could identify individuals.

```typescript
// backend/src/modules/ai/message-composer.service.ts (pattern)

// WRONG — do not do this:
const prompt = `Compose a payment message for ${participant.displayName} who owes $${amount}...`;

// CORRECT:
const prompt = `Compose a payment message for Person 1 who owes $${amount}...`;
const aiOutput = await callAI(prompt);
const validated = validateA3Output(aiOutput);
// Now insert the name into the validated template:
const finalMessage = validated.messages[0]!.message_body
  .replace('Person 1', sanitiseForPrompt(participant.displayName, 50));
```

---

## 6. Regulatory Compliance

### India DPDP Act 2023

The Digital Personal Data Protection Act 2023 applies to LetsSplyt because the app processes personal data of persons located in India, regardless of where the processing infrastructure is located.

**Lawful basis:** Contract performance. LetsSplyt processes phone numbers, names, and payment handles for the sole purpose of splitting a bill initiated by the Data Principal (the user). Processing is necessary to provide the service requested.

**Consent requirements:**

| Processing Activity | Consent Point | Implementation |
|---|---|---|
| OTP verification | Implicit at phone entry — user provides their number to receive OTP | Display: "By entering your phone number, you agree to receive a one-time verification code from LetsSplyt." |
| Storage of payment handles | Explicit — user actively adds a handle | Payment handle screen: "Your payment details are encrypted and used only to generate payment links for your events." |
| Sending messages to guests | Consent via event join flow | Browser join screen: "By joining this event, you agree to receive a one-time payment request via SMS from LetsSplyt. Reply STOP to opt out." |
| Analytics | Disclosure in Privacy Policy | Not separately consented — covered under contract performance |

**Data Principal rights and implementation:**

| Right | Implementation |
|---|---|
| Right to access | `GET /users/me/data` — returns all data held about the authenticated user as JSON: profile, payment handles (encrypted, shown as provider labels only), events, participants rows, settlement history |
| Right to correction | `PATCH /users/me` — user can update display name, full name, payment handles |
| Right to erasure | `DELETE /users/me` (P31) — see deletion procedure below |
| Right to grievance redress | Privacy contact email in Privacy Policy; response within 72 hours |

**Account deletion procedure (P31):**
1. Set `users.deleted_at = NOW()` (soft delete — preserves foreign key integrity)
2. Wipe `users.phone_encrypted` = `'[DELETED]'` and `users.phone_hash` = random 64-char hex (breaks lookup without removing the row)
3. Wipe `users.name_encrypted` = `NULL`
4. Set `users.display_name` = `'Deleted User'`
5. Hard-delete all rows in `user_payment_handles` for this user
6. For participant rows referencing this user: set `display_name` = `'Deleted User'`; `user_id` remains for foreign key integrity but the profile is anonymised
7. Hard-delete analytics events created more than 30 days ago by this user (events within 30 days are retained for fraud investigation, then dropped on the next monthly cleanup)
8. Return HTTP 200; invalidate all active sessions by deleting refresh tokens from Supabase Auth

**Data Fiduciary obligations:**

- **Breach notification:** Any confirmed breach affecting personal data of Indian Data Principals must be reported to the Data Protection Board of India within 72 hours of the organisation becoming aware. Notification to affected users must also be sent within 72 hours. See Section 9 (Incident Response) for the breach runbook.
- **Data minimisation:** No column is added to any table unless there is a specific, active use case for it. The principle is enforced at code review: new columns require an explanation of why they are necessary.
- **Purpose limitation:** Data collected for bill splitting is used only for bill splitting. Phone numbers are not used for marketing. Payment handles are not shared with third parties. Analytics use hashed user IDs only.

**Cross-border transfers:** LetsSplyt uses the following international data processors. All transfers are covered under Standard Contractual Clauses executed between Anthropic, Google, Supabase, and Twilio (as data processors) and the relevant data controller obligations:

| Processor | Location | Purpose | SCC Coverage |
|---|---|---|---|
| Supabase (postgres.supabase.com) | Singapore / US | Database hosting | Supabase DPA at supabase.com/privacy |
| Twilio | United States | SMS and WhatsApp message delivery | Twilio DPA at twilio.com/legal/data-protection-addendum |
| Google (Gemini) | United States | Receipt parsing, split calculation (dev/staging) | Google Cloud DPA at cloud.google.com/terms/data-processing-addendum |
| Anthropic (Claude) | United States | Receipt parsing, split calculation (production) | Anthropic DPA at anthropic.com/legal/dpa |
| Upstash (QStash, Redis) | United States | Background job queue, rate limiting | Upstash DPA at upstash.com/trust/dpa |

---

### GDPR (European Union / United Kingdom)

GDPR applies to any user with an EU or UK phone number. LetsSplyt does not geo-block; EU users may register.

**Lawful basis:** Contract performance (same as DPDP).

**Additional GDPR rights beyond DPDP:**

| Right | Implementation |
|---|---|
| Right to data portability | `GET /users/me/data?format=csv` — same endpoint as access, with CSV response option |
| Right to object | Not applicable — processing is for contract performance, not legitimate interest or direct marketing |
| Right to restriction | Implemented via account deletion (P31) — partial restriction is not offered at MVP |

**DPA agreements:** Before processing data of any EU/UK user, confirm the following DPAs are in place:
- Supabase: https://supabase.com/privacy (includes DPA)
- Twilio: https://www.twilio.com/en-us/legal/data-protection-addendum
- Anthropic: https://www.anthropic.com/legal/dpa
- Google: https://cloud.google.com/terms/data-processing-addendum

**GDPR and analytics:** IP addresses are SHA-256-hashed before storage in `analytics_events.ip_address`. Raw IP addresses are never written to any table or log.

---

### Required Privacy Policy Statements

The following statements are ready for inclusion in the Privacy Policy at `[your-domain]/privacy`. This page must be publicly accessible without login and must be live before App Store and Play Store submission.

---

**1. What Personal Data We Collect**

When you use LetsSplyt, we collect the following personal data:

- **Phone number.** Your mobile phone number in international format. We use it to verify your identity via one-time passcode and to send payment request messages on your behalf to event participants.
- **Display name.** A name or nickname you choose, shown to other participants in your events. This is not required to be your legal name.
- **Full name (optional).** If you provide your full name, it is used only in outbound payment request messages. It is encrypted and not visible to other users.
- **Payment handles.** Your usernames or identifiers for payment apps you choose to add (for example, your Venmo username or PayPal.Me link). These are encrypted and used only to generate payment links in messages sent on your behalf.
- **Device information.** Your device type (iOS or Android) and app version, used for technical support and app compatibility.
- **Usage data.** Information about how you use the app — for example, which features you use and how often — used to improve the product. This data is associated with a hashed identifier, not your phone number.

---

**2. How We Use Your Data**

We use your personal data only for the following purposes:

- To verify your identity when you sign in
- To create and manage bill-splitting events you initiate
- To send payment request messages to participants you specify
- To generate payment links that allow participants to pay you through third-party payment apps
- To notify you of payment confirmations, disputes, and event activity
- To improve the app using aggregated, anonymised usage data

We do not use your personal data for advertising. We do not sell your data to any third party.

---

**3. Who We Share Your Data With**

We share your data only with the following service providers, and only to the extent necessary to operate LetsSplyt:

- **Supabase** — our database and authentication provider. Stores your encrypted account data. Privacy policy: supabase.com/privacy
- **Twilio** — our SMS and WhatsApp delivery provider. Receives phone numbers solely to deliver payment request messages. Privacy policy: twilio.com/legal/privacy
- **Google (Gemini API)** — used in our development and staging environments to process receipt images for bill splitting. Receives receipt image data only. Privacy policy: policies.google.com/privacy
- **Anthropic (Claude API)** — used in our production environment to process receipt images for bill splitting. Receives receipt image data only. Privacy policy: anthropic.com/privacy
- **Upstash** — our background job and rate-limiting infrastructure provider. Does not receive personal data beyond IP addresses used for rate limiting. Privacy policy: upstash.com/trust/privacy

We do not share your data with any other third party.

---

**4. How Long We Keep Your Data**

| Data Type | Retention Period |
|---|---|
| Account data (phone, name, payment handles) | Until you delete your account |
| Event and participant data | Until you delete your account; settlement records retained 7 years for financial audit purposes |
| Guest data (phone and name of non-app participants) | 90 days after the event is settled, then automatically deleted |
| Receipt images | 90 days after the event is settled, then automatically deleted |
| Usage analytics | 2 years, then permanently deleted |
| SMS delivery and notification records | 1 year, then automatically deleted |

---

**5. Your Rights and How to Exercise Them**

Depending on your location, you may have the following rights regarding your personal data:

- **Access.** You can request a copy of all personal data we hold about you.
- **Correction.** You can update your display name, full name, and payment handles at any time in the app settings.
- **Deletion.** You can delete your account in the app settings (Settings → Delete Account). This will anonymise your profile and permanently delete your payment handles. Settlement records are retained for 7 years for legal and financial audit purposes.
- **Portability (EU/UK users).** You can request your data in a machine-readable format.
- **Opt out of SMS.** Reply STOP to any message you receive from LetsSplyt at any time. You will not receive any further messages from us.

To exercise your rights, contact us at: privacy@[your-domain] (replace with actual address). We will respond within 72 hours.

---

**6. Privacy Contact**

For any privacy-related questions, requests, or complaints:

**Email:** privacy@[your-domain]
**Response time:** Within 72 hours for requests; within 72 hours for breach notifications to affected users

If you are located in the European Union and believe your rights have not been honoured, you have the right to lodge a complaint with your local data protection authority. In India, you may contact the Data Protection Board of India.

---

## 7. Data Retention Schedule

| Data Type | Retention Period | Deletion Trigger | Method |
|---|---|---|---|
| User account (phone, name) | Until deletion request | User submits P31 (`DELETE /users/me`) | Wipe `phone_encrypted`, anonymise `display_name`, delete payment handles, set `deleted_at` |
| User payment handles | Until deletion or user removes handle | P31 or user removes in app | Hard delete from `user_payment_handles` |
| Guest PII (`guest_pii` rows) | 90 days after event settles | `purge_after < NOW()` — nightly QStash job at 02:00 UTC | Hard delete from `guest_pii` table |
| Receipt images (Supabase Storage) | 90 days after event settles | Event `fully_settled_at` + 90 days — nightly QStash job | Supabase Storage delete via service role |
| Settlement log | 7 years (financial audit record) | Never automatically deleted | No deletion — immutable |
| Analytics events | 2 years | Monthly partition drop | Drop partition table for months older than 24 months |
| AI audit log (`ai_audit_log`) | 2 years | Monthly cleanup job | Delete rows where `created_at < NOW() - INTERVAL '2 years'` |
| Access logs (Railway) | 30 days | Railway automatic log rotation | Managed by Railway — no action required |
| Notification log (`notification_log`) | 1 year | Quarterly cleanup job | Delete rows where `sent_at < NOW() - INTERVAL '1 year'` |
| SMS opt-out records (`sms_opt_outs`) | Permanent | Never | Legal requirement — STOP opt-outs must be honoured indefinitely |
| Device sessions (`device_sessions`) | Until account deletion or session expiry | Account deletion (P31) or 90 days of inactivity | Hard delete on P31; cleanup job for inactive sessions |

---

### Nightly Cleanup Job Specification

The nightly cleanup job runs via QStash cron at **02:00 UTC daily**. It performs all time-based data purges in a single job invocation.

**QStash Schedule:**
```
URL:  https://[railway-production-url]/api/v1/jobs/nightly-cleanup
Cron: 0 2 * * *
```

**Job endpoint:**
```typescript
// backend/src/modules/jobs/nightly-cleanup.controller.ts
import { Request, Response } from 'express';
import { Receiver } from '@upstash/qstash';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { logger } from '../../infrastructure/logger';

export async function handleNightlyCleanup(
  req: Request,
  res: Response
): Promise<void> {
  // Step 1: Verify QStash signature — reject unauthenticated calls
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });
  const isValid = await receiver.verify({
    signature: req.headers['upstash-signature'] as string,
    body: JSON.stringify(req.body),
  });
  if (!isValid) {
    res.status(401).json({ error: 'Invalid QStash signature' });
    return;
  }

  const results: Record<string, number | string> = {};
  const now = new Date().toISOString();

  // Step 2: Purge expired guest_pii rows (90 days after event settlement)
  try {
    const { count: guestPiiDeleted, error: guestPiiError } = await supabaseAdmin
      .from('guest_pii')
      .delete({ count: 'exact' })
      .lt('purge_after', now);
    if (guestPiiError) throw guestPiiError;
    results['guest_pii_deleted'] = guestPiiDeleted ?? 0;
    logger.info({ task: 'guest_pii_purge', deleted: guestPiiDeleted });
  } catch (err) {
    results['guest_pii_error'] = String(err);
    logger.error({ task: 'guest_pii_purge', error: err });
  }

  // Step 3: Purge expired receipt images from Supabase Storage
  // Events where fully_settled_at + 90 days < NOW() and receipt_s3_key is set
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleItems } = await supabaseAdmin
      .from('receipt_items')
      .select('receipt_s3_key')
      .not('receipt_s3_key', 'is', null)
      .lte('created_at', cutoff); // proxy: items older than cutoff from settled events

    // For each stale image, delete from storage
    let imagesDeleted = 0;
    for (const item of staleItems ?? []) {
      if (!item.receipt_s3_key) continue;
      const { error } = await supabaseAdmin.storage
        .from('receipts')
        .remove([item.receipt_s3_key]);
      if (!error) {
        imagesDeleted++;
        // Clear the s3_key reference so the record doesn't get picked up again
        await supabaseAdmin
          .from('receipt_items')
          .update({ receipt_s3_key: null })
          .eq('receipt_s3_key', item.receipt_s3_key);
      }
    }
    results['receipt_images_deleted'] = imagesDeleted;
    logger.info({ task: 'receipt_image_purge', deleted: imagesDeleted });
  } catch (err) {
    results['receipt_image_error'] = String(err);
    logger.error({ task: 'receipt_image_purge', error: err });
  }

  // Step 4: Purge notification_log rows older than 1 year
  try {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { count: notifDeleted, error: notifError } = await supabaseAdmin
      .from('notification_log')
      .delete({ count: 'exact' })
      .lt('sent_at', oneYearAgo);
    if (notifError) throw notifError;
    results['notification_log_deleted'] = notifDeleted ?? 0;
    logger.info({ task: 'notification_log_purge', deleted: notifDeleted });
  } catch (err) {
    results['notification_log_error'] = String(err);
    logger.error({ task: 'notification_log_purge', error: err });
  }

  // Step 5: Purge ai_audit_log rows older than 2 years
  try {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const { count: aiLogDeleted, error: aiLogError } = await supabaseAdmin
      .from('ai_audit_log')
      .delete({ count: 'exact' })
      .lt('created_at', twoYearsAgo);
    if (aiLogError) throw aiLogError;
    results['ai_audit_log_deleted'] = aiLogDeleted ?? 0;
    logger.info({ task: 'ai_audit_log_purge', deleted: aiLogDeleted });
  } catch (err) {
    results['ai_audit_log_error'] = String(err);
    logger.error({ task: 'ai_audit_log_purge', error: err });
  }

  // Step 6: Purge inactive device_sessions (90 days of inactivity)
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { count: sessionsDeleted, error: sessionsError } = await supabaseAdmin
      .from('device_sessions')
      .delete({ count: 'exact' })
      .lt('last_active_at', ninetyDaysAgo);
    if (sessionsError) throw sessionsError;
    results['device_sessions_deleted'] = sessionsDeleted ?? 0;
    logger.info({ task: 'device_session_purge', deleted: sessionsDeleted });
  } catch (err) {
    results['device_session_error'] = String(err);
    logger.error({ task: 'device_session_purge', error: err });
  }

  // Return summary — logged by Railway; never contains PII
  res.json({
    status: 'complete',
    timestamp: now,
    results,
  });
}
```

**The job is idempotent.** If it runs twice in a day due to a QStash retry, it deletes what it finds. Rows already deleted are not double-deleted. The Supabase `.delete().lt(column, cutoff)` call is safe to repeat.

**Monitoring:** Sentry captures any error in the job. If `guest_pii_deleted` is consistently 0 for more than 7 days after launch, investigate whether events are being settled correctly and `purge_after` is being set.

---

## 8. Secret Management

### How Secrets Flow to the Application

All secrets are stored in Doppler and injected into the Node.js process as `process.env` variables at startup. The flow is:

```
Doppler (source of truth)
    │  Doppler CLI / Railway Doppler integration
    │  injects at process start
    ▼
process.env in the running Node.js process
    │  accessed only via process.env.KEY_NAME
    │  never assigned to module-level variables that outlive a request
    ▼
Used in-memory, discarded after operation completes
```

**No secrets are ever:**
- Written to any file in the repository
- Hardcoded in any TypeScript or JavaScript file
- Written to application logs at any log level
- Included in error messages returned to clients
- Passed as URL query parameters
- Included in git commits (enforced by `git-secrets` pre-commit hook)

### Environment Isolation

Each environment (development, staging, production) has its own Doppler environment with its own set of secret values. Doppler access controls ensure:

- A developer with access to the `development` environment cannot read `staging` or `production` secrets
- The Railway staging service pulls from the Doppler `staging` environment only
- The Railway production service pulls from the Doppler `production` environment only

Development secrets in `.env.development` (local only, listed in `.gitignore`) are used only for running the backend locally. They reference the `letssplyt-dev` Supabase project — a completely separate database with no production data.

### Secret Rotation Procedure

```
1. Generate new key value:
   openssl rand -hex 32    (for 32-byte keys)
   openssl rand -hex 64    (for 64-byte keys)

2. Update the key in Doppler for the target environment

3. If the key is HANDLE_ENCRYPTION_KEY or PHONE_ENCRYPTION_KEY:
   Run the re-encryption migration BEFORE rotating the key in Doppler:
   a. Read all encrypted rows with the OLD key
   b. Re-encrypt with the NEW key in a transaction
   c. Commit the migration
   d. Then update Doppler with the new key
   e. Redeploy Railway (Railway auto-detects Doppler changes)

4. If the key is JWT_SECRET:
   a. Update in Doppler
   b. Redeploy Railway — all active sessions are immediately invalidated
   c. Notify users via in-app message if the rotation is planned

5. Verify the application starts correctly after rotation:
   Check Railway deployment logs for startup errors
   Run smoke tests against the affected environment
```

### Critical Rules

**PHONE_ENCRYPTION_KEY per environment:** This key must be different for each environment. If the same key is used in development and production, a developer who gains access to development data (which may be cloned from production) can decrypt production phone numbers. Loss of this key means every encrypted phone in the database becomes permanently unreadable — treat it with the same care as a private key.

**JWT_SECRET rotation consequence:** Rotating JWT_SECRET invalidates all active sessions immediately. Every logged-in user is forced to re-authenticate via OTP. Schedule planned rotations for off-peak hours and announce in advance through the app.

**Never log key values:** Even at `DEBUG` level, never write `console.log(process.env.PHONE_ENCRYPTION_KEY)` or equivalent. If a key value appears in any log output, treat it as a Severity 2 incident (see Section 9).

**Pre-commit enforcement:**
```bash
# Install git-secrets (one-time per developer machine)
brew install git-secrets   # macOS
# or: https://github.com/awslabs/git-secrets

# Configure for this repo (run in repo root)
git secrets --install
git secrets --register-aws   # catch AWS key patterns
# Add custom patterns for hex secrets:
git secrets --add '[0-9a-f]{64}'   # catches 32-byte hex keys
git secrets --add 'SUPABASE_SERVICE_ROLE'
```

---

## 9. Incident Response

### Severity Classification

| Severity | Definition | Response Time |
|---|---|---|
| Severity 1 | Database breach, account takeover at scale, production data exposure | Immediately upon discovery, 24/7 |
| Severity 2 | API key leaked to git, encryption key exposed in logs, single account compromise | Within 2 hours during business hours; within 4 hours outside |
| Severity 3 | Rate limiting bypass, anomalous API usage pattern, failed auth spike | Within 24 hours |

---

### Severity 1 Runbook — Database Breach

**Definition:** Attacker has or may have gained read access to the Supabase database, either via a misconfigured RLS policy, a leaked service role key, or a vulnerability in Supabase itself.

**Step 1 — Immediate containment (do these in the first 15 minutes)**

```bash
# 1a. Rotate PHONE_ENCRYPTION_KEY in Doppler (production)
#     This does NOT decrypt existing data — it prevents the attacker from using
#     a stolen key to decrypt future writes. Old data encrypted with the old key
#     remains encrypted but temporarily unreadable (see Step 3).
doppler secrets set PHONE_ENCRYPTION_KEY=$(openssl rand -hex 32) --project letssplyt --config production

# 1b. Rotate HANDLE_ENCRYPTION_KEY in Doppler (production)
doppler secrets set HANDLE_ENCRYPTION_KEY=$(openssl rand -hex 32) --project letssplyt --config production

# 1c. Rotate JWT_SECRET — this invalidates ALL active sessions immediately.
#     Every user will be logged out and must re-authenticate.
doppler secrets set JWT_SECRET=$(openssl rand -hex 64) --project letssplyt --config production

# 1d. If SUPABASE_SECRET_KEY (service role key) may be compromised:
#     Go to Supabase Dashboard → Project Settings → API → Service role key → Regenerate
#     Then update in Doppler:
# Update SUPABASE_SECRET_KEY in Doppler with the regenerated service role key:
doppler secrets set --project letssplyt --config production SUPABASE_SECRET_KEY "<regenerated-key>"

# 1e. Force a Railway redeploy to pick up the new secrets:
npx @railway/cli@latest redeploy --service letssplyt-production
```

**Step 2 — Assess breach scope**

```bash
# Check Supabase access logs for abnormal queries or role escalations:
# Go to: Supabase Dashboard → Logs → Postgres Logs
# Filter for: service_role requests that did not originate from your Railway IP range

# Check Railway logs for any unusual outbound connections or data volume spikes:
npx @railway/cli@latest logs --service letssplyt-production --tail 1000

# Check if sms_opt_outs, users, guest_pii, or user_payment_handles were queried
# by an IP address that is not the Railway production egress IP

# Document: what data could have been exposed, how many users are affected
```

**Step 3 — Re-encryption migration (after breach scope is determined)**

If `PHONE_ENCRYPTION_KEY` or `HANDLE_ENCRYPTION_KEY` are believed to have been obtained by the attacker, all affected ciphertext must be considered compromised. Re-encryption is required:

```typescript
// Run as a one-off script against production (AFTER rotating keys in Doppler)
// backend/scripts/re-encrypt-pii.ts

import { supabaseAdmin } from '../src/infrastructure/supabase';
import { encrypt, decrypt } from '../src/infrastructure/encryption';

const OLD_PHONE_KEY = process.env.OLD_PHONE_ENCRYPTION_KEY!;  // set temporarily for migration
const NEW_PHONE_KEY = process.env.PHONE_ENCRYPTION_KEY!;       // already updated in Doppler

async function reEncryptPhones(): Promise<void> {
  // Safety check: count affected users before proceeding
  const { count } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);
  console.log(`Re-encrypting PII for ${count} active users. Press Ctrl+C to abort.`);
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5-second abort window

  // CORRECT — selects active users (deleted_at IS NULL):
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, phone_encrypted, name_encrypted')
    .is('deleted_at', null);

  for (const user of users ?? []) {
    const phone = decrypt(user.phone_encrypted, OLD_PHONE_KEY);
    const name = user.name_encrypted ? decrypt(user.name_encrypted, OLD_PHONE_KEY) : null;
    await supabaseAdmin.from('users').update({
      phone_encrypted: encrypt(phone, NEW_PHONE_KEY),
      name_encrypted: name ? encrypt(name, NEW_PHONE_KEY) : null,
    }).eq('id', user.id);
  }

  // Repeat for guest_pii
  const { data: guests } = await supabaseAdmin
    .from('guest_pii')
    .select('id, phone_encrypted, name_encrypted');

  for (const guest of guests ?? []) {
    const phone = decrypt(guest.phone_encrypted, OLD_PHONE_KEY);
    const name = decrypt(guest.name_encrypted, OLD_PHONE_KEY);
    await supabaseAdmin.from('guest_pii').update({
      phone_encrypted: encrypt(phone, NEW_PHONE_KEY),
      name_encrypted: encrypt(name, NEW_PHONE_KEY),
    }).eq('id', guest.id);
  }
}

reEncryptPhones().then(() => console.log('Re-encryption complete')).catch(console.error);
```

**Step 4 — User notification (within 72 hours of discovery)**

GDPR Article 34 and India DPDP Act Section 8(6) require notifying affected users when a breach is likely to result in high risk to their rights and freedoms. Compose a notification:

> "We are writing to inform you that LetsSplyt experienced a security incident on [date]. [Describe what data was potentially accessed, e.g. 'encrypted phone number records']. We have taken the following steps to secure your account: [list actions]. We recommend that you re-verify your account the next time you sign in. If you have questions, contact us at privacy@[your-domain]."

Delivery channel: SMS (via Twilio) to all affected users. If SMS is not possible (user opted out), send via push notification.

**Step 5 — Regulatory notification**

- If more than 100 users are affected: notify the Data Protection Board of India within 72 hours of discovery
- If EU/UK users are affected: notify the relevant supervisory authority (e.g. ICO for UK users) within 72 hours
- File an internal breach report documenting: date/time of discovery, scope, affected data types, number of users affected, containment steps taken, user notification sent

**Step 6 — Post-incident review**

Within 7 days of the breach being contained:
1. Conduct a root cause analysis: how did the breach occur?
2. Identify the specific RLS policy gap, misconfiguration, or key exposure that enabled the breach
3. Write a remediation plan and implement it before reopening the affected system
4. Update this document if the threat model requires revision

---

### Severity 2 Runbook — API Key Leaked to Git

**Definition:** A secret key (any value that should be in Doppler) was committed to a git repository, whether public or private.

**Step 1 — Immediate revocation (within 30 minutes)**

Do not wait for a git rewrite. Assume the key has been harvested by automated scanning tools (e.g. GitHub secret scanning, truffleHog) the moment it was pushed.

```bash
# Identify which key was exposed from the git diff or GitHub alert

# If SUPABASE_ANON_KEY or SUPABASE_SECRET_KEY:
#   Supabase Dashboard → Project Settings → API → Regenerate the affected key

# If TWILIO_AUTH_TOKEN:
#   Twilio Console → Account → API keys & tokens → Rotate auth token

# If GEMINI_API_KEY:
#   Google AI Studio → API keys → Delete the exposed key → Create new key

# If ANTHROPIC_API_KEY:
#   Anthropic Console → API Keys → Delete exposed key → Create new key

# If any Doppler-managed key (HANDLE_ENCRYPTION_KEY, PHONE_ENCRYPTION_KEY, etc.):
doppler secrets set KEY_NAME=$(openssl rand -hex 32) --project letssplyt --config [env]

# If QSTASH_TOKEN or signing keys:
#   Upstash Console → QStash → Tokens → Revoke and regenerate
```

**Step 2 — Update Doppler and redeploy**

```bash
# After generating a new key value, update in Doppler for the affected environment:
doppler secrets set KEY_NAME=[new-value] --project letssplyt --config [dev|staging|production]

# Railway will auto-detect the Doppler change and trigger a redeploy.
# Monitor the deployment in Railway dashboard to confirm successful startup.
npx @railway/cli@latest logs --service letssplyt-[env] --tail 200
```

**Step 3 — Purge the key from git history**

```bash
# Use BFG Repo Cleaner (faster than git filter-branch for this purpose)
# Download: https://rtyley.github.io/bfg-repo-cleaner/

# Replace all occurrences of the exposed key value in git history:
bfg --replace-text secrets-to-remove.txt   # file contains one key value per line

# After BFG runs:
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease origin [branch]

# If the repository is on GitHub:
# Go to Settings → Security → Secret scanning alerts → mark the alert as resolved
# GitHub will also automatically block future pushes of the same key value
```

**Step 4 — Audit git history for additional exposures**

```bash
# Scan the entire git history for any other secrets:
git secrets --scan-history

# Or use truffleHog:
trufflehog git file://. --only-verified
```

**Step 5 — Root cause and prevention**

Determine how the key ended up in a commit:
- Was it hardcoded during development and not removed?
- Was a `.env` file accidentally staged and committed?
- Was a test fixture using a real key?

Remediation:
- Add the exposed file pattern to `.gitignore` if not already present
- Add `git-secrets` patterns for the exposed key format
- Review all `.env*` files to ensure they are listed in `.gitignore`
- Brief the development team on what happened and how to prevent recurrence

---

### Severity 3 Runbook — Rate Limiting Bypass or Auth Spike

**Definition:** Monitoring detects an unusual volume of failed authentication attempts, an IP making requests above normal traffic patterns, or a user making API calls that exceed expected rate limit bounds.

**Investigation (within 24 hours):**

```bash
# Review Railway logs for rate limit hits (HTTP 429 responses):
npx @railway/cli@latest logs --service letssplyt-production | grep "429"

# Review Supabase Auth logs for OTP request spikes:
# Supabase Dashboard → Logs → Auth Logs → filter for "otp"

# Check Upstash Redis for rate limit key patterns:
# Upstash Console → Redis → CLI:
# KEYS rate_limit:*

# If a specific IP is abusing the API:
# Add a temporary IP block in Railway networking settings
# OR: update the rate limiter to apply a tighter limit on that IP

# If OTP abuse is suspected (SMS toll fraud):
# Temporarily reduce OTP rate limits in the rate-limiter middleware:
# POST /auth/otp/request: 2 per phone per hour (from 5)
# Monitor Twilio console for unusual message volumes
```

**If OTP abuse is confirmed (SMS toll fraud pattern):**
1. Immediately pause Twilio messaging via the Twilio console (Emergency Stop)
2. Investigate the pattern: are requests coming from a small number of IPs? Are they requesting OTPs for phone numbers in a specific country code?
3. Implement CAPTCHA on the OTP request endpoint if IP-based rate limiting is insufficient
4. Re-enable Twilio messaging after the attack is mitigated
5. Review Twilio costs incurred during the attack — if significant, contact Twilio support to dispute fraudulent charges

---

*End of Security and Privacy Architecture. Version 1.0 — June 2026.*
*This document is the authority for the LetsSplyt security model. Any implementation that contradicts this document is a bug. Update this document when architectural decisions change.*
