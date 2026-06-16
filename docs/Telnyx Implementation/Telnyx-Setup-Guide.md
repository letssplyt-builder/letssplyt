# LetsSplyt — Telnyx Setup Guide

**Environments covered:** Development · Staging · Production  
**Who this is for:** Pawan (solo developer), setting up Telnyx from scratch  
**Time to complete:** ~2 hours for dev + staging; ~1 week for production (10DLC approval)

---

## Table of Contents

1. [Overview and Key Concepts](#1-overview-and-key-concepts)
2. [Account Setup](#2-account-setup)
3. [Development Environment](#3-development-environment)
4. [Staging Environment](#4-staging-environment)
5. [A2P 10DLC Registration (required for production off-net SMS)](#5-a2p-10dlc-registration)
6. [Production Environment](#6-production-environment)
7. [Doppler Configuration](#7-doppler-configuration)
8. [Webhook Setup](#8-webhook-setup)
9. [Testing Checklist by Environment](#9-testing-checklist-by-environment)
10. [Monitoring and Alerts](#10-monitoring-and-alerts)
11. [Troubleshooting](#11-troubleshooting)
12. [Cost Reference](#12-cost-reference)

---

## 1. Overview and Key Concepts

### What Telnyx Does for LetsSplyt

LetsSplyt uses Telnyx for two SMS operations:
- **OTP delivery** — sending a 6-digit verification code when a user registers or logs in
- **Payment request SMS** — sending each participant their share of the bill with payment links

### Key Terms

| Term | What it means |
|---|---|
| **Messaging Profile** | A container in Telnyx that groups phone numbers. Controls webhook URL and messaging settings. Each environment (dev, staging, prod) should have its own Messaging Profile. |
| **A2P 10DLC** | Application-to-Person 10-Digit Long Code. FCC-mandated registration for sending SMS from US long-code numbers to real US phone numbers. Required for production off-net (to non-Telnyx numbers) messaging. |
| **On-net messaging** | Telnyx-to-Telnyx SMS. No carrier involved. Free. No A2P 10DLC required. Used for dev testing. |
| **Off-net messaging** | Telnyx-to-carrier SMS (to real phone numbers on AT&T, Verizon, T-Mobile, etc.). Requires A2P 10DLC registration for production. |
| **TCR** | The Campaign Registry — the industry body that approves A2P 10DLC brands and campaigns. |
| **Sole Proprietor** | A simplified 10DLC registration path for individual developers without an LLC. No EIN required. Limited to 1 campaign, 1 phone number, and low throughput (~75 msgs/day). Sufficient for LetsSplyt v1. |
| **E.164** | Phone number format required by Telnyx: `+` followed by country code and number, no spaces or dashes. Example: `+14155550123`. |

### Environment Strategy

```
Dev       ─── One Telnyx account (personal/dev account)
               Two numbers: one sender, one test receiver (on-net only)
               No A2P 10DLC needed for on-net testing
               SMS_PROVIDER=telnyx

Staging   ─── Same Telnyx account as dev (separate Messaging Profile)
               Toll-Free number (TFN) — approved in 1-3 days vs 7+ days for 10DLC
               Can send to real phones once TFN is verified
               SMS_PROVIDER=telnyx

Production ── Same Telnyx account (separate Messaging Profile)
               10DLC long-code number registered via Sole Proprietor path
               Send to any US number once 10DLC campaign is approved
               SMS_PROVIDER=telnyx
```

---

## 2. Account Setup

### 2.1 Create a Telnyx Account

1. Go to **https://telnyx.com** and click **Get Started Free**
2. Enter your email and create a password
3. Verify your email address
4. Complete the phone number verification step
5. You are now in the Telnyx Mission Control Portal (their dashboard)

**Billing:** Telnyx is prepaid. You add credits to your account and they are consumed as you send messages. Start with $25-50 for development.

**Add credits:**
- Dashboard → **Billing** → **Add Funds**
- Minimum top-up: $20
- Funds do not expire

### 2.2 Note Your Account ID

- Dashboard → **Account** (top-right avatar) → **Account Settings**
- Copy your **Account ID** (looks like `ACC-xxxxxxxxxxxx`)
- You won't need this in code, but it's useful for support tickets

---

## 3. Development Environment

**Goal:** Send test SMS messages from your backend to a second Telnyx number you own (on-net), without A2P 10DLC registration. No real carrier involved — free and instant.

### 3.1 Create Your First API Key (Dev)

1. Dashboard → **Auth** → **API Keys**
2. Click **+ Add API Key**
3. Name: `letssplyt-dev`
4. Click **Create Key**
5. **COPY THE KEY NOW** — it is only shown once
6. Store it in Doppler as `TELNYX_API_KEY` for the `dev` environment (see Section 7)

### 3.2 Purchase Two Phone Numbers

You need two numbers for on-net dev testing: one that sends (your app's number), one that receives (simulates a real user's phone).

1. Dashboard → **Numbers** → **Search & Buy Numbers**
2. **First number (sender):**
   - Country: United States
   - Number type: Long Code
   - Features: SMS ✓
   - Pick any available number
   - Click **Add to Cart** → **Purchase**
   - Note this number as your `TELNYX_FROM_NUMBER` (e.g. `+14155550001`)

3. **Second number (receiver/test target):**
   - Repeat the above
   - Note this number — you'll use it as the "to" number in dev tests
   - This number simulates a test user's phone

**Cost:** ~$1.00/month per number on Telnyx (vs ~$1.15 on Twilio).

### 3.3 Create a Dev Messaging Profile

A Messaging Profile groups numbers and defines the webhook URL.

1. Dashboard → **Messaging** → **Messaging Profiles**
2. Click **+ New Profile**
3. Name: `letssplyt-dev`
4. Webhook URL: `https://your-dev-tunnel-url/webhooks/telnyx/messaging`
   - For local dev: use **ngrok** or **Cloudflare Tunnel** to expose your local backend
   - Example: `https://abc123.ngrok-free.app/webhooks/telnyx/messaging`
   - If you're not using webhooks in dev, you can leave this blank for now
5. Click **Save**

### 3.4 Assign Your Numbers to the Dev Messaging Profile

1. Dashboard → **Numbers** → **My Numbers**
2. Click on your sender number (`+14155550001`)
3. In the **Messaging** tab, find **Messaging Profile**
4. Select `letssplyt-dev` from the dropdown
5. Click **Save**
6. Repeat for the receiver number

**Why both?** On-net delivery requires both numbers to be Telnyx numbers. The receiver number doesn't need to be in a profile for receiving, but assigning it makes management easier.

### 3.5 Configure Doppler (Dev)

See Section 7 for full Doppler instructions. Summary for dev:

```
SMS_PROVIDER=telnyx
TELNYX_API_KEY=<your dev API key>
TELNYX_FROM_NUMBER=+14155550001   ← your dev sender number
```

### 3.6 Test On-Net Messaging

Start your backend locally and send a test SMS via your API:

```bash
# Using curl (replace with your local backend URL and test number)
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+14155550002"}'   # ← your second Telnyx number
```

The OTP should arrive at the second Telnyx number. To "check" it, query the `otp_verifications` table directly in Supabase's Table Editor to see the code (hashed), or instrument your dev backend to log the plaintext code (REMOVE this log before staging).

**Alternatively:** Use the Telnyx Portal to check message logs:
- Dashboard → **Messaging** → **Message Log**
- You can see all sent/received messages and their status

---

## 4. Staging Environment

**Goal:** Send real SMS to actual phone numbers (your personal mobile, test users) so you can test the full OTP and payment SMS flow end-to-end.

**Recommended approach for staging:** Use a **Toll-Free Number (TFN)** instead of a 10DLC long-code. Reasons:
- TFN Verification takes 1-3 business days (vs 7+ days for 10DLC)
- No brand/campaign registration required — just a single form
- Throughput: 3 MPS (sufficient for staging)
- Cost: ~$2.00/month (vs ~$1.00 for long-code, but the faster approval is worth it)

### 4.1 Purchase a Toll-Free Number (Staging)

1. Dashboard → **Numbers** → **Search & Buy Numbers**
2. Country: United States
3. Number type: **Toll-Free**
4. Features: SMS ✓
5. Pick any available 800/833/844/855/866/877/888 number
6. Click **Add to Cart** → **Purchase**
7. Note the number (e.g. `+18005550100`)

### 4.2 Create a Staging Messaging Profile

1. Dashboard → **Messaging** → **Messaging Profiles**
2. Click **+ New Profile**
3. Name: `letssplyt-staging`
4. Webhook URL: `https://staging.letssplyt.app/webhooks/telnyx/messaging`
   - Replace with your actual Railway staging URL
5. Click **Save**

### 4.3 Assign the Staging Number to the Staging Profile

1. Dashboard → **Numbers** → **My Numbers**
2. Click on your staging toll-free number
3. **Messaging** tab → Messaging Profile → select `letssplyt-staging`
4. Click **Save**

### 4.4 Submit Toll-Free Verification

Without verification, toll-free numbers can only send a limited number of messages. Submit for verification to unlock full throughput.

1. Dashboard → **Messaging** → **Toll-Free Verification**
2. Click **+ New Verification**
3. Fill in the form:

| Field | What to enter |
|---|---|
| **Phone number** | Your staging toll-free number |
| **Business name** | `LetsSplyt` |
| **Business address** | Your California address |
| **Business website** | `https://letssplyt.com` (can be a landing page) |
| **Message use case** | `Transactional` |
| **Use case description** | "LetsSplyt is a mobile bill-splitting app. We send two types of SMS: (1) one-time passcodes to verify user phone numbers during registration and login, and (2) personalized payment request messages to users informing them of their share of a restaurant bill." |
| **Sample message 1** | `Your LetsSplyt verification code is: 847293. Valid for 10 minutes.` |
| **Sample message 2** | `Hi Alex! Dinner at Nobu: Your share is $42.50. Pay Pawan on Venmo: venmo.com/pawan or CashApp: cash.app/$pawan` |
| **Opt-in method** | "Users provide their phone number and check a consent checkbox on the registration screen before submitting." |
| **Opt-out method** | "Reply STOP to opt out. Reply START to re-enable." |

4. Submit and wait 1-3 business days for approval
5. You'll receive an email when approved

### 4.5 Create a Staging API Key

1. Dashboard → **Auth** → **API Keys**
2. Click **+ Add API Key**
3. Name: `letssplyt-staging`
4. Copy the key immediately
5. Store in Doppler as `TELNYX_API_KEY` for the `staging` environment

### 4.6 Configure Doppler (Staging)

```
SMS_PROVIDER=telnyx
TELNYX_API_KEY=<your staging API key>
TELNYX_FROM_NUMBER=+18005550100   ← your staging toll-free number
```

---

## 5. A2P 10DLC Registration

**Required for:** Production long-code SMS to US phone numbers on real carriers (AT&T, Verizon, T-Mobile, etc.)

**What it is:** A2P 10DLC is an industry-wide system (mandated by US carriers since Feb 2025) that requires businesses sending application-to-person SMS to register a Brand (who you are) and a Campaign (what you're sending) with The Campaign Registry (TCR). Telnyx handles the TCR submission on your behalf through their portal.

**Timeline:** Allow 5-10 business days for full approval.

### 5.1 Choose the Sole Proprietor Path

Since LetsSplyt is operated by you as an individual (no LLC, no EIN), use the **Sole Proprietor** registration path:

| Feature | Sole Proprietor | Standard |
|---|---|---|
| EIN required | No | Yes |
| ID required | Last 4 digits of SSN | EIN |
| Max campaigns | 1 | Unlimited |
| Max phone numbers | 1 | Unlimited |
| Throughput | ~75 messages/day | 2,400+/day |
| TCR fee | ~$4/month | ~$10/month |
| Registration time | ~5-7 days | ~7-10 days |

**Is 75 messages/day enough?** For LetsSplyt v1 launch, yes. 75 messages/day = ~2,250 messages/month. At your realistic usage estimate (6 participants per event, ~8 events per day = ~48 SMS/day), this is sufficient. You can upgrade to a Standard brand later if needed by forming an LLC.

### 5.2 Register Your Brand

1. Dashboard → **Messaging** → **10DLC** → **Brands**
2. Click **+ Register Brand**
3. Select **Sole Proprietor**
4. Fill in the Brand form:

| Field | What to enter |
|---|---|
| **Brand name** | `LetsSplyt` |
| **First name** | `Pawan` |
| **Last name** | `Lawale` |
| **Email** | `builder@letssplyt.com` |
| **Phone number** | Your personal mobile (E.164 format) |
| **Country** | United States |
| **Street address** | Your California street address |
| **City** | Your city |
| **State** | CA |
| **Postal code** | Your zip code |
| **Last 4 of SSN** | (Your last 4 SSN digits — not stored by Telnyx after submission) |
| **Website** | `https://letssplyt.com` |
| **Vertical** | Technology |

5. Click **Submit Brand**
6. Brand approval takes 1-3 business days
7. You'll receive a **TCR Brand ID** once approved (save this)

**Note:** If your brand is rejected, the most common reasons are: (a) website not live, (b) privacy policy not accessible at the URL, (c) terms of service not accessible. Make sure `https://letssplyt.com/privacy` and `https://letssplyt.com/terms` are live before submitting.

### 5.3 Register Your Campaign

Once your Brand is approved:

1. Dashboard → **Messaging** → **10DLC** → **Campaigns**
2. Click **+ Register Campaign**
3. Fill in the Campaign form:

| Field | What to enter |
|---|---|
| **Brand** | Select `LetsSplyt` (from Step 5.2) |
| **Use case** | `2FA/OTP` — if this must be one, pick this. If you can select multiple, also select `Notifications` |
| **Campaign name** | `LetsSplyt Transactional` |
| **Campaign description** | "LetsSplyt is a bill-splitting mobile app. We send two types of transactional SMS messages: (1) one-time passcodes (6-digit codes) to verify user phone numbers during registration and login; (2) personalized payment request messages sent to participants in a shared restaurant bill, informing each person of their specific share and providing payment links to peer-to-peer payment services (Venmo, CashApp, Zelle). All recipients have explicitly consented to receive messages by entering their phone number and checking a consent box during app registration or event join flow. Reply STOP to opt out." |
| **Sample message 1** | `Your LetsSplyt code: 583920. Expires in 10 minutes. Reply STOP to opt out.` |
| **Sample message 2** | `Hi Sarah! Dinner at The Slanted Door: Your share is $38.75 (3 items + tip). Pay via Venmo: venmo.com/pawan or CashApp: cash.app/$pawan. Reply STOP to opt out.` |
| **Embedded links** | Yes (payment links) |
| **Embedded phone numbers** | No |
| **Age-gated content** | No |
| **Direct lending / loan arrangement** | No |
| **Subscriber optin** | Yes — describe: "Users enter their phone number and check a TCPA consent checkbox on the app registration and guest join screens before submitting. Consent wording: 'By continuing, you agree to receive SMS messages from LetsSplyt including verification codes and payment requests. Msg & data rates may apply. Reply STOP to opt out.'" |
| **Subscriber optout** | Yes — describe: "Reply STOP to any message. Opt-out processed within 10 business days." |
| **Subscriber help** | Yes — describe: "Reply HELP for assistance, or contact builder@letssplyt.com." |

4. Click **Submit Campaign**
5. Campaign approval takes 3-7 business days

**Campaign fee:** ~$10 one-time TCR registration fee, plus ~$4/month recurring brand fee. These are charged directly to your Telnyx account balance.

### 5.4 Assign Your Production Number to the Approved Campaign

Once your campaign is approved:

1. Dashboard → **Messaging** → **10DLC** → **Phone Numbers**
2. Click **+ Add Phone Number**
3. Select your production number (see Section 6.2)
4. Select your approved campaign
5. Click **Assign**

It may take up to 24 hours for the assignment to propagate to all carriers.

---

## 6. Production Environment

### 6.1 Create a Production API Key

1. Dashboard → **Auth** → **API Keys**
2. Click **+ Add API Key**
3. Name: `letssplyt-production`
4. **Important:** Store this key separately from dev/staging keys. It controls real SMS to real users.
5. Copy the key immediately and store in Doppler `production` environment

### 6.2 Purchase a Production Long-Code Number

1. Dashboard → **Numbers** → **Search & Buy Numbers**
2. Country: United States
3. Number type: Long Code
4. Features: SMS ✓ (Voice is optional)
5. Pick a number — consider selecting one with an area code local to California (area code 415, 650, 408, 510) to give a sense of locality
6. Add to cart and purchase
7. Note the number (e.g. `+14085550200`)

### 6.3 Create a Production Messaging Profile

1. Dashboard → **Messaging** → **Messaging Profiles**
2. Click **+ New Profile**
3. Name: `letssplyt-production`
4. Webhook URL: `https://letssplyt.app/webhooks/telnyx/messaging`
   - Use your production Railway URL (the `APP_URL` value in Doppler)
5. **Inbound settings:** 
   - Inbound Webhook URL: same as above (Telnyx sends both inbound messages and delivery receipts to this URL)
6. Click **Save**

### 6.4 Assign the Production Number to the Production Profile

1. Dashboard → **Numbers** → **My Numbers**
2. Click your production number
3. **Messaging** tab → Messaging Profile → `letssplyt-production`
4. Click **Save**
5. Then assign to your 10DLC campaign (see Section 5.4)

### 6.5 Configure Doppler (Production)

```
SMS_PROVIDER=telnyx
TELNYX_API_KEY=<your production API key>
TELNYX_FROM_NUMBER=+14085550200   ← your production number
```

### 6.6 Pre-Launch Checklist

Before sending your first production SMS:

- [ ] 10DLC brand is approved (status: `VERIFIED` in Telnyx portal)
- [ ] 10DLC campaign is approved (status: `ACTIVE` in Telnyx portal)
- [ ] Production number is assigned to the approved campaign
- [ ] Production webhook URL is live and returns `200` for a test POST
- [ ] Doppler production secrets are set and deployed
- [ ] `SMS_PROVIDER=telnyx` is set in Doppler production
- [ ] Privacy Policy and Terms of Service are live at `letssplyt.com/privacy` and `letssplyt.com/terms`
- [ ] STOP/START/HELP keywords are handled by your backend or Telnyx auto-response
- [ ] Consent capture is live in the app (checkbox on registration screen)
- [ ] Sent one real OTP to your personal mobile and verified it works end-to-end
- [ ] Sent one real payment request SMS and verified the links work

---

## 7. Doppler Configuration

### 7.1 Add Variables to Each Environment

In Doppler, navigate to your `letssplyt` project and set these variables per environment.

**Dev environment:**
```
SMS_PROVIDER              = telnyx
TELNYX_API_KEY            = KEY_telnyx_dev_xxxxxxxxxxxx
TELNYX_FROM_NUMBER        = +14155550001
```

**Staging environment:**
```
SMS_PROVIDER              = telnyx
TELNYX_API_KEY            = KEY_telnyx_staging_xxxxxxxxxxxx
TELNYX_FROM_NUMBER        = +18005550100
```

**Production environment:**
```
SMS_PROVIDER              = telnyx
TELNYX_API_KEY            = KEY_telnyx_prod_xxxxxxxxxxxx
TELNYX_FROM_NUMBER        = +14085550200
```

**All environments — keep (for Twilio fallback):**
```
TWILIO_ACCOUNT_SID        = ACyour_account_sid
TWILIO_AUTH_TOKEN         = your-twilio-auth-token
TWILIO_FROM_NUMBER        = +15005550006
```

**All environments — remove:**
```
TWILIO_VERIFY_SERVICE_SID    ← delete this variable; Twilio Verify no longer used
```

### 7.2 Using the Doppler CLI to Set Variables

```bash
# Switch to the right environment first
doppler setup   # if not already done

# Set a variable in a specific environment
doppler secrets set TELNYX_API_KEY="KEY_telnyx_dev_xxxx" --project letssplyt --config dev
doppler secrets set TELNYX_FROM_NUMBER="+14155550001" --project letssplyt --config dev

# Verify
doppler secrets --project letssplyt --config dev | grep TELNYX
```

### 7.3 Verify the Variable is Available in Your Backend

```bash
# Local dev: start with Doppler
doppler run -- npm run dev

# In your backend, verify the env var loads:
# Add a temporary log to app startup:
console.log('[startup] SMS_PROVIDER:', process.env.SMS_PROVIDER);
console.log('[startup] TELNYX_FROM_NUMBER:', process.env.TELNYX_FROM_NUMBER);
# Remove after confirming.
```

---

## 8. Webhook Setup

### 8.1 What Webhooks Does Telnyx Send?

Telnyx sends HTTP POST requests to your webhook URL for:
- `message.sent` — message accepted by Telnyx (not yet delivered)
- `message.finalized` — delivery outcome: `delivered` or `delivery_failed`

Your backend only needs to handle `message.finalized` to detect failed deliveries. The `telnyxWebhookRouter` created in the Cursor refactor document handles this.

### 8.2 Webhook URL by Environment

| Environment | Webhook URL |
|---|---|
| Dev (local) | `https://<ngrok-subdomain>.ngrok-free.app/webhooks/telnyx/messaging` |
| Staging | `https://staging.letssplyt.app/webhooks/telnyx/messaging` |
| Production | `https://letssplyt.app/webhooks/telnyx/messaging` |

Set these in each environment's Messaging Profile (see Sections 3.3, 4.2, 6.3).

### 8.3 Testing Webhooks Locally

Use **ngrok** to expose your local backend:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000

# Copy the HTTPS forwarding URL (e.g. https://abc123.ngrok-free.app)
# Update the dev Messaging Profile webhook URL to:
# https://abc123.ngrok-free.app/webhooks/telnyx/messaging
```

Or use **Cloudflare Tunnel** (free, no timeout):

```bash
# Install cloudflared
cloudflared tunnel --url http://localhost:3000
```

### 8.4 Verify the Webhook Works

After sending a test SMS:
1. Go to Telnyx Portal → **Messaging** → **Message Log**
2. Click on a message
3. Check the **Webhooks** tab — you should see a `200` response from your endpoint

If the webhook fails (non-200 response), Telnyx retries with exponential backoff up to 3 times.

### 8.5 Production Webhook Security (Optional for MVP — Recommended Before Public Launch)

Telnyx signs webhook requests with an Ed25519 signature. You can verify this to ensure the request actually came from Telnyx and not a malicious actor.

Telnyx also publishes a fixed CIDR range (`192.76.120.192/27`) that all webhook requests originate from. The simplest approach is to allowlist this IP range at your infrastructure level (Railway environment or a middleware check).

**Optional middleware for IP allowlist:**

```typescript
// backend/src/middleware/telnyx-ip-allowlist.ts
import { Request, Response, NextFunction } from 'express';

const TELNYX_CIDR = '192.76.120.192';

function ipInRange(ip: string): boolean {
  // Simple check: Telnyx IPs start with 192.76.120.
  // For a rigorous CIDR check, use the 'ip-cidr' npm package.
  return ip.startsWith('192.76.120.');
}

export function telnyxIPGuard(req: Request, res: Response, next: NextFunction): void {
  const clientIP = req.ip ?? req.socket.remoteAddress ?? '';
  if (!ipInRange(clientIP)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
```

Apply this middleware only to the `/webhooks/telnyx/*` route.

---

## 9. Testing Checklist by Environment

### Dev — On-Net Testing (No A2P 10DLC)

- [ ] `SMS_PROVIDER=telnyx` confirmed in Doppler dev
- [ ] API key loads correctly (no startup errors)
- [ ] Both Telnyx numbers are assigned to the `letssplyt-dev` messaging profile
- [ ] Register a test user using your second Telnyx number as the phone
- [ ] OTP SMS arrives at the second Telnyx number (visible in Telnyx Message Log)
- [ ] OTP code verifies successfully
- [ ] Create a test event and trigger payment SMS
- [ ] Payment SMS arrives at the second Telnyx number (visible in Telnyx Message Log)
- [ ] Webhook receives `message.finalized` with `status: delivered`

### Staging — Off-Net Testing (to Real Phones)

- [ ] Toll-Free Verification is approved
- [ ] `SMS_PROVIDER=telnyx` confirmed in Doppler staging
- [ ] Register a test user using your real personal mobile number
- [ ] OTP SMS arrives on your real phone
- [ ] OTP code verifies successfully (full flow in the app)
- [ ] Create a test event and trigger payment SMS
- [ ] Payment SMS arrives on your real phone
- [ ] Payment links in the SMS work correctly (open correct payment apps)
- [ ] Reply STOP from your phone → confirm opt-out is recorded
- [ ] Reply START from your phone → confirm re-subscribe works
- [ ] Webhook delivery receipts visible in Railway logs

### Production — Pre-Launch (Once 10DLC Approved)

- [ ] 10DLC brand status: `VERIFIED`
- [ ] 10DLC campaign status: `ACTIVE`
- [ ] Production number assigned to approved campaign
- [ ] All pre-launch checklist items from Section 6.6 completed
- [ ] Smoke test: send one real OTP to your personal mobile via the production backend
- [ ] Smoke test: send one real payment SMS via the production backend
- [ ] Delivery receipt webhook fires for both messages

---

## 10. Monitoring and Alerts

### 10.1 Telnyx Message Log

- Portal → **Messaging** → **Message Log**
- Filter by date range, status, or phone number
- Shows each message's status: `sent`, `delivered`, `delivery_failed`
- Export to CSV for bulk analysis

### 10.2 Delivery Failure Rate

A healthy delivery rate is >98% for US numbers. Monitor this weekly:
- Portal → **Analytics** → **Messaging**
- If delivery rate drops below 95%, investigate: common causes are invalid numbers, opted-out users, or carrier filtering

### 10.3 Set Up Email Alerts in Telnyx

- Portal → **Account** → **Notifications**
- Enable alerts for: account balance below threshold ($5 recommended), message delivery failures above a rate

### 10.4 Balance Auto-Reload

To avoid SMS outages from a depleted balance:
- Portal → **Billing** → **Auto Reload**
- Set: reload $50 when balance drops below $10
- This ensures uninterrupted service

### 10.5 Application-Level Logging

In your backend, log (without PII):
- `[sms] sent messageId=<id> provider=telnyx` — for audit trail
- `[sms] delivery_failed messageId=<id> errorCode=<code>` — from the webhook handler
- Never log phone numbers, message content, or OTP codes

---

## 11. Troubleshooting

### "403 Forbidden — Number not in Messaging Profile"

Your number is not assigned to a Messaging Profile, or it's assigned to the wrong profile for this API key.

Fix:
1. Portal → **Numbers** → **My Numbers** → click the number
2. Check which Messaging Profile it's assigned to
3. Ensure the Messaging Profile's API key matches the one you're using

### "422 Unprocessable Entity — Invalid phone number"

The `to` number is not in E.164 format. All phone numbers must start with `+` followed by country code.

Fix: check your phone number formatting before calling `sendSMS()`. The `resolveParticipantPhone()` function in `backend/src/infrastructure/security/resolveParticipantPhone.ts` should return E.164 format — verify this.

### "429 Too Many Requests"

You've hit Telnyx's rate limit. Default for a single number: 10 messages per second (MPS).

Fix: implement a retry with backoff. For LetsSplyt, you're unlikely to hit this limit. If you do, it's from a bug (sending too many simultaneous messages).

### OTP Messages Not Arriving in Dev

On-net testing requires both numbers to be Telnyx numbers in a Messaging Profile. If you send to a non-Telnyx number in dev, the message goes off-net and may be filtered without A2P 10DLC.

Fix: use only your second Telnyx number as the test recipient in dev.

### Toll-Free Verification Rejected (Staging)

Most common reasons:
- Website not live or doesn't describe the app
- Privacy Policy not accessible at a public URL
- Sample messages don't match the use case description
- Opt-in/opt-out description is vague

Fix: publish your Privacy Policy and Terms of Service on `letssplyt.com` and resubmit with more detailed opt-in/opt-out descriptions.

### 10DLC Campaign Rejected (Production)

Most common reasons:
- Brand website not live
- Privacy Policy not accessible
- Sample messages contain promotional content (10DLC transactional campaigns must be purely transactional)
- Opt-in flow not described clearly enough

Fix: ensure your website, Privacy Policy, and Terms of Service are all live and accessible before submitting. Resubmit with more detail.

### Messages Delivering to Some Carriers but Not Others

This is a carrier filtering issue. Ensure:
- Your campaign is fully approved (not just "pending")
- 24 hours have passed since number assignment
- Your message content matches your registered use case (no promotional text)
- Messages include STOP opt-out instructions at the end

---

## 12. Cost Reference

All prices in USD as of June 2026. Telnyx pricing is usage-based; no monthly minimums.

| Item | Cost | Notes |
|---|---|---|
| US long-code number | $1.00/month | Per number |
| US toll-free number | $2.00/month | Per number |
| Outbound US SMS | $0.004/message | Long-code or toll-free |
| Inbound US SMS | $0.001/message | STOP/START/HELP replies |
| 10DLC brand registration | $4.00/month | TCR fee via Telnyx |
| 10DLC campaign registration | $10.00 one-time | Per campaign, via Telnyx |
| Toll-Free Verification | Free | Included |

### Monthly Cost Estimate for LetsSplyt

Based on 1,000 realistic active users (6 participants/event, ~3 events/user/month):

| Item | Calculation | Monthly cost |
|---|---|---|
| OTP SMS | 1,000 users × 1 OTP/month | $4.00 |
| Payment request SMS | 1,000 events × 6 participants | $24.00 |
| Phone number (prod) | 1 number | $1.00 |
| 10DLC brand fee | Fixed | $4.00 |
| **Total** | | **~$33/month** |

At 15,000 users: ~$430/month (vs ~$4,200/month with Twilio).

---

*Document version: 1.0 — 2026-06-14*  
*Telnyx SDK version referenced: telnyx v6.65.0*  
*A2P 10DLC requirements as of February 2025 (FCC mandatory enforcement date)*
