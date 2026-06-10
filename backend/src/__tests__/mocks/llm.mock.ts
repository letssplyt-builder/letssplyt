import { jest } from '@jest/globals';

type LLMCompleteResult = {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  modelUsed: string;
};

const DEFAULT_PARSE_JSON = {
  items: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Item',
      unit_price: 10.0,
      quantity: 1,
      confidence_score: 0.95,
    },
  ],
  subtotal: 10.0,
  tax: 1.0,
  tip: 2.0,
  total: 13.0,
  currency: 'USD',
  parse_confidence: 0.95,
};

export const mockLLMProvider = {
  supportsVision: true,
  complete: jest.fn<() => Promise<LLMCompleteResult>>().mockResolvedValue({
    text: JSON.stringify(DEFAULT_PARSE_JSON),
    usage: { inputTokens: 100, outputTokens: 50 },
    modelUsed: 'mock-model',
  }),
};

export const createLLMProvider = jest
  .fn<() => typeof mockLLMProvider>()
  .mockReturnValue(mockLLMProvider);
