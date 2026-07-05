# LetsSplyt — Post-Audit Build Sequence

Remediation stories derived from **`CODEBASE-AUDIT-2026-07-05.md`**.  
Each story = **one PR** to `develop`, then promote to `staging` after confirmation.

Track completion in **`POST-AUDIT-PROGRESS.md`**.

---

## PA-01 — OTP dev bypass fail-closed + APP_ENV boot validation

**Audit:** C1  
**Goal:** Never accept arbitrary OTP codes unless explicitly in dev/test with a deliberate bypass flag or ACtest credentials.

### Changes

- `isOtpDevBypassEnabled()` returns `false` when `APP_ENV` is unset or unknown.
- Bypass only when `APP_ENV` is `development` or `test` AND (`OTP_DEV_BYPASS=true` OR Twilio `ACtest` SID).
- `validateStartupEnv()` — refuse boot if `APP_ENV` missing or not in `development|test|staging|production`.
- Log `otpMode: dev-bypass` at startup only when bypass is truly active.

### Acceptance criteria

- [ ] `APP_ENV=undefined` → bypass off; any OTP verify uses real DB path (or fails without row).
- [ ] `APP_ENV=production|staging` → bypass off regardless of `OTP_DEV_BYPASS`.
- [ ] `APP_ENV=development` + real Twilio SID + no `OTP_DEV_BYPASS` → bypass off.
- [ ] `APP_ENV=development` + `OTP_DEV_BYPASS=true` OR `ACtest` → bypass on.
- [ ] Server refuses to start when `APP_ENV` is missing or invalid.

### Tests

```bash
cd backend && npm test -- --testPathPattern="otp-dev-bypass|startup-env"
cd backend && npm test
```

---

## PA-02 — Express trust proxy + per-IP rate limiting

**Audit:** C2

### Changes

- `app.set('trust proxy', 1)` before rate limiters.
- Integration test: two different `X-Forwarded-For` values get independent buckets.

### Acceptance criteria

- [ ] `req.ip` reflects client IP behind proxy in tests.
- [ ] 101st request from same forwarded IP → 429; first request from different IP → 200.

### Tests

```bash
cd backend && npm test -- --testPathPattern="trust-proxy|rateLimiter"
cd backend && npm test
```

---

## PA-03 — Validated env config at startup

**Audit:** M1, partial H6

### Changes

- `backend/src/infrastructure/config.ts` — Zod schema, typed exports, prod-required vars.
- Normalize `APP_DOMAIN` → HTTPS CORS origin(s).
- Replace scattered `process.env` fallbacks for `APP_URL`, `APP_DOMAIN` in critical paths.

### Tests

- Unit tests for schema pass/fail cases.
- Full backend test suite green.

---

## PA-04 — Money column scale (3-decimal currencies)

**Audit:** C4

### Changes

- Migration: money columns to `NUMERIC(12,3)` or integer minor units (decide in PR).
- Verify split sum invariant after DB round-trip for BHD.

### Tests

- Migration applies cleanly on local Supabase.
- splitCalculator + integration tests for 3-decimal currency.

---

## PA-05 — Redis-backed rate limits

**Audit:** H1

### Changes

- `@upstash/ratelimit` or Redis store for express-rate-limit + OTP counters.
- TTL eviction for in-memory fallback if Redis unavailable in dev only.

---

## PA-06 — Atomic OTP attempts + timing-safe compare

**Audit:** H4

### Changes

- SQL/RPC `attempt_count = attempt_count + 1 WHERE attempt_count < max`.
- `crypto.timingSafeEqual` for hash compare.
- Dedicated `OTP_HMAC_SECRET` (optional same PR or follow-up).

---

## PA-07 — CI coverage enforcement

**Audit:** H5

### Changes

- Enable `coverageThreshold` when `CI=true`.
- Per-file 100% for `splitCalculator.ts`, `crypto.ts`, `sanitize.ts`.
- Document that integration tests already run via `test:coverage`.

---

## PA-08 — Security headers on HTML routes

**Audit:** H2

### Changes

- `helmet` with CSP for `/join`, `/split`, `/s`.
- `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store` on breakdown pages.

---

## PA-09 — Breakdown token expiry

**Audit:** H3

### Changes

- Revoke or expire `breakdown_token` after settlement + grace period.
- “Split closed” page for expired tokens.
- Include in guest PII purge job.

---

## PA-10 — CORS / APP_DOMAIN cleanup

**Audit:** H6 remainder

### Changes

- Single source of truth for web origins after PA-03.
- Remove localhost fallback in production.

---

## PA-11 — RLS strategy + centralized authz

**Audit:** C3

### Changes

- Written ADR: service-role + app authz vs `getSupabaseForUser`.
- Middleware or helper that loads event + asserts membership once per route.
- Cross-tenant rejection test suite for all event-scoped routes.
- Update CLAUDE.md / `supabase.ts` docstring to match decision.

---

## PA-12 — JSON error handler

**Audit:** M5

### Changes

- Move `errorHandler` to `middleware/errorHandler.ts`.
- Unknown errors → JSON 500, never Express HTML default.

---

## PA-13 — JSON body size limit

**Audit:** M6

### Changes

- Default `express.json({ limit: '100kb' })`.
- Per-route raise only where measured.

---

## PA-14 — Encryption key versioning

**Audit:** M7

### Changes

- Prefix `v1:` on ciphertext; 12-byte IV for new writes.
- Decrypt supports old format during rotation.

---

## PA-15 — Structured logging in cleanup paths

**Audit:** M8

### Changes

- Replace `console.warn` in `expenses.reset.ts`, `event-storage.cleanup.ts` with pino.

---

## PA-16 — Split security/sanitize module

**Audit:** M3

### Changes

- Pure `sanitize.ts`; move `resolveParticipantPhone`; align `formatCurrency` with shared package map.

---

## PA-17 — PostgREST filter guardrails

**Audit:** M4

### Changes

- Refactor `event.service.ts` `.or()` string build.
- ESLint rule or comment convention for filter templates.

---

## PA-18 — JWT local verification

**Audit:** M2

### Changes

- Verify JWT via JWKS locally in `authenticate` middleware.
- Reserve `getUser()` for sensitive account operations.

---

## PA-19 — Low-severity bundle

**Audit:** L1–L7

### Changes

- PII scrubber strip metrics (L1).
- TwiML XML escape (L2).
- splitCalculator negative guard tests (L3).
- Single Twilio webhook path (L4).
- Canonical `isOtpDevBypassEnabled` import (L5).
- CLAUDE.md doc map fix (L6).
- Mobile `console.warn` cleanup (L7).
