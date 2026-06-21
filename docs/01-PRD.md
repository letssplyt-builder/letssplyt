# LetsSplyt — Product Requirements Document (PRD)
**Version:** 1.2 | **Date:** May 2026 | **Status:** MVP Definition Complete
**Last updated:** Home dashboard — Members/Guests toggle with net counterparty balances; Events tab — Active|Settled toggle with Created/Joined sections under each. MVP US market, USD only. OTP = register everywhere; pure guests only via payer manual add without OTP.

---

## Table of Contents
1. Executive Summary
2. Problem Statement & Market Context
3. Target Users — The 9 People at the Table
4. What We Are NOT Building (Scope Boundaries)
5. Core Product Concept
6. System Architecture
7. The 3 AI Agents
8. Agent Communication Flow
9. Database Schema
10. Participant State Machine
11. Key Product Decisions & Rationale
12. MVP vs V2 vs V3 Roadmap

---

## 1. Executive Summary

LetsSplyt is an AI-powered mobile bill-splitting application for iOS and Android. It solves the single most persistent friction in group dining and social spending: splitting a bill when not everyone is on the same app, in the same country, or even in your contacts.

The product's core insight is that **existing apps (Splitwise, Venmo) require everyone to be onboarded before they're useful**. LetsSplyt inverts this — the payer does the work once, and every recipient gets a self-contained message with their exact amount and a direct payment link, regardless of whether they have any app installed.

Three AI agents handle the hard parts: reading any receipt via computer vision (A1), calculating fair per-person splits including proportional tax and tip (A2), and composing personalised, country-aware payment messages for each participant (A3).

**Target market:** US-first, with international participant support from day one.
**Primary user:** The person who pays the group bill and needs to collect from others.
**Secondary user:** Anyone added to a split who wants to track what they owe.

---

## 2. Problem Statement & Market Context

### The Core Pain
When a group goes out for dinner, someone pays the bill. That person then needs to:
1. Calculate everyone's share (including tax and tip)
2. Contact each person individually to tell them what they owe
3. Chase people who don't pay
4. Track who has and hasn't paid

This is universally painful. The problem is not that no tools exist — Splitwise, Venmo, and Zelle all exist. The problem is that **they only work when everyone is already using them**.

### Why Existing Solutions Fail
- **Splitwise:** Requires every participant to have an account. One person without the app breaks the flow.
- **Venmo/Cash App:** US-only, payment-focused, not designed for multi-person bill splitting.
- **WhatsApp / iMessage:** Manual calculation, no tracking, no payment links.
- **Paper and mental math:** Still the most common solution.

### The Specific Gap We Fill
The moment of failure is always the same: "I'd use Splitwise but Mark doesn't have it." LetsSplyt is designed specifically for that moment. Recipients need nothing — no app, no account, no prior relationship with the payer's tool of choice.

### Competitive Positioning Decision
**Decision:** Build standalone first, offer Splitwise as optional v2 integration — not compete head-on.
**Rationale:** Splitwise has 50M+ users and 13 years of network effects. Competing directly is a losing strategy. Our differentiation is the zero-onboarding recipient experience and AI receipt parsing — neither of which requires defeating Splitwise. In v2, we can integrate with Splitwise as an output channel for users who already have it.

---

## 3. Target Users — The 9 People at the Table

Through product research, we identified 9 distinct participant types. Not all are equal — MVP focuses on types 1-5.

| # | Type | Contact Info | MVP Coverage | How Handled |
|---|---|---|---|---|
| 1 | App user (on Splitwise/similar) | ✓ Phone | ✓ Full | WhatsApp + deep links |
| 2 | Known contact | ✓ Phone | ✓ Full | WhatsApp + deep links |
| 3 | New acquaintance (no app) | ✗ None → ✓ After OTP | ✓ Via QR/URL | QR/URL → browser → name+phone+OTP → registered user + event participant |
| 4 | International guest | ✓ Foreign phone | ✓ Partial | WhatsApp + filtered payment options |
| 5 | Cash-only person | Maybe | ✓ Via cash type | No message, manual settle |
| 6 | The Ghost (never pays) | ✓ Phone | ~ Partial | Nudge + write-off option |
| 7 | Corporate expenser | ✓ Phone | ✗ V2 | Per-person receipt export |
| 8 | Recurring tab person | ✓ Phone | ✗ V2 | Tab mode — cumulative balance |
| 9 | The generous one | ✓ Phone | ✗ V2 | Treat mode — social IOU |

