# LetsSplyt — Build Progress
**Project:** LetsSplyt mobile bill-splitting app
**Last updated:** June 2026
**Current story:** E01-S01 — Not started yet

> **AI:** Read this file at the start of every session to know where we left off.
> Find the first `[ ]` story below and build it. After Pawan confirms it's done, change `[ ]` to `[x]` and add the date.

---

## TIER 1 — Foundation

### Epic 1: Infrastructure & Security
- [ ] E01-S01 — Monorepo Scaffold + TypeScript Config
- [ ] E01-S02 — Express Application + All Middleware
- [ ] E01-S03 — Supabase Client Singletons
- [ ] E01-S04 — LLM Provider Factory
- [ ] E01-S05 — Test Infrastructure Setup
- [ ] E01-S06 — Security Utilities (encrypt, hashPhone, sanitizePromptInput, formatCurrency, getCurrencyMinorUnits)

### Epic 2: Database Schema & RLS
- [ ] E02-S01 — Database Migrations (all tables, triggers, RLS, indexes, functions)
- [ ] E02-S02 — Seed Data (3 test users, 2 events, all payment states)

### Epic 3: Authentication
- [ ] E03-S01 — OTP Request Endpoint (POST /auth/otp/request)
- [ ] E03-S02 — OTP Verify + Session Creation (POST /auth/otp/verify)
- [ ] E03-S03 — Mobile Auth Screens (Welcome, PhoneEntry, OTPVerify + authStore)

### Epic 4: Profile & Payment Handles
- [ ] E04-S01 — Profile API Endpoints (GET/PATCH /users/me, CRUD /handles)
- [ ] E04-S02 — Profile Mobile Screens (ProfileScreen, AddHandleScreen)

---

## TIER 2 — Core Creator Flow

### Epic 5: Event Creation, QR & Live Member List
- [ ] E05-S01 — Event CRUD API (create, list, get, lock, reopen, regenerate token)
- [ ] E05-S02 — Add Participant API + Manual Add
- [ ] E05-S03 — Mobile Event Screens (Home, Events, CreateEvent, QR, EventDetail + Realtime)

### Epic 6: Join Flows
- [ ] E06-S01 — Web Join Page (server-rendered HTML — works without JavaScript)
- [ ] E06-S02 — In-App Join + Deep Link Handler (Universal Links, AppJoinScreen)

### Epic 7: AI Receipt Pipeline
- [ ] E07-S01 — Receipt Image Upload (mobile compress → Supabase Storage signed URL)
- [ ] E07-S02 — A1 Receipt Parsing (AI Agent — atomic idempotency, Zod validation)
- [ ] E07-S03 — Item Review Screen (mobile — editable items, low-confidence highlight)
- [ ] E07-S04 — Split Calculator + A2 NLP (splitCalculator.ts — getCurrencyMinorUnits)
- [ ] E07-S05 — Split Entry + Review Screens (4 tabs, drag-drop, NLP input)

### Epic 8: Message System
- [ ] E08-S01 — A3 Message Generation + Preview API
- [ ] E08-S02 — Send Messages + Twilio Delivery (+ STOP webhook)
- [ ] E08-S03 — Split Image Generator (@napi-rs/canvas, upload to Storage, Twilio mediaUrl)
- [ ] E08-S04 — Message Preview + Sending Screens (carousel, Realtime delivery tracking)

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
| Tier 1 — Foundation | 4 | 13 | 0 | 13 |
| Tier 2 — Core Flow | 5 | 20 | 0 | 20 |
| Tier 3 — Operations | 3 | 8 | 0 | 8 |
| **Total** | **12** | **38** | **0** | **38** |

---

## Notes
<!-- AI: add session notes here when useful -->
<!-- Format: [Date] — [Story ID] — [What was built] — [Any decisions made] -->
