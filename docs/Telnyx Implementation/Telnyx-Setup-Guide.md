# LetsSplyt — Telnyx Setup Guide

**Environments:** Development · Staging · Production  
**Audience:** Solo developer setting up Telnyx with no prior Telnyx experience  
**Telnyx portal:** [Mission Control](https://portal.telnyx.com/)  
**LetsSplyt backend webhook path:** `{APP_URL}/api/v1/webhooks/telnyx/messaging`  
**Document version:** 2.0 — 2026-06-07 (aligned to current Mission Control UI)

---

## Table of Contents

1. [How LetsSplyt uses Telnyx](#1-how-letssplyt-uses-telnyx)
2. [Portal map (bookmark these URLs)](#2-portal-map-bookmark-these-urls)
3. [One-time account setup (all environments)](#3-one-time-account-setup-all-environments)
4. [Development environment](#4-development-environment)
5. [Staging environment](#5-staging-environment)
6. [Production: A2P 10DLC (required for US long-code)](#6-production-a2p-10dlc-required-for-us-long-code)
7. [Production environment](#7-production-environment)
8. [Doppler configuration](#8-doppler-configuration)
9. [Webhooks (delivery + STOP/START)](#9-webhooks-delivery--stopstart)
10. [Testing checklists](#10-testing-checklists)
11. [Monitoring](#11-monitoring)
12. [Troubleshooting](#12-troubleshooting)
13. [Cost reference](#13-cost-reference)

---

## 1. How LetsSplyt uses Telnyx

| Message type | When it fires | Example |
|---|---|---|
| **OTP SMS** | User registers, logs in, or joins via web | `Your LetsSplyt verification code is: 583920. Valid for 10 minutes.` |
| **Payment request SMS** | Creator sends split after locking group | Share amount + Venmo/CashApp links + breakdown URL |

**One Telnyx account** is enough. Use **separate Messaging Profiles** (and separate phone numbers) per environment: dev, staging, production.

### Environment strategy

| Environment | Phone number type | Recipient numbers | Registration needed |
|---|---|---|---|
| **Dev** | 2× US long-code (Telnyx numbers) | Second Telnyx number only (**on-net**) | Level 1 verification + payment |
| **Staging** | 1× US toll-free | Your real mobile (**off-net**) | Toll-free verification (+ BRN fields if required) |
| **Production** | 1× US long-code | Any US mobile (**off-net**) | 10DLC brand + campaign + number assignment |

### Key terms

| Term | Meaning |
|---|---|
| **Mission Control** | Telnyx’s web dashboard at `portal.telnyx.com` |
| **Messaging Profile** | Groups numbers, sets **webhook URL**, inbound/outbound rules. **Every sending number must be assigned to a profile.** |
| **On-net** | SMS between two Telnyx numbers on the same account. Cheap; good for dev. **Recipient is not configured in Telnyx** — you pass the destination number in your API/app. |
| **Off-net** | SMS to real carrier numbers (AT&T, Verizon, etc.). Needs toll-free verification or 10DLC. |
| **10DLC / A2P** | US carrier requirement for application-to-person SMS from 10-digit local numbers |
| **TCR** | The Campaign Registry — approves 10DLC brands/campaigns |
| **E.164** | `+` country code + number, no spaces. Example: `+14155550123` |

---

## 2. Portal map (bookmark these URLs)

Telnyx sometimes rearranges the left sidebar. If you cannot find a menu item, use **Search** in the portal (top) or open the direct link below.

| What you need | Where to click in the UI | Direct link |
|---|---|---|
| **Account verification (Level 1)** | Account / Verifications | https://portal.telnyx.com/#/app/account/verifications |
| **Add payment / balance** | Billing → Payment | https://portal.telnyx.com/#/app/billing/payment |
| **API keys (V2)** | Top-right **account menu** → **API Keys** | https://portal.telnyx.com/#/api-keys |
| **Search & buy numbers** | **Numbers** → **Search numbers** | https://portal.telnyx.com/#/app/numbers/search-numbers |
| **Your numbers** | **Numbers** → **My numbers** | https://portal.telnyx.com/#/app/numbers/my-numbers |
| **Messaging profiles** | **Realtime Communications** → **Messaging** → **Programmable Messaging** | https://portal.telnyx.com/#/app/messaging/messaging-profiles |
| **Per-message SMS log (MDR search)** | **Debugging** → **Detail Record Search** — set **Record type** to **Messaging** | Use portal **Search** (top) and type `Detail Record Search` if the menu moved |
| **Messaging deliverability (summary)** | **Reports** → **Reporting** → **Message Deliverability** tab | https://portal.telnyx.com/#/app/reporting/messaging-deliverability |
| **MDR / usage exports** | **Reports** → **Reporting** → **Detail Requests** or **Usage Reports** | https://portal.telnyx.com/#/app/reporting/detail-requests |

**Note:** Telnyx removed the old **Messaging → Message log** page. The URL `portal.telnyx.com/#/app/messaging/log` no longer works in the current Mission Control UI (2025+ redesign). Use **Detail Record Search** to see individual sent/received messages and delivery status.
| **Toll-free verification** | **Messaging** → **Toll-Free** (or **Programmable Messaging** → Toll-Free) | https://portal.telnyx.com/#/app/programmable-messaging/toll-free-messaging |
| **10DLC brands** | **Messaging** → **10DLC** → **Brands** | https://portal.telnyx.com/#/messaging-10dlc/brands |
| **10DLC campaigns** | **Messaging** → **10DLC** → **Campaigns** | https://portal.telnyx.com/#/messaging-10dlc/campaigns |

**Left-sidebar path for messaging profiles (video-accurate):**

`Realtime Communications` → `Messaging` → `Programmable Messaging` → `Add new profile`

---

## 3. One-time account setup (all environments)

Complete these **once** before buying numbers or sending SMS.

### 3.1 Create account

1. Go to https://telnyx.com/sign-up
2. Enter email, password, complete email verification
3. Complete any signup phone verification Telnyx requests
4. You land in **Mission Control**

### 3.2 Level 1 account verification (required)

Telnyx requires **Level 1 verification** before you can assign messaging profiles to phone numbers.

1. Open https://portal.telnyx.com/#/app/account/verifications
2. Complete **Level 1** (business/individual details as prompted)
3. Wait until status shows verified (often minutes; sometimes 1–2 business days)

If number assignment fails with a verification error, return here first.

### 3.3 Add payment method and balance

Telnyx is **prepaid**. You need a positive balance to buy numbers and send messages.

1. Open https://portal.telnyx.com/#/app/billing/payment
2. Add a **payment method**
3. **Add funds** — start with **$25–50** for dev + staging experiments
4. Optional: enable **Auto reload** (e.g. reload $50 when balance &lt; $10) under Billing

### 3.4 Understand API keys (V2)

LetsSplyt uses **API V2 keys** as `Authorization: Bearer …` in the Telnyx SDK.

**Create a key (repeat per environment label in Section 8):**

1. Open https://portal.telnyx.com/#/api-keys  
   - Or: click your **name / account icon** (top-right) → **API Keys**
2. Click **Create API Key** (top-right)
3. **Tag / name:** e.g. `letssplyt-dev` (descriptive label)
4. Set expiration if you want (or no expiry for server use)
5. Click **Create**
6. **Copy the key immediately** — Telnyx shows the full secret **only once**
7. Store in **Doppler** as `TELNYX_API_KEY` (never commit to git)

**Account owner:** Only the Telnyx account **owner** can create API keys. If you are a sub-user, ask the owner or transfer ownership.

---

## 4. Development environment

**Goal:** Send OTP and payment SMS from your backend to a **second Telnyx number** (on-net). No 10DLC required. No real carrier SMS.

**Doppler `dev` config (after setup):**

```text
SMS_PROVIDER=telnyx
TELNYX_API_KEY=<paste key from letssplyt-dev>
TELNYX_FROM_NUMBER=+1XXXXXXXXXX   ← sender long-code
```

### 4.1 Create dev API key

Follow Section 3.4 with name `letssplyt-dev`. Store in Doppler **dev** as `TELNYX_API_KEY`.

### 4.2 Buy two US long-code numbers (SMS-capable)

You need two numbers on your Telnyx account. **Telnyx does not have a “test recipient” field anywhere** — not on the Messaging Profile, not under Senders, not under My Numbers. The **Senders** tab on a Messaging Profile only lists numbers that can **send outbound SMS from** that profile.

| Number | Role in LetsSplyt dev | Where it is configured |
|---|---|---|
| **Number A** | **Sender** — outbound SMS appears to come from this number | Telnyx: assign to Messaging Profile → appears on **Senders** tab. Doppler: `TELNYX_FROM_NUMBER` |
| **Number B** | **Simulated user phone** — the destination you type when registering or requesting OTP | **Only in your app or API call** (`phone_e164`). **Not** in Telnyx Messaging Profile UI |

**Number B setup in Telnyx (minimal):**

1. Buy the second number (steps below) — it must exist on your account with SMS capability.
2. You do **not** need to add Number B on the Messaging Profile **Senders** tab for on-net OTP tests (A → B).
3. Optional: assign Number B to `letssplyt-dev` in **My Numbers** if you later want inbound SMS (STOP replies, webhook tests) routed through that profile.

**Number B setup in LetsSplyt (this is the “test recipient” step):**

When you test OTP, enter Number B as the user’s phone — e.g. in the mobile register screen or:

```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone_e164": "+1XXXXXXXXXX", "context": "register"}'
```

Replace `+1XXXXXXXXXX` with **Number B** (not Number A, not your personal mobile).

**Buy both numbers:**

1. Open https://portal.telnyx.com/#/app/numbers/search-numbers
2. **Country:** United States
3. **Type:** Local (long-code) — not toll-free for dev on-net tests
4. **Features:** Ensure **SMS** is available (look for **SMS** / messaging icon in results — Telnyx labels this “SMS Available”)
5. Pick a number → **Add to cart** → **Purchase**
6. Repeat for the second number

**Record both in E.164 form:** `+14155550123` (with `+1`).

Cost: ~$1.00/month per US long-code.

### 4.3 Create Messaging Profile `letssplyt-dev`

1. Open https://portal.telnyx.com/#/app/messaging/messaging-profiles  
   - Or navigate: **Realtime Communications** → **Messaging** → **Programmable Messaging**
2. Click **Add new profile** (or **+ New profile**)
3. **Profile name:** `letssplyt-dev`
4. **Inbound settings**
   - **Webhook URL:** leave blank for now **OR** set your ngrok URL (Section 9)  
   - Format: `https://<your-tunnel>/api/v1/webhooks/telnyx/messaging`
5. **Outbound settings**
   - **Allowed destinations:** include **United States** (and any other countries you test)
6. Confirm profile uses **API V2** (default on new profiles)
7. Click **Save**

### 4.4 Assign Number A to `letssplyt-dev` (Senders tab)

Only the **sender** must be linked to the Messaging Profile. That is what populates the profile’s **Senders** tab.

**Required — Number A (sender):**

**Method A — from My Numbers list (common UI):**

1. Open https://portal.telnyx.com/#/app/numbers/my-numbers
2. Find **Number A** (your sender — same as `TELNYX_FROM_NUMBER`)
3. In the **Messaging Profile** column, click **Select profile** / **Edit** (pencil icon)
4. Under **SMS Messaging**, choose **`letssplyt-dev`**
5. If prompted about **MRC (monthly cost)** change, click **Accept**
6. Click **Save** / **Save changes**

**Method B — from Messaging Profile Senders tab:**

1. Open your `letssplyt-dev` profile → **Senders** tab
2. **Add sender** / assign number → select **Number A** → Save

**Method C — from number detail page:**

1. My Numbers → click **Number A**
2. Open **Messaging** or **Settings** tab
3. Set **Messaging profile** → `letssplyt-dev` → Save

**Verify:** Messaging Profile `letssplyt-dev` → **Senders** tab shows **Number A**. My Numbers row for Number A shows `letssplyt-dev`.

**Optional — Number B:**

Only assign Number B to `letssplyt-dev` if you need inbound SMS on B (STOP/START webhook testing). For on-net OTP delivery checks, **Detail Record Search** is enough — Number B does not need to appear on the Senders tab.

### 4.5 Configure Doppler (dev)

See Section 8. Minimum:

```text
SMS_PROVIDER=telnyx
TELNYX_API_KEY=<letssplyt-dev key>
TELNYX_FROM_NUMBER=+1XXXXXXXXXX    ← Number A only
```

Keep Twilio vars for fallback until Telnyx is fully validated (Section 8).

### 4.6 Run backend locally with Doppler

```bash
cd backend
doppler run -- npm run dev
```

Confirm startup logs show no Telnyx-related errors. Optional temporary log:

```text
SMS_PROVIDER=telnyx
TELNYX_FROM_NUMBER=+1...
```

(remove after confirming)

### 4.7 Test on-net OTP (after E11-S05 enables Telnyx send)

**Important:** Use **Number B** as `phone_e164` in the app or curl — not your personal mobile. There is no Telnyx setting for this; you simply type Number B when LetsSplyt asks for a phone number.

1. In the app: Register or request OTP with **Number B** in E.164 format
2. If `OTP_DEV_BYPASS=true` (default local dev): no SMS is sent; any 6-digit code works — Telnyx not exercised
3. To test real Telnyx send locally:
   - Set `OTP_DEV_BYPASS=false` in Doppler dev (or env)
   - Restart backend
   - Request OTP again for Number B

**Verify delivery:**

1. In Mission Control, open **Detail Record Search** (left menu under **Debugging**, or portal **Search** → type `Detail Record Search`).
2. Set **Record type** to **Messaging** (MDRs).
3. Filter **Direction** = **Outbound** and narrow by date or destination number (Number B).
4. Find your message — **Status** should show **delivered** for on-net tests (may take a few seconds).

Alternate: **Reports** → **Reporting** → **Message Deliverability** shows counts per profile (delivered / not delivered / in-flight) but not each message body.

**Verify OTP code (dev only):**

- Supabase → Table Editor → `otp_verifications` (hashed code only), **or**
- Temporarily log code in backend during dev (**remove before staging**)

**Correct API path (LetsSplyt):**

```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone_e164": "+1XXXXXXXXXX", "context": "register"}'
```

Use Number B as `phone_e164`.

### 4.8 Dev checklist

- [ ] Level 1 verification complete
- [ ] Balance &gt; $0
- [ ] API key `letssplyt-dev` in Doppler
- [ ] Two SMS-capable US numbers purchased (A = sender, B = destination in app)
- [ ] Messaging Profile `letssplyt-dev` created
- [ ] **Number A** assigned to `letssplyt-dev` (visible on **Senders** tab)
- [ ] `SMS_PROVIDER=telnyx`, `TELNYX_FROM_NUMBER` set in Doppler dev
- [ ] Outbound message appears in **Detail Record Search** (Messaging) when sending to Number B

---

## 5. Staging environment

**Goal:** Send SMS to **your real phone** and real testers (off-net). Use a **toll-free** number — faster verification than full 10DLC.

**Railway staging `APP_URL` example:** `https://staging.letssplyt.app`  
**Webhook URL:** `https://staging.letssplyt.app/api/v1/webhooks/telnyx/messaging`

### 5.1 Create staging API key

1. https://portal.telnyx.com/#/api-keys → **Create API Key**
2. Name: `letssplyt-staging`
3. Store in Doppler **staging** as `TELNYX_API_KEY`

You may reuse the dev API key temporarily, but **separate keys** are better for audit and revocation.

### 5.2 Buy one US toll-free number (SMS)

1. https://portal.telnyx.com/#/app/numbers/search-numbers
2. **Country:** United States
3. **Type:** **Toll-free** (800, 833, 844, 855, 866, 877, 888)
4. **SMS** feature required
5. Purchase one number → record as `+1800…` / `+1888…` etc.

Cost: ~$2.00/month.

### 5.3 Create Messaging Profile `letssplyt-staging`

1. Programmable Messaging → **Add new profile**
2. Name: `letssplyt-staging`
3. **Webhook URL:** `https://<your-staging-APP_URL>/api/v1/webhooks/telnyx/messaging`
4. **Allowed destinations:** United States (minimum)
5. Save

### 5.4 Assign toll-free number to staging profile

My Numbers → your toll-free number → Messaging Profile → `letssplyt-staging` → Save.

### 5.5 Toll-free verification (required for off-net SMS)

**Unverified toll-free numbers cannot send to real mobiles** (industry rule). Submit verification before staging SMS tests.

1. Open https://portal.telnyx.com/#/app/programmable-messaging/toll-free-messaging  
   - Or: **Messaging** → **Toll-Free Verification** / **Toll-Free Messaging**
2. Click **Add** / **New verification** / **Register** (label varies)
3. Select your **staging toll-free number**
4. Fill the form (use LetsSplyt-consistent copy):

| Field | Value |
|---|---|
| Business name | `LetsSplyt` |
| Business address | Your California address |
| Website | `https://letssplyt.com` (or staging marketing URL) |
| Use case | Transactional |
| Description | Bill-splitting app. SMS types: (1) 6-digit OTP for login/register/join; (2) personalized payment requests with each guest’s share and P2P payment links. |
| Sample message 1 | `Your LetsSplyt verification code is: 847293. Valid for 10 minutes. Reply STOP to opt out.` |
| Sample message 2 | `Hi Alex! Dinner at Nobu: Your share is $42.50. See full split: https://letssplyt.app/split/…. Pay via Venmo/CashApp. Reply STOP to opt out.` |
| Opt-in | User enters phone on app/web join and accepts Terms/Privacy (TCPA checkbox) before OTP. |
| Opt-out | Reply STOP to opt out; reply START to resubscribe. |

5. **Business Registration (BRN) fields** — As of **Feb 2026**, Telnyx may require:
   - `businessRegistrationNumber` (e.g. state registration or other ID for sole prop)
   - `businessRegistrationType`
   - `businessRegistrationCountry` (`US`)
   See Telnyx docs if the form shows these as required.

6. Submit → wait **1–14 business days** (often 3–5)
7. Status **Verified** in the toll-free portal before relying on staging SMS

Detailed Telnyx article: [Toll Free Verification Request Guide](https://support.telnyx.com/en/articles/10729979-toll-free-verification-request-guide)

### 5.6 Doppler (staging)

```text
SMS_PROVIDER=telnyx
TELNYX_API_KEY=<letssplyt-staging key>
TELNYX_FROM_NUMBER=+1800XXXXXXX   ← staging toll-free
```

Redeploy Railway staging after updating Doppler.

### 5.7 Staging test flow

1. Install staging app or use web join on staging URL
2. Register with **your real mobile** number
3. Receive OTP SMS from toll-free number
4. Complete OTP verify
5. Create test event → send payment messages
6. Confirm SMS content, links, and webhook delivery (Section 9)

### 5.8 Staging checklist

- [ ] Toll-free number on `letssplyt-staging` profile
- [ ] Toll-free verification status = **Verified**
- [ ] Doppler staging vars set; Railway redeployed
- [ ] Webhook URL returns 200 (after E11-S06)
- [ ] OTP + payment SMS on real phone
- [ ] STOP reply opts out (after E11-S06)

---

## 6. Production: A2P 10DLC (required for US long-code)

**When:** Before sending production SMS from a **US local (10-digit) number** to real users.

**Timeline:** Plan **5–10 business days** for brand + campaign approval.

**Sole proprietor (no LLC):** Follow Telnyx’s dedicated guide:  
[Guide to Sole Proprietor 10DLC Brand and Campaign Registration](https://support.telnyx.com/en/articles/13545282-guide-to-sole-proprietor-10dlc-brand-and-campaign-registration)

### 6.1 Register brand

1. Open https://portal.telnyx.com/#/messaging-10dlc/brands
2. Click **Create a brand** / **Create Brand**
3. Choose entity type:
   - **Sole proprietor** if no EIN (limits: ~1 campaign, ~1 number, ~75 msgs/day on sole prop tier — enough for early launch)
   - **Private / public company** if you have EIN
4. Fill business details (examples for sole prop):

| Field | Example |
|---|---|
| Display / brand name | `LetsSplyt` |
| Legal name | Your name or `LetsSplyt` per Telnyx form |
| Email | `builder@letssplyt.com` |
| Phone | Your mobile E.164 |
| Address | California business address |
| Website | `https://letssplyt.com` |
| Vertical | Technology |

5. Save → wait for identity status in portal (email when updated)

**Before submitting:** Ensure live **Privacy Policy** and **Terms** (e.g. `https://letssplyt.com/privacy` and `/terms` or in-app legal URLs).

### 6.2 Create campaign

1. Open https://portal.telnyx.com/#/messaging-10dlc/campaigns
2. **Create New Campaign**
3. Link to your approved **brand**
4. Use cases: select **2FA/OTP** and **Account notifications** / **Customer care** as allowed (pick all transactional types that match)
5. **Campaign description** (example):

   LetsSplyt sends transactional SMS only: (1) one-time passcodes for register/login/join; (2) payment requests showing each guest’s share of a restaurant bill with P2P payment links. Users opt in via phone entry + TCPA checkbox on register and web join. Reply STOP to opt out.

6. **Sample messages** — match real templates (include STOP language)
7. **Embedded links:** Yes (breakdown URLs, Venmo/CashApp links)
8. **Opt-in / opt-out / help** — describe STOP, START, HELP, and `builder@letssplyt.com`
9. Submit → wait for campaign status **ACTIVE** (3–7+ business days)

Telnyx overview: [Register for 10DLC Messaging](https://support.telnyx.com/en/articles/6325731-register-for-10dlc-messaging)

### 6.3 Assign production number to campaign

After campaign is **ACTIVE** and production number exists (Section 7):

1. Open https://portal.telnyx.com/#/messaging-10dlc/campaigns
2. Click your campaign
3. Scroll to **Assign numbers**
4. Select Messaging Profile `letssplyt-production` to load numbers
5. Assign your production long-code number
6. Allow **up to 24 hours** for carrier propagation

Article: [How to assign a number to a campaign](https://support.telnyx.com/en/articles/6325734-how-to-assign-a-number-to-a-campaign)

---

## 7. Production environment

### 7.1 Create production API key

1. https://portal.telnyx.com/#/api-keys → Create API Key
2. Name: `letssplyt-production`
3. Store only in Doppler **production** — never reuse in dev/staging

### 7.2 Buy production US long-code (SMS)

1. Search numbers → US → **Local** → SMS enabled
2. Prefer California area codes if available (415, 408, 510, etc.)
3. Purchase → record E.164 (e.g. `+14085551234`)

### 7.3 Create Messaging Profile `letssplyt-production`

1. Add new profile → name `letssplyt-production`
2. **Webhook URL:** `https://letssplyt.app/api/v1/webhooks/telnyx/messaging`  
   (use exact `APP_URL` from Doppler production + `/api/v1/webhooks/telnyx/messaging`)
3. Allowed destinations: United States (add others if product expands)
4. Save

### 7.4 Assign number to production profile

My Numbers → production number → Messaging Profile → `letssplyt-production` → Save.

### 7.5 Link number to 10DLC campaign

Section 6.3 — required before off-net production SMS from long-code.

### 7.6 Doppler (production)

```text
SMS_PROVIDER=telnyx
TELNYX_API_KEY=<letssplyt-production key>
TELNYX_FROM_NUMBER=+1XXXXXXXXXX
```

Redeploy production Railway service.

### 7.7 Production pre-launch checklist

- [ ] 10DLC brand verified
- [ ] 10DLC campaign **ACTIVE**
- [ ] Production number assigned to campaign
- [ ] Messaging profile webhook live (200 OK)
- [ ] Privacy + Terms publicly accessible
- [ ] App TCPA checkbox on phone entry / web join
- [ ] STOP/START handled by backend (E11-S06)
- [ ] One real OTP to your phone — end-to-end
- [ ] One real payment-request SMS — links work

---

## 8. Doppler configuration

Project: `letssplyt` (or your Doppler project name). Set per **config**: `dev`, `staging`, `production`.

### 8.1 Telnyx variables (per environment)

| Variable | Dev | Staging | Production |
|---|---|---|---|
| `SMS_PROVIDER` | `telnyx` | `telnyx` | `telnyx` |
| `TELNYX_API_KEY` | `letssplyt-dev` key | `letssplyt-staging` key | `letssplyt-production` key |
| `TELNYX_FROM_NUMBER` | Dev sender long-code | Staging toll-free | Prod long-code |

**Format:** E.164 with `+` — e.g. `+14155550123`

### 8.2 Twilio fallback (keep until Telnyx proven)

LetsSplyt code uses `TWILIO_PHONE_NUMBER` (not `TWILIO_FROM_NUMBER`):

```text
TWILIO_ACCOUNT_SID=ACyour_account_sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+15005550006
TWILIO_WHATSAPP_NUMBER=+15005550006   ← if using Twilio international WhatsApp
```

Set `SMS_PROVIDER=twilio` to roll back transport without code changes.

### 8.3 Remove obsolete variable

Delete from all Doppler configs:

```text
TWILIO_VERIFY_SERVICE_SID   ← no longer used (custom OTP)
TWILIO_USE_LIVE_VERIFY      ← remove if present
```

### 8.4 Doppler CLI examples

```bash
doppler secrets set SMS_PROVIDER="telnyx" --project letssplyt --config dev
doppler secrets set TELNYX_API_KEY="KEYxxxx" --project letssplyt --config dev
doppler secrets set TELNYX_FROM_NUMBER="+14155550001" --project letssplyt --config dev

doppler secrets --project letssplyt --config dev | grep -E 'SMS_PROVIDER|TELNYX'
```

### 8.5 Railway

After changing Doppler, **redeploy** staging/production so containers pick up new secrets.

---

## 9. Webhooks (delivery + STOP/START)

### 9.1 What Telnyx sends

HTTP **POST** JSON to your Messaging Profile **webhook URL**:

| Event (API v2) | Purpose |
|---|---|
| `message.sent` | Accepted by Telnyx (optional to handle) |
| `message.finalized` | **Delivered** or **delivery_failed** — update UI green checks |
| Inbound SMS (`message.received`) | User texts **STOP**, **START**, **HELP** |

LetsSplyt backend route (implemented in **E11-S06**):

```text
POST {APP_URL}/api/v1/webhooks/telnyx/messaging
```

Use this exact path in every Messaging Profile webhook field.

### 9.2 Configure webhook in Messaging Profile

For each profile (`letssplyt-dev`, `letssplyt-staging`, `letssplyt-production`):

1. Programmable Messaging → open profile → **Edit**
2. **Inbound / Webhook URL:** `https://<host>/api/v1/webhooks/telnyx/messaging`
3. **Webhook API version:** `2` (API v2)
4. Optional: **Failover URL** (second endpoint)
5. Save

### 9.3 Local dev with ngrok

```bash
# Terminal 1 — backend
cd backend && doppler run -- npm run dev

# Terminal 2 — tunnel
ngrok http 3000
```

Copy ngrok **https** URL → set webhook to:

```text
https://abc123.ngrok-free.app/api/v1/webhooks/telnyx/messaging
```

Update **letssplyt-dev** profile whenever ngrok URL changes.

**Cloudflare Tunnel** (alternative): `cloudflared tunnel --url http://localhost:3000`

### 9.4 Verify webhook delivery

1. Send a test SMS
2. Open **Detail Record Search** → **Messaging** → find the row by time or destination number
3. Check **Status** (e.g. `delivered`) and copy the **UUID** if you need it for support
4. For webhook debugging after E11-S06: confirm your backend logs show HTTP 200 from Telnyx delivery events

### 9.5 Security (production)

- Telnyx sends from IP range **`192.76.120.192/27`** — allowlist in Railway or middleware (E11-S06)
- Optional: verify Ed25519 webhook signatures (Telnyx public key in portal)

---

## 10. Testing checklists

### Dev (on-net)

- [ ] `SMS_PROVIDER=telnyx` in Doppler dev
- [ ] Number A on `letssplyt-dev` profile (Senders tab)
- [ ] OTP send to **second Telnyx number** appears in **Detail Record Search** (Messaging)
- [ ] Payment SMS to second Telnyx number
- [ ] Webhook 200 (if tunnel configured)

### Staging (off-net)

- [ ] Toll-free **Verified**
- [ ] OTP to personal mobile
- [ ] Payment SMS to personal mobile
- [ ] STOP opts out; START clears opt-out (E11-S06)

### Production

- [ ] 10DLC brand + campaign active
- [ ] Number on campaign + `letssplyt-production` profile
- [ ] Section 7.7 checklist complete

---

## 11. Monitoring

| Task | Where |
|---|---|
| Per-message delivery status | **Debugging** → **Detail Record Search** → Record type **Messaging** |
| Deliverability summary by profile | https://portal.telnyx.com/#/app/reporting/messaging-deliverability |
| Delivery analytics | Messaging → Analytics (if available) |
| Low balance alert | Billing → Notifications / Auto reload |
| Backend logs | Log `messageId` only — never phone or OTP body |

---

## 12. Troubleshooting

### `403` / “Number not assigned to messaging profile” (API `40300`)

1. My Numbers → confirm number shows correct **Messaging Profile**
2. Profile name must match the environment you are testing
3. Confirm **Level 1 verification** complete

### `422` / invalid `from` number (`42200`)

- `TELNYX_FROM_NUMBER` must match the assigned sender exactly (E.164)
- Number must be SMS-capable and on the profile

### SMS works to Telnyx number but not my iPhone (dev)

You are sending **off-net** without toll-free verification or 10DLC. In dev, only send to your **second Telnyx number**.

### Toll-free / staging messages blocked

- Verification not **Verified**
- Missing BRN fields on verification form (2026+ requirement)

### 10DLC messages blocked in production

- Campaign not **ACTIVE**
- Number not assigned to campaign (wait 24h after assignment)
- Sample messages in campaign don’t match actual content

### Webhook never fires

- Webhook URL wrong (must be public HTTPS, include `/api/v1/webhooks/telnyx/messaging`)
- Profile not assigned to sending number
- Local dev: ngrok URL stale

### Wrong OTP API in old notes

LetsSplyt uses:

- `POST /api/v1/auth/otp/request` with `{ "phone_e164": "+1...", "context": "register" }`
- Not `/api/auth/send-otp`

---

## 13. Cost reference

Approximate USD (Telnyx pricing — confirm in portal):

| Item | Cost |
|---|---|
| US long-code | ~$1.00/month |
| US toll-free | ~$2.00/month |
| Outbound US SMS | ~$0.004/message |
| Inbound SMS | ~$0.001/message |
| 10DLC brand (TCR) | ~$4/month |
| 10DLC campaign | ~$10 one-time |
| Toll-free verification | Free |

**Example at 1,000 users/month (OTP + payment SMS):** ~$30–40/month Telnyx vs much higher on Twilio Verify + Messaging.

---

## Quick reference: order of operations

```
ONE TIME (all envs)
  1. Sign up → Level 1 verify → Add payment
  2. Create API keys (dev / staging / prod labels)

DEV
  3. Buy 2 long-codes → Profile letssplyt-dev → Assign Number A (sender)
  4. Doppler dev → test on-net: OTP to Number B via app/curl

STAGING
  5. Buy toll-free → Profile letssplyt-staging → Assign number
  6. Toll-free verification → wait Verified
  7. Doppler staging → test to real phone

PRODUCTION
  8. 10DLC brand → campaign → wait ACTIVE
  9. Buy long-code → Profile letssplyt-production → Assign number
  10. Assign number to 10DLC campaign
  11. Doppler production → pre-launch checklist
```

---

*Telnyx SDK in repo: `telnyx` npm package*  
*LetsSplyt implementation stories: E11-S03–S07 in `docs/12-Build-Sequence.md`*  
*Engineering spec: `docs/Telnyx Implementation/E11-S03-Implementation-Spec.md`*
