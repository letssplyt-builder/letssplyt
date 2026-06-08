import type { AgentKey } from './factory';
import { supabaseAdmin } from '../supabase';
import logger from '../logger';

export interface AuditLogParams {
  agent: AgentKey;
  eventId: string;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
  success: boolean;
  errorCode?: string;
  provider?: string;
  inputHash?: string;
  outputHash?: string;
  latencyMs?: number;
  attempts?: number;
}

/** Fire-and-forget audit log writer — never throws. */
export function writeAuditLog(params: AuditLogParams): void {
  void (async () => {
    try {
      const provider =
        params.provider ?? process.env[`AI_PROVIDER_${params.agent}`] ?? 'unknown';

      await supabaseAdmin.from('ai_audit_log').insert({
        event_id: params.eventId,
        agent: params.agent,
        provider,
        model_used: params.modelUsed,
        input_hash: params.inputHash ?? null,
        output_hash: params.outputHash ?? null,
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        latency_ms: params.latencyMs ?? null,
        attempts: params.attempts ?? 1,
        success: params.success,
        error_code: params.errorCode ?? null,
      });
    } catch (err) {
      logger.error({ err, agent: params.agent }, 'Failed to write AI audit log');
    }
  })();
}
