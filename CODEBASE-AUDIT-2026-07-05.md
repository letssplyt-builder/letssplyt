# LetsSplyt Codebase Audit — 2026-07-05

Analysis only — no code was changed. Severity: **Critical** (can cause account takeover, outage, or wrong money), **High** (violates project standards or creates real production risk), **Medium** (quality/scalability debt), **Low** (polish).

---

## Critical

### C1. OTP dev bypass fails OPEN when `APP_ENV` is missing
`backend/src/modules/auth/otp-dev-bypass.ts` returns `true` when `APP_ENV === undefined`. `verifyOTP()` then accepts **any 6-digit code**, and `authRateLimiter`, `checkOtpRequestRate`, and `recordFailedOtpVerify` all skip themselves when the bypass is on. CLAUDE.md itself warns that Railway sets `NODE_ENV`, not `APP_ENV` — so a single missed Doppler injection, a new service, or a misconfigured deploy silently turns production auth into "type any code, log in as any phone number." This is full account takeover with no alarm.

**Recommendation:** Invert the default — bypass only when `APP_ENV` is explicitly `development` or `test` AND `OTP_DEV_BYPASS === 'true'`. Any other state (including unset) must fail closed. Add a startup assertion that refuses to boot in an unknown `APP_ENV`, and log/alert loudly if bypass is ever active. Note the asymmetry: the QStash receiver already fails closed on missing env — apply the same philosophy here.

### C2. No `trust proxy` — rate limiting is broken behind Railway
No `app.set('trust proxy', ...)` anywhere in `backend/src`. Behind Railway's proxy, `req.ip` resolves to the proxy address, so `globalRateLimiter` (100 req/15 min per IP) becomes 100 req/15 min for **all users combined** — a self-inflicted outage under trivial load — and `authRateLimiter` shares one bucket across every client. express-rate-limit v7 will also raise `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` validation errors.

