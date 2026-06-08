# LetsSplyt — Complete User Actions Document
**Version:** 1.2 | **Date:** May 2026 | **Total Actions:** 61
**Last updated:** Waiting room removed. Event Detail now serves two phases: (1) joining phase — live QR, member list, manual add picker; (2) settlement phase — progress bar, confirm/dispute/nudge/cash. Manual add consolidated from 4 separate waiting-room actions into a two-choice flow (with phone vs. name only) accessible from Event Detail.

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
| P02 | Log in (returning user) | Enter phone → OTP → JWT issued → biometric registered for future logins | Every session starts here. JWT with refresh token rotation keeps sessions secure without constant re-authentication. **Critical Path** |
| P03 | Log in via biometric | Face ID / fingerprint opens app after first login — no OTP re-entry | OTP every time = friction. After first verification, device biometrics provide equivalent security (you have the device + your face/finger) with zero user effort. **MVP** |
| P04 | Add payment handles to profile | Enter Venmo username, PayPal.me URL, Cash App $tag, Zelle handle. Encrypted at rest. Set display order. | A3 fetches these automatically at message composition time. Storing once removes the biggest UX friction point — payer never has to re-enter payment details. AES-256 encryption because these are sensitive PII. **Critical Path** |
| P05 | Edit / remove a payment handle | Update or delete an existing handle | People change Venmo accounts, close PayPal, switch providers. Profile must stay current or payment links break. **MVP** |
| P06 | Edit display name or avatar | Update name shown to participants on split messages | Participants see the payer's name in their message ("Pay Rohan via..."). Must be correct and recognisable. **MVP** |

> **Mobile auth UX:** P01 and P02 are separate product actions but share one UI path — **Get Started** → phone → OTP. The app always calls `POST /auth/otp/request` with `context: 'register'`; returning users are detected via `account_exists` and skip the name field. See docs/08-Mobile-App-Specification.md (*Unified phone auth*).

### Event & Group Creation

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P07 | Create a new event | Enter event name, optional date. Generates a QR code and a shareable URL (e.g. letssplyt.app/join/abc123) with 24-hour TTL. Both QR and URL reach the same join flow. | The starting point of every split. Event name gives context in messages ("Dinner at Nobu, Sat"). QR shown at the table; URL dropped in group chat for people not present. **Critical Path** |
| P08 | Share QR / URL — Event Detail joining view | Fullscreen QR shown immediately after event creation. Payer shows it at the table or copies the link for a group chat. Two join paths on scan/click: (1) LetsSplyt app installed — app opens to join screen; (2) No app — browser opens with invitation card. After navigating away, payer returns by opening the Events tab and tapping the event card — this opens the **Event Detail (joining view)**: QR and copy/share link at top (while token is valid), amber "Expired" state with "Regenerate QR & link" button if token has lapsed, and a live member list below. | There is no separate waiting room screen. Event Detail serves both the joining phase and the settlement phase — the payer always knows where to go. Returning via Events tab builds consistent spatial memory. **Critical Path** |
| P09 | Add member manually — with phone number | From Event Detail (joining view) — "+ Add manually" — "With phone number". Two sub-options: (a) native contact picker — name and number pre-filled, no OTP required (payer vouches); or (b) manual entry with country code selector and libphonenumber validation. Added member receives a text invite via Twilio (WhatsApp-first, SMS fallback). International numbers are auto-flagged for country-aware payment filtering at send time. | For people the payer knows or wants to explicitly invite. Contact picker is the fast path; manual entry covers anyone not in contacts. Payer vouching skips OTP. Country-aware routing handles international guests automatically. **MVP** |
| P10 | Add member manually — name only (no phone) | From Event Detail (joining view) — "+ Add manually" — "Name only — no phone". Enter a name only. No message is ever sent to this person. App shows them with a "Manual" badge in the member list. After the bill is split, payer tells them their share verbally and marks their payment on their behalf via the Cash action in Event Detail (settlement view). | For cash payers, guests without a phone, or anyone who refuses digital payment requests. Included in split calculation and split image but excluded from all messaging. Payer takes full responsibility for this person's settlement actions. **MVP** |
| P11 | Remove participant | Before group lock — from Event Detail (joining view), remove someone who joined by mistake. | Wrong person scanned, duplicate entry, prank scan. Payer needs control over group membership before the split begins. **MVP** |
| P13a | Reopen join window | After locking, payer can reopen the QR join window for 1 hour for a latecomer. Generates a fresh short-lived token. Once the latecomer joins, payer locks again. | "Someone was in the bathroom when I showed the QR." Without reopen, that person must be added manually. Reopen is the graceful recovery path without abandoning the lock model. **MVP** |
| P14 | Lock group | Tap "Lock group" when all intended members are in. This: (1) expires the join token immediately, (2) prevents any new participants from joining, (3) prevents existing participants from leaving. The "Scan receipt & split" action is disabled until the group is locked — locking is the mandatory gate before any financial calculation begins. | Splitting before the group is finalised creates undefined shares. The lock step makes membership a deliberate, confirmed state. It also signals clearly to the group that the split is starting. **Critical Path** |