### Decision: Why QR for Type 3?
**Problem:** "I just met them" meant no contact info. Options explored: NFC tap, shared group QR, individual QR, forced manual entry.
**Decision:** Group QR code that anyone can scan to self-register.
**Rationale:** QR is universally understood, requires no hardware beyond a camera, and works across iOS/Android/any phone. It also creates a natural growth loop — every event is a potential onboarding moment for multiple new users.

---

## 4. What We Are NOT Building (MVP Scope Boundaries)

These were explicitly considered and deferred:

| Feature | Why Deferred |
|---|---|
| In-app payment processing (Stripe, Venmo API) | PCI compliance, KYC requirements, 6+ weeks of work. Payment UX without processing is sufficient for MVP validation. |
| WhatsApp Business API | Requires Meta approval (1-2 weeks), commercial license negotiation, approved message templates. Native share sheet achieves the same outcome without the overhead. |
| Splitwise integration | Requires commercial API license negotiation. Build standalone first, integrate from strength in v2. |
| Automatic payment detection (webhooks) | No payment rails in MVP means no webhooks. Manual marking is honest and simple for v1. |
| pgvector / memory graph | Valid v2 feature but premature complexity for MVP. Schema includes the table so data accumulates for backfill. |
| Corporate expense receipt export | Real use case (Type 7) but niche enough to defer without hurting core PMF. |
| Tab mode / treat mode | Types 8 and 9 are real but not the primary pain point being solved. |

---

## 5. Core Product Concept

### The Mental Model
LetsSplyt is not a bill-splitting calculator. It is a **bill-splitting messenger** — it calculates AND delivers, closing the loop from receipt to individual payment request in one flow.

### The User Experience in Plain English

**Step 1 — Someone pays the group bill.**
A group goes out for breakfast, lunch, dinner, or any shared event. One person covers the bill for everyone. Now it's time to split.

**Step 2 — Event creator sets up the group.**
The payer opens LetsSplyt, creates an event (e.g. "Dinner at Nobu"), and a QR code + shareable URL is generated instantly. They show the QR at the table or drop the link in the group chat.

**Organiser is always a member.** Creating the event automatically adds the payer to the member list (labelled **Organiser** in the app). They count toward the participant total but cannot be removed. Locking requires at least one other person besides the organiser — i.e. two rows in the member list (organiser + ≥1 guest or app member).

**Step 3 — Everyone scans or clicks to join. Two paths depending on whether they have the app:**

*Path A — Existing LetsSplyt member (app installed):*
- The QR/URL opens the LetsSplyt app directly.
- If they're already logged in → one tap to join, they're in immediately.
- If their session has expired → quick OTP verification → then they join.

*Path B — Non-member (no app):*
- The QR/URL opens in the phone's browser. No app download needed.
- They see: "[Payer name] invited you to [Event name]. Join the group."
- They enter First Name, Last Name, and Phone Number.
- An OTP is sent to verify the phone number is real and belongs to them.
- They enter the code and join the group. OTP also creates their LetsSplyt account — the name they entered in the browser is saved to `users.display_name`. If they install the app later, they sign in with the same number (no name re-entry) and see this event on their dashboard.
- They'll receive their payment request by SMS when the bill is split.

**Step 4 — Payer tracks who's joined (via Event Detail — joining view).**
After sharing the QR, the payer can navigate away freely. When they return — by going to the Events tab and tapping the event card — they see the **Event Detail (joining view)**:

- **QR code + copy/share link** at the top (while the token is still valid). A subtle expiry timer reminds the payer how long the link has left.
- **If the QR has expired**, the QR section is replaced with an amber "Expired" state and a single "Regenerate QR & link" button — generating a fresh token instantly.
- **Members list** below the QR, starting with the organiser (auto-added on create), then everyone who has joined via QR scan or manual add. Each row shows a join-method chip (e.g. Organiser, QR Web, Manual). The organiser row has no remove control.
- **"+ Add manually" button** below the members list. Opens `AddMembersSheet` (bottom sheet) with two tabs:
  - **Contacts** — multi-select from the device contact list (name + phone pre-filled, no OTP; payer vouches). Search filters the list.
  - **By name** — enter one or more people manually (name required, phone optional). **+ Add another person** adds rows. Tap **Done** to add everyone in one batch.
  - If the phone matches an existing LetsSplyt account, link by `user_id` immediately. If not, store in `guest_pii` for SMS only. Name-only members never receive a message; payer settles them in cash.

