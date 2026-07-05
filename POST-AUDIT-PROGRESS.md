# LetsSplyt — Post-Audit Build Progress

**Source:** `CODEBASE-AUDIT-2026-07-05.md`  
**Last updated:** 2026-07-05  
**Current story:** PA-01 — OTP fail-closed + APP_ENV boot validation

> **AI:** Read this file at the start of every post-audit session. Find the first `[ ]` story in `POST-AUDIT-BUILD-SEQUENCE.md`, build it as **one PR**, run tests, wait for Pawan confirmation, then mark `[x]` with date.

---

## Critical

- [x] PA-01 — OTP dev bypass fail-closed + APP_ENV boot validation (C1) (2026-07-05)
- [x] PA-02 — Express `trust proxy` + per-IP rate limit test (C2) (2026-07-05)
- [x] PA-03 — Validated env config module at startup (M1, partial H6) (2026-07-05)
- [x] PA-04 — Money column scale / minor-units migration (C4) (2026-07-05)

## High

- [x] PA-05 — Redis-backed rate limits + OTP counter TTL (H1) (2026-07-05)
- [ ] PA-06 — Atomic OTP attempt counting + timing-safe compare (H4)
- [ ] PA-07 — CI coverage enforcement + 100% gates on critical files (H5)
- [ ] PA-08 — Security headers on HTML routes (H2)
- [ ] PA-09 — Breakdown token expiry after settlement (H3)
- [ ] PA-10 — CORS origin normalization from APP_DOMAIN (H6 remainder)

## Architecture

- [ ] PA-11 — RLS strategy decision + centralized route authz (C3)

## Medium

- [ ] PA-12 — JSON error handler contract (M5)
- [ ] PA-13 — Global JSON body size limit (M6)
- [ ] PA-14 — Encryption key versioning + 12-byte GCM IV (M7)
- [ ] PA-15 — Structured logging in financial cleanup paths (M8)
- [ ] PA-16 — Split sanitize / formatCurrency / resolveParticipantPhone (M3)
- [ ] PA-17 — PostgREST filter injection guardrails (M4)
- [ ] PA-18 — JWT local verification for auth middleware (M2)

## Low

- [ ] PA-19 — PII scrubber metrics, TwiML escape, splitCalculator guards, route dedup, doc drift (L1–L7)
