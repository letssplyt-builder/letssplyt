# PA-18 — JWT local verification

**Status:** Accepted  
**Audit:** M2

## Problem

The `authenticate` middleware called `supabaseAnon.auth.getUser(token)` on every authenticated request — adding latency and making Supabase Auth availability a hard dependency for all API traffic.

## Decision

1. **Route authentication** — verify access JWTs locally in `supabase-jwt.ts` using Supabase JWKS (`/auth/v1/.well-known/jwks.json`) via `jose`.
2. **HS256 fallback** — when JWKS verification fails and `JWT_SECRET` is set (typical local/dev Supabase), verify with the shared secret.
3. **Revocation-aware checks** — `verifyAccessTokenViaSupabaseAuth()` wraps `auth.getUser()` for sensitive account operations (account deletion, handle changes) where session revocation must be honored.

## Trade-offs

Local verification does not detect revoked sessions until token expiry. Sensitive flows should call `verifyAccessTokenViaSupabaseAuth` when revocation awareness is required.
