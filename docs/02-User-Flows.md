# LetsSplyt — Complete User Actions Document
**Version:** 1.3 | **Date:** June 2026 | **Total Actions:** 66
**Last updated:** Home dashboard — **Members | Guests** toggle, net counterparty balances, Member/Guest detail → Event Detail. Events tab — **Active | Settled** toggle with **Created / Joined** sections under each. US MVP, USD only. OTP = register; pure guests via manual add only.

---

## How to Read This Document

Each action has:
- An **ID** (P = Payer, R = Registered Participant, G = Guest, S = System)
- A **name** and **description**
- A **flow tag** (which part of the app it belongs to)
- A **priority tag** (Critical Path / MVP / V2)
- A **why** — the rationale for including it

Actions marked **Critical Path** are the minimum required for the app to be usable at all. Every other action is supporting or enhancing.

---

## Actor 1: Payer / Group Creator
*The person who paid the bill and is running the split. 36 actions.*

### Auth & Profile Setup

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P01 | Register with phone number | Enter phone → OTP via SMS → enter code → account created | Phone is the spine of the entire system — login, participant lookup, message delivery all pivot on it. OTP chosen over password because there's nothing to forget and nothing to phish. **Critical Path** |
| P02 | Log in (returning user) | Enter phone → OTP → JWT issued → optional biometric enrollment | Every session starts with OTP. JWT + refresh in SecureStore; optional biometric gates **refresh token** on unlock. **Critical Path** |
| P03 | Log in via biometric / device credential | After enrolling: cold start or idle lock (5 min) → Face ID / fingerprint / device PIN → session restored without new OTP. **Skip on opt-in (Option B):** refresh stays in plain SecureStore — cold start is silent; idle lock still applies. OTP only required again after logout or failed unlock (3 attempts). **MVP** |
| P04 | Add payment handles to profile | Enter Venmo username, PayPal.me URL, Cash App $tag, Zelle handle. Encrypted at rest. Set display order. | A3 fetches these automatically at message composition time. Storing once removes the biggest UX friction point — payer never has to re-enter payment details. AES-256 encryption because these are sensitive PII. **Critical Path** |
| P05 | Edit / remove a payment handle | Update or delete an existing handle | People change Venmo accounts, close PayPal, switch providers. Profile must stay current or payment links break. **MVP** |
| P06 | Edit display name or avatar | Profile → edit name inline → `PATCH /users/me`. Updates `users.display_name` and syncs all linked `participants` rows; event APIs resolve live profile name for registered members. | Participants see the payer's name in their message ("Pay Rohan via..."). Creators and other members also see **current** names in live member lists — not the name someone typed only at join time. **MVP** |

> **Mobile auth UX:** P01 and P02 are separate product actions but share one UI path — **Get Started** → phone → OTP. The app always calls `POST /auth/otp/request` with `context: 'register'`; returning users are detected via `account_exists` and skip the name field. See docs/08-Mobile-App-Specification.md (*Unified phone auth*).

