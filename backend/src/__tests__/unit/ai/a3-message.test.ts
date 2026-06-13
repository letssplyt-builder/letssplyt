import { describe, expect, it } from '@jest/globals';
import { formatCurrency } from '../../../infrastructure/security';
import { getPaymentConfigForPhone } from '../../../config/payment-methods.config';
import {
  buildA3PromptForTest,
  composeParticipantMessage,
} from '../../../modules/messages/a3.agent';
import { buildPaymentLinksForMethods } from '../../../modules/messages/deepLinks';
import { buildA3Prompt } from '../../../modules/messages/a3.prompt';
import { buildStandardOpeningLine } from '../../../modules/messages/message-assembler';

const EVENT_ID = 'event-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa';

describe('A3 message composer', () => {
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

  it('uses deterministic opening line with participant and event names', async () => {
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

    expect(result.messageText).toContain(
      'Hi Mark!! Here is your share from Nobu Dinner organized by Alex Payer.',
    );
    expect(result.messageText).toContain('Your share is $25.00');
    expect(result.messageText).toContain('Mark');
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
      'USD',
      'en-US',
    );

    expect(links.map((link) => link.provider)).toEqual(['paypal']);
  });

  it('buildStandardOpeningLine matches product format', () => {
    const line = buildStandardOpeningLine('Sam', 'Friday Dinner', 'Alex Payer');
    expect(line).toBe('Hi Sam!! Here is your share from Friday Dinner organized by Alex Payer.');
  });

  it('buildA3PromptForTest delegates to buildA3Prompt', () => {
    const prompt = buildA3PromptForTest('Event', '$12.00', ['Tacos'], 'Host');
    expect(prompt).toContain('Event');
    expect(prompt).toContain('$12.00');
  });

  it('formats currency in composed message for non-USD', async () => {
    const amount = 10.5;
    const result = await composeParticipantMessage({
      eventId: EVENT_ID,
      eventName: 'Lunch',
      displayName: 'Yuki',
      payerDisplayName: 'Host',
      itemNames: [],
      amountOwed: amount,
      currency: 'EUR',
      locale: 'de-DE',
      payerHandles: [],
      supportedMethods: [],
      channel: 'sms',
      isRegistered: false,
    });

    const formatted = formatCurrency(amount, 'EUR', 'de-DE');
    expect(result.messageText).toContain(formatted);
  });
});
