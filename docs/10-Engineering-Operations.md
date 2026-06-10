# LetsSplyt — Engineering Operations
**Version:** 1.0 | **Date:** June 2026

---

## 1. Git Branch Strategy

### Permanent Branches

| Branch | Environment | Purpose |
|--------|-------------|---------|
| `main` | Production | Live, real users, real data |
| `staging` | Staging | Pre-launch testing; mirrors production |
| `develop` | Development | Active integration branch (default) |

### Feature Workflow

```
feature/... ──▶ develop ──▶ staging ──▶ main
                  PR1          PR2        PR3
```

1. Cut `feature/[name]` from `develop`
2. Open PR into `develop` — CI must pass (lint, typecheck, unit tests)
3. Squash-merge to `develop` → auto-deploys to staging environment
4. Open PR from `staging` into `main` — requires integration tests pass + manual review
5. Merge to `main` → triggers production deploy with manual approval gate

### Branch Protection Rules

**`main`**
- Require pull request before merging
- Require at least 1 approving review
- Dismiss stale reviews when new commits are pushed
- Require status checks to pass: `typecheck`, `lint`, `unit-tests`, `integration-tests`
- Require branches to be up to date before merging
- Require linear history (no merge commits)
- Do not allow bypassing the above settings (applies to administrators)

**`staging`**
- Require pull request before merging
- Require at least 1 approving review
- Require status checks to pass: `typecheck`, `lint`, `unit-tests`
- Require branches to be up to date before merging

**`develop`**
- Require pull request before merging
- Require status checks to pass: `typecheck`, `lint`, `unit-tests`
- Allow force pushes: disabled
- Allow deletions: disabled

### Hotfix Workflow

Emergency fixes that cannot wait for the `develop` → `staging` → `main` pipeline:

```
hotfix/[description] ──▶ main    (with required reviewer approval)
                     ──▶ develop  (back-merge immediately after)
```

---

## 2. Monorepo TypeScript Configuration

### Root: `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### `shared/package.json`

```json
{
  "name": "@letssplyt/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js"
  }
}
```

### `backend/tsconfig.json`

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@letssplyt/shared": ["../shared/src/index.ts"],
      "@letssplyt/shared/*": ["../shared/src/*"]
    }
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

### `mobile/tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@letssplyt/shared": ["../shared/src/index.ts"],
      "@letssplyt/shared/*": ["../shared/src/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.d.ts"],
  "references": [{ "path": "../shared" }]
}
```

### Root `package.json` (workspaces)

```json
{
  "name": "letssplyt",
  "private": true,
  "workspaces": ["mobile", "backend", "shared"],
  "scripts": {
    "build:shared": "cd shared && npm run build",
    "dev:backend": "doppler run -- cd backend && npm run dev",
    "dev:mobile": "cd mobile && npx expo start",
    "typecheck": "npm run build:shared && cd backend && tsc --noEmit && cd ../mobile && tsc --noEmit"
  }
}
```

---

## 3. CI/CD Pipeline

### On PR to `develop`

**File:** `.github/workflows/pr-develop.yml`

```yaml
name: PR Checks (develop)

on:
  pull_request:
    branches: [develop]

jobs:
  checks:
    name: Typecheck, Lint, Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: ./backend

      - name: Typecheck
        run: npm run typecheck
        working-directory: ./backend

      - name: Lint
        run: npm run lint
        working-directory: ./backend

      - name: Unit tests
        run: npm test -- --coverage --ci
        working-directory: ./backend
        env:
          NODE_ENV: test

      - name: Security audit
        run: npm audit --audit-level=high
        working-directory: ./backend
```

### On Merge to `staging`

**File:** `.github/workflows/deploy-staging.yml`

```yaml
name: Deploy to Staging

on:
  push:
    branches: [staging]

jobs:
  deploy-staging:
    name: Test, Migrate, Deploy (Staging)
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: ./backend

      - name: Typecheck
        run: npm run typecheck
        working-directory: ./backend

      - name: Lint
        run: npm run lint
        working-directory: ./backend

      - name: Unit tests
        run: npm test -- --ci
        working-directory: ./backend
        env:
          NODE_ENV: test

      - name: Integration tests
        run: npm run test:integration -- --ci
        working-directory: ./backend
        env:
          NODE_ENV: test
          SUPABASE_URL: ${{ secrets.SUPABASE_URL_STAGING }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_STAGING }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_STAGING }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_STAGING }}

      - name: Run database migration (staging)
        run: |
          npx supabase db push --db-url $SUPABASE_DB_URL_STAGING
        env:
          SUPABASE_DB_URL_STAGING: ${{ secrets.SUPABASE_DB_URL_STAGING }}

      - name: Deploy to Railway (staging)
        run: npx @railway/cli@latest up --service letssplyt-staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_STAGING_TOKEN }}

      - name: Smoke tests
        run: npm run test:smoke
        working-directory: ./backend
        env:
          SMOKE_TEST_BASE_URL: https://staging.letssplyt.railway.app
        # Smoke tests hit the live staging URL after deploy and verify
        # /health returns 200, /auth/otp/request returns 400 on missing body,
        # and the database connection is reachable.
