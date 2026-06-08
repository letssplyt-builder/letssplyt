# LetsSplyt — Persistent Project Brief
**Read this file at the start of EVERY session before writing any code.**
**Then read `BUILD-PROGRESS.md` to see where we left off.**
**Then read the next pending story from `files/12-Build-Sequence.md` and build it.**

---

## What You Are Building

LetsSplyt is a mobile bill-splitting app for iOS and Android. When a group eats out, one person pays the whole bill and needs to collect from everyone. Existing apps only work if everyone is already on the app. LetsSplyt solves this: guests pay without downloading any app — they receive an SMS with a link, open it in a browser, see their share, and pay directly.

## The Three Users

**Creator** — paid the restaurant bill. Creates an event, shows a QR code, waits for everyone to join (sees them appear in real time), locks the group, scans the receipt (AI reads it), chooses a split mode, sends payment requests to everyone via Twilio.

**App Member** — has the LetsSplyt app. Scans QR → app intercepts (Universal Link) → joins → receives in-app notification with their share and payment links → pays → self-reports.

**Guest** — no app. Scans QR → browser opens web page → enters name + phone → verifies OTP → joined. Receives SMS with their exact share and payment deep links. Pays via their preferred app. Never needs to install LetsSplyt.

## Event Lifecycle

Create Event → QR displayed → participants scan (app or browser) → members join in real time (Supabase Realtime) → Creator locks group → Receipt scanned → A1 AI extracts items/tax/tip/currency → Creator reviews/edits → A2 assigns items (NLP or manual) → splitCalculator.ts calculates shares (largest-remainder rounding, pure TS) → Creator previews messages → A3 generates personalised messages → Split image generated per participant → Twilio sends all → Participants pay → Self-report → Creator confirms → Event settles.

**Event-based model. Not a running ledger. Not Splitwise.**

---

## Tech Stack — Use Exactly These

**Mobile:** React Native + **Expo SDK 54** (must match the installed Expo Go app version), TypeScript strict, React Navigation v7, Zustand (state), expo-secure-store (tokens — NEVER AsyncStorage), expo-camera, expo-notifications, expo-local-authentication. **Do NOT use Expo Router.**

**Backend:** Node.js + Express + TypeScript, single Node.js process (services = TypeScript modules, direct imports — NOT microservices, NOT Redis pub/sub), @supabase/supabase-js v2 (NOT Prisma), @upstash/qstash (background jobs).

**Database:** Supabase (PostgreSQL + Auth + Realtime + Storage). RLS on every table. Realtime on `participants`. Storage bucket `receipts` (private).

**AI:** Gemini 2.5 Flash (dev/staging), Claude Haiku 4.5 (production). ALWAYS use LLM factory (`src/infrastructure/llm/factory.ts`, exported function `createLLMProvider`). NEVER hardcode providers.

**Secrets:** Doppler → process.env. No Doppler SDK. No config loaders. Use `APP_ENV` (not `NODE_ENV`) — Railway sets NODE_ENV=production on all deployments. Two URL environment variables exist: `APP_URL` (full URL, e.g. `https://letssplyt.app`, used for Twilio webhooks) and `APP_DOMAIN` (domain only, e.g. `letssplyt.app`, used for CORS and deep link config). Both are set by Doppler.

**Package manager:** npm. Monorepo workspaces: `mobile/`, `backend/`, `shared/`.

---

## Monorepo Structure

```
letssplyt/
├── CLAUDE.md                     ← you are reading this
├── BUILD-PROGRESS.md             ← read this to know where we are
├── package.json                  ← workspaces: ["mobile","backend","shared"]
├── tsconfig.base.json            ← @letssplyt/shared path alias
├── supabase/              ← at repo root (Supabase CLI requires this)
│   ├── migrations/
│   └── seed.sql
├── shared/
│   ├── package.json              ← name: "@letssplyt/shared"
│   ├── types/                    ← auth, event, participant, receipt, settlement, api
│   └── utils/                    ← splitCalculator.ts, formatCurrency.ts, currency.ts
├── backend/
│   ├── src/
│   │   ├── app.ts / server.ts
│   │   ├── infrastructure/
│   │   │   ├── supabase.ts       ← anon + service role singletons
│   │   │   ├── errors.ts          ← AppError class + Errors convenience constructors
│   │   │   ├── llm/factory.ts    ← createLLMProvider()
│   │   │   ├── llm/ai-audit.ts   ← writeAuditLog() — fire-and-forget, never throws
│   │   │   ├── push.service.ts   ← sendPushNotification(), sendBatchPushNotifications()
│   │   │   └── security/         ← encrypt, hashPhone, sanitizePromptInput, resolveParticipantPhone
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── profile/
│   │   │   ├── events/
│   │   │   ├── participants/
│   │   │   ├── receipts/
│   │   │   ├── splits/
│   │   │   ├── messages/
│   │   │   ├── settlement/
│   │   │   ├── jobs/
│   │   │   └── analytics/
│   │   └── middleware/           ← authenticate, piiScrubber, rateLimiter
└── mobile/
    ├── app.config.js             ← NO expo-router plugin
    ├── eas.json
    └── src/
        ├── navigation/RootNavigator.tsx
        ├── screens/
        ├── store/                ← authStore, eventStore, settlementStore
        ├── services/
        └── components/
```