### Event & Group Creation

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P07 | Create a new event | Enter event name, optional date. Generates a QR code and a shareable URL (e.g. letssplyt.app/join/abc123) with 24-hour TTL. Both QR and URL reach the same join flow. | The starting point of every split. Event name gives context in messages ("Dinner at Nobu, Sat"). QR shown at the table; URL dropped in group chat for people not present. **Critical Path** |
| P08 | Share QR / URL — Event Detail joining view | Fullscreen QR shown immediately after event creation. Payer shows it at the table or copies the link for a group chat. Two join paths on scan/click: (1) LetsSplyt app installed — app opens to join screen; (2) No app — browser opens with invitation card. After navigating away, payer returns by opening the Events tab and tapping the event card — this opens the **Event Detail (joining view)**: QR and copy/share link at top (while token is valid), amber "Expired" state with "Regenerate QR & link" button if token has lapsed, and a live member list below. | There is no separate waiting room screen. Event Detail serves both the joining phase and the settlement phase — the payer always knows where to go. Returning via Events tab builds consistent spatial memory. **Critical Path** |
| P09 | Add member manually — with phone number | From Event Detail (joining view) — "+ Add manually" — "With phone number". Two sub-options: (a) native contact picker — name and number pre-filled, no OTP required (payer vouches); or (b) manual entry with country code selector and libphonenumber validation. Server hashes phone and looks up `users.phone_hash`. **Registered:** participant linked via `user_id` — they see the event under **Events you joined** on next login (no OTP, no new account). **Unregistered:** `guest_pii` stores phone for SMS; no `users` row created until they verify via OTP elsewhere. Added member receives a text invite via Twilio when messages are sent (WhatsApp-first, SMS fallback). International numbers are auto-flagged for country-aware payment filtering at send time. | For people the payer knows or wants to explicitly invite. Contact picker is the fast path; manual entry covers anyone not in contacts. Payer vouching skips OTP at join time. Registered users get in-app visibility; guests stay SMS-only until they register. **MVP** |
| P10 | Add member manually — name only (no phone) | From Event Detail (joining view) — "+ Add manually" — "Name only — no phone". Enter a name only. No message is ever sent to this person. App shows them with a "Manual" badge in the member list. After the bill is split, payer tells them their share verbally and marks their payment on their behalf via the Cash action in Event Detail (settlement view). | For cash payers, guests without a phone, or anyone who refuses digital payment requests. Included in split calculation and breakdown page but excluded from all messaging. Payer takes full responsibility for this person's settlement actions. **MVP** |
| P11 | Remove participant | Before group lock — from Event Detail (joining view), remove someone who joined by mistake. | Wrong person scanned, duplicate entry, prank scan. Payer needs control over group membership before the split begins. **MVP** |
| P11b | Delete event (pre-send) | Payer only. **⋮** overflow menu (top right) → **Delete event** while `messages_sent_at` is null — open or locked, with or without receipt data. Destructive confirmation → `DELETE /events/:id` hard-deletes the event, participants, receipt images, and guest PII. Navigates back to Events list. Hidden after messages are sent (409 `EVENT_MESSAGES_ALREADY_SENT`). | Abandoned test events, wrong event created, or payer wants a clean slate before anyone receives payment requests. Same `messages_sent_at` gate as Reset expenses. **MVP** |
| P13a | Reopen join window | After locking, payer can reopen the QR join window for 24 hours for a latecomer. Generates a fresh short-lived token. Once the latecomer joins, payer locks again. | "Someone was in the bathroom when I showed the QR." Without reopen, that person must be added manually. Reopen is the graceful recovery path without abandoning the lock model. **MVP** |
| P14 | Lock group | Tap "Lock group" when all intended members are in. This: (1) expires the join token immediately, (2) prevents any new participants from joining, (3) prevents existing participants from leaving. The "Scan receipt & split" action is disabled until the group is locked — locking is the mandatory gate before any financial calculation begins. After lock, Event Detail footer shows **Scan receipt** and **Enter total** side by side (creator only) until a receipt or manual total is entered. | Splitting before the group is finalised creates undefined shares. The lock step makes membership a deliberate, confirmed state. It also signals clearly to the group that the split is starting. **Critical Path** |