```

### On Merge to `main`

**File:** `.github/workflows/deploy-production.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-production:
    name: Test, Backup, Migrate, Deploy (Production)
    runs-on: ubuntu-latest
    environment: production  # requires reviewer approval in GitHub → Settings → Environments

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: ./backend

      - name: Typecheck
        run: npm run typecheck
        working-directory: ./backend

      - name: Lint
        run: npm run lint
        working-directory: ./backend

      - name: Unit tests
        run: npm test -- --ci
        working-directory: ./backend
        env:
          NODE_ENV: test

      - name: Integration tests
        run: npm run test:integration -- --ci
        working-directory: ./backend
        env:
          NODE_ENV: test
          SUPABASE_URL: ${{ secrets.SUPABASE_URL_STAGING }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_STAGING }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_STAGING }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_STAGING }}

      - name: Security audit
        run: npm audit --audit-level=high
        working-directory: ./backend

      - name: Database backup (before migration)
        run: |
          TIMESTAMP=$(date +%Y%m%d_%H%M%S)
          npx supabase db dump --db-url $SUPABASE_DB_URL_PRODUCTION > backup_${TIMESTAMP}.sql
          echo "BACKUP_FILE=backup_${TIMESTAMP}.sql" >> $GITHUB_ENV
        env:
          SUPABASE_DB_URL_PRODUCTION: ${{ secrets.SUPABASE_DB_URL_PRODUCTION }}

      - name: Upload backup artifact
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.sha }}
          path: ${{ env.BACKUP_FILE }}
          retention-days: 30

      - name: Run database migration (production)
        run: |
          npx supabase db push --db-url $SUPABASE_DB_URL_PRODUCTION
        env:
          SUPABASE_DB_URL_PRODUCTION: ${{ secrets.SUPABASE_DB_URL_PRODUCTION }}

      - name: Deploy to Railway (production)
        run: npx @railway/cli@latest up --service letssplyt-production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_PRODUCTION_TOKEN }}

      - name: Health check after deploy
        run: |
          # Wait for Railway to finish rolling deployment
          sleep 30
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.letssplyt.com/health)
          if [ "$STATUS" != "200" ]; then
            echo "Health check failed with status $STATUS"
            exit 1
          fi
          echo "Health check passed — status $STATUS"

      - name: Create GitHub release tag
        run: |
          VERSION=$(node -p "require('./backend/package.json').version")
          git tag "v${VERSION}"
          git push origin "v${VERSION}"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Mobile Typecheck and EAS Build (`.github/workflows/ci.yml` additions)

```yaml
# .github/workflows/ci.yml — add these jobs
typecheck-mobile:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - run: npm ci
    - run: npm run build:shared
    - run: cd mobile && npx tsc --noEmit

build-mobile-staging:
  needs: [typecheck-mobile, test-backend]
  if: github.ref == 'refs/heads/staging'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: expo/expo-github-action@v8
      with: { eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
    - run: npm ci && npm run build:shared
    - run: cd mobile && eas build --profile staging --platform android --non-interactive
```

### Supabase Migration CLI Commands

```bash
# Staging migration
npx supabase db push --db-url $SUPABASE_DB_URL_STAGING

# Production migration (always backup first)
npx supabase db dump --db-url $SUPABASE_DB_URL_PRODUCTION > backup_$(date +%Y%m%d_%H%M%S).sql
npx supabase db push --db-url $SUPABASE_DB_URL_PRODUCTION
```

### Required GitHub Secrets

Configure these in GitHub → Repository → Settings → Secrets and variables → Actions:

| Secret | Used By |
|--------|---------|
| `SUPABASE_URL_STAGING` | Integration tests, staging migration |
| `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Integration tests |
| `SUPABASE_DB_URL_STAGING` | Staging migration (`postgresql://...`) |
| `UPSTASH_REDIS_REST_URL_STAGING` | Integration tests |
| `UPSTASH_REDIS_REST_TOKEN_STAGING` | Integration tests |
| `RAILWAY_STAGING_TOKEN` | Railway staging deploy |
| `SUPABASE_DB_URL_PRODUCTION` | Production backup + migration |
| `RAILWAY_PRODUCTION_TOKEN` | Railway production deploy |

Configure these in GitHub → Repository → Settings → Environments → `production` → Environment secrets (the `production` environment requires a mandatory reviewer before any job runs against it).

---

## 3. Expo Mobile Build Configuration

### `eas.json`

Place this file at the root of the `/mobile` directory.

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "development" },
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    },
    "staging": {
      "distribution": "internal",
      "env": { "APP_ENV": "staging" },
      "android": {
        "buildType": "apk",
        "credentialsSource": "remote"
      },
      "ios": {
        "credentialsSource": "remote",
        "enterpriseProvisioning": "adhoc"
      }
    },
    "production": {
      "env": { "APP_ENV": "production" },
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle",
        "credentialsSource": "remote"
      },
      "ios": {
        "credentialsSource": "remote"
      }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./google-service-account.json", "track": "internal" },
      "ios": { "appleId": "your-apple-id@email.com", "ascAppId": "your-app-store-connect-id" }
    }
  }
}
```

**Note:** `autoIncrement: true` automatically bumps `buildNumber` (iOS) and `versionCode` (Android) on each production build.

### Environment Variable Strategy

- Railway sets `NODE_ENV=production` on ALL deployed services (both staging and production).
- Use `APP_ENV` (not `NODE_ENV`) to distinguish staging from production.
- Doppler **staging** environment sets: `APP_ENV=staging`, `NODE_ENV=production`
- Doppler **production** environment sets: `APP_ENV=production`, `NODE_ENV=production`
- Doppler **development** environment sets: `APP_ENV=development`, `NODE_ENV=development`
- All code that branches on environment **must use `APP_ENV`**, never `NODE_ENV`.
- The LLM factory resolves provider from `APP_ENV`: `development|staging → Gemini`, `production → Anthropic`

### Local Development Startup

```bash
# Prerequisites: Node.js, Doppler CLI, Supabase CLI
# Run once after cloning:
npm install           # from root — installs all workspace deps
cd shared && npm run build  # build shared types first
doppler login         # authenticate Doppler CLI
doppler setup         # in project root, select project=letssplyt, env=development

