-- Repair settlement_log audit columns (required by E09-S01 settlement.service writeSettlementLog).
-- Safe on fresh installs where 20260601000000 already defined these columns.

ALTER TABLE settlement_log
  ADD COLUMN IF NOT EXISTS from_status TEXT CHECK (
    from_status IS NULL OR from_status IN (
      'pending', 'self_reported', 'payer_marked', 'confirmed',
      'disputed', 'opted_out', 'settled'
    )
  ),
  ADD COLUMN IF NOT EXISTS to_status TEXT CHECK (
    to_status IS NULL OR to_status IN (
      'pending', 'self_reported', 'payer_marked', 'confirmed',
      'disputed', 'opted_out', 'settled'
    )
  ),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN settlement_log.from_status IS 'Payment status before this transition';
COMMENT ON COLUMN settlement_log.to_status IS 'Payment status after this transition';
