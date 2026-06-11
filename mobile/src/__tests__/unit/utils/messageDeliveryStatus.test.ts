import { describe, expect, it } from '@jest/globals';
import {
  deriveMessageDeliveryStatus,
  isTerminalMessageDeliveryStatus,
} from '../../../utils/messageDeliveryStatus';

describe('messageDeliveryStatus', () => {
  it('maps participant fields to delivery statuses', () => {
    expect(deriveMessageDeliveryStatus({})).toBe('queued');
    expect(
      deriveMessageDeliveryStatus({ message_sent_at: '2026-01-01T00:00:00.000Z' }),
    ).toBe('sent');
    expect(
      deriveMessageDeliveryStatus({
        message_sent_at: '2026-01-01T00:00:00.000Z',
        message_delivered_at: '2026-01-01T00:00:01.000Z',
      }),
    ).toBe('delivered');
    expect(deriveMessageDeliveryStatus({ message_failed: true })).toBe('failed');
    expect(deriveMessageDeliveryStatus({}, 'skipped_opt_out')).toBe('skipped');
  });

  it('treats sent, delivered, failed, and skipped as terminal', () => {
    expect(isTerminalMessageDeliveryStatus('sent')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('delivered')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('failed')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('skipped')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('queued')).toBe(false);
  });
});