**Step 5 — Payer locks the event.**
When the payer is satisfied that everyone who needs to be in the event is in, they tap **Lock event →** from Event Detail. The lock button stays disabled until the member list has at least two people (organiser plus one other). This closes the join window — no new members can join and no one can leave. Locking is the explicit gate before splitting begins. (Payer can reopen for 24 hours if someone was missed.)

**Step 6 — Receipt scanning and split.**
Payer photographs the receipt. AI (A1) reads every line item. Payer assigns items to people via drag-and-drop or natural language ("Rohan had the pasta and two beers"). AI (A2) calculates each person's exact share including proportional tax and tip.

**Step 7 — Review and send.**
Payer previews what each person's message will look like, then taps "Send to all" — one action delivers to every participant simultaneously. AI (A3) generates personalised greeting text and country-appropriate payment deep links for each person. Each SMS includes a secret link (`/split/:token`) to a server-rendered breakdown page where the recipient's row is highlighted and the full group table (including organiser) is shown. Messages are sent as SMS/WhatsApp **text only** (no MMS) via Twilio, with in-app delivery tracking showing a green check per person as each message lands.

**Step 8 — Everyone gets their message.**
Each person receives a WhatsApp or SMS with the full group split table, their exact amount, and direct payment links (Venmo/PayPal/etc — US MVP uses US payment apps). App members also see outstanding balances on the **Home** dashboard (Members toggle).

**Step 9 — Settlement.**
People pay via their preferred app (Venmo, PayPal, etc.). Registered participants tap **I've paid** (per event in Event Detail, or **Settle all** on Member detail for every outstanding event with that payer). The creator confirms from **Event Detail** (per row) or **Member detail** (**Confirm all** / **Mark all paid** / **Dispute all**). **Home** routes to Members/Guests lists and detail screens; **Events** tab lists by Created/Joined. No separate Settlement tab.

### The Key Design Principles
- **Recipients never need an account.** They receive a self-contained message. Everything they need is in it.
- **Payer does the work once, not N times.** One scan, one split, one tap-through — not six separate WhatsApp messages written manually.
- **AI only where it earns its keep.** Agents handle receipt parsing (genuinely hard) and split calculation (tedious). Everything else is deterministic.
- **Loosely coupled services.** Every module is independently replaceable. Adding Stripe later = plug into the payment adapter, no other changes.

---

## 6. System Architecture

### Architecture Decision: Microservices Over Monolith
**Decision:** 7 loosely coupled services communicating over an event bus.
**Rationale:** A monolith is faster to build initially but creates tight coupling that makes every future addition (Stripe, Splitwise, new payment provider) expensive. With an event bus (Redis Pub/Sub in MVP, upgradeable to Kafka), adding a new feature = adding a new subscriber. Zero changes to existing services.

### The 7 Services

| Service | Responsibility | Why Separate |
|---|---|---|
| Auth Service | OTP, JWT, biometric | Security boundary — never mixed with business logic |
| Profile Service | User data, encrypted payment handles | PII isolation — encrypted column, decrypt only at message time |
| Event Service | Create/manage events, receipt items | Core domain — most frequently changed |
| Ledger Service | "Owed to me" + "I owe" aggregated views | Read-heavy, query patterns differ from write patterns |
| Settlement Service | State machine for payment confirmation | Complex state logic deserves its own boundary |
| Notification Service | Push notifications, nudge scheduler | Async by nature — shouldn't block main flows |
| Message Service | Image generation, deep links, share queue | Output channel logic — swap WhatsApp for Telegram without touching split logic |
| AI Orchestrator | A1, A2, A3 agents | AI calls are expensive and slow — isolate for rate limiting and retry logic |

### Event Bus Events