# Run database migrations (dev Supabase project):
cd backend
npx supabase db push --db-url $SUPABASE_URL

# Run seed data:
npx supabase db reset --db-url $SUPABASE_URL  # WARNING: wipes dev DB

# Start backend (in one terminal):
cd backend
doppler run -- npm run dev  # starts on port 3000

# Start mobile (in another terminal):
cd mobile
npx expo start          # shows QR code for Expo Go

# Expo Go compatibility: the project uses Expo SDK 54. Your phone's Expo Go app
# must be SDK 54 as well (App Store / Play Store always ships the latest).
# If you see "Project is incompatible with this version of Expo Go", upgrade the
# project: cd mobile && npx expo install expo@^54.0.0 --fix
# Do NOT downgrade Expo Go — install the matching SDK in the project instead.

# Receipt scanning requires a development build (NOT Expo Go):
# react-native-document-scanner-plugin uses native VisionKit / ML Kit.
# After adding or updating the plugin, run:
#   cd mobile && npx expo prebuild
#   npx expo run:ios    # or run:android
# Or use EAS: eas build --profile development --platform ios

# Physical device + local backend: localhost on the phone is NOT your Mac.
# The app auto-uses your Mac's LAN IP from the Expo Metro bundler (e.g. http://192.168.x.x:3000).
# Requirements: backend running, phone and Mac on the same Wi‑Fi, Mac firewall allows port 3000.
# If auto-detection fails, set your Mac's IP explicitly before starting Expo:
#   EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npx expo start
# Find your Mac IP: System Settings → Network, or run: ipconfig getifaddr en0

# OTP on a physical device (Send Code returns 503 / "Unable to send OTP"):
# Twilio is called on every OTP request unless dev bypass is active.
# OTP in development defaults to dev bypass (otpMode: dev-bypass in startup logs).
# Twilio Verify does NOT support test credentials — twilioCode 20008 means you hit live Verify with test creds.
# Any 6-digit code passes verify; no SMS sent. Use your real phone in the app.
# For real SMS locally: TWILIO_USE_LIVE_VERIFY=true, OTP_DEV_BYPASS=false, live Twilio creds in Doppler.
```

### `app.config.js`

Place this file at the root of the `/mobile` directory. It reads `EXPO_PUBLIC_ENV` at build time to switch configuration dynamically. This replaces a static `app.json`.

```javascript
// mobile/app.config.js

const env = process.env.EXPO_PUBLIC_ENV ?? 'development';

const APP_CONFIG = {
  development: {
    name: 'LetsSplyt (Dev)',
    slug: 'letssplyt-dev',
    bundleIdentifier: 'com.letssplyt.dev',
    androidPackage: 'com.letssplyt.dev',
    icon: './assets/icon-dev.png',
    scheme: 'letssplyt-dev',
  },
  staging: {
    name: 'LetsSplyt (Staging)',
    slug: 'letssplyt-staging',
    bundleIdentifier: 'com.letssplyt.staging',
    androidPackage: 'com.letssplyt.staging',
    icon: './assets/icon-staging.png',
    scheme: 'letssplyt-staging',
  },
  production: {
    name: 'LetsSplyt',
    slug: 'letssplyt',
    bundleIdentifier: 'com.letssplyt.app',
    androidPackage: 'com.letssplyt.app',
    icon: './assets/icon.png',
    scheme: 'letssplyt',
  },
};

const config = APP_CONFIG[env] ?? APP_CONFIG.development;

module.exports = {
  expo: {
    name: config.name,
    slug: config.slug,
    version: '1.0.0',
    orientation: 'portrait',
    icon: config.icon,
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#6366F1',
    },
    scheme: config.scheme,
    ios: {
      supportsTablet: false,
      bundleIdentifier: config.bundleIdentifier,
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription:
          'LetsSplyt uses your camera to scan receipts.',
        NSFaceIDUsageDescription:
          'LetsSplyt uses Face ID to securely unlock your account.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#6366F1',
      },
      package: config.androidPackage,
      versionCode: 1,
      permissions: ['CAMERA', 'USE_BIOMETRIC', 'USE_FINGERPRINT'],
    },
    // DO NOT add 'expo-router' — this project uses React Navigation v7. expo-router conflicts with it.
    plugins: [
      'expo-camera',
      'expo-image-picker',
      'expo-local-authentication',
      'expo-secure-store',
      'expo-notifications',
      [
        'expo-build-properties',
        {
          android: {},
          ios: {},
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'YOUR_EAS_PROJECT_ID',
      },
      env,
    },
  },
};
```

Replace `YOUR_EAS_PROJECT_ID` with the value from `eas.json` after running `eas init` for the first time.

### Build Commands

```bash
# Development build (installs expo-dev-client on device; used for local development)
eas build --profile development --platform android
eas build --profile development --platform ios

# Staging build (distributes via TestFlight / Android Internal Track)
eas build --profile staging --platform android
eas build --profile staging --platform ios

