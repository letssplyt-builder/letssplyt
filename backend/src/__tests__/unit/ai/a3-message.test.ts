import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../infrastructure/llm/ai-audit', () => ({
  writeAuditLog: jest.fn(),
}));

import { createLLMProvider, mockLLMProvider } from '../../mocks/llm.mock';
import { formatCurrency } from '../../../infrastructure/security';
import { getPaymentConfigForPhone } from '../../../config/payment-methods.config';
import {
  buildA3PromptForTest,
  composeParticipantMessage,
} from '../../../modules/messages/a3.agent';
import { buildPaymentLinksForMethods } from '../../../modules/messages/deepLinks';
import { buildA3Prompt } from '../../../modules/messages/a3.prompt';

const EVENT_ID = 'event-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa';

describe('A3 message composer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createLLMProvider.mockReturnValue(mockLLMProvider);
    mockLLMProvider.complete.mockResolvedValue({
      text: 'Hey Recipient! Hope you had an amazing time at Nobu — here is your share from dinner.',
      usage: { inputTokens: 40, outputTokens: 20 },
      modelUsed: 'mock-a3',
    });
  });

  it('builds A3 prompt WITHOUT participant display_name or phone numbers', () => {
    const prompt = buildA3Prompt('Nobu Dinner', '$25.00', ['Salmon', 'Ramen'], 'Alex');

    expect(prompt).not.toContain('Mark Johnson');
    expect(prompt).not.toContain('+14165550000');
    expect(prompt).toContain('Recipient');
    expect(prompt).toContain('Nobu Dinner');
    expect(prompt).toContain('$25.00');
  });

  it('sanitizes item names in the A3 prompt', () => {
    const prompt = buildA3Prompt('Event', '$10.00', ['<script>Sushi</script>'], 'Payer');
    expect(prompt).not.toContain('<script>');
    expect(prompt).toContain('Sushi');
  });

  it('inserts real display_name AFTER AI call in composed message', async () => {
    const result = await composeParticipantMessage({
      eventId: EVENT_ID,
      eventName: 'Nobu Dinner',
      displayName: 'Mark',
      payerDisplayName: 'Alex Payer',
      itemNames: ['Salmon'],
      amountOwed: 25,
      currency: 'USD',
      locale: 'en-US',
      payerHandles: [{ provider: 'paypal', handle_value: 'alex-pay' }],
      supportedMethods: ['paypal'],
      channel: 'sms',
      isRegistered: true,
    });

    expect(result.messageText).toContain('Mark');
    expect(mockLLMProvider.complete).toHaveBeenCalled();
    const promptContent = JSON.stringify(mockLLMProvider.complete.mock.calls);
    expect(promptContent).not.toContain('Mark');
    expect(promptContent).toContain('Recipient');
  });

  it('excludes Venmo and Zelle for Canadian +1 numbers', () => {
    const config = getPaymentConfigForPhone('+14165550000', 'CA');
    expect(config.supportedMethods).not.toContain('venmo');
    expect(config.supportedMethods).not.toContain('zelle');

    const links = buildPaymentLinksForMethods(
      [
        { provider: 'venmo', handle_value: 'venmo-user' },
        { provider: 'zelle', handle_value: 'zelle@email.com' },
        { provider: 'paypal', handle_value: 'paypal-user' },
      ],
      config.supportedMethods,
      20,
      'Dinner',
      'CAD',
      'en-CA',
    );

    expect(links.map((l) => l.provider)).toEqual(['paypal']);
  });

  it('includes Wise and excludes Venmo and CashApp for Indian numbers', () => {
    const config = getPaymentConfigForPhone('+919876543210', 'IN');
    expect(config.supportedMethods).toContain('wise');
    expect(config.supportedMethods).not.toContain('venmo');
    expect(config.supportedMethods).not.toContain('cashapp');

    const links = buildPaymentLinksForMethods(
      [
        { provider: 'venmo', handle_value: 'venmo-user' },
        { provider: 'cashapp', handle_value: '$cash' },
        { provider: 'wise', handle_value: 'wise-user' },
        { provider: 'upi', handle_value: 'user@upi' },
      ],
      config.supportedMethods,
      100,
      'Dinner',
      'INR',
      'en-IN',
    );

    expect(links.map((l) => l.provider)).toEqual(expect.arrayContaining(['wise', 'upi']));
    expect(links.map((l) => l.provider)).not.toContain('venmo');
    expect(links.map((l) => l.provider)).not.toContain('cashapp');
  });

  it('uses formatCurrency with event currency in prompt (not hardcoded $)', () => {
    const formatted = formatCurrency(1234.56, 'INR', 'en-IN');
    const prompt = buildA3PromptForTest('Event', formatted, [], 'Payer');
    expect(prompt).toContain(formatted);
    expect(prompt).not.toMatch(/\$1234/);
  });
});
