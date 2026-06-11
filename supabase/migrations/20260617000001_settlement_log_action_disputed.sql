-- Allow settlement_log.action = 'disputed' (payer rejects self-report).
-- Dev DB may have an older CHECK missing this value.

ALTER TABLE settlement_log DROP CONSTRAINT IF EXISTS settlement_log_action_check;

ALTER TABLE settlement_log ADD CONSTRAINT settlement_log_action_check
  CHECK (action IN (
    'self_reported',
    'confirmed',
    'disputed',
    'settled',
    'cancelled',
    'nudged',
    'opted_out'
  ));