# Production build (submits to App Store / Google Play)
eas build --profile production --platform all

# Submit production build to stores (after production build completes)
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

---

## 4. Database Migration Runbook

### Creating a New Migration

```bash
# 1. Create the migration file (timestamp prefix generated automatically)
npx supabase migration new [description]
# Example: npx supabase migration new add_nudge_count_to_participants
# Creates: supabase/migrations/20260615120000_add_nudge_count_to_participants.sql

# 2. Edit the generated file
# Always include a rollback comment at the top:
#   -- DESCRIPTION: Adds nudge_count and last_nudged_at to participants table
#   -- ROLLBACK: ALTER TABLE participants DROP COLUMN IF EXISTS nudge_count;
#   --           ALTER TABLE participants DROP COLUMN IF EXISTS last_nudged_at;
#   -- TESTED IN STAGING: YYYY-MM-DD

# 3. Apply locally (against your dev Supabase project)
npx supabase db push

# 4. Verify the migration ran and your schema looks correct
npx supabase db diff
```

### Migration File Location

```
/supabase/
  migrations/
    20260601000000_initial_schema.sql
    20260615000000_add_ai_audit_log.sql
    20260620000000_[next_change].sql
  config.toml
```

### Environment Promotion Sequence

1. Write the migration file in `supabase/migrations/` on your feature branch.
2. Test locally: `npx supabase db push` (against your dev Supabase project). Verify with `npx supabase db diff` that the result matches expectations.
3. Commit the migration file to the feature branch.
4. Merge the feature branch into `develop`. On merge to `staging`, CI/CD automatically runs `npx supabase db push --db-url $SUPABASE_DB_URL_STAGING`.
5. Test the feature end-to-end in the staging environment.
6. Open a PR from `staging` into `main`. On merge to `main`, CI/CD takes a backup, then runs `npx supabase db push --db-url $SUPABASE_DB_URL_PRODUCTION`.

### Emergency Rollback Procedure

If a production migration causes an outage and needs to be reversed immediately:

```bash
# Step 1: Restore the pre-migration backup (created automatically by CI/CD before every production migration)
# Retrieve the backup artifact from the GitHub Actions run for this deploy.
# Download backup_YYYYMMDD_HHMMSS.sql

# Step 2: Restore the backup
psql $SUPABASE_DB_URL_PRODUCTION < backup_YYYYMMDD_HHMMSS.sql

# Step 3: Redeploy the previous version of the backend (before the migration)
# Roll back in Railway: Railway dashboard → Deployments → select previous deployment → Redeploy

# Step 4: Verify /health returns status "ok"
curl https://api.letssplyt.com/health

# Step 5: Write a follow-up migration to re-apply any safe changes from the reverted migration,
# fixing the root cause first.
```

### Migration Safety Rules

- **Never** use `DROP COLUMN` in the same migration as `ADD COLUMN` on the same table. Do them in two separate deployments separated by at least one release cycle.
- **Always** add new columns as `NULLABLE` first. Backfill existing rows with a `UPDATE` statement. Then, in a separate migration, add the `NOT NULL` constraint.
- **Never** rename a column. Add a new column with the correct name, backfill data from the old column, deprecate the old column in the API layer, then remove it in a later migration.
- **Always** write migrations so they can run twice without error. Use `IF NOT EXISTS` for `CREATE TABLE`, `CREATE INDEX`, `CREATE EXTENSION`. Use `IF EXISTS` for `DROP`. This makes it safe to re-run a migration that partially failed.
- **Always** test the migration on staging first. Confirm the staging app continues to function for at least 15 minutes before applying to production.
- **Every** migration file must have the rollback SQL written as a comment at the top before it is merged.

---

## 5. Background Job Architecture

> **NOTE: The PRD (Section 6) shows a Redis Pub/Sub event bus table as a future architecture.**
> **For MVP, all service-to-service communication is direct TypeScript function calls within**
> **the single Node.js process. No message broker is used. The event bus table in the PRD is**
> **aspirational — it shows what the architecture would look like if services were split into**
> **separate deployable units. Do not implement Redis Pub/Sub or EventEmitter for MVP.**

All background jobs use Upstash QStash as the queue and HTTP callback broker. QStash is serverless-compatible and works with Railway.

```
Job Producer (Express route)
    │  POST to QStash API with optional delay
    ▼
Upstash QStash (managed HTTP queue)
    │  POST to /webhooks/jobs/[job-name] after delay
    ▼
Job Consumer (Express route in /webhooks/jobs/)
    │  Verifies QStash signature, processes job
    ▼
Database / Twilio / Supabase
```

### Shared QStash Signature Verification Helper

```typescript
// backend/src/modules/jobs/qstash.receiver.ts
import { Receiver } from '@upstash/qstash';
import type { Request, Response, NextFunction } from 'express';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function verifyQStashSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const isValid = await receiver.verify({
      signature: req.headers['upstash-signature'] as string,
      body: JSON.stringify(req.body),
    });
    if (!isValid) {
      res.status(401).json({ error: 'Invalid QStash signature' });
      return;
    }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Signature verification failed' });
  }
}
```

### Job 1: Nudge Reminder (T+48hr)

**Trigger:** Fired by the backend immediately after `POST /api/v1/messages/send` completes. The job runs 48 hours later.

