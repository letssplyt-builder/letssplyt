# LetsSplyt — Build Progress
**Project:** LetsSplyt mobile bill-splitting app
**Last updated:** 2026-06-07
**Current story:** E11-S07 — QStash OTP Cleanup, Docs, Smoke & Rollout

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
- [x] E07-S05 — A2 NLP Assignment Agent (sanitizePromptInput, delegates math to calculator) (2026-06-07)
- [x] E07-S06 — Split Entry + Review Screens (4 tabs, drag-drop, NLP input) (2026-06-07)

### Epic 8: Message System (7 stories)
- [x] E08-S01 — A3 Message Generation + Preview API (2026-06-07)
- [x] E08-S02 — Send Messages + Twilio Delivery (+ STOP webhook) (2026-06-07)
- [x] E08-S03 — Hosted split breakdown page + per-participant `breakdown_token` (SMS link replaces MMS split image on send) (2026-06-07)
- [x] E08-S04 — Message Preview Screen (carousel, per-participant `breakdown_url` link card) (2026-06-11)
- [x] E08-S05 — Send + Realtime Delivery Tracking (Supabase Realtime, status badges) (2026-06-07)
- [x] E08-S06 — Twilio STOP Webhook Handler (2026-06-07)
- [x] E08-S07 — Post-Send Split Edit (P20a) (2026-06-07)

