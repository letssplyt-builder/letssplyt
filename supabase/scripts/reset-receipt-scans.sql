-- Reset receipt scan data for dev/testing (Supabase SQL Editor — runs as postgres, bypasses RLS).
--
-- Two modes below. Run PREVIEW first. Replace YOUR_USER_ID with your users.id (same as auth.users.id).
--
-- What CASCADE handles automatically when you DELETE receipt_items:
--   • item_assignments (FK item_id ON DELETE CASCADE)
--
-- What you must clear manually (this script):
--   • events receipt/AI columns (tax, tip, fees, total, ai_stage, …)
--   • participants split fields (amount_owed, payment_status) if splits ran
--   • ai_audit_log (optional — append-only, no FK from receipt_items)
--   • storage.objects in bucket receipts (images are NOT deleted by SQL on public tables)
--
-- What is NOT removed by this script:
--   • settlement_log (append-only by design — blocks DELETE events if rows exist)
--   • notification_log rows (historical sends)
--   • participants / event_join_tokens (events are kept in MODE A)

-- ─── CONFIG ─────────────────────────────────────────────────────────────────
-- Your app user id (SELECT id FROM users LIMIT 20; or from Supabase Auth dashboard)
-- MODE A: reset scans on events you created (keeps events + members, ready to scan again)
-- MODE B: delete entire scanned events (destructive — see notes at bottom)

-- ═══════════════════════════════════════════════════════════════════════════
-- PREVIEW — run this first
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
  e.id,
  e.title,
  e.status,
  e.ai_stage,
  e.receipt_scan_attempted,
  e.total_amount,
  e.tax_amount,
  e.tip_amount,
  COUNT(ri.id) AS receipt_item_rows,
  COUNT(DISTINCT ia.id) AS item_assignment_rows
FROM events e
LEFT JOIN receipt_items ri ON ri.event_id = e.id
LEFT JOIN item_assignments ia ON ia.item_id = ri.id
WHERE e.payer_id = 'YOUR_USER_ID'
  AND (
    e.receipt_scan_attempted = true
    OR e.ai_stage <> 'none'
    OR EXISTS (SELECT 1 FROM receipt_items ri2 WHERE ri2.event_id = e.id)
  )
GROUP BY e.id, e.title, e.status, e.ai_stage, e.receipt_scan_attempted,
         e.total_amount, e.tax_amount, e.tip_amount
ORDER BY e.created_at DESC;

-- Optional columns on events (if preview above errors, check what exists):
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'events'
  AND column_name IN ('fees_amount', 'last_parse_attempt_id')
ORDER BY column_name;

-- Receipt images in Storage (paths like {event_id}/{uuid}.jpg)
SELECT name, created_at
FROM storage.objects
WHERE bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM events
    WHERE payer_id = 'YOUR_USER_ID'
      AND (receipt_scan_attempted = true OR ai_stage <> 'none')
  )
ORDER BY created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- MODE A — Reset receipt data, KEEP events (recommended for re-testing scans)
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

-- 1) Line items (+ item_assignments via CASCADE)
DELETE FROM receipt_items
WHERE event_id IN (
  SELECT id FROM events
  WHERE payer_id = 'YOUR_USER_ID'
    AND (
      receipt_scan_attempted = true
      OR ai_stage <> 'none'
    )
);

-- 2) Clear receipt / AI fields on events (skips columns missing on this DB)
DO $$
DECLARE
  extra_sets text := '';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'fees_amount'
  ) THEN
    extra_sets := extra_sets || ', fees_amount = NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'last_parse_attempt_id'
  ) THEN
    extra_sets := extra_sets || ', last_parse_attempt_id = NULL';
  END IF;

  EXECUTE format(
    $sql$
    UPDATE events
    SET
      total_amount = NULL,
      tax_amount = NULL,
      tip_amount = NULL,
      receipt_scan_attempted = false,
      ai_parse_success = NULL,
      ai_parse_confidence = NULL,
      ai_stage = 'none',
      split_mode = NULL,
      status = CASE
        WHEN status IN ('calculating', 'sent') THEN 'locked'
        ELSE status
      END
      %s
    WHERE payer_id = 'YOUR_USER_ID'
      AND (receipt_scan_attempted = true OR ai_stage <> 'none')
    $sql$,
    extra_sets
  );
END $$;

-- 3) Clear per-participant split amounts from any A2 run
UPDATE participants
SET
  amount_owed = NULL,
  payment_status = 'pending',
  message_sent_at = NULL,
  message_delivered_at = NULL,
  message_failed = false,
  message_channel = NULL,
  payment_link_tapped_at = NULL,
  self_reported_at = NULL,
  self_reported_method = NULL,
  confirmed_at = NULL
WHERE event_id IN (
  SELECT id FROM events WHERE payer_id = 'YOUR_USER_ID'
);

-- 4) Optional: remove A1 audit rows for those events
DELETE FROM ai_audit_log
WHERE agent = 'A1'
  AND event_id IN (SELECT id FROM events WHERE payer_id = 'YOUR_USER_ID');

-- 5) Delete receipt images from Storage bucket
DELETE FROM storage.objects
WHERE bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM events WHERE payer_id = 'YOUR_USER_ID'
  );

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- MODE B — DELETE entire scanned events (destructive)
-- ═══════════════════════════════════════════════════════════════════════════
-- WARNING:
--   • Deletes participants, join tokens, receipt_items, ai_audit_log (ON DELETE CASCADE).
--   • FAILS if settlement_log rows exist for those events (FK has no CASCADE).
--   • notification_log.event_id may become orphaned depending on FK — check first.
--
-- BEGIN;
-- DELETE FROM storage.objects
-- WHERE bucket_id = 'receipts'
--   AND (storage.foldername(name))[1] IN (
--     SELECT id::text FROM events
--     WHERE payer_id = 'YOUR_USER_ID'
--       AND (receipt_scan_attempted = true OR ai_stage <> 'none')
--   );
--
-- DELETE FROM events
-- WHERE payer_id = 'YOUR_USER_ID'
--   AND (receipt_scan_attempted = true OR ai_stage <> 'none');
-- COMMIT;
