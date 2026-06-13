-- Post-migration verification for staging / production.
-- Run in Supabase SQL Editor after: supabase db push
-- Every check should pass before deploying backend + mobile to that environment.

-- ─── 1. Migration history (expect 17 rows on fully migrated projects) ─────
SELECT
  'migration_count' AS check_name,
  COUNT(*)::text AS result,
  CASE WHEN COUNT(*) >= 17 THEN 'ok' ELSE 'MISSING MIGRATIONS' END AS status
FROM supabase_migrations.schema_migrations;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- ─── 2. Required migration versions (must all appear above) ─────────────────
WITH expected AS (
  SELECT unnest(ARRAY[
    '20260601000000',
    '20260608000000',
    '20260608164200',
    '20260608164500',
    '20260608164600',
    '20260608200000',
    '20260608210000',
    '20260609000000',
    '20260609000001',
    '20260610000000',
    '20260610000001',
    '20260611000000',
    '20260611100000',
    '20260612000000',
    '20260613000000',
    '20260614000000',
    '20260615000000'
  ]) AS version
),
applied AS (
  SELECT version FROM supabase_migrations.schema_migrations
)
SELECT
  e.version AS missing_migration_version
FROM expected e
LEFT JOIN applied a ON a.version = e.version
WHERE a.version IS NULL
ORDER BY e.version;

-- ─── 3. Events columns (E05 + E07) ──────────────────────────────────────────
SELECT
  column_name,
  CASE WHEN column_name IS NOT NULL THEN 'ok' ELSE 'missing' END AS status
FROM (
  SELECT unnest(ARRAY[
    'ai_stage',
    'locale',
    'fees_amount',
    'last_parse_attempt_id',
    'receipt_scan_attempted',
    'tax_amount',
    'tip_amount',
    'total_amount',
    'split_mode'
  ]) AS column_name
) expected
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'events'
 AND c.column_name = expected.column_name;

-- ─── 4. ai_stage allows parsed_confirmed (migration #16) ────────────────────
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.events'::regclass
  AND conname = 'events_ai_stage_check';

-- ─── 5. reset_event_expenses_data function (migration #17) ───────────────────
SELECT
  'reset_event_expenses_data' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reset_event_expenses_data'
  ) THEN 'ok' ELSE 'MISSING FUNCTION' END AS status;

-- ─── 6. Auth registration RPC (migration #2) ───────────────────────────────
SELECT
  'upsert_user_profile_on_auth' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'upsert_user_profile_on_auth'
  ) THEN 'ok' ELSE 'MISSING FUNCTION' END AS status;

-- ─── 7. guest_pii table (migration #7 / #9) ─────────────────────────────────
SELECT
  'guest_pii' AS check_name,
  CASE WHEN to_regclass('public.guest_pii') IS NOT NULL THEN 'ok' ELSE 'MISSING TABLE' END AS status;

-- ─── 7b. ai_audit_log (migration #1 — if missing, run repair-ai-audit-log.sql) ─
SELECT
  'ai_audit_log' AS check_name,
  CASE WHEN to_regclass('public.ai_audit_log') IS NOT NULL THEN 'ok' ELSE 'MISSING TABLE' END AS status;

-- ─── 8. Receipt items columns (E07) ─────────────────────────────────────────
WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'id', 'event_id', 'name', 'unit_price', 'quantity', 'line_total',
    'confidence_score', 'is_low_confidence', 'is_tax', 'is_fee', 'is_tip',
    'is_shared', 'ai_extracted', 'receipt_s3_key', 'created_at'
  ]) AS column_name
),
actual AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'receipt_items'
)
SELECT
  e.column_name,
  (a.column_name IS NOT NULL) AS present
FROM expected_columns e
LEFT JOIN actual a ON a.column_name = e.column_name
ORDER BY e.column_name;

-- ─── 9. Receipts storage bucket (migration #11) ─────────────────────────────
SELECT
  id,
  name,
  public,
  file_size_limit
FROM storage.buckets
WHERE id = 'receipts';
