import { describe, expect, it } from '@jest/globals';
import {
  buildCompactSmsMessage,
  SMS_SINGLE_SEGMENT_LIMIT,
  smsSegmentCount,
} from '../../../modules/messages/compact-sms';

describe('buildCompactSmsMessage', () => {
  const payUrl = 'https://letssplyt.app/s/abcdefghijklmnopqrstuvwx';

  it('fits a typical US split message in one SMS segment', () => {
    const message = buildCompactSmsMessage({
      displayName: 'Jordan K.',
      payerDisplayName: 'Alex R.',
      eventName: 'Team Dinner',
      formattedAmount: '$42.50',
      payUrl,
    });

    expect(message.length).toBeLessThanOrEqual(SMS_SINGLE_SEGMENT_LIMIT);
    expect(message).toContain('$42.50');
    expect(message).toContain(payUrl);
    expect(message).not.toContain('Venmo:');
    expect(message).not.toContain('PayPal:');
    expect(smsSegmentCount(message)).toBe(1);
  });

  it('includes revision prefix when provided', () => {
    const message = buildCompactSmsMessage({
      displayName: 'Jordan',
      payerDisplayName: 'Alex',
      eventName: 'Dinner',
      formattedAmount: '$20.00',
      payUrl,
      revisionLeadIn: 'Your share has been updated.',
    });

    expect(message.startsWith('Your share has been updated.')).toBe(true);
    expect(message.length).toBeLessThanOrEqual(SMS_SINGLE_SEGMENT_LIMIT);
  });

  it('shortens long event titles to stay within 160 characters', () => {
    const message = buildCompactSmsMessage({
      displayName: 'Jordan',
      payerDisplayName: 'Alexandra',
      eventName: 'Friday Night Celebration Dinner at Osteria Morini with the whole team',
      formattedAmount: '$128.75',
      payUrl,
    });

    expect(message.length).toBeLessThanOrEqual(SMS_SINGLE_SEGMENT_LIMIT);
    expect(message).toContain('$128.75');
    expect(message).toContain(payUrl);
  });
});