**Condition at execution time:** participant has `amount_owed > 0`, `payment_status = 'pending'`, and either `last_nudged_at IS NULL` or `last_nudged_at < NOW() - INTERVAL '24 hours'`.

**Consumer endpoint:** `POST /webhooks/jobs/nudge`

```typescript
// backend/src/modules/jobs/nudge.controller.ts
import type { Request, Response } from 'express';
import { verifyQStashSignature } from './qstash.receiver';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { sendNudgeSMS } from '../notifications/notifications.service';
import { isOptedOut } from '../notifications/opt-out.service';

// Producer: call this after messages/send completes
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export async function scheduleNudgeCheck(eventId: string): Promise<void> {
  await qstash.publishJSON({
    url: `${process.env.APP_DOMAIN}/webhooks/jobs/nudge`,
    body: { eventId },
    delay: 60 * 60 * 48, // 48 hours in seconds
    retries: 3,
  });
}

// Consumer handler
export const handleNudgeCheck = [
  verifyQStashSignature,
  async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.body as { eventId: string };

    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }

    // Load participants who still owe money and are past the nudge cooldown
    const { data: participants, error } = await supabaseAdmin
      .from('participants')
      .select('id, guest_pii_token, payment_status, amount_owed, last_nudged_at, nudge_count')
      .eq('event_id', eventId)
      .eq('payment_status', 'pending')
      .gt('amount_owed', 0);

    if (error) {
      res.status(500).json({ error: 'Failed to load participants' });
      return;
    }

    const now = Date.now();
    const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    let nudgedCount = 0;

    for (const participant of participants ?? []) {
      // Check cooldown
      if (
        participant.last_nudged_at &&
        now - new Date(participant.last_nudged_at).getTime() < NUDGE_COOLDOWN_MS
      ) {
        continue;
      }

      // Resolve phone from guest_pii if needed and check opt-out
      const optedOut = await isOptedOut(participant.id);
      if (optedOut) continue;

      await sendNudgeSMS(participant.id, eventId);

      // Update nudge tracking
      await supabaseAdmin
        .from('participants')
        .update({
          last_nudged_at: new Date().toISOString(),
          nudge_count: (participant.nudge_count ?? 0) + 1,
        })
        .eq('id', participant.id);

      // Write to notification_log
      await supabaseAdmin.from('notification_log').insert({
        participant_id: participant.id,
        event_id: eventId,
        type: 'nudge_sms',
        channel: 'sms',
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      // Write to settlement_log
      await supabaseAdmin.from('settlement_log').insert({
        participant_id: participant.id,
        event_id: eventId,
        action: 'nudge_sent',
        actor_id: null, // system action
        metadata: { nudge_number: (participant.nudge_count ?? 0) + 1 },
      });

      nudgedCount++;
    }

    res.json({ nudged: nudgedCount });
  },
];
```

### Job 2: Guest PII Purge (Nightly)

**Trigger:** QStash cron schedule — daily at 02:00 UTC. On Supabase Pro, this can alternatively be a `pg_cron` job. On Free tier, use the QStash cron approach below.

**Consumer endpoint:** `POST /webhooks/jobs/purge-guest-pii`

```typescript
// backend/src/modules/jobs/purge.controller.ts
import type { Request, Response } from 'express';
import { verifyQStashSignature } from './qstash.receiver';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { logger } from '../../infrastructure/logger';

export const handleGuestPiiPurge = [
  verifyQStashSignature,
  async (req: Request, res: Response): Promise<void> => {
    const now = new Date().toISOString();

    // Delete guest_pii rows past their purge date
    const { data: deleted, error } = await supabaseAdmin
      .from('guest_pii')
      .delete()
      .lt('purge_after', now)
      .select('id');

    if (error) {
      logger.error({
        level: 'error',
        service: 'notification',
        message: 'Guest PII purge failed',
        error: error.message,
        timestamp: now,
      });
      res.status(500).json({ error: 'Purge failed' });
      return;
    }

    const deletedIds = (deleted ?? []).map((row: { id: string }) => row.id);

    // Clear guest_pii_token references on participants
    // These participants no longer have PII — they retain their split record
    if (deletedIds.length > 0) {
      await supabaseAdmin
        .from('participants')
        .update({ guest_pii_token: null })
        .in('guest_pii_token', deletedIds);
    }

    logger.info({
      level: 'info',
      service: 'notification',
      message: 'Guest PII purge complete',
      timestamp: now,
      deletedCount: deletedIds.length,
    });

    res.json({ deleted: deletedIds.length });
  },
];
```

**QStash cron schedule** (configure in Upstash dashboard → QStash → Schedules):

```
URL:   https://api.letssplyt.com/webhooks/jobs/purge-guest-pii
Cron:  0 2 * * *   (daily at 02:00 UTC)
```

### Job 3: Analytics Partition Creation (Monthly)

**Trigger:** On Supabase Pro, `pg_cron` fires on the 25th of each month at 00:00 UTC (already defined in the schema). On Free tier / staging, use the QStash workaround below.

**Consumer endpoint:** `POST /webhooks/jobs/create-partition`

