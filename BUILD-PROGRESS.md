# LetsSplyt — Build Progress
**Project:** LetsSplyt mobile bill-splitting app
**Last updated:** 2026-06-08
**Current story:** E05-S04 — Event Member Management UI (contacts, remove, reopen)

> **AI:** Read this file at the start of every session to know where we left off.
> Find the first `[ ]` story below and build it. After Pawan confirms it's done, change `[ ]` to `[x]` and add the date.

---

## TIER 1 — Foundation

### Epic 1: Infrastructure & Security
- [x] E01-S01 — Monorepo Scaffold + TypeScript Config (2026-06-07)
- [x] E01-S02 — Express Application + All Middleware (2026-06-07)
- [x] E01-S03 — Supabase Client Singletons (2026-06-07)
- [x] E01-S04 — LLM Provider Factory (2026-06-07)
- [x] E01-S05 — Test Infrastructure Setup (2026-06-07)
- [x] E01-S06 — Security Utilities (encrypt, hashPhone, sanitizePromptInput, formatCurrency, getCurrencyMinorUnits) (2026-06-07)

### Epic 2: Database Schema & RLS
- [x] E02-S01 — Core Tables + Indexes (2026-06-07)
- [x] E02-S02 — Triggers + Functions (2026-06-07)
- [x] E02-S03 — RLS Policies (2026-06-07)
- [x] E02-S04 — Seed Data (2026-06-07)

### Epic 3: Authentication
- [x] E03-S01 — OTP Request Endpoint (POST /auth/otp/request) (2026-06-07)
- [x] E03-S02 — OTP Verify + Session Creation (POST /auth/otp/verify) (2026-06-07)
- [x] E03-S03 — Welcome + PhoneEntry Screens + authStore (2026-06-07)
- [x] E03-S04 — OTPVerify Screen + initAuthListener + Token Refresh (2026-06-08)

### Epic 4: Profile & Payment Handles
- [x] E04-S01 — Profile API Endpoints (GET/PATCH /users/me, CRUD /handles) (2026-06-08)
- [x] E04-S02 — Profile Mobile Screens (ProfileScreen, AddHandleScreen) (2026-06-08)

---

## TIER 2 — Core Creator Flow

### Epic 5: Event Creation, QR & Live Member List
- [x] E05-S01 — Event CRUD API (create, list, get, lock, reopen, regenerate token) (2026-06-08)
- [x] E05-S02 — Add Participant API + Manual Add (2026-06-08)
- [x] E05-S03 — Mobile Event Screens (Home, Events, CreateEvent, QR, EventDetail + Realtime) (2026-06-08)
- [ ] E05-S04 — Event Member Management UI (contact picker, remove before lock, reopen after lock)

### Epic 6: Join Flows (3 stories)
- [x] E06-S01 — Web Join Page (server-rendered HTML — works without JavaScript) (2026-06-08)
- [ ] E06-S02 — In-App Join + Deep Link Handler (Universal Links, AppJoinScreen)
- [ ] E06-S03 — Deep Link Infrastructure (AASA, App Links, Expo Config)

### Epic 7: AI Receipt Pipeline
- [ ] E07-S01 — Receipt Image Upload (mobile compress → Supabase Storage signed URL)
- [ ] E07-S02 — A1 Receipt Parsing (AI Agent — atomic idempotency, Zod validation)
- [ ] E07-S03 — Item Review Screen (mobile — editable items, low-confidence highlight)
- [ ] E07-S04 — Split Calculator (getCurrencyMinorUnits, largest-remainder, 100% coverage)
- [ ] E07-S05 — A2 NLP Assignment Agent (sanitizePromptInput, delegates math to calculator)
- [ ] E07-S06 — Split Entry + Review Screens (4 tabs, drag-drop, NLP input)

### Epic 8: Message System (7 stories)
- [ ] E08-S01 — A3 Message Generation + Preview API
- [ ] E08-S02 — Send Messages + Twilio Delivery (+ STOP webhook)
- [ ] E08-S03 — Split Image Generator (@napi-rs/canvas, upload to Storage, Twilio mediaUrl)
- [ ] E08-S04 — Message Preview Screen (carousel, per-participant split image)
- [ ] E08-S05 — Send + Realtime Delivery Tracking (Supabase Realtime, status badges)
- [ ] E08-S06 — Twilio STOP Webhook Handler
- [ ] E08-S07 — Post-Send Split Edit (P20a)

