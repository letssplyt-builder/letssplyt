-- Run in Supabase SQL Editor to verify receipt_items matches E07 expectations.
-- Every row in expected_columns should show present = true.

WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'id',
    'event_id',
    'name',
    'unit_price',
    'quantity',
    'line_total',
    'confidence_score',
    'is_low_confidence',
    'is_tax',
    'is_fee',
    'is_tip',
    'is_shared',
    'ai_extracted',
    'receipt_s3_key',
    'created_at'
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

-- Legacy columns that should NOT exist after repair (optional check).
SELECT column_name AS legacy_column_still_present
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'receipt_items'
  AND column_name IN ('description', 'price');
