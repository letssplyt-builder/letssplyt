import { describe, expect, it } from '@jest/globals';
import {
  deriveMessageDeliveryStatus,
  formatFailedRecipientNames,
  isTerminalMessageDeliveryStatus,
  listFailedSmsRecipients,
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

  it('lists only phone-backed failed recipients', () => {
    expect(
      listFailedSmsRecipients([
        {
          id: 'org',
          display_name: 'Alex',
          is_organiser: true,
          message_failed: true,
        },
        {
          id: 'cash',
          display_name: 'Raj',
          join_method: 'manual_name_only',
          message_failed: true,
        },
        {
          id: 'ok',
          display_name: 'Sam',
          join_method: 'qr_web',
          message_failed: false,
        },
        {
          id: 'fail',
          display_name: 'Jordan',
          join_method: 'qr_web',
          message_failed: true,
        },
      ]).map((row) => row.id),
    ).toEqual(['fail']);
  });

  it('formats failed recipient names for the banner', () => {
    expect(formatFailedRecipientNames(['Jordan'])).toBe('Jordan');
    expect(formatFailedRecipientNames(['Jordan', 'Sam'])).toBe('Jordan and Sam');
    expect(formatFailedRecipientNames(['Jordan', 'Sam', 'Mia'])).toBe(
      'Jordan, Sam, and Mia',
    );
  });

  it('treats sent, delivered, failed, and skipped as terminal', () => {
    expect(isTerminalMessageDeliveryStatus('sent')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('delivered')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('failed')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('skipped')).toBe(true);
    expect(isTerminalMessageDeliveryStatus('queued')).toBe(false);
  });
});