### Receipt & Split

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P15 | Scan the receipt (optional) | Native document scanner (VisionKit / ML Kit) auto-detects receipt edges and crops → **preview screen** where payer confirms the scan looks correct → upload → A1 parses items. Optional — payer can skip and enter total manually. | Edge detection + confirm step reduces bad uploads before A1 runs. AI receipt parsing is the core value proposition. "Optional" because not every event has a physical receipt. **Critical Path** |
| P15a | Choose split mode (receipt path only) | After scanning receipt — two tiles: (1) Itemised → item review screen, (2) Custom → split entry screen (P16b). Manual-total path skips this screen and lands directly on P16b. | P15a only appears after a receipt scan, because Itemised is the only option that needs receipt data. Even split is now a tab inside P16b — no extra screen needed. **Critical Path** |
| P16b | Split entry screen | Four tabs: **= Even** (auto-fills equal shares, inputs locked — pre-selected by default), **$ Amount** (exact dollars, must sum to bill total), **% Percent** (must sum to 100%), **⅟ Portion** (relative weights, e.g. 2 = double share). Live progress bar + allocated/remaining counter enforce the sum invariant. "Review split →" CTA locked until constraint is satisfied. Manual-total path enters here directly (Even pre-selected). | Consolidating Even and Custom into one screen saves a tap in the most common case. All split methods live in one place — payer can switch tabs to compare approaches before committing. **Critical Path** |
| P16 | Review & correct parsed items | Edit misread item names, prices, quantities. Add missing items. Shown only in itemised mode. | AI is not perfect. Bad lighting, crumpled receipt, unusual format = parsing errors. Payer review before splitting prevents errors propagating to everyone's amounts. **Critical Path** |
| P17 | Enter total manually (no receipt) | Skip camera — type event total. Goes directly to split entry screen (P16b) with Even pre-selected. | Some events have no receipt (drinks at someone's house), or payer lost it, or prefers not to photograph. Manual entry is a necessary fallback. **MVP** |
| P18 | Assign items via drag-and-drop | Drag each line item onto participant avatars. Shared items split equally among selected. | Natural phone UI for itemised splitting. Spatial and tactile — faster than typing for most people. Shared item handling (drag to multiple) covers the "we split the nachos" case. **Critical Path** |
| P19 | Assign items via natural language | Type or speak "Rohan had the pasta and two beers" — A2 maps to line items. | After a long dinner, speaking is faster than dragging. NLP is additive — not replacing drag UI, enhancing it for users who prefer voice or text. **MVP** |
| P20 | Review final split breakdown | See per-person totals with proportional tax & tip. Edit any amount before sending. | Final checkpoint before money messages go out. Catching errors here prevents disputes and the embarrassment of sending a wrong amount to a friend. **Critical Path** |
| P20a | Edit split after messages already sent | Same **Edit share** footer as pre-send → Split entry → Review split → **Save and notify**. Only participants whose amounts changed get revision SMS. Edit blocked when any payment is self-reported, confirmed, or settled; dispute (back to pending) re-opens edit if nothing else blocks. **MVP** |

### Sending Messages

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P21 | Trigger message generation | Tap "Send to all" — A3 assembles SMS body (greeting, amount, `See full split:` breakdown link, country-filtered payment links). Payment handles auto-fetched from profile. Text-only Twilio send — no MMS. | The culmination of the entire split flow. A3 automates what would otherwise be N manual WhatsApp messages — each with a custom amount, personalised breakdown page, and correct payment links. **Critical Path** |
| P21a | Preview message before sending (optional) | All group members shown in a horizontal scrollable avatar row. Payer taps any avatar to preview that person's exact message — full SMS text, tappable breakdown link, amount, and payment links. "Send to all" button is always visible and accessible without opening any preview. Preview is optional — not a required step. | Payer may want to spot-check an international participant's options, or verify a large amount, without being forced to review every message. Making preview optional respects the payer's time while still giving them the tool to catch errors before they cause disputes. **Critical Path** |
| P22 | Send messages | Tap "Send to all" once. App delivers all messages simultaneously via Twilio Programmable Messaging (WhatsApp-first, SMS fallback). In-app progress screen shows a green check per person as each message lands. No per-message tap required. | One "Send to all" is the core UX promise — the payer does the work once, not N times. Own-phone sending (share sheet) would require N manual taps per recipient due to OS security restrictions, defeating this. Personalization comes from message content (payer's name, recipient's items, exact amount) not the sending number. **Critical Path** |
| P23 | Send nudge to pending participant | Tap "Nudge" from Event Detail (Events tab → tap event → member row with Pending status). Re-sends reminder message to that participant. Nudge timestamp logged — button grays out with "nudged Xm ago" until cooldown expires, preventing spam. | The ghost problem — someone read the message and didn't pay. Nudge is a soft social reminder. Timestamp logging prevents the payer from accidentally sending repeated nudges. **MVP** |

### Settlement & Tracking

Settlement actions run at **two levels:** (1) **Event Detail** — per-participant swipe actions (Paid / Dispute) and participant **I've paid**; (2) **Member detail** — **Pay all** / **I've paid all** (net settlement bulk API). Home lists counterparties and routes to detail screens; there is no separate Settlement tab.

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P24 | View event settlement status | Events tab → tap any event card you created → Event Detail screen. Status chip **Expenses Share** while `sent`; **All settled** when event `settled`/`archived`. Shows: event totals (bill / collected / outstanding), segmented progress bar (green = confirmed/paid, amber = disputed, grey = pending), and a per-member roster with status labels (**Paid by [method]**, **Pending**, **Disputed. Pending**, **Organiser**). | Settlement tracking belongs inside the event context, not on a separate screen. Creators think "I want to check Dinner at Nobu" — not "I want to open the settlement module." Event Detail keeps everything in one place. **MVP** |
| P25 | Participant self-reports payment | Registered participant taps **I've paid** (Event Detail or Member detail **I've paid all**) → payment method sheet → `POST .../self-report` or `self-report-all`. Backend immediately sets `payment_status=confirmed` (records `self_reported_at` + `self_reported_method`). Toast: **Payment recorded**. No separate payer confirm step in the happy path. | Self-report is trusted for registered app users; payer can still **Dispute** if payment never arrived. **MVP** |
| P26 | Dispute a payment | From Event Detail — swipe **left** on a registered member row (`user_id` set) with paid status → **Dispute** → `payment_status=disputed` (not back to `pending`). Guest rows (`user_id` null) show **Paid** swipe only — no Dispute. Participant notified. | Someone marked paid without actually paying. Dispute flags the row for follow-up; participant can self-report again from `disputed`. **MVP** |
| P27 | Manually mark a participant as paid | From Event Detail — swipe **right** on Pending or Disputed rows → **Paid** → payer marks cash/external (`POST .../settlement/cash/:participantId`). Status becomes confirmed with method recorded. Inline Nudge / Cash chips removed from roster cards; **Nudge** remains on Member detail when rows are pending. | Cash payments and Zelle transfers leave no in-app trace. Swipe actions reduce accidental taps vs inline chips. **MVP** |
| P28 | View event history | **Events** tab: **Active | Settled** toggle at top; under each toggle, two sections — **Events you created** and **Events you joined**. **Settled** for creators = event `settled`/`archived`; for participants also when viewer's `payment_status` is complete (`confirmed`, `payer_marked`, `settled`, `opted_out`). Status chips: creator **Expenses Share** / **All settled**; participant **Settled** when paid. Tap card → Event Detail. Tapping Events tab resets stack to list. Tapping Dashboard tab resets Home stack to list. | Browse by lifecycle (active vs settled) and role (creator vs participant). **MVP** |