> **Implementation note (June 2026):** The event bus and 7-service model described here is the target architecture for when services are split into separate deployable units. For the MVP, all services run as TypeScript modules within a single Node.js Express process and communicate via direct function imports — no Redis Pub/Sub, no EventEmitter, no message broker. The event bus table above documents the intended message contracts for future reference. Do not implement pub/sub for MVP.

```
event.created          → Ledger Service (update "owed to me")
participant.added      → Notification Service (inbox + push: added_to_event for registered members)
payment.self_reported  → Notification Service (inbox + push to creator: member_paid; member auto-confirmed — no confirm push)
payment.confirmed      → Ledger Service (update both dashboards) — no push to member (MVP policy)
payment.disputed       → Notification Service (push to participant: disputed — future)
event.all_settled      → Notification Service (inbox + push to creator: event_fully_settled)
share.sent             → Notification Service (inbox + push to members: share_ready / share_edited)
```

### Tech Stack Summary

| Layer | Technology | Decision Rationale |
|---|---|---|
| Mobile | React Native + Expo + **TypeScript** | One codebase for iOS + Android. TypeScript enforces type safety across components, API calls, and data models — catching bugs at compile time before they reach users. Expo handles contacts, camera, share sheet without native config. |
| Backend | Node.js + Express + **TypeScript** | Fast REST + WebSocket. TypeScript on the backend means the same language and shared types across the full stack — a `Participant` type defined once is used by both mobile and backend. Compiled to JS at deploy time, no performance cost. |
| Database | PostgreSQL (Supabase) | Relational integrity for financial data. pgvector available for v2 memory. RLS for data security. |
| Cache / Queue | Upstash Redis | Serverless Redis — no idle cost. Job queue for nudge scheduler. |
| File Storage | Supabase Storage | Included in $25/mo plan. S3-compatible. Receipt images (private bucket). Split breakdown is server-rendered HTML — not stored in Storage on send. |
| Auth | Supabase Auth (Phone OTP) | Phone-native. No email friction. Handles JWT + refresh tokens. |
| AI (dev/staging) | Google Gemini 2.5 Flash | Free tier covers all development. ~$0.30/$1.50 per 1M tokens if paid. Fast, accurate for receipt parsing. |
| AI (production) | Anthropic Claude Haiku 4.5 | $1/$5 per 1M tokens. Chosen for lowest hallucination rate on financial documents — won't invent prices not on the bill. |
| Messaging | Twilio Verify + Programmable SMS | Verify handles OTP with WhatsApp/SMS auto-channel. A2P 10DLC for US SMS compliance. |
| Push Notifications | Expo Push (FCM + APNs) | Free. Expo wraps both platforms behind one API. |
| Hosting | Railway | $5/mo Hobby tier handles MVP. One-click deploy from GitHub. |

---

## 7. The 3 AI Agents

### Why Only 3 Agents (Not 5)?
Original design had 5 agents. Settlement Tracker (A4) and Memory Agent (A5) were cut from MVP.

**Settlement Tracker cut because:** No payment rails in MVP = no webhooks to track. Manual marking replaces it at zero engineering cost. Reintroduce in v2 with Stripe.

**Memory Agent cut because:** pgvector embeddings require a training dataset of real events. Can't build meaningful memory on zero data. Ship MVP, accumulate data, build memory in v2 from real usage patterns.

### Agent 1 — Receipt AI (A1)
**Trigger:** User photographs a bill.
**Input:** Base64-encoded receipt image.
**Process:** Vision AI with structured prompt — extract every line item, unit price, quantity, tax, tip, currency. Return strict JSON. Uses Gemini 2.5 Flash in dev/staging, Claude Haiku 4.5 in production.
**Output:** `{ items: [{name, price, qty}], tax, tip, total, currency }`
**Tools used:** Vision AI (Gemini dev / Claude Haiku prod), S3 upload, JSON validator, DB write (receipt_items).

**Why AI vision over dedicated OCR?**
Dedicated OCR (Tesseract, AWS Textract) extracts text but doesn't understand context — it can't distinguish "service charge" from a menu item, or handle a receipt where the total is in a different location. Gemini 2.5 Flash and Claude Haiku both understand the semantic structure of a bill. Gemini is used in dev for cost efficiency; Claude Haiku is used in production for its lower hallucination rate on financial data (benchmark: 94–97% accuracy on restaurant receipts).

