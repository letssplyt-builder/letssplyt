import type { LLMProvider } from './llm.provider';
import { AnthropicAdapter } from './providers/anthropic.adapter';
import { GeminiAdapter } from './providers/gemini.adapter';

export type AgentKey = 'A1' | 'A2' | 'A3';

/**
 * Reads AI_PROVIDER_Ax and AI_MODEL_Ax from environment and returns the correct adapter.
 * Harness files MUST call this function — never import provider SDKs directly.
 */
export function createLLMProvider(agent: AgentKey): LLMProvider {
  const provider = process.env[`AI_PROVIDER_${agent}`] ?? 'gemini';
  const model = process.env[`AI_MODEL_${agent}`] ?? 'gemini-2.5-flash';

  let adapter: LLMProvider;

  switch (provider) {
    case 'anthropic':
      adapter = new AnthropicAdapter(model);
      break;
    case 'gemini':
      adapter = new GeminiAdapter(model);
      break;
    default:
      throw new Error(`Unknown AI provider: "${provider}" for agent ${agent}`);
  }

  if (agent === 'A1' && !adapter.supportsVision) {
    throw new Error(
      'Provider for A1 does not support vision input. A1 requires vision capability.',
    );
  }

  return adapter;
}
