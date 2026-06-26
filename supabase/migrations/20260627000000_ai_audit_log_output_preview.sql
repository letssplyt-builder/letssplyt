-- Store a short snippet of failed model output for A1/A2/A3 debugging (no migration on events).
ALTER TABLE ai_audit_log
  ADD COLUMN IF NOT EXISTS output_preview TEXT;