### Dashboard Views (Home tab)

Home is the **financial overview**. Settlement actions execute in **Event Detail** (per event) or **Member/Guest detail** (**Settle all** for that person). Home routes to the right counterparty or event.

**Layout:** Net balance hero (unchanged) → **Members | Guests** toggle → list(s) → FAB **＋ New event**.

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P29 | View Home — net balance hero | Top card: net USD balance (green / red / grey). Calls `GET /users/me/balance`. **Owed to you** sums all outstanding on events the user created — registered members **and** pure guests (not just the Members toggle). **You owe** sums registered counterparties only. Same card for all users. | One number for total exposure across all events without splitting the hero by toggle. **MVP** |
| P30 | Home — Members toggle | **People who owe you** (net **> 0** per registered user) and **People you owe** (net **< 0**). One row per person; row shows **name + net amount only**. Net = Σ(they owe you) − Σ(you owe them) across events with a direct payer↔participant link. **Net = 0** → hidden. Tap row → **Member detail** (P32). | Registered counterparties in one place without opening every event. Net aggregation avoids duplicate rows when you and Alex owe each other on different dinners. **MVP** |
| P31 | Home — Guests toggle | Lists **pure guests** (`user_id` null) who **still owe the logged-in user** on events they created. Settled guests hidden. **With phone:** aggregate by `phone_hash` → one row, total outstanding. **Name only:** one row per participant (names may repeat). Row shows name + amount. Tap **phone guest** → Guest detail (P33). Tap **name-only guest** → **Event Detail directly** (single event). Guests never appear in "you owe". | Creators need to see SMS-only guests who haven't paid. Phone aggregation matches how guests are identified in `guest_pii`. Name-only guests skip detail screen — only one event. **MVP** |
| P32 | Member detail screen | Header: counterparty name + net amount. **Nudge** when they owe you on pending rows. When you owe: **Pay all** (handles sheet) + **I've paid all** (`POST /settlement/member/:userId/self-report-all` — net settlement alias). **Outstanding** events listed first; **"See more events"** expands history. Tap event → Event Detail (Events stack). Per-event dispute/confirm happen on Event Detail swipe actions — not bulk CTAs here. | One-tap clears net balance with a registered member; event-level swipe actions for payer verification. **MVP** |
| P33 | Guest detail screen (phone guests) | Payer-only. **Nudge** when pending. Bulk **Mark all paid** via API where implemented; per-row **Paid** swipe on Event Detail. Tap event → Event Detail. Name-only guests skip this screen (P31). | Multi-event phone guests; dispute/confirm at event level. **MVP** |
| P34 | Delete account & data | GDPR right to erasure. Removes user, anonymises participant history, deletes payment handles. | Legally required. **Legally Required** |