```typescript
// backend/src/modules/jobs/partition.controller.ts
import type { Request, Response } from 'express';
import { verifyQStashSignature } from './qstash.receiver';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { logger } from '../../infrastructure/logger';

export const handlePartitionCreation = [
  verifyQStashSignature,
  async (req: Request, res: Response): Promise<void> => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const partitionName = `analytics_events_${nextMonth.getFullYear()}_${String(
      nextMonth.getMonth() + 1,
    ).padStart(2, '0')}`;
    const startDate = nextMonth.toISOString().split('T')[0]!;
    const endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1)
      .toISOString()
      .split('T')[0]!;

    const { error } = await supabaseAdmin.rpc('create_analytics_partition', {
      partition_name: partitionName,
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      logger.error({
        level: 'error',
        service: 'ai',
        message: 'Analytics partition creation failed',
        error: error.message,
        timestamp: new Date().toISOString(),
        partitionName,
      });
      res.status(500).json({ error: 'Partition creation failed', partitionName });
      return;
    }

    logger.info({
      level: 'info',
      service: 'ai',
      message: 'Analytics partition created',
      timestamp: new Date().toISOString(),
      partitionName,
    });

    res.json({ created: partitionName, startDate, endDate });
  },
];
```

**QStash cron schedule for staging** (configure in Upstash dashboard):

```
URL:   https://staging.letssplyt.railway.app/webhooks/jobs/create-partition
Cron:  0 0 25 * *   (25th of each month at 00:00 UTC)
```

### Job Routes

```typescript
// backend/src/modules/jobs/jobs.routes.ts
import { Router } from 'express';
import { handleNudgeCheck } from './nudge.controller';
import { handleGuestPiiPurge } from './purge.controller';
import { handlePartitionCreation } from './partition.controller';

const router = Router();

// All job endpoints use QStash signature verification (applied inside each handler array)
// These routes are NOT JWT-authenticated — QStash calls them, not users
router.post('/nudge', handleNudgeCheck);
router.post('/purge-guest-pii', handleGuestPiiPurge);
router.post('/create-partition', handlePartitionCreation);

export { router as jobsRouter };

// Mount in app.ts:
// app.use('/webhooks/jobs', jobsRouter);
```

**Security note:** The `/webhooks/jobs/*` routes are rate-limited to 10 requests per minute at the Express rate-limiter level. They are not listed in the API spec served to clients. QStash signature verification prevents any caller other than QStash from triggering these endpoints.

---

## 6. Observability and Monitoring

### Structured Logging

All log lines must be JSON. No `console.log` anywhere in production code — only the structured logger.

```typescript
// backend/src/infrastructure/logger.ts
import type { Request } from 'express';

export type LogLevel = 'info' | 'warn' | 'error';
export type ServiceName = 'auth' | 'event' | 'ai' | 'settlement' | 'notification';

export interface LogEntry {
  timestamp: string;       // ISO 8601
  level: LogLevel;
  service: ServiceName;
  requestId?: string;      // uuid — set from X-Request-ID header or generated per request
  userId?: string | null;  // uuid or null — NEVER the phone number or name
  eventId?: string | null; // uuid or null
  message: string;
  durationMs?: number;
  error?: string | null;   // error.message only — no stack traces in production
}

function write(entry: LogEntry): void {
  // In production: write to stdout (Railway captures it)
  // In development: pretty-print
  if (process.env.NODE_ENV === 'development') {
    const { level, service, message, ...rest } = entry;
    console.log(`[${level.toUpperCase()}] [${service}] ${message}`, rest);
  } else {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

export const logger = {
  info: (entry: Omit<LogEntry, 'level'>) =>
    write({ ...entry, level: 'info', timestamp: entry.timestamp ?? new Date().toISOString() }),
  warn: (entry: Omit<LogEntry, 'level'>) =>
    write({ ...entry, level: 'warn', timestamp: entry.timestamp ?? new Date().toISOString() }),
  error: (entry: Omit<LogEntry, 'level'>) =>
    write({ ...entry, level: 'error', timestamp: entry.timestamp ?? new Date().toISOString() }),
};
```

**Example log line (production):**

```json
{
  "timestamp": "2026-06-04T14:32:01.123Z",
  "level": "info",
  "service": "settlement",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "9f8e7d6c-5b4a-3210-fedc-ba9876543210",
  "eventId": "11223344-5566-7788-99aa-bbccddeeff00",
  "message": "Participant payment confirmed",
  "durationMs": 87,
  "error": null
}
```

**PII rules — non-negotiable:**

- Phone numbers (any format) MUST NOT appear in any log line.
- Names and `display_name` values MUST NOT appear in any log line.
- Payment handles (Venmo, PayPal, etc.) MUST NOT appear in any log line.
- UUIDs (`userId`, `eventId`, `participantId`) are safe to log — they are opaque identifiers.
- OTP codes MUST NOT be logged at any log level, including `debug`.

The PII scrubber middleware (`middleware/pii-scrubber.middleware.ts`) enforces these rules on all HTTP request/response logs. Additionally, all direct calls to `logger` in service code must follow these rules manually — the scrubber only covers the HTTP layer.

### Alerting Thresholds

Configure these alerts in Railway + Sentry + Upstash dashboards:

| Metric | Threshold | Window | Alert Method |
|--------|-----------|--------|-------------|
| API P95 latency | > 2000ms | 5 consecutive minutes | Email + Slack |
| API error rate (5xx) | > 5% of requests | 3 consecutive minutes | Email + Slack |
| Twilio SMS delivery rate | < 90% | Any 1-hour window | Email |
| AI call failure rate (A1/A2/A3) | > 10% | Any 30-minute window | Email + Slack |
| QStash job failure | Any single failure | Immediate | Email + Slack |
| Supabase connection pool | > 80% utilisation | 5 consecutive minutes | Email |
| Supabase disk usage | > 70% | Immediate | Email |
| Railway memory usage | > 85% | 5 consecutive minutes | Email |