### Epic 9: Settlement Tracking
- [ ] E09-S01 — Settlement API (self-report, confirm, dispute, nudge with 24h cooldown)
- [ ] E09-S02 — Settlement Ledger API (owed-to-me, i-owe, summary, person-detail)
- [ ] E09-S03 — Settlement Mobile Screens (SettlementTab, PayNowScreen, PersonDetailScreen)

---

## TIER 3 — Operations

### Epic 10: Background Jobs & Push Notifications
- [ ] E10-S01 — QStash Job Handlers (nudge-check, purge-guest-pii, create-analytics-partition)
- [ ] E10-S02 — Push Notifications (token registration, send from backend, foreground/background/killed)

### Epic 11: Account Management
- [ ] E11-S01 — Biometric Authentication (opt-in, isEnrolledAsync edge case)
- [ ] E11-S02 — Settings Screen + Delete Account (3-screen flow, full PII wipe)

### Epic 12: Launch Readiness
- [ ] E12-S01 — Analytics Event Ingestion + Health Check
- [ ] E12-S02 — Sentry Error Monitoring + Structured Logging
- [ ] E12-S03 — EAS Build Configuration + CI/CD Completion
- [ ] E12-S04 — End-to-End Test Suite (Maestro)

---

## Completion Summary

| Tier | Epics | Stories | Done | Remaining |
|---|---|---|---|---|
| Tier 1 — Foundation | 4 | 16 | 16 | 0 |
| Tier 2 — Core Flow | 5 | 23 | 4 | 19 |
| Tier 3 — Operations | 3 | 8 | 0 | 8 |
| **Total** | **12** | **47** | **17** | **30** |

---

## Notes
<!-- AI: add session notes here when useful -->
<!-- Format: [Date] — [Story ID] — [What was built] — [Any decisions made] -->
- [2026-06-07] — E01-S01–E03-S02 — Monorepo scaffold, full DB migration+seed, Express middleware, Supabase clients, LLM factory, OTP auth endpoints. Session creation via Admin REST API (`/auth/v1/admin/users/{id}/sessions`) because `createSession()` is not in @supabase/supabase-js@2.49. Mobile bumped to Expo SDK 52 for React Navigation v7 compat.
- [2026-06-07] — E01-S05 — Jest (backend+mobile), mocks (supabase/twilio/llm), CI workflow, ESLint root config, git-secrets hooks. Per-table `__setMockResultForTable` added for independent table mock config.
- [2026-06-07] — E01-S06 — crypto/sanitize utilities with 100% test coverage target, formatCurrency, resolveParticipantPhone. Hex IV format per docs/09 (not base64 from build-sequence prompt).
- [2026-06-08] — Mobile upgraded Expo SDK 52 → 54 to match App Store Expo Go (SDK 54). React 19.1, RN 0.81. Docs updated in CLAUDE.md, 08, 10, 12-Build-Sequence.
- [2026-06-08] — E06-S01 — Server-rendered web join at /join/:token (HTML form, OTP, participant create, funnel checkpoints). Schema repair migrations for funnel_checkpoints and participants. 134 backend tests passing.
- [2026-06-08] — Product — Reopen join window TTL changed from 1 hour to 24 hours (matches initial join link). Updated event.service.ts JOIN_TOKEN_TTL_HOURS and PRD/API/User Flows/E05-S04 docs.
- [2026-06-08] — Docs — Added E05-S04 to build sequence (contact picker, remove participant before lock, reopen join window after lock). MVP items from PRD/User Flows P09/P11/P13a were spec'd but missing from 12-Build-Sequence; E05-S03 note points to S04. Build E05-S04 before continuing Epic 6.
- [2026-06-08] — E03-S04 + auth hardening. Session creation via `backend/src/infrastructure/supabase-auth.ts` (`generateLink` + `verifyOtp` + internal email `{userId}@letssplyt.internal`) — NOT `createSession()` or REST `/admin/users/{id}/sessions` (404). Registration writes `public.users` via `upsert_user_profile_on_auth` SECURITY DEFINER RPC + `users_service_role_all` policy — migration `20260608000000_users_auth_registration.sql`. Login OTP requires `public.users` row (orphan `auth.users` → `ACCOUNT_NOT_FOUND`). Mobile: duck-typed `isApiRequestError()` in `api.ts` (Metro breaks `instanceof`); E.164 normalization in `phone.ts`; Register CTA + logout on Home. Dev cleanup: `cd backend && doppler run -- npm run cleanup:phone -- +1XXXXXXXXXX`. If schema already applied: `npx supabase migration repair 20260601000000 --status applied` before `db push`.
