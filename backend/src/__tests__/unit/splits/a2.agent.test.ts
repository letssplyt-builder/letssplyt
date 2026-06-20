import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../modules/splits/a2-idempotency', () => ({
  claimCalculatingSlot: jest.fn(() => Promise.resolve(true)),
  setAiStage: jest.fn(() => Promise.resolve()),
}));

import { createLLMProvider, mockLLMProvider } from '../../mocks/llm.mock';
import { assignItems } from '../../../modules/splits/a2.agent';
import { claimCalculatingSlot, setAiStage } from '../../../modules/splits/a2-idempotency';

const EVENT_ID = 'event-55555555-5555-5555-5555-555555555555';

const ITEMS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Burger', unit_price: 18, quantity: 1 },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Salad', unit_price: 12, quantity: 1 },
];

const PARTICIPANTS = [{ display_name: 'Alex' }, { display_name: 'Jordan' }];

const TOTALS = {
  subtotal: 30,
  tax: 2.4,
  fees: 0,
  tip: 3,
  discounts: 0,
  total: 35.4,
};

describe('a2.agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createLLMProvider.mockReturnValue(mockLLMProvider);
    jest.mocked(claimCalculatingSlot).mockResolvedValue(true);
    jest.mocked(setAiStage).mockResolvedValue(undefined);
  });

  it('uses createLLMProvider with A2 and returns complete assignments', async () => {
    mockLLMProvider.complete.mockResolvedValue({
      text: JSON.stringify({
        assignments: [
          { item_id: ITEMS[0].id, assigned_to: ['Alex'] },
          { item_id: ITEMS[1].id, assigned_to: ['Jordan'] },
        ],
        unassigned_item_ids: [],
        confidence: 0.95,
      }),
      usage: { inputTokens: 50, outputTokens: 80 },
      modelUsed: 'mock-a2',
    });

    const result = await assignItems(
      EVENT_ID,
      'Alex had the burger, Jordan had the salad',
      ITEMS,
      PARTICIPANTS,
      TOTALS,
      'USD',
    );

    expect(createLLMProvider).toHaveBeenCalledWith('A2');
    expect(result.status).toBe('complete');
    expect(result.unassignedItemIds).toEqual([]);
    expect(result.splits.length).toBe(2);
    expect(setAiStage).toHaveBeenCalledWith(EVENT_ID, 'calculated');
    expect(result.splits.reduce((sum, row) => sum + row.amountOwed, 0)).toBeCloseTo(35.4, 1);
  });

  it('returns partial status when model leaves items unassigned', async () => {
    mockLLMProvider.complete.mockResolvedValue({
      text: JSON.stringify({
        assignments: [{ item_id: ITEMS[0].id, assigned_to: ['Alex'] }],
        unassigned_item_ids: [ITEMS[1].id],
        confidence: 0.6,
      }),
      usage: { inputTokens: 40, outputTokens: 60 },
      modelUsed: 'mock-a2',
    });

    const result = await assignItems(
      EVENT_ID,
      'Alex had the burger',
      ITEMS,
      PARTICIPANTS,
      TOTALS,
      'USD',
    );

    expect(result.status).toBe('partial');
    expect(result.unassignedItemIds).toEqual([ITEMS[1].id]);
    expect(result.requiresReview).toBe(true);
    expect(setAiStage).toHaveBeenCalledWith(EVENT_ID, 'parsed_confirmed');
  });

  it('retries on invalid JSON then succeeds', async () => {
    mockLLMProvider.complete
      .mockResolvedValueOnce({
        text: 'not json',
        usage: { inputTokens: 10, outputTokens: 5 },
        modelUsed: 'mock-a2',
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          assignments: [
            { item_id: ITEMS[0].id, assigned_to: ['Alex', 'Jordan'] },
            { item_id: ITEMS[1].id, assigned_to: ['Alex', 'Jordan'] },
          ],
          unassigned_item_ids: [],
          confidence: 0.9,
        }),
        usage: { inputTokens: 40, outputTokens: 60 },
        modelUsed: 'mock-a2',
      });

    const result = await assignItems(
      EVENT_ID,
      'everyone shared everything',
      ITEMS,
      PARTICIPANTS,
      TOTALS,
      'USD',
    );

    expect(mockLLMProvider.complete).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('complete');
  });
});
