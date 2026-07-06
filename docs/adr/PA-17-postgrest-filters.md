# PA-17 — PostgREST filter guardrails

**Status:** Accepted  
**Audit:** M4

## Problem

PostgREST `.or()` filters built with template literals (e.g. `` .or(`payer_id.eq.${userId},id.in.(${ids})`) ``) are a filter-injection footgun if any interpolated value ever becomes user-controlled.

## Decision

1. **Prefer typed query builders** — `.eq()`, `.in()`, `.is()` — over string filters.
2. **When OR semantics are needed** — run separate queries and merge/sort in application code (see `fetchAllRoleEventRows` in `event.service.ts`).
3. **ESLint** — `no-restricted-syntax` errors on template literals passed to `.or()` (`.eslintrc.js`).

## Remaining `.or()` string filters

`ledger.service.ts` and `inbox-notification.service.ts` still use static-pattern `.or()` strings with server-derived values. Refactor when those modules are next touched; ESLint will flag new template-literal `.or()` usage.