**Setting up Sentry error alerts:**

In Sentry → Alerts → Create Alert Rule:
1. Error rate: `event.type:error` — threshold: 1% of sessions — notify immediately
2. New issue type seen for the first time — notify immediately

### Health Check Endpoint

**Route:** `GET /health` — no authentication required.

```typescript
// backend/src/modules/health/health.controller.ts
import type { Request, Response } from 'express';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { redis } from '../../infrastructure/redis';
import twilio from 'twilio';
import { execSync } from 'child_process';

type CheckStatus = 'ok' | 'error';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: {
    database: CheckStatus;
    redis: CheckStatus;
    twilio: CheckStatus;
  };
  version: string;
}

// Cached git SHA — computed once at startup
const GIT_SHA = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown';
  }
})();

export async function handleHealthCheck(req: Request, res: Response): Promise<void> {
  const checks: HealthResponse['checks'] = {
    database: 'ok',
    redis: 'ok',
    twilio: 'ok',
  };

  // Check database — query a table that always exists
  try {
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1);
      // (RLS: service role bypasses — this always returns even with 0 users)
    if (dbError) checks.database = 'error';
  } catch {
    checks.database = 'error';
  }

  // Check Redis
  try {
    await redis.ping();
  } catch {
    checks.redis = 'error';
  }

  // Check Twilio (lightweight — fetch account balance rather than send a message)
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );
    await client.api.accounts(process.env.TWILIO_ACCOUNT_SID!).fetch();
  } catch {
    checks.twilio = 'error';
  }

  const failedCount = Object.values(checks).filter((v) => v === 'error').length;
  const status: HealthResponse['status'] =
    failedCount === 0 ? 'ok' : failedCount === Object.keys(checks).length ? 'down' : 'degraded';

  const body: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: GIT_SHA,
  };

  // Return 200 for "ok" and "degraded" (load balancer keeps routing)
  // Return 503 for "down" (load balancer stops routing)
  res.status(status === 'down' ? 503 : 200).json(body);
}
```

**Example responses:**

```json
{
  "status": "ok",
  "timestamp": "2026-06-04T14:00:00.000Z",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "twilio": "ok"
  },
  "version": "a1b2c3d"
}
```

```json
{
  "status": "degraded",
  "timestamp": "2026-06-04T14:00:00.000Z",
  "checks": {
    "database": "ok",
    "redis": "error",
    "twilio": "ok"
  },
  "version": "a1b2c3d"
}
```

---

## 7. LLMOps — Model Upgrade Procedure

When a new model version is released (Gemini 2.x for dev/staging, or a new Claude Haiku version for production), follow this procedure. Never upgrade the model in production without running the full eval suite first.

### Step-by-Step Procedure

**1. Update the model string in the development environment**

Edit the model identifier in your Doppler dev environment (or `.env.development` if not using Doppler):

```bash
# Example: upgrading from gemini-2.5-flash to gemini-2.5-flash-002
GEMINI_MODEL=gemini-2.5-flash-002

# Or for a production model upgrade:
ANTHROPIC_MODEL=claude-haiku-4-6
```

The LLM factory reads this environment variable at startup — no code change required for a model upgrade within the same provider.

```typescript
// backend/src/infrastructure/llm/factory.ts
export function resolveProvider(): LLMProvider {
  const env = process.env.APP_ENV;  // Use APP_ENV, not NODE_ENV — see Environment Variable Strategy
  if (env === 'production') {
    return new AnthropicAdapter({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
    });
  }
  // development and staging both use Gemini
  return new GeminiAdapter({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  });
}
```

**2. Run the full AI eval suite**

```bash
npm run eval:all
```

This command runs all three AI agent evals against the golden dataset (defined in `07-AI-Agent-Specification.md` Section 7):

```bash
# What npm run eval:all does (package.json script):
# "eval:all": "ts-node evals/run-all.ts --dataset evals/golden-dataset.json --output evals/results/"
```

**3. Review eval results**

A passing run produces output like this in `evals/results/[timestamp]/`:

```
════════════════════════════════════════════════════════
LetsSplyt AI Eval Suite — Run 2026-06-04T14:00:00Z
Model (dev): gemini-2.5-flash-002
Dataset: 120 golden cases
════════════════════════════════════════════════════════

A1 — Receipt Parser
  Cases run:    40
  Accuracy:     93.5%   ✓ (threshold: ≥ 90%)
  Avg latency:  6.2s    ✓ (threshold: ≤ 8s)
  Worst case:   7.9s    ✓

A2 — Split Calculator
  Cases run:    40
  Sum invariant: PASS (all 40 cases)   ✓ (threshold: 100%)
  Accuracy:     97.5%   ✓ (threshold: ≥ 95%)
  Avg latency:  2.1s    ✓ (threshold: ≤ 3s)
  Rounding errors: 0    ✓

A3 — Message Composer
  Cases run:    40
  Quality score: 4.3/5  ✓ (threshold: ≥ 4.0)
  PII leakage:  NONE    ✓
  Avg latency:  3.8s    ✓ (threshold: ≤ 5s)

════════════════════════════════════════════════════════
OVERALL: PASS ✓
All thresholds met. Safe to promote to staging.
════════════════════════════════════════════════════════
```

**Passing thresholds (from `07-AI-Agent-Specification.md` Section 7):**

