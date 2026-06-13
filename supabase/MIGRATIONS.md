# Supabase migration registry

**Authoritative inventory** of every migration in `supabase/migrations/`. When adding a migration:

1. Create the file with `supabase migration new [description]` from **repo root**.
2. Add rollback comments at the top (see `docs/10-Engineering-Operations.md` §4).
3. Append a row to the table below.
4. Update `backend/src/__tests__/unit/migrations/migration-manifest.test.ts`.
5. Run `supabase db push` on dev, then `supabase/scripts/verify-deployment-schema.sql` in SQL Editor.
6. Promote: staging → smoke tests → production (backup first).

**Never** edit migration files that have already been applied to staging/production. Add a new forward migration instead.

---

## Apply order (22 migrations)

Run from **repository root** (`letssplyt/`), not `supabase/`:

```bash
cd /path/to/letssplyt
supabase link --project-ref <project-ref>   # once per environment
supabase db push                          # dev (linked project)

# Or direct URL (staging / production):
supabase db push --db-url "$SUPABASE_DB_URL"
```

If CLI reports *"Found local migration files to be inserted before the last migration on remote"*, a migration timestamp is **older** than migrations already on that database. Either:

- Rename the new file to a timestamp **after** the latest remote migration, or
- Run `supabase db push --include-all` only after confirming the out-of-order migration is safe (fresh envs only).

---

## Migration inventory

| # | File | Story / area | What it does | Idempotent? |
|---|------|--------------|--------------|-------------|
| 1 | `20260601000000_initial_schema.sql` | E02 | Full schema: tables, indexes, triggers, RLS, partitions, Realtime | Initial only |
| 2 | `20260608000000_users_auth_registration.sql` | E03-S02b | `users_service_role` policy + `upsert_user_profile_on_auth` RPC | Policies use IF NOT EXISTS patterns |
| 3 | `20260608164200_device_sessions_expo_push_token.sql` | E10 | `device_sessions.expo_push_token` | `ADD COLUMN IF NOT EXISTS` |
| 4 | `20260608164500_device_sessions_rls_fix.sql` | E10 | Split device_sessions RLS for upsert | `DROP POLICY IF EXISTS` |
| 5 | `20260608164600_device_sessions_app_version_nullable.sql` | E10 | `app_version` nullable | Safe re-run |
| 6 | `20260608200000_events_ai_stage_locale.sql` | E05 | `events.ai_stage`, `locale` | `ADD COLUMN IF NOT EXISTS` |
| 7 | `20260608210000_guest_pii_and_participants_token.sql` | E05-S02 | `guest_pii` table + `participants.guest_pii_token` | `IF NOT EXISTS` |
| 8 | `20260609000000_ensure_funnel_checkpoints.sql` | E06 | Repair `funnel_checkpoints` for web join | Repair migration |
| 9 | `20260609000001_ensure_participants_web_join.sql` | E06 | `qr_web` join_method, participant/guest_pii repair | `IF NOT EXISTS` |
| 10 | `20260610000000_backfill_creator_participants.sql` | E05 | Backfill payer participant rows | `ON CONFLICT` safe |
| 11 | `20260610000001_receipts_storage_bucket.sql` | E07-S01 | Storage bucket `receipts` (private) | `ON CONFLICT DO UPDATE` |
| 12 | `20260611000000_receipt_items_ai_columns.sql` | E07-S02 | A1 confidence columns on `receipt_items` | `IF NOT EXISTS` |
| 13 | `20260611100000_receipt_items_full_schema_repair.sql` | E07-S02 | Full `receipt_items` column repair | Repair / IF NOT EXISTS |
| 14 | `20260612000000_event_fees_and_receipt_item_is_fee.sql` | E07 | `events.fees_amount`, `receipt_items.is_fee` | `IF NOT EXISTS` |
| 15 | `20260613000000_events_last_parse_attempt_id.sql` | E07 | `events.last_parse_attempt_id` | `IF NOT EXISTS` |
| 16 | `20260614000000_events_ai_stage_parsed_confirmed.sql` | E07-S03 | `ai_stage` includes `parsed_confirmed` | `DROP CONSTRAINT IF EXISTS` |
| 17 | `20260615000000_reset_event_expenses_function.sql` | E07-S06 | `reset_event_expenses_data()` RPC | `CREATE OR REPLACE` |
| 18 | `20260616000000_participants_breakdown_token.sql` | E08-S03 | `participants.breakdown_token` + unique partial index for SMS breakdown links | `ADD COLUMN IF NOT EXISTS` |
| 19 | `20260617000000_settlement_log_audit_columns.sql` | E09-S01 | `settlement_log.from_status`, `to_status` (+ amount/note/metadata if missing) | `ADD COLUMN IF NOT EXISTS` |
| 20 | `20260617000001_settlement_log_action_disputed.sql` | E09-S01 | `settlement_log.action` CHECK includes `disputed` | `DROP CONSTRAINT IF EXISTS` |
| 21 | `20260618000000_event_delete_fk_cascade.sql` | E07+ | `notification_log` / `settlement_log` `ON DELETE CASCADE` on `event_id`; `sms_opt_outs.event_id` `ON DELETE SET NULL` | `DROP CONSTRAINT IF EXISTS` |
| 22 | `20260619000000_device_sessions_trust_columns.sql` | E11 | `device_sessions` OTP/biometric trust timestamps | `ADD COLUMN IF NOT EXISTS` |

