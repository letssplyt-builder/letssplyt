# LetsSplyt — Build Progress
**Project:** LetsSplyt mobile bill-splitting app
**Last updated:** 2026-06-07
**Current story:** E07-S05 — A2 NLP Assignment Agent (sanitizePromptInput, delegates math to calculator)

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
- [x] E05-S04 — Event Member Management UI (contact picker, remove before lock, reopen after lock) (2026-06-09)

### Epic 6: Join Flows (3 stories)
- [x] E06-S01 — Web Join Page (server-rendered HTML — works without JavaScript) (2026-06-08)
- [x] E06-S02 — In-App Join + Deep Link Handler (Universal Links, AppJoinScreen) (2026-06-09)
- [x] E06-S03 — Deep Link Infrastructure (AASA, App Links, Expo Config) (2026-06-09)

### Epic 7: AI Receipt Pipeline
- [x] E07-S01 — Receipt Image Upload (native doc scanner → preview confirm → compress → Supabase Storage signed URL) (2026-06-10)
- [x] E07-S02 — A1 Receipt Parsing (AI Agent — atomic idempotency, Zod validation, additional_charges/fees, dedupe) (2026-06-10)
- [x] E07-S03 — Item Review Screen (mobile — editable items, low-confidence highlight) (2026-06-10)
- [x] E07-S04 — Split Calculator (getCurrencyMinorUnits, largest-remainder, 100% coverage) (2026-06-07)
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
- [ ] E09-S02 — Settlement Ledger API (balance, counterparties, member/guest detail, owed-to-me, i-owe)
- [ ] E09-S03 — Dashboard & Settlement Mobile (Home Members/Guests, Member/Guest detail, Events Active|Settled + Created/Joined, PayNow, Event Detail settlement — 3-tab nav)

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

### Epic 13: AI Eval Framework (last epic — after E12)
- [ ] E13-S01 — Eval runner infrastructure (`eval:all`, provider flags, report)
- [ ] E13-S02 — A1 golden dataset (45+ receipts) + Evals 1–6
- [ ] E13-S03 — A2 golden dataset + eval suite
- [ ] E13-S04 — A3 golden dataset + LLM-judge evals
- [ ] E13-S05 — CI eval jobs + deployment gate

---

## Completion Summary

