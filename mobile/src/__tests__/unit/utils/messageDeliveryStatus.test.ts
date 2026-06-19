import { describe, expect, it } from '@jest/globals';
import {
  deriveMessageDeliveryStatus,
  isTerminalMessageDeliveryStatus,
  messageDeliveryAccessibilityLabel,
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
    expect(
      deriveMessageDeliveryStatus({ join_method: 'manual_name_only' }),
    ).toBe('skipped');
  });

  it('never returns queued for manual_name_only even without send results', () => {
    expect(
      deriveMessageDeliveryStatus({
        join_method: 'manual_name_only',
        message_sent_at: null,
        message_delivered_at: null,
        message_failed: false,
      }),
    ).toBe('skipped');
    expect(
      deriveMessageDeliveryStatus({
        join_method: 'manual_name_only',
      }),
    ).not.toBe('queued');
  });

  it('labels skipped name-only members for accessibility', () => {
    expect(messageDeliveryAccessibilityLabel('Raj', 'skipped')).toBe('Raj — message skipped');
  });

  it('treats sent, delivered, failed, and skipped as terminal', () => {
    expect(isTerminalMessageDeliveryStatus('sent')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('delivered')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('failed')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('skipped')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('queued')).toBe(false);
  });
});