### Epic 9: Settlement Tracking
- [x] E09-S01 — Per-event settlement API (self-report, confirm, dispute, nudge, mark-paid/cash + `smoke:settlement`) (2026-06-07)
- [x] E09-S02 — Counterparty bulk settlement API (settle-all per member/guest: self-report-all, confirm-all, dispute-all, mark-paid-all + `smoke:bulk-settlement`) (2026-06-07)
- [x] E09-S03 — Settlement ledger API (owed-to-me, i-owe, person alias, ledger tests + `smoke:ledger`) (2026-06-07)
- [x] E09-S04 — Settlement mobile UI (Event Detail swipe roster, participant paid state, Events Active/Settled rules, Member detail Pay all / I've paid all, eventNavigation, Android refresh fix, Dashboard stack reset) (2026-06-07)

---

## TIER 3 — Operations

### Epic 10: Background Jobs & Push Notifications
- [x] E10-S01 — QStash Job Handlers (purge-guest-pii, create-analytics-partition; nudge deferred) (2026-06-07)
- [x] E10-S02 — Push Notifications + in-app notification center (2026-06-07)

### Epic 11: Account Management
- [x] E11-S01 — Biometric Authentication (Option B skip, idle lock, OTP/logout fixes) (2026-06-07)
- [x] E11-S02 — Settings Screen + Delete Account (3-screen flow, full PII wipe) (2026-06-07)
- [x] E11-S03 — SMS Provider Abstraction Foundation (factory + Twilio adapter + outbound facade) (2026-06-07)
- [x] E11-S04 — Custom OTP Service (replaces Twilio Verify; auth + web join) (2026-06-07)
- [x] E11-S05 — Telnyx Provider + Outbound Messaging Migration (2026-06-07)
- [x] E11-S06 — Messaging Webhooks + Inbound STOP/START (2026-06-07)
- [ ] E11-S07 — QStash OTP Cleanup, Docs, Smoke & Rollout

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
| Tier 2 — Core Flow | 5 | 24 | 20 | 4 |
| Tier 3 — Operations | 4 | 18 | 4 | 14 |
| **Total** | **13** | **58** | **34** | **24** |

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
- [2026-06-08] — Product — **Dashboard redesign** (approved): Home = net balance hero + **Members | Guests** toggle (counterparty lists, no settlement actions); MemberDetailScreen / GuestDetailScreen drill-down; Events tab = **Active | Settled** toggle with **Created / Joined** sections under each; **no Settlement bottom tab** (3-tab nav). USD-only MVP. Docs fully aligned: 01-PRD, 02-User-Flows (P28–P34), 03-System-Architecture (counterparty aggregation), 05-API (counterparties, member/guest detail), 08-Mobile-App-Spec, 12-Build-Sequence (E05-S03 placeholder note, E09-S02/S03 rewritten), prototype/home.html. Implementation deferred to E09-S02/E09-S03. (E08-S07 later revised to Edit share flow — see 2026-06-07 E08-S07 entry.)
- [2026-06-09] — E05-S04 — Event member management UI: contact picker + manual add, remove before lock, reopen after lock; participant Event Detail view; registered-user manual add by `user_id`; web join `display_name` fix; creator backfill migration; dashboard spec alignment. 142 backend + 89 mobile tests passing at sign-off.
- [2026-06-09] — Fix: event member lists show **live** profile names for registered members — `GET /events/:id` resolves `users.display_name` for linked participants; `PATCH /users/me` syncs all `participants.display_name` rows for that user (Realtime + SMS/split consistency). Tests: `participant-display-name` unit, profile sync unit, events integration. Docs: 01, 02, 03, 04, 05, 08, 09, 12.
- [2026-06-09] — E06-S03 — Deep Link Infrastructure: AASA + assetlinks served from backend/public, Expo associatedDomains/intentFilters. 155 backend tests passing at sign-off.
- [2026-06-09] — E06-S02 — In-App Join + Deep Link Handler: join preview/app-join API, AppJoin/AppJoined/AppLocked screens, linking + pending token through auth, DevJoinTestPanel for Expo Go. 155 backend + 94 mobile tests passing at sign-off.
- [2026-06-10] — Planning — Epic 13 (AI Eval Framework) added as **last** epic in `docs/12-Build-Sequence.md` (after E12). Spec remains in `docs/07-AI-Agent-Specification.md` §7; implementation deferred until E07–E12 agents exist.
- [2026-06-08] — E03-S04 + auth hardening. Session creation via `backend/src/infrastructure/supabase-auth.ts` (`generateLink` + `verifyOtp` + internal email `{userId}@letssplyt.internal`) — NOT `createSession()` or REST `/admin/users/{id}/sessions` (404). Registration writes `public.users` via `upsert_user_profile_on_auth` SECURITY DEFINER RPC + `users_service_role_all` policy — migration `20260608000000_users_auth_registration.sql`. Login OTP requires `public.users` row (orphan `auth.users` → `ACCOUNT_NOT_FOUND`). Mobile: duck-typed `isApiRequestError()` in `api.ts` (Metro breaks `instanceof`); E.164 normalization in `phone.ts`; Register CTA + logout on Home. Dev cleanup: `cd backend && doppler run -- npm run cleanup:phone -- +1XXXXXXXXXX`. If schema already applied: `npx supabase migration repair 20260601000000 --status applied` before `db push`.
- [2026-06-07] — E08-S03 — Split image generator (@napi-rs/canvas), Storage upload to receipts/{eventId}/split-{participantId}.png, Twilio mediaUrl on send, smoke 21/21, 257 backend tests. Live smoke + integration tests for storage/send.
- [2026-06-07] — E08-S02 — Send Messages + Twilio Delivery: POST /events/:id/messages/send, notification_log, Twilio opt-out/delivery webhooks, messaging dev-bypass (local smoke 19/19). 244 backend tests passing at sign-off.
- [2026-06-10] — E07-S03 — Item Review Screen + `POST /receipts/confirm`, receipt-review snapshot on GET event, Event Detail footer modes (review/edit), ReceiptReviewSlip UX. **Partial E09 (ahead of E09-S02/S03):** Home Members|Guests dashboard, counterparties + member/guest detail APIs, HomeStack (Member/Guest detail), Events Active|Settled toggle with Created/Joined sections, tab stack reset on Dashboard/Events tap. Docs: 01, 02, 03, 08, 12 updated for Events layout. Tests: counterparties.service, EventsScreen, settlementStore, HomeScreen, filterEventsBySegment, eventSections, receipt confirm/review, ItemReview, eventSplitFooter.
- [2026-06-11] — E08-S04 — Message Preview Screen: carousel per member (organiser excluded), split image from signed URL, Send to all gated until all viewed (send wired in E08-S05). Edit → SplitEntry with hydrate from split store + assignments API. Event Detail polish: overflow ⋮ (Reopen/Reset + confirm alerts), settlement footer for all post-lock statuses, split entry UI slimming, Home→EventDetail navigation, balance hero guests. Backend: preview/send exclude organiser, simplified split image columns, GET split assignments. MessagePreviewScreen tests 3/3; mobile suite green at sign-off.
- [2026-06-07] — E08-S05 — Send + Realtime Delivery Tracking: DeliveryTrackingScreen (Realtime on participants, Done when sent/delivered/failed/skipped), MessagePreview Send to all (preview optional), retry per participant. Backend: POST messages/retry/:participantId, GET event includes message_sent_at/delivered_at/failed, dev bypass sets delivered_at, Twilio webhook updates delivered_at. Smoke 24/24; 260 backend + 9 mobile message tests passing at sign-off.
- [2026-06-07] — E08-S06 — Twilio STOP webhook: `processSmsStopOptOut` (sms_opt_outs, users, participants, settlement_log), `/webhooks/twilio/stop` + `/opt-out`, TwiML confirmation; 264 backend tests. No mobile UI.
- [2026-06-07] — **SMS delivery strategy change** — Retired MMS `mediaUrl` on send/preview. Each participant gets `participants.breakdown_token` + `See full split: https://{APP_DOMAIN}/split/{token}` in SMS body; `GET /split/:token` serves HTML (all rows including organiser; viewer highlighted). Preview API field `breakdown_url`; mobile MessagePreview opens link in browser. `POST /split/confirm` allowed when `events.status` is `locked` or `sent`. Migration #18. Legacy `split-image.generator.ts` not on delivery path. Docs: CLAUDE, 01–08, 12, MIGRATIONS. Tests: breakdown-page integration, message-assembler, confirm-split, send.service (no MMS), messages-send integration, MessagePreviewScreen 4/4, smoke script breakdown checks; 262 backend tests.
- [2026-06-07] — E08-S07 (revised, pending sign-off) — Post-send split edit via existing **Edit share** → Review split → **Save and notify** (no EditSplitModal). `POST /split/confirm` post-send revisions + `POST /splits/resend` selective SMS. Edit locked on `self_reported` / `confirmed` / `settled`; dispute→`pending` re-opens. Docs: 01, 02, 05, 08, 10, 12. Smoke `smoke:split-revision` 20/20; 265 backend + 192 mobile tests.
- [2026-06-07] — E09-S01 — Per-event settlement API complete: mark-paid/cash, migrations #19–#20 (`settlement_log` audit columns + `disputed` action), `smoke:settlement` 22/22, backend 277 tests.
- [2026-06-07] — E09-S01 — Per-event settlement API: mark-paid/cash endpoint, migrations #19–#20 (`settlement_log` audit + `disputed` action), `npm run smoke:settlement` 22/22, backend 277 tests.
- [2026-06-07] — E11-S01 — Biometric auth (Option B: skip keeps plain refresh; enroll gates refresh behind OS biometrics). Idle app lock (5 min). `secureTokenStorage`, `authToken.resolveAccessToken`, BiometricOptIn/Lock screens, in-memory Supabase session, OTP verify `device_id`/`platform`, non-fatal `registerDeviceAfterOtp`, navigation reset fixes, logout best-effort. Migration #22 `device_sessions` trust columns. Docs 02/05/08/09/12. Tests: mobile 233, backend 304 passing.
- [2026-06-07] — E10-S02 — Expo push pipeline (`push.service.ts`, dev log-only), in-app inbox (`user_notifications`, GET/PATCH APIs), notification center UI (bell + badge on Dashboard/Events, `NotificationsScreen`, `notificationStore`), revised push policy (member self-report auto-settles — no confirm push to member; creator pushes: member paid, fully settled, member paid all; member pushes: added, nudge, share ready/edited). Navigation fixes (`navigateFromNotification`, `navigateToHomeTab`, tab stack reset). Badge real-time fix (`apiPatchAuth`, store race guards). Tests: backend 329 (unit + integration notifications), mobile 252; `smoke:notifications` live script. Docs: 01–06, 08, 10, 12, 04, MIGRATIONS, BUILD-PROGRESS.
- [2026-06-07] — Product/docs — Epic 9 realigned to 4 stories: E09-S01 per-event API, **E09-S02 bulk settle-all**, E09-S03 ledger (partial E07-S03), E09-S04 mobile actions (partial E07-S03). Total stories 53.
- [2026-06-07] — E11-S02 — Settings tab (Account/Legal/Notifications/Security), in-app legal docs (`LegalDocumentScreen` + synced markdown), delete account flow (balance gate, DELETE confirm, tombstone + auth delete), notification prefs migration, `phone_encrypted` nullable migration, delete service fallbacks (PGRST204/`name_encrypted`, DELETED tombstone). Phone entry: tappable Terms & Privacy links on auth stack. Tests: delete.service 10, PhoneEntry 5, DeleteConfirm/Deleted mobile.
- [2026-06-07] — E11-S03 + E11-S04 — SMS provider factory (Twilio adapter, outbound facade), custom OTP (`otp_verifications`, otp.service), Twilio Verify removed from auth + web join. Telnyx planning docs in `docs/Telnyx Implementation/`. 362 backend tests passing.