**Design decision — scan is optional:**
Payer can skip the camera entirely and enter the total manually. Scan and split mode are independent choices. This ensures the app works even when AI parsing fails (bad lighting, unusual receipt format).

### Agent 2 — Smart Split (A2)
**Trigger:** Payer confirms item list + group is set.
**Input:** Items JSON from A1 + participant list + assignments (drag or NLP).
**Process:** Map items to participants, prorate tax/tip proportionally, resolve rounding.
**Output:** Per-person breakdown: `[{ name, phone, items[], amount_owed }]`
**Tools used:** AI NLP (Gemini dev / Claude Haiku prod, if text assignment), split calculator, tax/tip proration, DB write.

**Split modes — simplified flow:**
- **Receipt scanned path** → P15a shows two tiles: Itemised and Custom.
- **Manual total path** → skips P15a entirely, lands directly on the split entry screen.

The split entry screen (P16b) has four tabs:
1. **= Even** — auto-fills equal shares (total ÷ N), inputs locked. Pre-selected by default. Zero extra taps for the most common case.
2. **Itemised** (receipt path only) — assign items per person. For precise fairness.
3. **Custom split** — payer enters each person's share via three selectable input methods:
   - **$ Amount** — type exact dollar values; must sum to bill total.
   - **% Percent** — type percentages per person; must sum to 100%.
   - **⅟ Portion** — type relative portion weights (e.g. 2 = double share); app calculates dollar amounts proportionally. Useful when someone had "roughly twice as much" but exact amounts are unknown.
   
   All three methods share a live progress bar and allocated/remaining counter that enforces the sum invariant. The "Review split →" CTA remains locked until the constraint is exactly satisfied.

**Why NLP assignment?**
Drag-and-drop is natural on a phone. But after a long dinner, speaking "Rohan had the pasta and two beers" is faster than dragging 3 items onto an avatar. NLP is additive — not replacing the drag UI, enhancing it.

**Critical invariant:** Sum of all `amount_owed` values MUST equal event total ±$0.01. This is enforced in both code and evals. Financial data cannot have silent rounding errors.

### Agent 3 — Message Composer (A3)
**Trigger:** Payer taps "Send to all."
**Input:** Per-person breakdown + payer's payment handles (fetched from profile).
**Process:** For each participant — ensure a unique `breakdown_token` and build `https://{APP_DOMAIN}/split/{token}` URL, construct country-filtered payment deep links with their exact amount, assemble SMS body (greeting + amount + breakdown link + payment block), append conditional app nudge.
**Output:** Queue of N delivery-ready text packages (SMS body includes breakdown URL), dispatched via Twilio — no MMS `mediaUrl`.
**Tools used:** `breakdown-page.service.ts` (HTML breakdown at link), deep link builder, AI text (personalised greeting — Gemini dev / Claude Haiku prod), Twilio Programmable Messaging.

**Country-aware payment filtering:**
```
US (+1)     → Venmo, Zelle, Cash App, PayPal, Cash
Non-US      → PayPal, Wise, Cash only
```
**Why this matters:** Sending a Venmo link to a German phone number is worse than sending nothing — it's confusing and makes the app look broken. The filter is config-driven (one line per country) so expanding internationally requires zero code changes.

**Conditional app nudge:**
App download nudge appended only for non-registered participants, only at the bottom of the message, only after all payment links. Registered users never see it (they already have the app). Position matters — payment action must come before any download prompt.

**Manual nudge cooldown: 24 hours.** After a payer taps 'Nudge' for a participant, the button is disabled for 24 hours. The system-initiated T+48hr nudge (to the payer, reminding them to follow up) is separate and runs automatically via QStash.

---

## 8. Agent Communication Flow

Agents run in a **linear synchronous pipeline** per event. No message broker needed — output of each agent passes directly as input to the next.

```
USER: photographs receipt
    ↓
A1: Vision AI (Gemini 2.5 Flash in dev / Claude Haiku 4.5 in prod) → { items[], tax, tip, total, currency }
    ↓ (passes structured JSON)
A2: split calculation → { participants[{ name, phone, items[], amount_owed }] }
    ↓ (passes per-person breakdown + payer's payment handles from Profile Service)
A3: message composition → N message packages in share queue
    ↓
USER: taps "Send to all" once → Twilio delivers to all N participants simultaneously
```

