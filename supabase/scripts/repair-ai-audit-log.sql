-- Recreate public.ai_audit_log if missing (migration #1 object dropped or repair-marked without apply).
-- Safe to run multiple times. Run in Supabase SQL Editor on DEV only.

CREATE TABLE IF NOT EXISTS public.ai_audit_log (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID         REFERENCES public.events(id) ON DELETE CASCADE,
  agent       VARCHAR(2)   NOT NULL CHECK (agent IN ('A1','A2','A3')),
  provider    TEXT         NOT NULL,
  model_used  TEXT         NOT NULL,
  input_hash  TEXT,
  output_hash TEXT,
  input_tokens  INT,
  output_tokens INT,
  latency_ms    INT,
  attempts      SMALLINT    NOT NULL DEFAULT 1,
  success       BOOLEAN     NOT NULL,
  error_code    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_event ON public.ai_audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_agent_event ON public.ai_audit_log(agent, event_id);

ALTER TABLE public.ai_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role only — no client policies (matches migration #1)

SELECT
  CASE WHEN to_regclass('public.ai_audit_log') IS NOT NULL THEN 'ok' ELSE 'STILL MISSING' END AS ai_audit_log_status;
