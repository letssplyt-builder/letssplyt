import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMCompletionOptions,
  LLMMessage,
  LLMProvider,
  LLMResponse,
} from '../llm.provider';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 10_000;

function isRetriable(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const msg = err.message.toLowerCase();
  if (msg.includes('api key') || msg.includes('invalid') || msg.includes('400')) {
    return false;
  }
  return true;
}

function jitteredDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return Math.random() * exponential;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AnthropicAdapter implements LLMProvider {
  readonly supportsVision = true;
  private client = new Anthropic();

  constructor(private readonly model: string) {}

  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<LLMResponse> {
    const { maxTokens = 1024, timeout = 20_000 } = options;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await this.client.messages.create(
          {
            model: this.model,
            max_tokens: maxTokens,
            messages: messages.map((m) => ({
              role: m.role,
              content:
                typeof m.content === 'string'
                  ? m.content
                  : m.content.map((block) =>
                      block.type === 'image'
                        ? {
                            type: 'image' as const,
                            source: {
                              type: 'base64' as const,
                              media_type: block.mimeType,
                              data: block.base64,
                            },
                          }
                        : { type: 'text' as const, text: block.text },
                    ),
            })),
          },
          { signal: controller.signal },
        );

        const text =
          response.content[0]?.type === 'text' ? response.content[0].text : '';
        return {
          text,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
          modelUsed: response.model,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (!isRetriable(err) || attempt === MAX_ATTEMPTS) break;
        await sleep(jitteredDelay(attempt));
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error('Anthropic request failed');
  }
}
