# LetsSplyt — Cursor Build Guide
**Version:** 1.0 | **Date:** June 2026
**For:** Building LetsSplyt with Cursor
**Companion files:** CLAUDE.md (project brief), BUILD-PROGRESS.md (story tracking)

---

## How Cursor Builds LetsSplyt

Development happens in sessions. Each session, Cursor needs to read two files before writing any code:

- **CLAUDE.md** at the project root — the complete project brief. It contains the product vision, full tech stack, security rules, and document map. You never need to re-explain the product or architecture — it's all in this file.
- **BUILD-PROGRESS.md** at the project root — the 38-story checklist. It tells Cursor exactly which story to build next.

**Important:** Unlike some AI tools, Cursor does not read these files automatically. The `.cursorrules` file at the project root instructs Cursor to read them at the start of every session, but you should verify this is working by checking that Cursor acknowledges the project context in its first response.

---

## Before You Start Your First Session

Make sure you have:
1. Cloned the letssplyt repository and opened it in Cursor
2. Completed all accounts and secrets in docs/11-Setup-Guide.md
3. Run `./setup.sh dev` to confirm the dev environment is ready
4. The `.cursorrules` file exists at the project root (it was created for you)

---

## Starting a Session

### Session 1 — First time only

Open Cursor → open the letssplyt folder → open Composer (Cmd+I or Ctrl+I).

Paste this prompt:

```
Read CLAUDE.md and BUILD-PROGRESS.md. This is a React Native + Node.js bill-splitting app. Find the first unchecked [ ] story in BUILD-PROGRESS.md, read it in docs/12-Build-Sequence.md, and build it. Follow all session rules in CLAUDE.md.
```

Cursor will read both files, confirm the project context, and start building E01-S01.

### Session 2 onwards

The `.cursorrules` file handles context loading. Open Composer and paste:

```
Read CLAUDE.md and BUILD-PROGRESS.md. Build the next pending story.
```

That's it. Cursor will find the next unchecked [ ] story and build it.

---

## During a Session

Cursor will:
1. Read CLAUDE.md and BUILD-PROGRESS.md
2. Find the next unchecked story
3. Read that story's full spec from docs/12-Build-Sequence.md
4. Write all code, run all tests, show you results
5. Wait for your confirmation before marking the story done

**Do not interrupt** while Cursor is working. Let it finish.

**If Cursor asks a question:** Answer it. Some stories require environment-specific values (Railway URL, EAS project ID) that only you know.

---

## Confirming a Story is Done

When Cursor shows test results and says the story is complete:

1. Review the acceptance criteria shown in the output
2. If everything looks right, type: **"looks good, continue"**
3. Cursor will update BUILD-PROGRESS.md — changing `[ ]` to `[x]` with today's date
4. Cursor will commit all changed files: `git add -A && git commit -m "E##-S##: [story name]"`
5. Cursor will push to GitHub: `git push origin main`
6. Check GitHub → your repository to confirm the commit appears
7. The next session will pick up from the next unchecked story

**Never say "looks good" until you've reviewed the test output.** All stories require passing tests.

**Never confirm a story as done until tests pass.** Committing broken code to main means the next story starts from a broken base.

---

## Story Reference

All 38 stories are in `docs/12-Build-Sequence.md`. Each story has:
- A **Prompt** — paste this into Cursor Composer if starting that story directly
- **Acceptance Criteria** — what must be true for the story to be done
- **Tests** — what test commands to run and what they must output

### All 38 Stories