**AI API call count per event:** Typically 2-3 calls (A1 vision + A2 NLP if used + A3 greeting text). At Gemini rates (dev): near-zero cost. At Haiku rates (production): approximately $0.004-0.006 per event.

---

## 9. Database Schema

### Design Decisions

**UUID as primary key, phone as unique index:**
Phone numbers change. If phone were the PK, a user changing their number would cascade across the entire schema. UUID is the stable identity. Phone is a lookup index. Changing a phone = update one row.

**E.164 normalisation at gateway:**
All phone numbers stored as E.164 (`+15550001234`). `libphonenumber` runs at the API layer before any DB operation. "555-000-1234", "5550001234", "+1 (555) 000-1234" all resolve to the same canonical form. Without this, the same person could appear as 3 different records.

**Nullable `user_id` on PARTICIPANTS:**
A participant may or may not be a registered user. `user_id = null` means **pure guest** — payer manual add when the phone is not registered (no OTP). `user_id = <uuid>` means registered user — OTP-verified web join, app join, or payer manual add when phone matches `users.phone_hash`. **OTP anywhere creates or resolves a `users` row**; legacy guest rows are upgraded to `user_id` on next OTP login. This nullable FK enables the dual dashboard.

**Display names for registered members:** `users.display_name` is the live profile name. `participants.display_name` is stored per event (join snapshot) but stays in sync when the user edits their profile; event APIs resolve the current profile name for any row with `user_id` set. Pure guests keep only the stored participant name.

**Encrypted payment handles:**
`handle_encrypted` column uses AES-256 encryption at rest. Decrypted only at message composition time, in memory, never logged. Payment identifiers are PII — treating them as such from day one avoids a security retrofit later.

**SETTLEMENT_LOG as audit trail:**
Every state transition (self_reported, confirmed, disputed, reset) is logged with actor_id and timestamp. This is the trust layer — if a dispute arises, both parties can see the full history of who did what and when.

### Core Tables

```
USERS
  id (uuid, PK) | phone_e164 (unique) | display_name | avatar_url | created_at

USER_PAYMENT_HANDLES
  id | user_id (FK) | provider (enum) | handle_encrypted (AES-256) | is_active | display_order

EVENTS
  id | payer_id (FK→users) | title | total_amount | currency | status (enum) | created_at

PARTICIPANTS
  id | event_id (FK) | user_id (nullable FK→users) | phone_e164 | display_name
  amount_owed | payment_status (state machine) | self_reported_at | confirmed_at

RECEIPT_ITEMS
  id | event_id (FK) | description | unit_price | quantity | s3_key

ITEM_ASSIGNMENTS
  id | item_id (FK) | participant_id (FK) | share_amount

SETTLEMENT_LOG
  id | participant_id (FK) | action (enum) | actor_id (FK→users) | note | created_at

NOTIFICATION_LOG
  id | user_id (FK) | event_id (FK) | type (enum) | sent_at | opened_at
```

---

## 10. Participant Payment State Machine

The payment status for each participant follows a strict state machine. This was designed to solve the trust problem: if a recipient can unilaterally mark themselves paid, the payer has no verification. If only the payer can mark paid, the recipient has no agency.

**Solution:** Two-party confirmation model.

```
PENDING → SELF_REPORTED (recipient taps "I paid")
PENDING → PAYER_MARKED (payer taps "mark paid" — for cash/manual)
SELF_REPORTED → CONFIRMED (payer confirms)
SELF_REPORTED → DISPUTED (payer rejects → resets to PENDING)
PAYER_MARKED → CONFIRMED (automatic)
CONFIRMED → SETTLED (automatic)
```

**DISPUTED → PENDING (not SELF_REPORTED).** When a payer disputes a self-report, the participant's status resets to PENDING — they must re-pay and re-submit a self-report from scratch. See 04-Data-Architecture.md for the authoritative state machine.

**Why this matters:** A "ghost" (someone who marks paid without actually paying) is caught at the SELF_REPORTED → CONFIRMED gate. The payer gets a push notification and must actively confirm. This creates social accountability without requiring payment verification infrastructure.

---

## 11. Key Product Decisions & Rationale

### QR Join Flow — Two Paths

The QR code and shareable URL serve two fundamentally different populations. The behaviour on scan/click must branch accordingly.