**Recommendation:** `app.set('trust proxy', 1)` (or Railway's documented hop count), and add an integration test asserting distinct client IPs get distinct rate-limit buckets.

### C3. RLS is architecturally bypassed — `supabaseAdmin` used in 39 module files
`supabase.ts` documents: "NEVER use supabaseAdmin in user-facing read endpoints… use getSupabaseForUser(jwt)". In reality 39 module files use `supabaseAdmin` and exactly **one** (`profile.service.ts`) uses `getSupabaseForUser`. Event, settlement, ledger, receipts, splits — all user-facing reads run with the service role. Authorization now rests entirely on hand-written checks (`assertEventOwner`, `assertEventAccess`) being present in every code path; one forgotten check anywhere is a cross-tenant data leak. The 47 RLS policies you carefully wrote are dead weight at runtime — they protect nothing except direct Realtime/PostgREST access.

**Recommendation:** Decide explicitly which model you're on. Either (a) migrate user-scoped reads to `getSupabaseForUser` so RLS is the enforcement layer and app checks are defense-in-depth, or (b) formally adopt service-role + app-authz, then centralize authorization (middleware that loads the event and asserts access once per route, instead of per-service ad-hoc calls) and add tests that every route rejects a non-member. Also update the docstring/CLAUDE.md so the stated rule matches reality — a false rule is worse than none.

### C4. `NUMERIC(10,2)` cannot store 3-decimal currencies the app claims to support
Schema uses `NUMERIC(10,2)` for `total_amount`, `amount_owed`, `original_amount_owed`, while `splitCalculator.ts` correctly computes BHD/KWD/OMR/JOD/TND to 3 decimal places (CLAUDE.md rule #8 calls out BHD explicitly). Postgres will round the third decimal on write — shares that satisfied the ±1 minor-unit sum invariant in TypeScript will be silently corrupted at rest, and the stored amounts can violate the invariant.

**Recommendation:** Either migrate money columns to `NUMERIC(12,3)` (scale ≥ max supported minor units), or store amounts as integer minor units (`BIGINT`) + currency — the cleaner long-term fix since all arithmetic already happens in minor units. Alternatively, constrain supported currencies at the API boundary to 0/2-decimal only and delete the 3-decimal sets. Any of these is fine; the current mismatch is not.

---

## High

### H1. In-memory rate limiting and OTP counters — breaks on scale-out, leaks memory
`rateLimiter.ts` keeps `otpRequestCounts`/`otpVerifyAttempts` in module-level `Map`s, and express-rate-limit uses its default MemoryStore. Two consequences: (1) the moment Railway runs 2+ instances (or restarts mid-window), per-phone OTP throttles reset or fragment — an attacker just spreads requests across instances; (2) stale phone-hash entries are never evicted, so the Maps grow unboundedly — a slow memory leak an attacker can accelerate. Ironically `@upstash/redis` is already a dependency and `redis.ts` exists — it's used only by the health check.

**Recommendation:** Back both limiters with Upstash Redis (`rate-limit-redis` store for express-rate-limit; `INCR`+`EXPIRE` for the per-phone counters). Until then, at minimum add TTL eviction to the Maps and pin the service to one instance intentionally.

### H2. No security headers on server-rendered pages
`helmet` is absent. `/join/*` (guest PII entry: name, phone, OTP) and `/split/:token` (names + amounts) are served without CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or HSTS. The breakdown URL is a capability token in the path — without `Referrer-Policy` it can leak via the referrer header if the page ever gains an external link.

**Recommendation:** Add `helmet` with a strict CSP for the HTML routes, `Referrer-Policy: no-referrer`, and `Cache-Control: private, no-store` on `/split/:token` responses.

### H3. Breakdown tokens never expire
`participants.breakdown_token` is high-entropy (18 random bytes — good) but permanent. Every SMS ever sent contains a forever-valid URL exposing all participants' names and amounts. SMS bodies get forwarded, backed up, and synced to laptops.

**Recommendation:** Expire or revoke breakdown pages after event settlement + grace period (serve a "this split has closed" page), and clear `breakdown_token` in the guest-PII purge job alongside the vault purge.

### H4. OTP verification: non-atomic attempt counting and non-timing-safe compare
In `otp.service.ts`, `attempt_count` is read-then-written (`update({ attempt_count: row.attempt_count + 1 })`) — parallel requests can race past `OTP_MAX_ATTEMPTS`, which matters because this is the brute-force backstop and (per H1) the outer in-memory throttle is unreliable. This also contradicts your own rule #6 ("atomic updates… never read-then-write"). Additionally `row.code_hash !== codeHash` is not constant-time, and OTP codes are HMAC'd with `PII_HMAC_SALT` — the same secret used for phone hashing (key-separation violation).

**Recommendation:** Increment atomically (RPC/SQL `SET attempt_count = attempt_count + 1 WHERE id = … RETURNING attempt_count`, or conditional `WHERE attempt_count < 5`); use `crypto.timingSafeEqual`; introduce a dedicated `OTP_HMAC_SECRET`.

### H5. CI does not enforce the project's own quality bars
Three gaps: (1) coverage thresholds are applied **only when `CI !== 'true'`** — inverted from any sane intent; CI enforces nothing. (2) CLAUDE.md mandates 100% coverage for `splitCalculator.ts`, `crypto.ts`, `sanitize.ts`, but no per-file 100% threshold exists anywhere — only a global 80/70. (3) CI runs `test:unit` only; the entire `__tests__/integration` suite never runs in CI. There's also no `npm audit`/dependency scanning or secret scanning step, and `.npmrc` pins `legacy-peer-deps=true` (masks dependency conflicts).

**Recommendation:** Enable thresholds in CI, add per-file `coverageThreshold` entries at 100% for the three mandated files, run integration tests in CI (Supabase local via CLI or mocked), and add `npm audit --audit-level=high` + secret scanning (gitleaks) jobs.

### H6. CORS origin config contradicts documented `APP_DOMAIN` semantics
CLAUDE.md defines `APP_DOMAIN` as domain-only (`letssplyt.app`), but `app.ts` feeds it directly into `cors({ origin: [...] })`, which compares against the `Origin` header — a full URL (`https://letssplyt.app`). Domain-only values will never match, so either CORS is silently broken for browser clients, or someone set `APP_DOMAIN` to a full URL in Doppler and the docs are wrong. Meanwhile `breakdown-url.ts` *normalizes* the same variable by prepending `https://` — two different interpretations of one env var. The fallback `http://localhost:3000` also means a missing var in production yields a localhost CORS policy rather than a startup failure.

**Recommendation:** Normalize once at startup into a validated config module (see M1), derive the CORS origin as `https://${APP_DOMAIN}`, and fail fast if unset in production.

---

## Medium

### M1. No validated env/config layer
~30 `process.env.*` reads are scattered across the codebase, each with its own fallback behavior — some throw (`supabase.ts`), some default silently (`APP_URL ?? 'http://localhost:3000'` in the Twilio webhook URL builder), some fail open (C1). Misconfiguration is discovered per-feature at runtime instead of at boot.

**Recommendation:** One `config.ts` with a Zod schema validating every env var at startup (typed exports, explicit prod-required list). This single change structurally prevents C1, H6, and the localhost-fallback class of bugs. It doesn't violate the "no config loaders" rule — it's plain `process.env` validation, not a Doppler SDK.

### M2. `authenticate` middleware makes a network call per request
Every authenticated request round-trips to Supabase (`supabaseAnon.auth.getUser(token)`). Correct, but it adds latency to every call and makes Supabase Auth availability a hard dependency of every endpoint — a scaling ceiling.

**Recommendation:** Verify JWTs locally (Supabase JWKS / `jose`) with signature+expiry checks; keep `getUser` only for sensitive flows (account deletion, handle changes) where revocation-awareness matters.

### M3. `sanitize.ts` mixes three unrelated concerns
Prompt sanitization, currency formatting, and a DB-touching `resolveParticipantPhone` (imports `supabaseAdmin`) live in one "security" module. A pure utility layer now depends on infrastructure, and `formatCurrency` lives in the backend even though CLAUDE.md's map says `shared/utils/formatCurrency.ts`. Also `sanitizePromptInput` is blacklist-based (strips newlines/pipes/tags) — fine as defense-in-depth given math never comes from the LLM, but it should not be described as preventing injection.

**Recommendation:** Split into `security/sanitize.ts` (pure), `shared/utils/formatCurrency.ts` (shared, as documented), and move `resolveParticipantPhone` next to the PII vault code. Update the doc map or the code — they currently disagree (`shared/utils/currency.ts` doesn't exist either; minor-units logic lives in `splitCalculator.ts`).

### M4. PostgREST filter built by string interpolation
`event.service.ts` builds `.or(\`payer_id.eq.${userId},id.in.(${participantEventIds.join(',')})\`)`. Today both values are server-derived UUIDs, so it's not exploitable — but it's a filter-injection pattern one refactor away from being fed user input, and there's no lint rule preventing that.

**Recommendation:** Restructure as two queries or use parameterized `.in()`/`.eq()` builders; add an ESLint restriction on template literals inside `.or(`.

### M5. Error handling inconsistencies
The global `errorHandler` lives in `auth.controller.ts` (misplaced — it's app-wide infrastructure). Non-`AppError` errors are passed to `next(err)` after Sentry capture, landing in Express's default handler, which returns `text/html` "Internal Server Error" — breaking the JSON error contract mobile relies on. `ValidationError` also double-wraps the code (`code: 'VALIDATION_ERROR'` inside `details` and on the error).

**Recommendation:** Move to `middleware/errorHandler.ts`; terminate unknown errors with a JSON 500 (`{ code: 'INTERNAL_ERROR' }`), never falling through to Express defaults.

### M6. `express.json({ limit: '10mb' })` globally
Receipts upload via signed URLs to Storage, so no JSON endpoint should legitimately need 10 MB. Combined with C2 (broken rate limiting), that's an easy memory-pressure DoS vector.

**Recommendation:** Default 100 KB globally; raise per-route only where measured payloads require it.

### M7. Crypto: no key versioning; 16-byte GCM IV
`encrypt()` output (`iv:tag:ciphertext`) carries no key identifier, so rotating `PHONE_ENCRYPTION_KEY`/`HANDLE_ENCRYPTION_KEY` requires re-encrypting every row in one shot with no rollback. Also GCM's recommended nonce length is 12 bytes; 16 works but is nonstandard (NIST SP 800-38D).

**Recommendation:** Prefix a key-version byte (`v1:iv:tag:ct`), support decrypt-with-old/encrypt-with-new during rotation; switch to 12-byte IVs for new writes (format stays parseable since IV length is self-describing per version).

### M8. Backend `console.warn` in financial cleanup paths
`expenses.reset.ts` and `event-storage.cleanup.ts` log failures via `console.warn`, bypassing pino (no requestId/userId, invisible to structured log pipelines and Sentry). These are exactly the paths where silent partial failure hurts.

**Recommendation:** Use the pino logger; consider whether a failed expenses-reset RPC should be a warning at all, or an operational error.

---

## Low

- **L1.** `piiScrubberMiddleware` silently deletes PII keys from responses. Good backstop, but it can mask contract bugs — a response that *should* never contain `phone_encrypted` will just quietly lose the field. Add a log/metric when the scrubber actually strips something, so leaks are noticed, not hidden.
- **L2.** TwiML replies (`twimlMessage`) don't XML-escape `replyText`. Today the strings are static; escape anyway so a future dynamic reply can't inject TwiML.
- **L3.** `largestRemainderRound` assumes `unitsLeft ≥ 0` and distributes at most +1 per share; extreme float accumulation or negative shares (future refunds/discount-heavy edge) would break the invariant silently before the final check throws. Add explicit guards/tests for negative shares and `unitsLeft > shares.length`.
- **L4.** Duplicate route mounts (`/webhooks/twilio` and `/api/v1/webhooks/twilio`) — pick one canonical path; the Twilio signature validation depends on exact URL matching, so dual paths double the misconfiguration surface.
- **L5.** `isOtpDevBypassEnabled` is re-exported through `auth.service.ts` and imported from two different paths (`server.ts` vs `otp.service.ts`) — one canonical import path, please.
- **L6.** CLAUDE.md doc map drift: `shared/utils/formatCurrency.ts` and `currency.ts` don't exist; comment in `otp-dev-bypass.ts` still describes Twilio Verify though the code is custom OTP. Stale docs actively mislead future sessions given your session rules tell the AI to trust these docs.
- **L7.** Mobile is in good shape on the audited rules: tokens in `expo-secure-store` (AsyncStorage holds only a non-sensitive biometric-mode flag), no Expo Router, Zustand stores, in-memory Supabase session with secure persistence hooks. Two `console.warn`s in `eventNavigation.ts` should route through a logging abstraction if you add one.

---

## What's done well

Worth stating, because it changes the recommendations above from "rebuild" to "tighten": pure-TS financial arithmetic with a sum-invariant check and largest-remainder rounding; atomic conditional update for breakdown-token assignment; QStash signature verification that fails closed; Twilio webhook signature validation; PII vault (HMAC lookup + AES-256-GCM) implemented as specified; consistent HTML escaping in all server-rendered templates; LLM factory with vision-capability guard; fire-and-forget AI audit logging that never throws; extensive test suite (90+ backend test files) with dev-bypass paths deliberately tested.

## Suggested fix order

1. C1 (fail-closed OTP bypass) + C2 (`trust proxy`) — hours of work, removes the two worst production risks.
2. M1 (validated config) — structurally prevents the C1/H6 class.
3. C4 (money column scale) — before real 3-decimal-currency data exists; migration cost only grows.
4. H1 (Redis-backed rate limits) + H4 (atomic OTP attempts) — auth brute-force hardening as one unit.
5. H5 (CI enforcement) — so regressions on all of the above get caught.
6. C3 (RLS decision) — biggest architectural item; decide the model, then migrate incrementally.
7. H2/H3/H6, then Medium items opportunistically.