### Receipt & Split

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P15 | Photograph the receipt (optional) | Camera → capture → A1 parses items. Optional — payer can skip and enter total manually. | AI receipt parsing is the core value proposition. "Optional" because not every event has a physical receipt, and AI can fail on bad images. Scan and split mode are independent decisions. **Critical Path** |
| P15a | Choose split mode (receipt path only) | After scanning receipt — two tiles: (1) Itemised → item review screen, (2) Custom → split entry screen (P16b). Manual-total path skips this screen and lands directly on P16b. | P15a only appears after a receipt scan, because Itemised is the only option that needs receipt data. Even split is now a tab inside P16b — no extra screen needed. **Critical Path** |
| P16b | Split entry screen | Four tabs: **= Even** (auto-fills equal shares, inputs locked — pre-selected by default), **$ Amount** (exact dollars, must sum to bill total), **% Percent** (must sum to 100%), **⅟ Portion** (relative weights, e.g. 2 = double share). Live progress bar + allocated/remaining counter enforce the sum invariant. "Review split →" CTA locked until constraint is satisfied. Manual-total path enters here directly (Even pre-selected). | Consolidating Even and Custom into one screen saves a tap in the most common case. All split methods live in one place — payer can switch tabs to compare approaches before committing. **Critical Path** |
| P16 | Review & correct parsed items | Edit misread item names, prices, quantities. Add missing items. Shown only in itemised mode. | AI is not perfect. Bad lighting, crumpled receipt, unusual format = parsing errors. Payer review before splitting prevents errors propagating to everyone's amounts. **Critical Path** |
| P17 | Enter total manually (no receipt) | Skip camera — type event total. Goes directly to split entry screen (P16b) with Even pre-selected. | Some events have no receipt (drinks at someone's house), or payer lost it, or prefers not to photograph. Manual entry is a necessary fallback. **MVP** |
| P18 | Assign items via drag-and-drop | Drag each line item onto participant avatars. Shared items split equally among selected. | Natural phone UI for itemised splitting. Spatial and tactile — faster than typing for most people. Shared item handling (drag to multiple) covers the "we split the nachos" case. **Critical Path** |
| P19 | Assign items via natural language | Type or speak "Rohan had the pasta and two beers" — A2 maps to line items. | After a long dinner, speaking is faster than dragging. NLP is additive — not replacing drag UI, enhancing it for users who prefer voice or text. **MVP** |
| P20 | Review final split breakdown | See per-person totals with proportional tax & tip. Edit any amount before sending. | Final checkpoint before money messages go out. Catching errors here prevents disputes and the embarrassment of sending a wrong amount to a friend. **Critical Path** |
| P20a | Edit split after messages already sent | Payer corrects an error post-send. App warns if any payments already made. Only affected participants get revised message. | Receipts get misread. Dishes get forgotten. Silent errors = trust violations. Active correction with selective notification = integrity. Edit blocked after confirmed payments without explicit warning. **MVP** |

### Sending Messages

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P21 | Trigger message generation | Tap "Send to all" — A3 generates split image + country-filtered payment links per participant. Payment handles auto-fetched from profile. | The culmination of the entire split flow. A3 automates what would otherwise be N manual WhatsApp messages — each with a custom amount, highlighted row, and correct payment links. **Critical Path** |
| P21a | Preview message before sending (optional) | All group members shown in a horizontal scrollable avatar row. Payer taps any avatar to preview that person's exact message — highlighted split image, amount, and payment links. "Send to all" button is always visible and accessible without opening any preview. Preview is optional — not a required step. | Payer may want to spot-check an international participant's options, or verify a large amount, without being forced to review every message. Making preview optional respects the payer's time while still giving them the tool to catch errors before they cause disputes. **Critical Path** |
| P22 | Send messages | Tap "Send to all" once. App delivers all messages simultaneously via Twilio Programmable Messaging (WhatsApp-first, SMS fallback). In-app progress screen shows a green check per person as each message lands. No per-message tap required. | One "Send to all" is the core UX promise — the payer does the work once, not N times. Own-phone sending (share sheet) would require N manual taps per recipient due to OS security restrictions, defeating this. Personalization comes from message content (payer's name, recipient's items, exact amount) not the sending number. **Critical Path** |
| P23 | Send nudge to pending participant | Tap "Nudge" from Event Detail (Events tab → tap event → member row with Pending status). Re-sends reminder message to that participant. Nudge timestamp logged — button grays out with "nudged Xm ago" until cooldown expires, preventing spam. | The ghost problem — someone read the message and didn't pay. Nudge is a soft social reminder. Timestamp logging prevents the payer from accidentally sending repeated nudges. **MVP** |

### Settlement & Tracking

Settlement tracking lives entirely inside **Event Detail** — there is no separate settlement dashboard. Payer navigates: Events tab → tap event card → Event Detail.

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P24 | View event settlement status | Events tab → tap any event card you created → Event Detail screen. Shows: event totals (bill / collected / outstanding), segmented progress bar (green = confirmed, amber = self-reported, grey = pending), and a per-member roster with status chips and inline actions. | Settlement tracking belongs inside the event context, not on a separate screen. Creators think "I want to check Dinner at Nobu" — not "I want to open the settlement module." Event Detail keeps everything in one place. **MVP** |
| P25 | Confirm a self-reported payment | From Event Detail — member row with "🕐 Self-reported" status shows a "✓ Confirm payment" button. Tap → Confirm Payment screen shows amount, method, and timestamp. Payer taps "Confirm — Mark as settled" → member row turns green, progress bar updates, participant notified. | Two-party confirmation model. Recipient self-reports from their side; payer verifies from theirs. Prevents unilateral "mark myself paid" abuse while giving recipients agency. **MVP** |
| P26 | Dispute a self-reported payment | From Event Detail — member row with "🕐 Self-reported" status also shows "✕ Dispute" button. Tap → status resets to Pending → participant notified. | Someone marked paid without actually paying. Dispute resets the status and notifies the participant. The audit trail (SETTLEMENT_LOG) captures the full history for both parties. **MVP** |
| P27 | Manually mark a participant as paid (Cash) | From Event Detail — each Pending member row shows a "💵 Cash" button alongside "⏰ Nudge". Payer taps Cash → confirmation sheet (amount, member name, method) → confirms → status changes to Paid immediately. Available for all pending participants, not just cash-only ones. | Cash payments and Zelle transfers leave no in-app trace. "Cash" button is surfaced directly on the Event Detail member row next to Nudge. Confirmation sheet prevents accidental taps on a financial action. **MVP** |
| P28 | View event history | Events tab shows all events (Active and Settled). Settled events appear at the bottom with a green ✓. Tap any event for the full per-member settlement breakdown. | Reference for disputes, tax purposes, personal finance tracking. "Did Rohan ever pay me back from the concert?" — tap the settled event and the full log is there. **MVP** |

### Dashboard Views

The app has a single home dashboard that is **persona-aware** — the same screen renders different data depending on whether the user is primarily a creator or a participant in that context. Every creator is also a potential participant in other events; the dashboard reflects both sides simultaneously.

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| P29 | View home dashboard — creator perspective | Dashboard tab shows: net balance hero card (green when owed more than owing), "Needs attention" section (pending payments from members), and "Owed to you" list with per-person outstanding amounts. "＋ New event" shortcut button visible. | Aggregate view across all events you created. The net number tells the whole story at a glance — without it, the creator has to open each event individually to understand their exposure. **MVP** |
| P30 | View home dashboard — participant perspective | Same dashboard, different data: net balance hero card (typically red when you owe more than you're owed), "You owe" section as the dominant list. No "New event" button — a pill showing active event count instead. | Same app, same screen — the dashboard adapts to context. A creator who was also added to someone else's event sees both sides of their balance. Dual-sided view is what makes this a complete financial picture, not just a payment request tool. **MVP** |
| P31 | Delete account & data | GDPR right to erasure. Removes user, anonymises participant history, deletes payment handles. | Legally required in most jurisdictions. Also builds trust — users know they can leave and their data leaves with them. **Legally Required** |

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
| R06 | Self-report payment in app | After paying externally (e.g. Venmo) → open app → go to event via Events tab or home dashboard → tap "✓ I've paid — mark as settled" → select payment method (Venmo / Cash App / Bank transfer / etc.) → tap "Settle up" → balance clears on their side immediately, push notification sent to creator: "[Name] says they paid $X via Venmo." Creator still confirms via Event Detail — two-party model. | Gives registered participants agency to initiate settlement without waiting for the creator to notice. The self-report flow is: external payment → return to event → one confirmation tap. Push to creator closes the loop. **MVP** |
| R07 | View home dashboard (participant perspective) | App home dashboard adapts to show the participant's side: net balance (how much they owe in aggregate), "You owe" list with each outstanding event, and "You're owed" if others owe them from events they created. Same app, same dashboard screen — rendered with participant's data. | This is the retention hook for the recipient side. Without a clear view of what they owe and to whom, there's no reason to keep the app. The unified dashboard means participants and creators use the same interface. **MVP** |
| R08 | View event detail (participant perspective) | Events tab → tap event → Event Detail shows their share, itemised breakdown of what was ordered, and live group settlement status (how many others have paid). | Transparency builds trust. "Why do I owe $48.50?" — event detail shows exactly which items were assigned to them and confirms others are paying their share too. **MVP** |

### Account

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| R09 | Add own payment handles to profile | Set up Venmo/PayPal/etc for when they become a payer in a future event. | Registered participants will eventually pay for a group themselves. Handles set up once → ready to use immediately when they create their first event. **MVP** |
| R10 | Opt out / delete account | Reply STOP to message (stops future messages) OR delete account in app. | Legally required. Someone added to a split without their prior consent (manually added by payer) must have an easy opt-out path. STOP keyword is the messaging industry standard. **Legally Required** |

---

## Actor 3: Non-Member Guest
*No LetsSplyt account. Two sub-types: (A) joined via QR/URL in browser, (B) added manually by payer.*

### Sub-type A: QR Browser Guest
*Scanned the QR or clicked the URL, no app installed. Joined entirely in browser.*

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| G01 | Open invite in browser | QR scan or URL click → phone browser opens invite page showing: who invited them, event name, member count. Single CTA: "Join the group." No app download prompt at this stage — joining in browser is the primary path, not a fallback. | Non-members have no reason to install an app before they've experienced any value. Browser join removes all friction from their perspective: no install, no account, no password. **Critical Path** |
| G02 | Enter name and phone | Browser form: First Name, Last Name, Phone Number (with country selector). Submit → OTP sent to that number. | Name identifies them in the group and on the split. Phone is the delivery address for their payment request. Country selector ensures correct E.164 formatting and appropriate payment options later. **Critical Path** |
| G03 | Verify OTP in browser | 6-digit code sent to their phone via SMS → enter in browser → verified → added to event as a participant. No LetsSplyt account created — they are a verified participant record, not a user record. | OTP proves the phone number is real and belongs to this person. Without it, anyone could enter anyone else's number and redirect payment requests. **Critical Path** |
| G04 | Joined confirmation in browser | After OTP: browser shows confirmation — event name, organiser, group members, and a simple explanation of what happens next ("Pawan scans receipt → AI splits → you get a text with your amount"). Soft nudge to download LetsSplyt at the bottom. No separate "waiting" screen — the joined confirmation is the final browser state. Guest is done until they receive the SMS. | Sets expectations so the guest isn't confused when a payment SMS arrives later. Nudge is optional and below all other content — never the primary message. **MVP** |
| G05 | Receive payment request via SMS | When payer sends messages — guest receives SMS with split image (their row highlighted) + country-filtered payment links + amount owed + opt-out line. | The moment their participation materialises financially. Everything they need is in this one message — no app, no login, no lookup. **Critical Path** |
| G05a | Receive revised payment request | "[Payer] made a correction — your revised share is $X (was $Y)" sent only if their amount changed. | Silent amount changes destroy trust. Explicit revision message with before/after makes the correction transparent. **MVP** |
| G06 | Tap payment link | SMS payment link opens Venmo / PayPal / Wise / Cash App (country-filtered) with handle + amount pre-filled. Guest pays externally. | The moment of payment. Pre-filled links remove friction — no need to type an amount or look up a handle. **Critical Path** |
| G07 | Opt out of messages | Reply STOP to any SMS → flagged opted-out in DB → no further messages sent to that number ever. | Legally required. Guest gave their number to join a specific event. STOP is the only consent revocation mechanism available to them. Must be honoured immediately and permanently. **Legally Required** |

### Sub-type B: Manually Added Guest
*Added directly by payer (from contacts or by typing a number) — payer vouches for them. No OTP required on join.*

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| G08 | Receive payment request via SMS/WhatsApp | Same message as G05 — split image + payment links + amount + opt-out line. Delivery channel is WhatsApp-first (Twilio auto-route) for manually-added guests since payer likely knows them. | Payer vouched for them, so no OTP was needed at join time. Message delivery is identical to QR browser guests. **MVP** |
| G09 | Tap payment link | Same as G06. | Same rationale. **Critical Path** |
| G10 | Opt out of messages | Same as G07 — reply STOP. | Same legal obligation. **Legally Required** |

---

## Actor 4: System / AI Agents
*Automated actions triggered by user events. 11 actions.*

| ID | Action | Description | Why This Exists |
|----|--------|-------------|-----------------|
| S01 | A1 — Parse receipt via vision | Vision AI (Gemini 2.5 Flash in dev/staging, Claude Haiku 4.5 in production) extracts line items, prices, tax, tip, currency. Returns structured JSON. | Core AI value. Deterministic OCR can't distinguish a service charge from a menu item. AI understands bill semantics. ~94–97% accuracy on quality restaurant receipts. |
| S02 | A2 — Calculate smart split | Applies assignments (drag or NLP), prorates tax & tip proportionally, handles shared items, enforces sum invariant. | Mathematical correctness with semantic intelligence. "Proportional" tax/tip (not equal share) is what most people consider "fair." The sum invariant (all shares = total) is non-negotiable for financial data. |
| S03 | A3 — Compose personalised messages | Generates split image (recipient's row highlighted), country-filtered payment deep links, message text, conditional app nudge. Payment handles fetched from payer profile. | N manual WhatsApp messages → one automated composition flow. Personalisation (highlighted row, pre-filled amount) makes each message feel intentional rather than mass-broadcast. |
| S04 | Auto-route delivery channel | US (+1) → SMS first. Non-US → WhatsApp first via Twilio auto-channel, SMS fallback if WhatsApp fails. No third-party WhatsApp detection — Twilio handles it natively. | Different countries have different messaging norms. Germany = high WhatsApp. US = SMS still dominant. Twilio auto-channel achieves optimal delivery without needing to detect WhatsApp status (which violates ToS). |
| S05 | Auto-filter payment options by country | US → all options. Non-US → PayPal + Wise + Cash only. Config-driven — new country = one config line change. | Sending Venmo to a German number is worse than sending nothing — it's a broken link. Country filtering is a trust and usability decision, not just a UX nicety. |
| S06 | Expire QR join token | Expires on payer lock OR 24-hour TTL, whichever comes first. Payer can reopen for 1 hour manually. | Permanent QR = security risk (screenshot could add strangers days later). TTL = closes the window. Reopen = graceful latecomer handling. Three scenarios, one mechanism. |
| S07 | Push — self-report received | Participant taps "I paid" → push to payer: "[Name] says they paid $X. Confirm?" | Payer needs to know immediately when someone claims payment so they can confirm or dispute while context is fresh. Push is the right channel — faster than email, less intrusive than SMS. |
| S08 | Push — nudge reminder to payer | T+48hrs: push to payer "N people haven't paid yet. Send a reminder?" Payer initiates nudge manually. | The ghost problem has a 48-hour horizon in most social contexts — if someone hasn't paid in 2 days, a nudge is socially appropriate. Payer initiates (not automatic) to preserve social control. |
| S09 | Auto-detect existing user on QR join | Phone number submitted → DB lookup → if match found, skip registration, link existing account, send "welcome back" OTP. | Prevents duplicate accounts. UUID is stable identity — linking to existing account preserves history. "Welcome back" OTP confirms identity without re-collecting data. |
| S10 | Compute split diff on edit | When payer edits post-send — system calculates which participants' amounts changed. Sends revised message only to affected participants. Logs revision in settlement_log. | Surgical precision in resending. Sending a revision to someone whose amount didn't change creates confusion. Diff computation identifies exactly who needs notification. |
| S11 | Push — revision notification | Sends push to registered participants who received a revised amount: "Your share in [event] was updated." | In-app notification for registered participants when their amount changes. Ensures they don't miss the revision if they don't check WhatsApp immediately. |

---

## Critical Path Summary

The minimum viable sequence for the app to work end-to-end:

**Payer side:** P01 → P04 → P07 → P08 (QR + Event Detail joining view) → [optional: P09/P10 manual add] → P14 (lock group) → P15 → **Scanned:** P15a → **Itemised:** P16 → P18 → P16b → P20 | **Custom/Even:** P16b → P20 || **Manual total:** P17 → P16b (Even pre-selected) → P20 → P21 → P21a → P22 → [Events tab] → P24 (Event Detail settlement view) → P25 (confirm payment)

**Existing member joining (app):** R01 → [in-app join screen] → R04 → R05 → R06 (self-report after paying)

**Non-member joining (browser):** G01 → G02 → G03 → G04 → [receive SMS] → G05 → G06

**Note on P14:** The "Lock group" action is the hard gate between group formation and split calculation. No split can begin until the payer explicitly locks. This is enforced in the UI (Scan receipt button disabled) and in the API (split endpoints check group lock status).

**Note on P24–P27:** There is no separate settlement dashboard screen. All settlement tracking and actions (confirm, dispute, nudge, mark cash) are accessed via Events tab → tap event card → Event Detail. This keeps tracking in context of the event rather than a global settlement view.

Everything else is recovery paths, edge cases, or quality-of-life improvements.

---

*~70 total actions (revised). 4 actor types. 3 legally required. ~15 critical path.*