**Path A — Existing member (app installed):**
The operating system intercepts the URL via a universal link / app link and opens LetsSplyt directly to the event join screen. If the user is logged in, they see the event details (name, organiser, members already in) and join with one tap. If their session has expired, they do a quick OTP verification first, then join. No browser involved. No re-registration.

**Path B — Non-member (no app):**
The URL opens in the phone's default browser. The page shows an invitation card: who invited them, the event name, and how many members are already in. The user enters their First Name, Last Name, and Phone Number, then receives an OTP to verify the number is real and belongs to them. After verification they are registered as a LetsSplyt user and added to the event as a participant (`user_id` set). When the bill is split, they receive their payment request via SMS; if they install the app, they sign in with the same number and see past and current joined events on the dashboard.

**Why OTP is mandatory for Path B:**
The payer doesn't know these people personally. OTP guarantees the phone number is real and belongs to the person who scanned. This prevents someone entering a stranger's number and receiving payment requests on their behalf.

**Why OTP is a quick re-verify for Path A (expired session):**
Existing members registered their phone at account creation. Re-verify is a lightweight re-authentication step, not a re-registration. The phone lookup finds the existing account — no duplicate accounts created.

**Token expiry and regeneration:**
QR / URL token expires on payer lock OR 24-hour TTL, whichever comes first. When the token expires before the payer locks, the Event Detail (joining view) transitions: the QR/link section collapses and is replaced by an amber "QR code & invite link expired" banner with a single "Regenerate QR & link" button. Tapping issues a fresh 24-hour token and the new QR and link immediately appear at the top of Event Detail. Payer can also reopen the join window for 24 hours after locking to accommodate latecomers. Permanent tokens are a security risk — a screenshot shared days later could add unintended people to a closed event.

### Group Lock as a Hard Gate

**Decision:** Payer must explicitly lock the group before proceeding to the receipt and split flow. Locking is not automatic.

**What locking does:**
- Expires the join token immediately (regardless of 24-hour TTL).
- Prevents any new participants from joining via QR or URL.
- Prevents existing participants from leaving the group.
- Enables the "Scan receipt & split" action — this button is disabled until the group is locked.

**Rationale:** Starting the split before everyone is in creates a consistency problem — if someone joins after items are assigned, their share is undefined. The explicit lock step makes the group membership a deliberate, payer-confirmed state before any financial calculations begin. It also creates a clear social signal to the group: "We're starting now."

**Reopen:** After locking, payer can reopen the join window for 24 hours via "Reopen join window." This generates a fresh short-lived token for a specific latecomer. Once they join, payer locks again.

### OTP Verification — Registration Rule
**Decision:** OTP verification **anywhere** (web join, app Get Started) creates or resolves a `users` account. The **only** path without OTP is payer manual add (payer vouches) — those numbers stay pure guests (`guest_pii`) until the person later verifies via OTP.
**Rationale:** One verified phone = one identity. Web joiners who install the app later should not re-enter their name; their joined events and balances must appear on login. Manual add without OTP is the exception for people the payer knows personally.

### Twilio Server-Side Delivery Over Native Share Sheet
**Decision:** Use Twilio Programmable Messaging for all outbound messages. One "Send to all" tap delivers to every participant simultaneously.
**Rationale:** The payer doing the work once is LetsSplyt's core value proposition. Native share sheet requires N manual taps — one per recipient — which defeats the "one action, done" experience at any group size above 3–4 people. Twilio delivers to all recipients in one shot, with per-person delivery tracking shown in-app via green checks.

**Why not send from the payer's own phone number?**
iOS and Android both prevent apps from silently sending SMS or WhatsApp messages without per-message user confirmation — a deliberate OS security boundary that cannot be worked around. Own-phone sending is inherently N-tap. The "personal feel" concern is addressed by message content instead: the message body includes the payer's name, the recipient's specific items, and their exact amount — making the message feel personal regardless of the sending number.

**WhatsApp Business API deferred to V2:** Requires Meta approval (1–2 weeks) and approved message templates. Twilio Programmable SMS + WhatsApp channel (auto-route) achieves the same delivery with no approval process for MVP. V2 replaces Twilio's WhatsApp route with the official Business API for better deliverability and template support.