| Story ID | Name | Epic |
|---|---|---|
| E01-S01 | Monorepo Scaffold + TypeScript Config | Infrastructure |
| E01-S02 | Express Application + All Middleware | Infrastructure |
| E01-S03 | Supabase Client Singletons | Infrastructure |
| E01-S04 | LLM Provider Factory | Infrastructure |
| E01-S05 | Test Infrastructure Setup | Infrastructure |
| E01-S06 | Security Utilities | Infrastructure |
| E02-S01 | Database Migrations | Database Schema |
| E02-S02 | Seed Data | Database Schema |
| E03-S01 | OTP Request Endpoint | Authentication |
| E03-S02 | OTP Verify + Session Creation | Authentication |
| E03-S03 | Mobile Auth Screens | Authentication |
| E04-S01 | Profile API Endpoints | Profile |
| E04-S02 | Profile Mobile Screens | Profile |
| E05-S01 | Event CRUD API | Events |
| E05-S02 | Add Participant API | Events |
| E05-S03 | Mobile Event Screens | Events |
| E05-S04 | Event Member Management UI | Events |
| E06-S01 | Web Join Page | Join Flows |
| E06-S02 | In-App Join + Deep Link | Join Flows |
| E07-S01 | Receipt Image Upload | AI Pipeline |
| E07-S02 | A1 Receipt Parsing | AI Pipeline |
| E07-S03 | Item Review Screen | AI Pipeline |
| E07-S04 | Split Calculator + A2 NLP | AI Pipeline |
| E07-S05 | Split Entry + Review Screens | AI Pipeline |
| E08-S01 | A3 Message Generation | Messages |
| E08-S02 | Send Messages + Twilio | Messages |
| E08-S03 | Split Image Generator | Messages |
| E08-S04 | Message Preview + Sending | Messages |
| E09-S01 | Settlement API | Settlement |
| E09-S02 | Settlement Ledger API | Settlement |
| E09-S03 | Settlement Mobile Screens | Settlement |
| E10-S01 | QStash Job Handlers | Background Jobs |
| E10-S02 | Push Notifications | Background Jobs |
| E11-S01 | Biometric Authentication | Account |
| E11-S02 | Settings + Delete Account | Account |
| E12-S01 | Analytics + Health Check | Launch |
| E12-S02 | Sentry + Structured Logging | Launch |
| E12-S03 | EAS Build + CI/CD | Launch |
| E12-S04 | End-to-End Test Suite | Launch |

---

## Prototype Reference

All screen mockups are in the `prototype/` folder. Cursor should match these designs exactly.

| Prototype File | What It Shows |
|---|---|
| `prototype/dusk-auth.html` | Welcome + Phone Entry + OTP screens |
| `prototype/home.html` | Home screen and navigation |
| `prototype/create-event.html` | Create event + QR display |
| `prototype/receipt-split.html` | Receipt scan + item review + split modes |
| `prototype/send-messages.html` | Message preview + sending |
| `prototype/ledger.html` | Settlement ledger |
| `prototype/participant.html` | Participant view |
| `prototype/guest.html` | Guest web join page |
| `prototype/simulate.html` | Full flow simulation |

---

## Testing on Your Phone

After Cursor builds the first mobile screen (E03-S03):

```bash
cd ~/letssplyt/mobile
npx expo start
```

Scan the QR code in Terminal with the Expo Go app on your Android phone.

Every time Cursor saves a change, the app updates automatically.

---

## Running Tests

```bash
# Backend tests with coverage
cd backend && npm run test:coverage

# Mobile tests
cd mobile && npm run test:coverage

# Run all tests from root
npm test
```

Coverage thresholds (enforced by CI):
- Backend: 80% lines, 70% branches
- Mobile: 70% lines, 60% branches
- splitCalculator.ts: 100% (no exceptions)
- security/crypto.ts: 100% (no exceptions)

---

## Troubleshooting

**Cursor doesn't seem to know the project context:**
Check that `.cursorrules` exists at the project root. If it does and Cursor still doesn't acknowledge the project, manually paste: *"Read CLAUDE.md. This is the LetsSplyt project."* at the start of your prompt.

**Cursor writes code that contradicts CLAUDE.md:**
Quote the relevant section of CLAUDE.md in your message: *"CLAUDE.md says [exact quote]. Please fix this."*

**Tests are failing:**
Do not confirm the story as done. Tell Cursor: *"Tests are failing. Fix them before we continue."*

**Cursor asks about environment values (URLs, keys):**
These come from your Doppler setup. Check Doppler → letssplyt → development for the value needed.

**setup.sh says the project isn't scaffolded yet:**
Complete E01-S01 first. The setup script requires the monorepo structure to exist before running `./setup.sh dev`.