| Tier | Epics | Stories | Done | Remaining |
|---|---|---|---|---|
| Tier 1 — Foundation | 4 | 16 | 16 | 0 |
| Tier 2 — Core Flow | 5 | 23 | 12 | 11 |
| Tier 3 — Operations | 4 | 13 | 0 | 13 |
| **Total** | **13** | **52** | **22** | **30** |

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
- [2026-06-08] — Fix: web join `display_name` now persisted to `users.display_name` and `participants.display_name`; placeholder profiles (`LetsSplyt User`) upgraded on register. Tests: auth placeholder-name unit test, join.service display_name assertions, web-join integration assertions. Docs: 01, 02, 05, 08, 12 (E03-S02/E06-S01 test lists + acceptance criterion 8).
- [2026-06-08] — Product rule: **OTP = register** (web join + app); only payer manual add without OTP stays pure guest (`guest_pii`). Web join creates `users` + `participants.user_id`; `upgradeGuestParticipantsToUser` links legacy guests on OTP login. Participant Event Detail view for non-payers (E05-S04). Tests: participant-link, join-web (createUser), auth resolveUserAfterOtp + upgradeGuestParticipantsToUser, join.service (user_id insert), participant.service, EventDetailScreen, participantEventView. Docs: 01, 02, 03, 04, 05, 08, 12 (E03-S02/E05-S04/E06-S01 prompts + test lists aligned).
- [2026-06-07] — E05-S04 (in progress, pending Pawan sign-off) — Mobile: AddParticipantModal contact picker + manual paths, EventDetailScreen remove/reopen, EventMemberRow compact UI, lock requires 2 members (organiser + 1); **participant Event Detail view** (no QR/lock/add for joined members — share hero, split breakdown, group roster). Backend: creator auto-inserted as participant on POST /events (`is_organiser` on GET detail), `is_self` + `my_items` on GET detail, `join_token`/`summary` payer-only; manual add links registered users by `user_id` or `guest_pii` for guests. Migration `20260610000000_backfill_creator_participants.sql`. Docs updated: 01-PRD, 02, 03, 04, 05, 08, 12.
- [2026-06-08] — Product — **Dashboard redesign** (approved): Home = net balance hero + **Members | Guests** toggle (counterparty lists, no settlement actions); MemberDetailScreen / GuestDetailScreen drill-down; Events tab = **Active | Settled** toggle with **Created / Joined** sections under each; **no Settlement bottom tab** (3-tab nav). USD-only MVP. Docs fully aligned: 01-PRD, 02-User-Flows (P28–P34), 03-System-Architecture (counterparty aggregation), 05-API (counterparties, member/guest detail), 08-Mobile-App-Spec, 12-Build-Sequence (E05-S03 placeholder note, E09-S02/S03 rewritten, E08-S07 → EventDetailScreen), prototype/home.html. Implementation deferred to E09-S02/E09-S03.
- [2026-06-09] — E05-S04 — Event member management UI: contact picker + manual add, remove before lock, reopen after lock; participant Event Detail view; registered-user manual add by `user_id`; web join `display_name` fix; creator backfill migration; dashboard spec alignment. 142 backend + 89 mobile tests passing at sign-off.
- [2026-06-09] — Fix: event member lists show **live** profile names for registered members — `GET /events/:id` resolves `users.display_name` for linked participants; `PATCH /users/me` syncs all `participants.display_name` rows for that user (Realtime + SMS/split consistency). Tests: `participant-display-name` unit, profile sync unit, events integration. Docs: 01, 02, 03, 04, 05, 08, 09, 12.
- [2026-06-09] — E06-S03 — Deep Link Infrastructure: AASA + assetlinks served from backend/public, Expo associatedDomains/intentFilters. 155 backend tests passing at sign-off.
- [2026-06-09] — E06-S02 — In-App Join + Deep Link Handler: join preview/app-join API, AppJoin/AppJoined/AppLocked screens, linking + pending token through auth, DevJoinTestPanel for Expo Go. 155 backend + 94 mobile tests passing at sign-off.
- [2026-06-10] — Planning — Epic 13 (AI Eval Framework) added as **last** epic in `docs/12-Build-Sequence.md` (after E12). Spec remains in `docs/07-AI-Agent-Specification.md` §7; implementation deferred until E07–E12 agents exist.
- [2026-06-08] — E03-S04 + auth hardening. Session creation via `backend/src/infrastructure/supabase-auth.ts` (`generateLink` + `verifyOtp` + internal email `{userId}@letssplyt.internal`) — NOT `createSession()` or REST `/admin/users/{id}/sessions` (404). Registration writes `public.users` via `upsert_user_profile_on_auth` SECURITY DEFINER RPC + `users_service_role_all` policy — migration `20260608000000_users_auth_registration.sql`. Login OTP requires `public.users` row (orphan `auth.users` → `ACCOUNT_NOT_FOUND`). Mobile: duck-typed `isApiRequestError()` in `api.ts` (Metro breaks `instanceof`); E.164 normalization in `phone.ts`; Register CTA + logout on Home. Dev cleanup: `cd backend && doppler run -- npm run cleanup:phone -- +1XXXXXXXXXX`. If schema already applied: `npx supabase migration repair 20260601000000 --status applied` before `db push`.
- [2026-06-10] — E07-S03 — Item Review Screen + `POST /receipts/confirm`, receipt-review snapshot on GET event, Event Detail footer modes (review/edit), ReceiptReviewSlip UX. **Partial E09 (ahead of E09-S02/S03):** Home Members|Guests dashboard, counterparties + member/guest detail APIs, HomeStack (Member/Guest detail), Events Active|Settled toggle with Created/Joined sections, tab stack reset on Dashboard/Events tap. Docs: 01, 02, 03, 08, 12 updated for Events layout. Tests: counterparties.service, EventsScreen, settlementStore, HomeScreen, filterEventsBySegment, eventSections, receipt confirm/review, ItemReview, eventSplitFooter.