### Twilio Auto-Channel Over WhatsApp Detection
**Decision:** Use Twilio's auto-channel routing (WhatsApp first → SMS fallback) rather than detecting if a number is on WhatsApp.
**Rationale:** No official WhatsApp API exists to check if a number is registered. Third-party detection services violate WhatsApp ToS and risk account bans. Twilio Verify with `channel=auto` attempts WhatsApp delivery and falls back to SMS automatically — same outcome, fully compliant, no detection needed.

### Message Preview Carousel
**Decision:** Show payer a swipeable preview of each participant's message before sending.
**Rationale:** The payer is about to send financial messages to multiple people. A preview catches errors (wrong amount, wrong payment link) before they cause embarrassment or disputes. Particularly important for international participants (Mark) where payment options differ — payer should verify the message looks right before sending.

### Post-Send Edit with Selective Resend
**Decision:** Reuse the existing **Edit share** flow after messages are sent (Split entry → Review split → **Save and notify**). Only participants whose amounts changed receive a revision SMS ("Your share has been updated."). No separate edit modal or overflow action.
**Rationale:** Editing is sometimes necessary (AI misread an item, someone forgot to mention a dish). Selective resend avoids confusing unchanged participants. Edit is blocked when any participant has self-reported or confirmed payment; disputing a self-report (back to `pending`) re-opens edit if no other blockers remain.

### Payment Handles in Profile (Not at Send Time)
**Decision:** Store payment handles in user profile, fetch at A3 composition time.
**Rationale:** Requiring payer to enter Venmo/PayPal details for every event is friction. Storing once in profile means A3 fetches them automatically — zero extra steps at send time. Encrypted at rest (AES-256) because payment identifiers are sensitive PII.

---

## 12. MVP vs V2 vs V3 Roadmap

### MVP (Build Now — 0 to 3 months)
- Phone OTP auth + biometric login
- Profile with payment handles
- QR / URL group join — two paths: app deep link (existing members) + browser join (non-members, no install required)
- Event Detail (joining view) — live member list, QR + copy/share link, QR expiry with one-tap regeneration, "Add manually" picker (with phone vs. name only); group lock gate required before split can begin
- Receipt scanning (A1) + smart split (A2) + message composer (A3)
- Split entry screen with four tabs: = Even (default), Itemised (receipt path only), $ Amount, % Percent, ⅟ Portion — manual total path skips the split-mode chooser and lands directly on this screen
- Message preview carousel
- One-tap "Send to all" via Twilio Programmable Messaging (WhatsApp-first, SMS fallback) with in-app per-person delivery tracking
- Event Detail screen with inline settlement tracking (segmented progress bar, per-member confirm/dispute/nudge/cash actions)
- Home dashboard: net balance hero; **Members | Guests** toggle; Members shows net counterparty rows (People who owe you / People you owe); Guests shows outstanding pure guests who owe the creator (phone guests aggregated, name-only guests per-event)
- Member/Guest detail screens: **Settle all** bulk actions + per-event drill-down to Event Detail
- Events tab: **Active | Settled** toggle; under each, **Events you created** and **Events you joined**
- Post-send edit with selective resend
- US market MVP — USD only; US payment apps in messages
- Push notifications (self-report, nudge, confirmation)
- Cash-only participant type

### V2 (Post-PMF — 3 to 6 months)
- Splitwise optional integration (contact developers@splitwise.com now)
- Hybrid routing agent (A0) — Splitwise friends → API, others → WhatsApp/SMS
- Settlement tracker agent (A4) — Stripe webhook-based auto-detection
- Memory agent (A5) — pgvector, social graph, pre-fill recurring groups
- Shared table QR — collaborative real-time item claiming
- Tab mode for recurring split partners
- Corporate expense receipt export (per-person PDF)
- WhatsApp Business API (replace share sheet for payer-side automation)

### V3 (Scale — 6 to 12 months)
- Negotiate Splitwise commercial partnership from data leverage
- International payment rails (Wise, UPI, SEPA)
- Treat mode — social IOU system
- Running balance / tab settle
- Analytics dashboard for payer (total spent, total recovered, slow payers)
- Enterprise / team plan (company dinners, recurring team events)

---

*Document generated from product research session, May 2026. All decisions reflect deliberate tradeoffs made with full awareness of alternatives.*