---

## Backend features requiring specific migrations

| Feature | Minimum migrations |
|---------|-------------------|
| Event CRUD + lock | #1, #6 |
| OTP register / profile RPC | #2 |
| Manual participant + guest PII | #7, #9 |
| Web join | #8, #9 |
| Receipt upload (Storage) | #11 |
| A1 parse + confirm | #12–#15 |
| Item review confirm | #16 |
| `POST /events/:id/expenses/reset` (atomic) | #17 (fallback row updates work without #17) |
| Split calculate + NLP | #1, #6, #16 |
| SMS breakdown link (`GET /split/:token`) | #18 |
| Message preview/send with `breakdown_url` | #18 |
| Settlement API (`settlement_log` writes) | #19, #20 |
| `DELETE /events/:id` (pre-send hard delete) | #21 (service also deletes logs + guest_pii explicitly) |

---

## Staging / production checklist

After `supabase db push` on staging or production:

1. **SQL Editor** → run `supabase/scripts/verify-deployment-schema.sql`  
   All rows should show `ok` / `present = true`. Fix any `MISSING` before deploying backend/mobile.

2. **CLI** — confirm all versions applied:
   ```bash
   supabase migration list --db-url "$SUPABASE_DB_URL"
   ```
   All 22 versions should show as applied on remote.

3. **Smoke tests** (backend running against that environment):
   ```bash
   cd backend
   doppler run -- npm run smoke:receipts-confirm
   doppler run -- npm run smoke:splits
   doppler run -- npm run smoke:expenses-reset
   doppler run -- npm run smoke:messages-preview
   doppler run -- npm run smoke:split-revision
   ```

4. **Manual** — create event → lock → enter total → reset expenses → scan/enter total again.

---

## Rollback notes

| Migration | Rollback (emergency — run manually) |
|-----------|-------------------------------------|
| #17 | `DROP FUNCTION IF EXISTS public.reset_event_expenses_data(UUID);` |
| #16 | Restore previous `events_ai_stage_check` without `parsed_confirmed` (only if no rows use that stage) |
| #1–#15 | Prefer **Supabase backup restore** over partial rollback. See `docs/10-Engineering-Operations.md` §4. |

---

## Related scripts (not migrations)

| Script | Purpose |
|--------|---------|
| `supabase/scripts/verify-deployment-schema.sql` | Post-push schema + function verification |
| `supabase/scripts/verify-receipt-items-schema.sql` | Receipt items column audit |
| `supabase/scripts/reset-receipt-scans.sql` | Dev-only manual reset (use API in prod) |
| `supabase/scripts/wipe-all-dev-data.sql` | **Dev/staging only** — delete all rows + auth users + receipt storage; keeps schema |
| `supabase/scripts/repair-ai-audit-log.sql` | Recreate `ai_audit_log` if table missing but migration #1 is marked applied |
| `supabase/seed.sql` | Dev seed data (`supabase db reset` only — **never** on staging/prod) |
