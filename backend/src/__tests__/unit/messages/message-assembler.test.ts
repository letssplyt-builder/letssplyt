import { describe, expect, it } from '@jest/globals';
import {
  assembleParticipantMessage,
  buildStandardOpeningLine,
} from '../../../modules/messages/message-assembler';
import { SMS_SINGLE_SEGMENT_LIMIT } from '../../../modules/messages/compact-sms';

describe('buildStandardOpeningLine', () => {
  it('follows the fixed greeting format', () => {
    expect(buildStandardOpeningLine('Bob', 'Dinner', 'Alex Host')).toBe(
      'Hi Bob!! Here is your share from Dinner organized by Alex Host.',
    );
  });
});

describe('assembleParticipantMessage', () => {
  const baseParams = {
    aiGreeting: 'Hi Bob!! Here is your share from Dinner organized by Alex Host.',
    displayName: 'Bob',
    payerDisplayName: 'Alex Host',
    amountOwed: 24.5,
    currency: 'USD',
    locale: 'en-US',
    eventName: 'Dinner',
    payerHandles: [
      { provider: 'venmo' as const, handle_value: '@alex-host' },
      { provider: 'paypal' as const, handle_value: 'paypal.me/alexhost' },
    ],
    supportedMethods: ['venmo', 'paypal'] as Array<'venmo' | 'paypal'>,
    isRegistered: false,
    breakdownUrl: 'https://letssplyt.app/s/abc123token',
  };

  it('uses compact single-link SMS under 160 characters', () => {
    const result = assembleParticipantMessage({
      ...baseParams,
      channel: 'sms',
    });

    expect(result.messageText.length).toBeLessThanOrEqual(SMS_SINGLE_SEGMENT_LIMIT);
    expect(result.messageText).toContain('$24.50');
    expect(result.messageText).toContain('https://letssplyt.app/s/abc123token');
    expect(result.messageText).not.toContain('See full split:');
    expect(result.messageText).not.toContain('Pay here:');
    expect(result.messageText).not.toContain('Venmo:');
    expect(result.paymentLinks).toHaveLength(2);
  });

  it('keeps full payment links in WhatsApp messages', () => {
    const result = assembleParticipantMessage({
      ...baseParams,
      channel: 'whatsapp',
      breakdownUrl: 'https://letssplyt.app/split/abc123token',
    });

    expect(result.messageText).toContain('Your share is $24.50');
    expect(result.messageText).toContain('See full split: https://letssplyt.app/split/abc123token');
    expect(result.messageText).toContain('Pay here:');
    expect(result.messageText).toContain('Venmo:');
    expect(result.messageText).toContain('PayPal:');
  });

  it('includes revision prefix in compact SMS', () => {
    const result = assembleParticipantMessage({
      ...baseParams,
      channel: 'sms',
      isRegistered: true,
      revisionLeadIn: 'Your share has been updated.',
    });

    expect(result.messageText.startsWith('Your share has been updated.')).toBe(true);
    expect(result.messageText.length).toBeLessThanOrEqual(SMS_SINGLE_SEGMENT_LIMIT);
  });
});
