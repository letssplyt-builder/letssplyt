import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../modules/ai/receipt-parser/receipt-parser.preprocess', () => ({
  preprocessReceiptImage: jest.fn((base64: string) => Promise.resolve(base64)),
  assertImageSize: jest.fn(),
}));

import { mockSupabase } from '../../mocks/supabase.mock';
import { createLLMProvider, mockLLMProvider } from '../../mocks/llm.mock';

const EVENT_ID = 'event-44444444-4444-4444-4444-444444444444';
const STORAGE_PATH = `${EVENT_ID}/receipt.jpg`;

function mockClaimUpdate(claimed: boolean) {
  const chain = {
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    select: jest.fn(() =>
      Promise.resolve({
        data: claimed ? [{ id: EVENT_ID }] : [],
        error: null,
      }),
    ),
  };
  return {
    update: jest.fn().mockReturnValue(chain),
    delete: jest.fn().mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    }),
    insert: jest.fn(() => Promise.resolve({ error: null })),
  };
}

function mockGetAiStage(stage: string) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn(() => Promise.resolve({ data: { ai_stage: stage }, error: null })),
      }),
    }),
  };
}

describe('a1-receipt-parser', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    createLLMProvider.mockReturnValue(mockLLMProvider);
    mockLLMProvider.complete.mockResolvedValue({
      text: JSON.stringify({
        items: [
          {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Burger',
            unit_price: 10,
            quantity: 1,
            confidence_score: 0.95,
          },
        ],
        subtotal: 10,
        tax: 1,
        tip: 2,
        total: 13,
        currency: 'USD',
        parse_confidence: 0.95,
      }),
      usage: { inputTokens: 10, outputTokens: 20 },
      modelUsed: 'mock-model',
    });

    global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]).buffer,
    } as Response);
  });

  it('calls LLM factory for vision parse', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          ...mockGetAiStage('none'),
          ...mockClaimUpdate(true),
        } as never;
      }
      if (table === 'receipt_items') {
        return mockClaimUpdate(true) as never;
      }
      return mockClaimUpdate(true) as never;
    });

    const { runA1ReceiptParse } = await import('../../../modules/ai/a1-receipt-parser');
    const result = await runA1ReceiptParse(EVENT_ID, STORAGE_PATH, 'Team Dinner');

    expect(createLLMProvider).toHaveBeenCalledWith('A1');
    expect(mockLLMProvider.complete).toHaveBeenCalled();
    expect(result.items[0].name).toBe('Burger');
    expect(result.total_amount).toBe(13);
  });

  it('returns cached result without calling AI when already parsed', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return mockGetAiStage('parsed') as never;
      }
      if (table === 'receipt_items') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: 'item-1',
                      name: 'Cached',
                      unit_price: 5,
                      quantity: 1,
                      confidence_score: 1,
                      is_low_confidence: false,
                    },
                  ],
                  error: null,
                }),
              ),
            }),
          }),
        } as never;
      }
      return mockGetAiStage('parsed') as never;
    });

    const { runA1ReceiptParse } = await import('../../../modules/ai/a1-receipt-parser');
    await runA1ReceiptParse(EVENT_ID, STORAGE_PATH);

    expect(mockLLMProvider.complete).not.toHaveBeenCalled();
  });

  it('rejects malformed AI response with PARSE_FAILED', async () => {
    mockLLMProvider.complete.mockResolvedValue({
      text: 'not-json',
      usage: { inputTokens: 1, outputTokens: 1 },
      modelUsed: 'mock-model',
    });

    mockSupabase.from.mockImplementation(() => ({
      ...mockGetAiStage('none'),
      ...mockClaimUpdate(true),
      update: jest
        .fn()
        .mockReturnValueOnce(mockClaimUpdate(true).update())
        .mockImplementation(() => Promise.resolve({ error: null })),
    } as never));

    const { runA1ReceiptParse } = await import('../../../modules/ai/a1-receipt-parser');
    await expect(runA1ReceiptParse(EVENT_ID, STORAGE_PATH)).rejects.toMatchObject({
      code: 'PARSE_FAILED',
      statusCode: 500,
    });
  });

  it('sanitizePromptInput strips unsafe event title from prompt', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          ...mockGetAiStage('none'),
          ...mockClaimUpdate(true),
        } as never;
      }
      if (table === 'receipt_items') {
        return mockClaimUpdate(true) as never;
      }
      return mockClaimUpdate(true) as never;
    });

    const { runA1ReceiptParse } = await import('../../../modules/ai/a1-receipt-parser');
    await runA1ReceiptParse(EVENT_ID, STORAGE_PATH, '<script>alert(1)</script>');

    const callPayload = JSON.stringify(mockLLMProvider.complete.mock.calls);
    expect(callPayload).not.toContain('<script>');
  });
});
