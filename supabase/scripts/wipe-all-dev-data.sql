-- ═══════════════════════════════════════════════════════════════════════════
-- wipe-all-dev-data.sql — DEV / STAGING ONLY
-- ═══════════════════════════════════════════════════════════════════════════
-- Removes ALL application data while keeping schema (tables, RLS, functions).
-- Skips tables that do not exist (safe if migrations are partially applied).
--
-- NEVER run on production.
--
-- After wipe: log out on mobile, then re-register via OTP.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. MIGRATION AUDIT — run first if any table is "does not exist" ───────
-- Fully migrated dev projects should show 20 rows and no missing_migration_version.
SELECT COUNT(*)::int AS applied_migration_count
FROM supabase_migrations.schema_migrations;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

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
    '20260615000000',
    '20260616000000',
    '20260617000000',
    '20260617000001'
  ]) AS version
),
applied AS (
  SELECT version FROM supabase_migrations.schema_migrations
)
SELECT e.version AS missing_migration_version
FROM expected e
LEFT JOIN applied a ON a.version = e.version
WHERE a.version IS NULL
ORDER BY e.version;

-- List public tables actually present (compare to repo migrations if gaps)
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ─── 1. PREVIEW row counts (existing public tables only) ───────────────────
-- Note: Supabase SQL Editor runs each execution in a new session. Section 5
-- rebuilds counts itself — you do not need to re-run section 1 before verify.
DROP TABLE IF EXISTS _wipe_preview;
CREATE TEMP TABLE _wipe_preview (table_name text PRIMARY KEY, row_count bigint);

DO $$
DECLARE
  r RECORD;
  cnt bigint;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('SELECT COUNT(*)::bigint FROM public.%I', r.tablename) INTO cnt;
    INSERT INTO _wipe_preview (table_name, row_count) VALUES (r.tablename, cnt);
  END LOOP;
END $$;

SELECT 'public.' || table_name AS table_name, row_count
FROM _wipe_preview
ORDER BY table_name;

SELECT 'auth.users' AS table_name, COUNT(*)::bigint AS row_count FROM auth.users
UNION ALL
SELECT 'storage.objects (receipts)', COUNT(*)::bigint FROM storage.objects
  WHERE bucket_id = 'receipts';

-- ─── 2. WIPE public application data ───────────────────────────────────────
-- Uncomment after PREVIEW. Only truncates tables that exist.

/*
DO $$
DECLARE
  wipe_tables constant text[] := ARRAY[
    'item_assignments',
    'receipt_items',
    'settlement_log',
    'notification_log',
    'participants',
    'event_join_tokens',
    'events',
    'user_payment_handles',
    'device_sessions',
    'funnel_checkpoints',
    'sms_opt_outs',
    'ai_audit_log',
    'analytics_events',
    'guest_pii',
    'users'
  ];
  existing text[];
  t text;
  truncate_sql text;
BEGIN
  FOR t IN SELECT unnest(wipe_tables) LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t
    ) THEN
      existing := array_append(existing, t);
    END IF;
  END LOOP;

  IF existing IS NULL OR array_length(existing, 1) IS NULL THEN
    RAISE NOTICE 'No public tables to truncate.';
    RETURN;
  END IF;

  SELECT string_agg(format('public.%I', u.t), ', ')
  INTO truncate_sql
  FROM unnest(existing) AS u(t);

  EXECUTE 'TRUNCATE TABLE ' || truncate_sql || ' RESTART IDENTITY CASCADE';
  RAISE NOTICE 'Truncated: %', truncate_sql;
END $$;
*/

-- ─── 3. WIPE Supabase Auth users ───────────────────────────────────────────

/*
BEGIN;
DELETE FROM auth.sessions;
DELETE FROM auth.identities;
DELETE FROM auth.users;
COMMIT;
*/

-- ─── 4. WIPE receipt images in Storage ─────────────────────────────────────

/*
DELETE FROM storage.objects WHERE bucket_id = 'receipts';
*/

-- ─── 5. VERIFY (standalone — SQL Editor does not keep temp tables between runs) ─
DROP TABLE IF EXISTS _wipe_verify;
CREATE TEMP TABLE _wipe_verify (table_name text PRIMARY KEY, row_count bigint);

DO $$
DECLARE
  r RECORD;
  cnt bigint;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('SELECT COUNT(*)::bigint FROM public.%I', r.tablename) INTO cnt;
    INSERT INTO _wipe_verify (table_name, row_count) VALUES (r.tablename, cnt);
  END LOOP;
END $$;

SELECT 'public.' || table_name AS table_name, row_count
FROM _wipe_verify
ORDER BY table_name;

SELECT 'auth.users' AS table_name, COUNT(*)::bigint AS row_count FROM auth.users
UNION ALL
SELECT 'storage.objects (receipts)', COUNT(*)::bigint FROM storage.objects
  WHERE bucket_id = 'receipts';
