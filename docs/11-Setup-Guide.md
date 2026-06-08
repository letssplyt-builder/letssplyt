# LetsSplyt — Setup Guide
**Version:** 2.0 | **Date:** June 2026
**For:** Non-developers building LetsSplyt with Cursor
**Script:** Run `./setup.sh` from the project root for automated setup

---

## How This Guide Works

Setup is organised into **four parts** that you complete in order:

| Part | What | When |
|---|---|---|
| **Part 1: Prerequisites** | Install tools, create accounts | Once, before anything |
| **Part 2: Development** | Build and test on your laptop | Weeks 1–8 |
| **Part 3: Staging** | Test with real people before launch | Weeks 8–12 |
| **Part 4: Production** | Launch to real users | At launch |

**The fastest way to start:** Run `./setup.sh` from the project root. It checks what you have, installs what you're missing, and guides you through each environment.

**Time and cost:**
- Prerequisites: ~2 hours, $0
- Development: $0/month (all free tiers)
- Staging: ~$5/month (Railway Hobby)
- Production: ~$80/month at launch (scales with users)

---

## Part 1 — Prerequisites
*Do this once. These steps apply to all three environments.*

---

### 1.1 — Check What's Already Installed

Run this first — it shows everything installed and flags what's missing:

```bash
./setup.sh check
```

If you see all green checkmarks, skip to **1.3 Create Your Accounts**.

---

### 1.2 — Install Required Tools

```bash
./setup.sh computer
```

This installs everything automatically. If you prefer to do it manually:

**Homebrew** (Mac package manager — everything else installs through this):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Node.js** (runs your backend code):
```bash
brew install node@22 && brew link node@22
# Verify: node --version  (should show v22.x.x)
```

**Git** (saves your code history):
```bash
brew install git
# Verify: git --version
```

**Doppler CLI** (secrets vault — replaces .env files):
```bash
brew install gnupg doppler
# Verify: doppler --version
```

**Supabase CLI** (applies database changes):
```bash
brew install supabase/tap/supabase
# Verify: supabase --version
```

**EAS CLI** (builds your app for App Store / Play Store):
```bash
npm install -g eas-cli
# Verify: eas --version
```

**Xcode** (required for iOS — install from Mac App Store, search "Xcode", free, ~15 GB):
- After install: `sudo xcodebuild -license accept`
- Verify: `xcodebuild -version`

**Android Studio** (required for Android builds — download from developer.android.com/studio):
- Run the Setup Wizard → choose Standard installation
- In SDK Manager, enable Android 14 (API 34)

**Expo Go on your phone** (for daily development testing):
- Android: Play Store → search "Expo Go" → Install
- iPhone: App Store → search "Expo Go" → Install

---

### 1.3 — Create Your Accounts

Create these accounts before continuing. Save every key to `my-keys.txt` on your Desktop as you go:

```
# LetsSplyt — My Keys File
# Keep this safe. Delete it once all keys are in Doppler.

## GitHub
GitHub Username:

## Supabase — DEV
Project URL:
Publishable Key:
Secret Key:

## Supabase — STAGING
Project URL:
Publishable Key:
Secret Key:

## Supabase — PRODUCTION
Project URL:
Publishable Key:
Secret Key:

## Twilio — LIVE Credentials
Account SID:
Auth Token:
Phone Number:
Verify Service SID:

## Twilio — TEST Credentials (free, no real SMS)
Test Account SID:
Test Auth Token:

## Gemini (dev/staging AI)
GEMINI_API_KEY:

## Anthropic (production AI)
ANTHROPIC_API_KEY:

## Upstash Redis — DEV/STAGING (shared)
REST URL:
REST Token:

## Upstash Redis — PRODUCTION (separate)
REST URL:
REST Token:

## Upstash QStash (background jobs)
QSTASH_TOKEN:
QSTASH_CURRENT_SIGNING_KEY:
QSTASH_NEXT_SIGNING_KEY:

## Domain Name:

## Expo Username:
```

---

#### GitHub — Free
1. Go to **github.com** → Sign up → verify your email → save username

---

#### 1.3B — Create and Initialise Your Git Repository

Your code lives in a private GitHub repository. Set this up before building anything — Cursor will commit to it after every confirmed story.