| Agent | Metric | Threshold |
|-------|--------|-----------|
| A1 Receipt Parser | Accuracy on golden dataset | ≥ 90% |
| A1 Receipt Parser | End-to-end latency | ≤ 8 seconds |
| A2 Split Calculator | Sum invariant (total_amount = sum of amount_owed) | 100% of cases |
| A2 Split Calculator | Accuracy | ≥ 95% |
| A3 Message Composer | Quality score (human-rated 1–5) | ≥ 4.0 average |
| A3 Message Composer | PII leakage (phone/name in wrong participant's message) | 0 cases |

**4. If all evals pass: promote to staging**

Update the model string in Doppler's staging environment. Trigger a redeploy of the staging backend:

```bash
railway redeploy --service letssplyt-staging
```

Run smoke tests against staging. Manually test one receipt scan, one split calculation, and one message send.

**5. If all evals pass in staging: promote to production**

Update the model string in Doppler's production environment. The next production deploy (via the `main` branch CI/CD pipeline) picks up the new model.

**6. If any eval fails: do not promote**

```
A1 — Receipt Parser
  Accuracy: 78.2%   ✗ (threshold: ≥ 90%)

OVERALL: FAIL ✗
Do NOT promote to staging. Revert model string.
```

Steps when an eval fails:

1. Revert the model string in `.env.development` to the previous value.
2. File a GitHub issue with the title `[LLMOps] Model upgrade failed: [model name]`.
3. In the issue body, paste the eval output and the specific failing cases from `evals/results/[timestamp]/failures.json`.
4. Monitor the model provider's release notes and try again when a fix is available.

---

## 8. Performance Baselines

### Expected Performance at MVP Scale

These are the targets for a single Railway instance (1 vCPU, 512MB RAM) with Supabase Pro and Upstash Redis.

| Operation | Target | Notes |
|-----------|--------|-------|
| Receipt parse (A1 end-to-end) | ≤ 8 seconds | Includes image upload, LLM call, response parsing |
| Split calculation (A2) | ≤ 3 seconds | Pure LLM call; no I/O |
| Message generation (A3) | ≤ 5 seconds per participant | Includes payment handle decrypt + LLM call |
| API P50 latency | ≤ 200ms | Non-AI endpoints |
| API P95 latency | ≤ 1000ms | Non-AI endpoints |
| Twilio SMS delivery | ≤ 10 seconds | Carrier-dependent; varies internationally |
| Twilio WhatsApp delivery | ≤ 30 seconds | WhatsApp route adds latency |

### Scale Limits and Mitigation

**100 concurrent active events** — fine. No changes needed. This is the expected MVP load.

**1,000 concurrent active events** — Redis and Supabase database connection counts become the bottleneck.
- Supabase Free tier allows ~60 concurrent connections. Supabase Pro allows ~200.
- At 1,000 concurrent events, add **PgBouncer** in transaction mode to pool connections before they reach Supabase. Railway offers a PgBouncer add-on.
- Redis connection count: Upstash handles this via HTTP — not a concern.
- LLM API rate limits become relevant. Implement per-user request queuing in the AI service layer.

**10,000 concurrent active events** — significant infrastructure changes required.
- Enable **Railway autoscaling** (horizontal scale-out). Configure minimum 2 instances, maximum 10. Ensure session state (JWT verification) is stateless — it already is, since JWTs are validated against the Supabase auth service.
- Upgrade to **Supabase Pro** (if not already) and enable PgBouncer as above.
- Add a **CDN** (Cloudflare) in front of the API for edge caching of public routes (`/health`, receipt image uploads).
- Partition `analytics_events` aggressively — ensure the current month's partition is always the active write target.
- Consider moving the AI pipeline to a separate Railway service (so AI workloads do not contend with API latency).

### Database Connection Budget

| Environment | Max Supabase Connections | Connection Strategy |
|-------------|------------------------|---------------------|
| Development | 60 (Free tier) | Direct connections — fine for dev |
| Staging | 60 (Free tier) or 200 (Pro) | Direct connections |
| Production | 200 (Pro) | PgBouncer when > 50 concurrent users |

**PgBouncer configuration** (when required):

```
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
server_idle_timeout = 600
```

Set `DATABASE_URL` in Railway to point to the PgBouncer endpoint rather than directly to Supabase. The Supabase client in the backend uses the `SUPABASE_URL` (REST API) which is not affected by PgBouncer — only the direct PostgreSQL connection used by Supabase CLI migrations and any raw `pg` queries is affected.

```typescript
// backend/src/infrastructure/supabase.ts — CONNECTION POOLING
// Supabase Pro allows ~200 connections. getSupabaseForUser() creates a new client per request.
// Without a connection limit, concurrent requests can exhaust the pool.
// Solution: Use a single supabaseAdmin client for all service-role operations (already a singleton).
// For user-scoped clients, set the connection pooling mode in the Supabase URL:

// Add ?connection_limit=10 to SUPABASE_URL in Doppler for pooled connections:
// Example: https://[project].supabase.co?connection_limit=10
// OR use Supabase's built-in Transaction pooler by changing the URL port to 6543:
// postgres://[user]:[pass]@[project].supabase.co:6543/postgres?pgbouncer=true

// Add to monitoring alerts: alert when active DB connections > 150 (75% of Pro limit)
// Check current connections: SELECT count(*) FROM pg_stat_activity WHERE state='active';
```
