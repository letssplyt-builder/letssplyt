# ADR PA-11: RLS strategy and centralized route authorization

**Status:** Accepted  
**Date:** 2026-07-05  
**Audit:** C3

## Context

The backend uses `supabaseAdmin` (service role) in ~39 module files. Row Level Security policies in PostgreSQL protect Realtime and direct PostgREST access, but **API route handlers bypass RLS**. Authorization today relies on ad-hoc `fetchEventRow` + `assertEventOwner` calls scattered across services; `assertEventAccess` (member check) was private and used in only one code path.

The prior `supabase.ts` docstring stated "NEVER use supabaseAdmin in user-facing read endpoints" — that rule did not match runtime behavior and created a false sense of security.

## Decision

**Adopt model (b): service-role data access + centralized application authorization.**

1. **`supabaseAdmin` remains the default** for Express route handlers and background jobs. Guest PII, cross-user writes, webhooks, and analytics require service role regardless.

2. **RLS stays enabled** as defense-in-depth for Supabase Realtime subscriptions and any direct PostgREST access — not as the primary API enforcement layer.

3. **Route-level middleware** (`requireEventAccess`, `requireEventAccessFromBody`) loads the event once and asserts access before handlers run:
   - **`owner`** — payer only (mutations, receipts, splits, messages send)
   - **`member`** — payer or linked app participant (`GET /events/:id`)

4. **Service-layer asserts remain** temporarily as defense-in-depth; new code should rely on middleware-attached `req.event` where wired.

5. **`getSupabaseForUser(jwt)`** is reserved for future incremental migration of read paths once JWT is stored on `req`; not required for PA-11.

## Consequences

- Cross-tenant data leaks require a missing route middleware **and** a missing service assert — two failures.
- New event-scoped routes must declare `requireEventAccess('owner' | 'member')` in the router.
- Integration test matrix (`event-scoped-routes.test.ts`) guards all event-scoped endpoints against stranger access.
- CLAUDE.md and `supabase.ts` docstrings reflect the adopted model.

## Alternatives considered

**(a) Migrate user reads to `getSupabaseForUser`** — correct long-term for RLS-as-enforcement, but high regression risk and does not eliminate service-role needs for writes/guest flows. Deferred as optional follow-up.