**Step 1 — Create the repository on GitHub:**
1. Go to **github.com** → click **+** → New repository
2. Repository name: `letssplyt`
3. Set to **Private**
4. **Do not** tick "Add a README file", "Add .gitignore", or "Choose a license" — leave all three unchecked
5. Click **Create repository**
6. Copy the HTTPS clone URL shown (e.g. `https://github.com/your-username/letssplyt.git`)

**Step 2 — Clone it to your Mac:**
```bash
cd ~/Developer   # or wherever you keep projects; create the folder if it doesn't exist
git clone https://github.com/your-username/letssplyt.git
cd letssplyt
```

> If you don't have a Developer folder: `mkdir ~/Developer` then run the commands above.

**Step 3 — Copy your project files in:**

Copy the following into your `letssplyt/` folder (these are the docs and setup files you've already created):
- `CLAUDE.md`
- `BUILD-PROGRESS.md`
- `.cursorrules`
- `setup.sh`
- `files/` folder (all 11 markdown files — keep the folder named `files/`, do not rename it)
- `prototype/` folder (all HTML mockups)
- `LetsSplyt-Antigravity.html` (Cursor Build Guide)

**Step 4 — Create your `.gitignore` file:**

Inside the `letssplyt/` folder, create a file called `.gitignore` with exactly this content:

```
# ─── Dependencies ─────────────────────────────────────────────
node_modules/

# ─── TypeScript build outputs ─────────────────────────────────
dist/
*.js.map
*.d.ts.map
*.tsbuildinfo

# ─── Expo / React Native generated ───────────────────────────
.expo/
mobile/ios/
mobile/android/

# ─── Test coverage reports ────────────────────────────────────
coverage/

# ─── Environment files (secrets live in Doppler, not here) ───
.env
.env.*
!.env.example

# ─── Supabase local dev state ─────────────────────────────────
supabase/.branches/
supabase/.temp/
.supabase/

# ─── Logs ─────────────────────────────────────────────────────
logs/
*.log
npm-debug.log*

# ─── EAS / app store build artifacts ─────────────────────────
*.ipa
*.apk
*.aab

# ─── OS / editor ──────────────────────────────────────────────
.DS_Store
Thumbs.db
```

> **Why these?**
> - `node_modules/` — npm recreates this from `package.json` on any machine. ~300 MB. Never commit it.
> - `dist/` — TypeScript compiled output. Regenerated by `npm run build`. Never commit it.
> - `.expo/` — Expo local cache. Specific to your machine. Never commit it.
> - `mobile/ios/` and `mobile/android/` — Generated by Expo when running locally. EAS Build generates these in the cloud from your source code. Never commit them.
> - `coverage/` — Jest test coverage reports. Generated by `npm test`. Never commit them.
> - `.env` / `.env.*` — You're using Doppler. No `.env` files should exist. This rule is a safety net.
> - `supabase/.branches/` and `.supabase/` — Local Supabase state. Not needed by others or CI.
> - `*.ipa`, `*.apk`, `*.aab` — Binary app builds. Hundreds of MB. Distributed via App Store/Play Store, not git.

**Step 5 — Make your first commit and push:**

```bash
git add -A
git commit -m "initial: docs, prototype, and project config"
git push origin main
```

Go to **github.com/your-username/letssplyt** and confirm all files appear.

**Step 6 — Open in Cursor:**

Open Cursor → File → Open Folder → select the `letssplyt/` folder. This is now your working directory for all development.

---

#### Branching during the build phase

During the 46-story build (Tier 1–3), commit everything directly to **`main`**. Cursor handles this automatically after each confirmed story.

The three-branch workflow (`main` / `staging` / `develop`) described in `files/10-Engineering-Operations.md` kicks in at **Epic 12** (Launch Readiness) when CI/CD is wired up and Railway deployments are active. You do not need branches, pull requests, or merge workflows until then.

**Commit message format Cursor uses:** `E##-S##: brief description`
Examples: `E01-S01: monorepo scaffold`, `E03-S02: OTP verify and session creation`

---

#### Supabase — Free (dev/staging), $25/month (production)

Create **three separate projects**:

1. Go to **supabase.com** → Start your project
2. Create `letssplyt-dev` → free tier
3. Create `letssplyt-staging` → free tier
4. Create `letssplyt-production` → upgrade to Pro before launch

For **each project**, save to `my-keys.txt`:
- **Project URL**: Click Connect → Framework tab → Expo React Native
- **Publishable key** (`sb_publishable_...`): Settings → API Keys
- **Secret key** (`sb_secret_...`): Settings → API Keys

**In each project, create a storage bucket:**
Storage → Create bucket → Name: `receipts` → Private → Create

**In each project, enable Realtime:**
Database → Replication → enable Realtime for the `participants` table

---

#### Twilio — ~$12/month
1. Go to **twilio.com** → Sign up → verify phone
2. Save **Account SID** and **Auth Token** (live credentials)
3. Find **Test Credentials** (same page) — save separately
4. Create a Verify service: Messaging → Verify → Services → Create → name it `letssplyt` → save Service SID
5. Buy a phone number: Phone Numbers → Manage → Buy a number

---

#### AI — Gemini (free) + Anthropic (paid at launch)

**Gemini 2.5 Flash** (development + staging):
1. Go to **aistudio.google.com** → Get API key → Create in new project → save as `GEMINI_API_KEY`

**Anthropic Claude Haiku** (production only):
1. Go to **console.anthropic.com** → Sign up → API Keys → Create key → save as `ANTHROPIC_API_KEY`
2. Billing → Set spending limit to **$20/month** now, raise to $100 at launch

---

#### Upstash — Free

**Redis** (job queue):
1. Go to **upstash.com** → Sign up with Google
2. Create Database: `letssplyt-redis-dev`, Regional, US-East-1 → save REST URL + Token (covers dev + staging)
3. Create second database: `letssplyt-redis-production` → save REST URL + Token separately

**QStash** (background jobs — separate from Redis):
1. Same Upstash account → click **QStash** in sidebar
2. Save: Token (`QSTASH_TOKEN`), Current Signing Key, Next Signing Key

---

#### Doppler — Free
1. Go to **doppler.com** → Sign up with Google
2. Create Project → name: `letssplyt`
3. Rename environments to: `development`, `staging`, `production`
4. In Terminal: `doppler login` → approve in browser

---

#### Domain Name — ~$15/year
Go to **namecheap.com** or **porkbun.com** → search for a short domain (e.g. `tryletssplyt.com`) → buy it

---

#### App Stores — skip for now
- **Apple Developer Program** ($99/year): start this early when ready — approval takes 1-2 business days
- **Google Play Console** ($25 one-time): can wait until launch

---

### 1.4 — Add All Secrets to Doppler

Open doppler.com → letssplyt → **development** environment first. Add each secret below.

> **Why APP_ENV?** Railway sets `NODE_ENV=production` on ALL deployments — both staging and production. Your app cannot use `NODE_ENV` to tell them apart. `APP_ENV` solves this — it is explicitly set per environment in Doppler.

**APP_ENV and NODE_ENV per environment:**

| Secret | Development | Staging | Production |
|---|---|---|---|
| `APP_ENV` | `development` | `staging` | `production` |
| `NODE_ENV` | `development` | `production` | `production` |

**Supabase (use each project's own keys):**

| Secret | Where to get it |
|---|---|
| `SUPABASE_URL` | Connect button → Framework → Expo React Native |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → `sb_secret_...` |

**Twilio (TEST for development, LIVE for staging/production):**

| Secret | Development | Staging + Production |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Test Account SID | Live Account SID |
| `TWILIO_AUTH_TOKEN` | Test Auth Token | Live Auth Token |
| `TWILIO_PHONE_NUMBER` | `+15005550006` | Your Twilio number |
| `TWILIO_VERIFY_SERVICE_SID` | Not used in dev (see below) | Your live Verify SID |
| `OTP_DEV_BYPASS` | omit (defaults to bypass) or `true` | — (omit or `false`) |

**OTP in development:** Twilio **Verify does not support test credentials** (error `20008`). With `APP_ENV=development`, the backend **defaults to OTP dev bypass** — no SMS, any 6-digit code works. Check backend logs for `otpMode: dev-bypass` on startup. Use your real phone number in the app. To test real SMS locally, set `TWILIO_USE_LIVE_VERIFY=true`, `OTP_DEV_BYPASS=false`, and use **live** Twilio credentials in Doppler.

**OTP on your physical phone during local dev:** Expo Go auto-detects your Mac's LAN IP for API calls. OTP verify screen is complete (E03-S04). Dev bypass accepts any 6-digit code when `APP_ENV=development`. New user registration requires migration `20260608000000_users_auth_registration.sql` applied to Supabase.

**AI (different providers per environment):**

| Secret | Development | Staging | Production |
|---|---|---|---|
| `GEMINI_API_KEY` | Your key | Your key | — |
| `ANTHROPIC_API_KEY` | — | — | Your key |
| `AI_PROVIDER_A1` | `gemini` | `gemini` | `anthropic` |
| `AI_MODEL_A1` | `gemini-2.5-flash` | `gemini-2.5-flash` | `claude-haiku-4-5-20251001` |
| `AI_PROVIDER_A2` | `gemini` | `gemini` | `anthropic` |
| `AI_MODEL_A2` | `gemini-2.5-flash` | `gemini-2.5-flash` | `claude-haiku-4-5-20251001` |
| `AI_PROVIDER_A3` | `gemini` | `gemini` | `anthropic` |
| `AI_MODEL_A3` | `gemini-2.5-flash` | `gemini-2.5-flash` | `claude-haiku-4-5-20251001` |

**Upstash (Redis shared for dev+staging, separate for production):**

| Secret | Development | Staging | Production |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Dev Redis URL | Dev Redis URL | Production Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Dev Redis Token | Dev Redis Token | Production Redis Token |
| `QSTASH_TOKEN` | Your QStash Token | Same | Same |
| `QSTASH_CURRENT_SIGNING_KEY` | Current key | Same | Same |
| `QSTASH_NEXT_SIGNING_KEY` | Next key | Same | Same |

**Security keys — generate DIFFERENT values for each environment:**

```bash
# Run each command in Terminal, paste the output as the value in Doppler
openssl rand -hex 32   # → HANDLE_ENCRYPTION_KEY (encrypts payment handles)
openssl rand -hex 64   # → JWT_SECRET (signs session tokens)
openssl rand -hex 16   # → ANALYTICS_SALT (anonymises analytics)
openssl rand -hex 32   # → PHONE_ENCRYPTION_KEY (encrypts phone numbers)
openssl rand -hex 32   # → PII_HMAC_SALT (hashes phones for lookups)
```

⚠️ Generate different values for dev, staging, and production. Never copy keys across environments.

**App URLs:**

> `APP_URL` is the full URL including scheme (e.g. `https://letssplyt.app`) — used by the backend for Twilio webhook URLs.
> `APP_DOMAIN` is the domain only without scheme (e.g. `letssplyt.app`) — used for CORS and deep link config.
> For local development both point to localhost.

| Secret | Development | Staging | Production |
|---|---|---|---|
| `APP_URL` | `http://localhost:3000` | `https://letssplyt.up.railway.app` | `https://your-domain.com` |
| `APP_DOMAIN` | `localhost:3000` | `letssplyt.up.railway.app` | `your-domain.com` |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000/api/v1` | `https://letssplyt.up.railway.app/api/v1` | `https://your-domain.com/api/v1` |
| `EXPO_PUBLIC_APP_DOMAIN` | `http://localhost:3000` | `https://letssplyt.up.railway.app` | `https://your-domain.com` |

> ⚠️ Fill in staging/production values after you have a Railway URL (Part 3) and domain (Part 4). Leave as shown for development now.

✅ **Part 1 complete when:** All development secrets are green in Doppler. Run `./setup.sh check` to confirm.

---

## Part 2 — Development Environment
*Weeks 1–8: Build and test on your laptop. Zero cost.*

Run the automated setup:
```bash
./setup.sh dev
```

Or follow the manual steps below.

---

### 2.1 — Connect GitHub to Cursor

1. Open **Cursor** → File → Open Folder → select your `letssplyt/` project folder
2. Sign in to Cursor with GitHub if prompted (Settings → Sign In)
3. In Cursor Settings → Features → enable Composer and Codebase Indexing
4. Confirm these files are in the project root (`~/letssplyt/`):
   - `CLAUDE.md`, `BUILD-PROGRESS.md`, `.cursorrules`, `setup.sh`
   - `files/` folder (all 11 markdown docs — **keep the name `files/`**)
   - `prototype/` folder (HTML mockups)
   - `LetsSplyt-Antigravity.html` (Cursor Build Guide)

Then connect Doppler:
```bash
cd ~/letssplyt
doppler login      # opens browser — approve the request
doppler setup      # select project: letssplyt, environment: development
```

---

### 2.2 — Build E01-S01 (Monorepo Scaffold) with Cursor

Open `LetsSplyt-Antigravity.html` in your browser. Follow the **Session 1** prompt exactly — paste it into Cursor Composer and let Cursor build the complete monorepo skeleton.

E01-S01 is the only story you build in the first session. After Cursor finishes and you confirm it's done:
- The `mobile/` directory exists with `app.config.js`
- The `backend/` and `shared/` directories exist with correct TypeScript config
- All package.json workspace files are in place

Verify all E01-S01 acceptance criteria before continuing to step 2.2A.

---

### 2.2A — EAS Init (run after E01-S01 is complete)

Now that `mobile/` exists, you can register your app with Expo and get a Project ID. This is required for push notifications to work in all builds.

> ⚠️ This step must come after E01-S01 — `eas init` requires an Expo project directory to already exist. Running it before E01-S01 will fail with "Run this command inside a project directory."

1. Make sure you are logged in to EAS:
   ```bash
   eas login
   ```
2. Move into the mobile directory and run `eas init`:
   ```bash
   cd ~/letssplyt/mobile
   eas init
   ```
3. Select **"Create a new project"** → name it `letssplyt`
4. EAS shows you a project ID like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890` — copy it
5. Open `mobile/app.config.js` and replace `YOUR_EAS_PROJECT_ID` with your real project ID
6. Add the project ID to Doppler (all three environments):
   - Secret name: `EXPO_PROJECT_ID`
   - Value: your project ID (same value in development, staging, and production)
7. Commit the updated `app.config.js`:
   ```bash
   git add mobile/app.config.js
   git commit -m "config: add EAS project ID"
   git push origin main
   ```

✅ **Done when:** `mobile/app.config.js` has a real UUID for `extra.eas.projectId` and `EXPO_PROJECT_ID` is in Doppler.

> ⚠️ Without this step, push notifications fail silently in all builds. There is no error message — notifications simply never arrive.

---

### 2.3 — Continue Building (E01-S02 onwards)

From session 2 onwards, use the one-line continuation prompt from `LetsSplyt-Antigravity.html`. Cursor reads CLAUDE.md and BUILD-PROGRESS.md, finds the next unchecked story, and builds it.

**After E02-S01 (database migrations are created), apply the schema:**

From the **repo root** (not `backend/`):

```bash
cd ~/letssplyt

# One-time: link CLI to your Supabase project
npx supabase login
npx supabase link --project-ref <ref>   # ref = subdomain of SUPABASE_URL (e.g. abcdef from https://abcdef.supabase.co)

# If tables already exist but CLI shows BOTH migrations pending, mark initial as applied first:
npx supabase migration repair 20260601000000 --status applied

# Push pending migrations (e.g. 20260608000000_users_auth_registration.sql)
npx supabase db push
```

> **Do not** use `--db-url $SUPABASE_URL` — that is the REST API URL, not a Postgres connection string. Use `supabase link` + `db push`, or paste migration SQL into Supabase Dashboard → SQL Editor.

**Seed data (optional, local or fresh remote):**
```bash
npx supabase db reset   # applies migrations + seed.sql — destructive, dev only
```

**Re-register a phone after a failed sign-up (dev only):**
```bash
cd ~/letssplyt/backend
doppler run -- npm run cleanup:phone -- +1XXXXXXXXXX
```

---

### 2.4 — Start Development Servers

**Terminal 1 — Backend:**
```bash
cd ~/letssplyt/backend
doppler run -- npm run dev
```

**Terminal 2 — Mobile:**
```bash
cd ~/letssplyt/mobile
npx expo start
```

Scan the QR code in Terminal with the Expo Go app on your Android phone. The app updates automatically when Cursor saves changes.

**If `npx expo start` fails:** paste the error message to Cursor and ask it to fix it.

---

### 2.4A — Set Up ngrok for Twilio Webhooks (Development Only)

Twilio delivery callbacks and STOP opt-out webhooks require a publicly accessible URL. During development your backend runs on localhost — Twilio cannot reach it. ngrok creates a temporary public tunnel.

**Install ngrok:**
```bash
brew install ngrok
ngrok config add-authtoken YOUR_TOKEN  # get your token at ngrok.com (free account)
```

**Every time you develop features involving Twilio webhooks:**
1. Start your backend: `doppler run -- npm run dev` (Terminal 1)
2. Start ngrok in a second terminal:
   ```bash
   ngrok http 3000
   ```
3. ngrok shows a URL like `https://abc123.ngrok.io`
4. Update Doppler development — set both URL secrets to the ngrok URL:
   - `APP_URL` = `https://abc123.ngrok.io` (used by the backend for Twilio callback URLs)
   - `APP_DOMAIN` = `abc123.ngrok.io` (domain only, no scheme)
5. In Twilio Console → Messaging → Settings → Webhook URL, set to:
   `https://abc123.ngrok.io/api/v1/webhooks/twilio/delivery`
6. For opt-out webhooks: Twilio Console → Phone Numbers → your number → Messaging → set STOP webhook to:
   `https://abc123.ngrok.io/api/v1/webhooks/twilio/opt-out`

> Note: The ngrok URL changes every time you restart ngrok (free tier). Update both `APP_URL` and `APP_DOMAIN` in Doppler and the Twilio webhook URLs when it changes.

> You only need ngrok when testing: (a) message delivery status (MessageSendingScreen green checkmarks) or (b) STOP opt-out processing. All other development works without ngrok.

---

### 2.5 — Feature Build Instructions

All feature prompts, prototype references, and build instructions are in **`LetsSplyt-Antigravity.html`** (open in your browser).

---

## Part 3 — Staging Environment
*Weeks 8–12: Test with real people. ~$5/month.*

```bash
./setup.sh staging
```

---

### 3.1 — Deploy Backend to Railway

1. Go to **railway.app** → New Project → Deploy from GitHub → select `letssplyt`
2. Railway detects Node.js and deploys → gives you a URL like `letssplyt.up.railway.app`
3. Connect Doppler to Railway: doppler.com → letssplyt → staging → Integrations → Railway → Authorise
4. Update Doppler staging secrets with your Railway URL:
   - `APP_URL` = `https://letssplyt.up.railway.app`
   - `APP_DOMAIN` = `letssplyt.up.railway.app`
   - `EXPO_PUBLIC_API_URL` = `https://letssplyt.up.railway.app/api/v1`
   - `EXPO_PUBLIC_APP_DOMAIN` = `https://letssplyt.up.railway.app`

---

### 3.1A — Host Universal Link Files for Deep Links

When a user with the LetsSplyt app taps a QR join link, their phone should open the app directly (not the browser). This requires two files hosted at specific URLs on your domain.

> **Note:** Story E06-S03 (Deep Link Infrastructure) in the build sequence handles creating the AASA and assetlinks.json files. This section covers hosting them and verifying they are accessible after deploying to Railway.

**Step 1 — Add the files to your backend**
Tell Cursor:
*"Add static file serving to Express. In app.ts, add: app.use('/.well-known', express.static('public/.well-known', { setHeaders: (res) => { res.set('Content-Type', 'application/json'); } })). Create backend/public/.well-known/apple-app-site-association.json and backend/public/.well-known/assetlinks.json using the templates in files/08-Mobile-App-Specification.md Section 9 (Deep Links). Fill in your Apple Team ID (from developer.apple.com → Account), your iOS bundle identifier (from app.config.js), your Android package name, and your Android SHA-256 fingerprint (from Google Play Console → Setup → App Integrity)."*

**Step 2 — Verify the files are accessible**
After deploying to Railway staging:
```bash
curl https://letssplyt.up.railway.app/.well-known/apple-app-site-association
# Should return JSON with your appID, not a 404
curl https://letssplyt.up.railway.app/.well-known/assetlinks.json
# Should return JSON array with your package_name
```

**Step 3 — Test deep links**
After both files return correct JSON:
- On Android: long-press the join URL → should show "Open in LetsSplyt"
- On iOS: tap join URL → should open LetsSplyt app directly (requires TestFlight build, not Expo Go)

✅ **Done when:** Both .well-known files return valid JSON without auth and deep links open the app.

> Note: Deep links only work with signed builds (EAS staging/production), NOT with Expo Go.

---

### 3.2 — Run Staging Migrations

From repo root (linked project or Postgres URI from Supabase Dashboard → Database → Connection string):

```bash
cd ~/letssplyt
npx supabase link --project-ref <staging-ref>   # one-time
npx supabase db push
# Or CI: npx supabase db push --db-url "$SUPABASE_DB_URL_STAGING"
```

---

### 3.3 — Build Staging App with EAS

```bash
eas login        # first time only
eas build --profile staging --platform android
```

The build appears at expo.dev. Share the download link with your testers — they install it directly without the Play Store.

---

### 3.4 — Register for A2P 10DLC (required for real SMS)

Without A2P registration, US carriers may filter your messages:
1. Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC
2. Register Brand (Sole Proprietor is fine)
3. Register Campaign (bill splitting payment requests + OTP)
4. Approval takes 1–5 business days

---

## Part 4 — Production Environment
*At launch. Real users, real money. ~$80/month.*

```bash
./setup.sh prod
```

⚠️ **Do not run this until staging is fully tested with at least 10 real events.**

---

### 4.1 — Upgrade Production Supabase to Pro

supabase.com → letssplyt-production → Settings → Billing → Pro ($25/month). Enables daily backups and higher connection limits.

---

### 4.2 — Set Up Production Railway Service

Create a separate Railway service for production. Connect Doppler production environment to it. Update `APP_DOMAIN` in Doppler production.

---

### 4.3 — Raise Anthropic Spending Limit

console.anthropic.com → Billing → Usage limits → set **$100/month**

---

### 4.4 — Run Production Migrations

```bash
cd ~/letssplyt
npx supabase link --project-ref <production-ref>   # one-time
npx supabase db push
# Or CI: npx supabase db push --db-url "$SUPABASE_DB_URL_PRODUCTION"
```

---

### 4.5 — EAS Production Builds

```bash
eas build --profile production --platform android
eas submit --platform android

eas build --profile production --platform ios        # requires Apple Developer Program
eas submit --platform ios
```

---

### 4.0 — Host Privacy Policy and Terms of Service

Both app stores require these pages to be live at public URLs before accepting your app submission. The content is already written in files/09-Security-And-Privacy.md Section 6.

**Option A — Serve from your backend (simplest)**
Tell Cursor:
*"Add static HTML pages for Privacy Policy and Terms of Service. Create backend/public/privacy.html and backend/public/terms.html. In app.ts, add: app.use(express.static('public')). The Privacy Policy content is in files/09-Security-And-Privacy.md Section 6 — translate the six policy statement blocks into a readable HTML page. Do the same for Terms of Service."*

Then verify after deploying to production:
```bash
curl https://your-domain.com/privacy.html  # should return HTML, not 404
curl https://your-domain.com/terms.html
```

**Option B — Vercel/Netlify static site (if you want a separate site)**
1. Create a simple HTML file at `privacy.html` and `terms.html`
2. Deploy to Vercel (free) at your custom domain

**Update app.config.js:**
```javascript
privacyPolicyUrl: 'https://your-domain.com/privacy.html',
```

**Update Expo store submission settings** in app.config.js:
```javascript
ios: {
  privacyManifests: { ... },
}
```

✅ **Done when:** Privacy Policy URL and Terms of Service URL return HTML content without authentication.

---

### 4.6 — Pre-Launch Checklist

- [ ] Privacy Policy live at your domain/privacy
- [ ] Terms of Service live at your domain/terms
- [ ] Sentry error monitoring connected
- [ ] A2P 10DLC approved by Twilio
- [ ] Production Supabase on Pro plan
- [ ] Anthropic spending limit set to $100/month
- [ ] Railway production service healthy
- [ ] EAS production builds submitted to both stores
- [ ] At least 10 complete end-to-end tests on staging
- [ ] All three Supabase projects have `receipts` storage bucket
- [ ] Realtime enabled on `participants` table in all three projects

---

## Quick Reference

### Common Commands

```bash
# Check everything is installed
./setup.sh check

# Start development
cd backend && doppler run -- npm run dev       # Terminal 1
cd mobile && npx expo start                    # Terminal 2

# Apply schema changes (development — from repo root)
cd ~/letssplyt && npx supabase db push

# Clean up failed registration by phone (dev only)
cd backend && doppler run -- npm run cleanup:phone -- +1XXXXXXXXXX

# Build staging app
eas build --profile staging --platform android

# Build production apps
eas build --profile production --platform android
eas build --profile production --platform ios

# Check Doppler secrets
doppler secrets --plain

# See current Doppler environment
doppler configure

# Switch Doppler environment
doppler setup --project letssplyt --config development
doppler setup --project letssplyt --config staging
doppler setup --project letssplyt --config production
```

### Emergency Commands

```bash
# Rotate a compromised encryption key
doppler secrets set PHONE_ENCRYPTION_KEY=$(openssl rand -hex 32)
# Railway auto-redeploys when Doppler syncs

# Check Railway logs
railway logs

# Force Railway redeploy
railway up --detach
```
