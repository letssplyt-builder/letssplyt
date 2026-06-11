import { describe, expect, it } from '@jest/globals';
import { assembleParticipantMessage } from '../../../modules/messages/message-assembler';

describe('assembleParticipantMessage', () => {
  it('includes breakdown link in SMS body when provided', () => {
    const result = assembleParticipantMessage({
      aiGreeting: 'Hi Bob!',
      displayName: 'Bob',
      amountOwed: 24.5,
      currency: 'USD',
      locale: 'en-US',
      eventName: 'Dinner',
      payerHandles: [],
      supportedMethods: [],
      channel: 'sms',
      isRegistered: false,
      breakdownUrl: 'https://letssplyt.app/split/abc123',
    });

    expect(result.messageText).toContain('Your share is $24.50');
    expect(result.messageText).toContain('See full split: https://letssplyt.app/split/abc123');
  });
});
