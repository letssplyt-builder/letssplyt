export interface LLMTextBlock {
  type: 'text';
  text: string;
}

export interface LLMImageBlock {
  type: 'image';
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export type LLMContentBlock = LLMTextBlock | LLMImageBlock;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  text: string;
  usage: LLMUsage;
  modelUsed: string;
}

export interface LLMCompletionOptions {
  maxTokens?: number;
  timeout?: number;
  /** When true, Gemini uses responseMimeType application/json (A1 receipt parse). */
  responseJson?: boolean;
}

export interface LLMProvider {
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMResponse>;

  supportsVision: boolean;
}