---

## Critical Security Rules — Non-Negotiable

1. **PII Vault:** Phone numbers NEVER in plaintext. Store `phone_hash` (SHA-256 HMAC with `PII_HMAC_SALT`) for lookups and `phone_encrypted` (AES-256-GCM with `PHONE_ENCRYPTION_KEY`) for retrieval. Never return raw phone numbers in API responses.

2. **Token Storage:** Supabase JWT tokens → `expo-secure-store` ONLY. Never AsyncStorage.

3. **Payment handles:** AES-256-GCM encrypted with `HANDLE_ENCRYPTION_KEY` before storing.

4. **AI Prompt Safety:** Call `sanitizePromptInput()` on ALL user-controlled strings before inserting into AI prompts.

5. **Arithmetic:** A2 does NLP assignment ONLY. All math → `splitCalculator.ts` (pure TypeScript, no AI). Sum invariant: all shares = total ± 1 minor unit.

6. **Atomic AI stages:** All `ai_stage` updates use `UPDATE ... WHERE ai_stage='previous'`. Never read-then-write.

7. **Split image:** Every participant message includes a personalised split image (their row highlighted). Generated by `split-image.generator.ts` using `@napi-rs/canvas`.

8. **Currency:** Use `getCurrencyMinorUnits(currency)` for all arithmetic. NEVER multiply by 100 universally — JPY has 0 decimal places, BHD has 3.

---

## Document Map

> **Note:** Files are stored in the `files/` subdirectory. The paths below reference logical document names.

| Document | Read it for |
|---|---|
| `files/01-PRD.md` | Why we're building this, product decisions |
| `files/02-User-Flows.md` | Every user action and screen state |
| `files/03-System-Architecture.md` | Service structure, TypeScript config |
| `files/04-Data-Architecture.md` | **AUTHORITATIVE schema** — any schema question, answer is here |
| `files/05-API-Specification.md` | Every endpoint, request/response shapes |
| `files/06-Integration-Contracts.md` | Twilio, Gemini, Anthropic, QStash, Expo Push exact API contracts |
| `files/07-AI-Agent-Specification.md` | A1/A2/A3 implementations, prompts, factory |
| `files/08-Mobile-App-Specification.md` | Navigation, all screen specs, Zustand stores |
| `files/09-Security-And-Privacy.md` | PII model, encryption implementations |
| `files/10-Engineering-Operations.md` | CI/CD, EAS builds, local startup, monitoring |
| `files/12-Build-Sequence.md` | **YOUR BUILD GUIDE** — 47 stories with prompts, acceptance criteria, tests |
| `prototype/` | HTML mockups — match visual design for every screen |

---

## Session Rules

1. **Start every session:** Read this file → read `BUILD-PROGRESS.md` → find the next `[ ]` story → read it in `files/12-Build-Sequence.md`.

2. **Build one story at a time.** Complete it fully before starting the next.

3. **Before marking any story done:** Run all specified tests, show Pawan the results, verify ALL acceptance criteria. Wait for explicit confirmation: *"looks good, continue"* or similar.

4. **After confirmation:** Update `BUILD-PROGRESS.md` — change `[ ]` to `[x]` with today's date.

5. **After confirmation:** Commit all changed files with message `E##-S##: [story name]` (e.g. `E01-S01: monorepo scaffold`) and push to `origin main`. Use `git add -A`, then `git commit`, then `git push origin main`.

6. **Never skip tests.** 100% coverage required for `splitCalculator.ts`, `security/crypto.ts`, and `security/sanitize.ts`. These files contain financial arithmetic and PII handling — any untested line is a liability.

7. **Never use placeholder data or TODO comments** as substitutes for real implementations.

8. **When uncertain, stop and ask.** If anything is ambiguous, underdefined, or not covered by the referenced docs — or if two docs appear to contradict — STOP before writing code. State clearly what is unclear, read the relevant doc section, propose a solution, and wait for Pawan's confirmation. Never invent a solution to fill a gap. This rule is especially critical for financial arithmetic (splitCalculator.ts), PII handling (crypto.ts, sanitize.ts), and security code.