---

## Actor 2: Registered Participant
*Has a LetsSplyt account — joined via app deep link, or added by payer. 10 actions.*

### Joining

The join flow splits into two distinct paths based on whether the person has LetsSplyt installed.

**Path A — App installed (existing member):**

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| R01 | Open event via deep link — logged in | QR scan or URL click → OS intercepts via universal/app link → LetsSplyt opens to event join screen showing event name, organiser, and members already in. User is already authenticated → taps "Join now" → added to group immediately. | Zero friction for an existing logged-in member. The app intercepts the URL so there's no browser step at all. One tap is the entire flow. **Critical Path** |
| R01a | Open event via deep link — session expired | QR scan or URL click → app opens → session expired prompt → user enters phone → OTP sent → verified → lands on join screen → taps "Join now." | Session expiry is a security feature, not a bug. The re-verify step is lightweight (user already registered) and keeps the join experience inside the app without re-collecting any data. **Critical Path** |
| R03 | System detects duplicate on QR join | If a non-member attempts the browser join flow (Path B) with a phone number that already has an account → system detects match → shows "You already have LetsSplyt — open the app to join" prompt instead of creating a duplicate. | Phone is the unique identity key. Allowing two records for the same phone corrupts the ledger. Detection at join time keeps the DB clean. **MVP** |

**Path B — No app (browser join):** See Actor 3 — Non-Member Guest (QR Browser), actions G01–G04.

### Receiving & Paying

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| R04 | Receive split message | Gets image (their row highlighted) + payment deep links + soft app download nudge at bottom (suppressed if already registered). | The core recipient experience. Highlighted row removes the need to scan a table looking for their name. Pre-filled payment links remove calculation friction. Nudge only for non-registered — registered users already have the app. **Critical Path** |
| R04a | Receive revised split message | If payer edits after sending — receives "your revised share is $X (was $Y)" only if their amount changed. Same channel as original. | Transparency is trust. Silent amount changes destroy trust. Explicit revision message with old vs new amount makes the correction clear and professional. **MVP** |
| R05 | Tap payment deep link | Venmo/PayPal/Cash App opens with handle + amount pre-filled. Pays externally. | The moment of payment. Deep links pre-fill both the recipient (payer's handle) and amount — two fewer steps vs opening the app and entering manually. **Critical Path** |
| R06 | Self-report payment in app | After paying externally → Home **Members** → Member detail → **I've paid all** **or** Event Detail → **I've paid** → payment method. `POST self-report` sets `confirmed` immediately. Payer can **Dispute** from Event Detail if payment not received. | Participant clears net balance in one tap; payer dispute path preserved. **MVP** |
| R07 | View Home (participant) | Same Home as payer: net hero + **Members** toggle. Participant sees net **< 0** rows under **People you owe**; net **> 0** under **People who owe you** if they also created events. **Guests** toggle only relevant when user is a creator with outstanding guest debtors. | One Home screen for all roles; data reflects both creator and participant obligations. **MVP** |
| R08 | View event detail (participant) | **Events you joined** → tap card → participant Event Detail (share hero, split breakdown, roster). Or Home → Member detail → tap event. | Transparency on what they owe and event context. **MVP** |

### Account

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| R09 | Add own payment handles to profile | Set up Venmo/PayPal/etc for when they become a payer in a future event. | Registered participants will eventually pay for a group themselves. Handles set up once → ready to use immediately when they create their first event. **MVP** |
| R09a | Edit display name in profile | Profile → edit name inline → same `PATCH /users/me` sync as P06. Name shown to event creators and other members updates everywhere (member list, Realtime). | Join name (e.g. nickname at QR scan) may differ from preferred profile name later; creators must not be stuck seeing an outdated label. **MVP** |
| R10 | Opt out / delete account | Reply STOP to message (stops future messages) OR delete account in app. | Legally required. Someone added to a split without their prior consent (manually added by payer) must have an easy opt-out path. STOP keyword is the messaging industry standard. **Legally Required** |

---

## Actor 3: Non-Member Guest
*No LetsSplyt account. Two sub-types: (A) joined via QR/URL in browser, (B) added manually by payer.*

### Sub-type A: QR Browser Guest
*Scanned the QR or clicked the URL, no app installed. Joined entirely in browser.*

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| G01 | Open invite in browser | QR scan or URL click → phone browser opens invite page showing: who invited them, event name, member count. Single CTA: "Join the group." No app download prompt at this stage — joining in browser is the primary path, not a fallback. | Non-members have no reason to install an app before they've experienced any value. Browser join removes install friction; OTP on G03 still registers their identity so the app works seamlessly later. **Critical Path** |
| G02 | Enter name and phone | Browser form: Your name, Phone Number (with country selector). Submit → OTP sent to that number. Name is carried through the OTP page as a hidden field. | Name identifies them in the group, on the split, and in `users.display_name` after OTP. Phone is the delivery address for their payment request. Country selector ensures correct E.164 formatting and appropriate payment options later. **Critical Path** |
| G03 | Verify OTP in browser | 6-digit code sent to their phone via SMS → enter in browser → verified → **LetsSplyt account created** (if new) and added to event as participant with `user_id` set. Browser `display_name` saved to `users.display_name` and `participants.display_name`. | OTP proves the phone is real and registers identity — same rule as app sign-up. Installing the app later uses the same number without re-entering name; joined events appear on dashboard. Placeholder profiles (`LetsSplyt User`) are replaced with the browser-entered name. **Critical Path** |
| G04 | Joined confirmation in browser | After OTP: browser shows confirmation — event name, organiser, group members, and a simple explanation of what happens next ("Pawan scans receipt → AI splits → you get a text with your amount"). Soft nudge to download LetsSplyt at the bottom. No separate "waiting" screen — the joined confirmation is the final browser state. Guest is done until they receive the SMS. | Sets expectations so the guest isn't confused when a payment SMS arrives later. Nudge is optional and below all other content — never the primary message. **MVP** |
| G05 | Receive payment request via SMS | When payer sends messages — guest receives SMS with amount owed, a `See full split:` link to a hosted breakdown page (their row highlighted, full group table including organiser), country-filtered payment links, and opt-out line. Text-only — no MMS attachment. | The moment their participation materialises financially. Everything they need is in this one message — no app, no login, no lookup. **Critical Path** |
| G05a | Receive revised payment request | "[Payer] made a correction — your revised share is $X (was $Y)" sent only if their amount changed. | Silent amount changes destroy trust. Explicit revision message with before/after makes the correction transparent. **MVP** |
| G06 | Tap payment link | SMS payment link opens Venmo / PayPal / Wise / Cash App (country-filtered) with handle + amount pre-filled. Guest pays externally. | The moment of payment. Pre-filled links remove friction — no need to type an amount or look up a handle. **Critical Path** |
| G07 | Opt out of messages | Reply STOP to any SMS → flagged opted-out in DB → no further messages sent to that number ever. | Legally required. Guest gave their number to join a specific event. STOP is the only consent revocation mechanism available to them. Must be honoured immediately and permanently. **Legally Required** |

### Sub-type B: Manually Added (with phone)
*Added directly by payer (from contacts or by typing a number) — payer vouches for them. No OTP required on join.*

**Two backend outcomes (same payer UI — no OTP):**
- **Phone matches existing LetsSplyt user** → `participants.user_id` set immediately.
- **Phone not registered** → `guest_pii` only (`user_id=null`). Pure guest until they verify via OTP (web join or app) — then account is created and guest rows are linked.

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| G08 | Receive payment request via SMS/WhatsApp | Same message as G05 — breakdown link + payment links + amount + opt-out line. Delivery channel is WhatsApp-first (Twilio auto-route) for manually-added guests since payer likely knows them. Registered users may also see the request in-app. | Payer vouched for them, so no OTP was needed at join time. Message delivery is identical to QR browser guests for unregistered numbers. **MVP** |
| G09 | Tap payment link | Same as G06. | Same rationale. **Critical Path** |
| G10 | Opt out of messages | Same as G07 — reply STOP. | Same legal obligation. **Legally Required** |

---

## Actor 4: System / AI Agents
*Automated actions triggered by user events. 13 actions.*

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| S01 | A1 — Parse receipt via vision | Vision AI (Gemini 2.5 Flash in dev/staging, Claude Haiku 4.5 in production) extracts line items, prices, tax, tip, currency. Returns structured JSON. | Core AI value. Deterministic OCR can't distinguish a service charge from a menu item. AI understands bill semantics. ~94–97% accuracy on quality restaurant receipts. |
| S02 | A2 — Calculate smart split | Applies assignments (drag or NLP), prorates tax & tip proportionally, handles shared items, enforces sum invariant. | Mathematical correctness with semantic intelligence. "Proportional" tax/tip (not equal share) is what most people consider "fair." The sum invariant (all shares = total) is non-negotiable for financial data. |
| S03 | A3 — Compose personalised messages | Assembles SMS body: AI greeting, formatted amount, per-participant breakdown URL (`/split/:token`), country-filtered payment deep links, conditional app nudge. Payment handles fetched from payer profile. Breakdown page highlights recipient's row server-side. | N manual WhatsApp messages → one automated composition flow. Personalisation (highlighted row on breakdown page, pre-filled amount) makes each message feel intentional rather than mass-broadcast. |
| S04 | Auto-route delivery channel | US (+1) → SMS first. Non-US → WhatsApp first via Twilio auto-channel, SMS fallback if WhatsApp fails. No third-party WhatsApp detection — Twilio handles it natively. | Different countries have different messaging norms. Germany = high WhatsApp. US = SMS still dominant. Twilio auto-channel achieves optimal delivery without needing to detect WhatsApp status (which violates ToS). |
| S05 | Auto-filter payment options by country | US → all options. Non-US → PayPal + Wise + Cash only. Config-driven — new country = one config line change. | Sending Venmo to a German number is worse than sending nothing — it's a broken link. Country filtering is a trust and usability decision, not just a UX nicety. |
| S06 | Expire QR join token | Expires on payer lock OR 24-hour TTL, whichever comes first. Payer can reopen for 24 hours manually. | Permanent QR = security risk (screenshot could add strangers days later). TTL = closes the window. Reopen = graceful latecomer handling. Three scenarios, one mechanism. |
| S07 | Push + inbox — member paid | Member self-reports → auto `confirmed` → inbox + push to creator (`member_paid`). No "tap to confirm" push to creator. | Member self-report auto-settles; creator notified for awareness; dispute remains on Event Detail. |
| S07a | In-app notification center | Bell on Dashboard/Events; badge = unread in 30-day window; tap row marks read and opens event when `event_id` set. | Registered users see history without relying on OS notification tray alone. |
| S08 | Push — nudge to member | Organizer nudge → inbox + push to participant (`nudge`). | Polite reminder with amount; payer-initiated only. |
| S09 | Auto-detect existing user on QR join | Phone number submitted → DB lookup → if match found, skip registration, link existing account, send "welcome back" OTP. | Prevents duplicate accounts. UUID is stable identity — linking to existing account preserves history. "Welcome back" OTP confirms identity without re-collecting data. |
| S09a | Auto-link registered user on manual add | Payer adds member with phone → `hashPhone()` → lookup `users.phone_hash`. If match: insert participant with `user_id` (no `guest_pii`, no OTP). If no match: `guest_pii` for SMS only (pure guest until OTP elsewhere). | Registered friends added from contacts appear on their dashboard without scanning QR. Unregistered numbers stay pure guests until web join or app OTP. **MVP** |
| S12 | OTP registers identity | Any OTP verify path (web join G03, app P01/P02) calls `resolveUserAfterOtp` → `users` row + `upgradeGuestParticipantsToUser`. Participant rows get `user_id`. | One verified phone = one identity. Web joiners who install the app later see past events without re-entering name. **MVP** |
| S10 | Compute split diff on edit | Post-send: payer uses **Edit share** → Review split → **Save and notify** (`split/confirm` + `splits/resend`). Only participants with changed amounts (`revision_count > 0`) get revision SMS. Edit blocked when any participant is `self_reported`, `confirmed`, or `settled`; `disputed` does **not** block edit. | Surgical resend avoids confusing unchanged participants. Locking during active confirmed payments. |
| S11 | Push + inbox — share edited | Post-send revision → inbox + push to affected members (`share_edited`). | In-app + push when share changes after send. |

---

## Critical Path Summary

The minimum viable sequence for the app to work end-to-end:

**Payer side:** P01 → P04 → P07 → P08 (QR + Event Detail joining view) → [optional: P09/P10 manual add] → P14 (lock group) → P15 → **Scanned:** P15a → **Itemised:** P16 → P18 → P16b → P20 | **Custom/Even:** P16b → P20 || **Manual total:** P17 → P16b (Even pre-selected) → P20 → P21 → P21a → P22 → [Home P30/P31 or Events P28] → P24 (Event Detail settlement) → P25 (confirm payment)

**Existing member joining (app):** R01 → [in-app join screen] → R04 → R05 → R06 (self-report after paying)

**Non-member joining (browser):** G01 → G02 → G03 → G04 → [receive SMS] → G05 → G06

**Note on P14:** The "Lock group" action is the hard gate between group formation and split calculation. No split can begin until the payer explicitly locks. This is enforced in the UI (Scan receipt button disabled) and in the API (split endpoints check group lock status).

**Note on P24–P27 / P32–P33:** No separate Settlement tab. Home lists counterparties; Member/Guest detail offers **Settle all** bulk actions; Event Detail offers per-participant actions. Events tab lists by Created/Joined.

Everything else is recovery paths, edge cases, or quality-of-life improvements.

---

*~70 total actions (revised). 4 actor types. 3 legally required. ~15 critical path.*
