import { describe, expect, it } from '@jest/globals';
import {
  buildConsolidatedNudgeMessage,
  buildNudgeMessage,
} from '../../../modules/messages/nudge.builder';

describe('nudge.builder', () => {
  it('keeps a single-event reminder within one SMS segment', () => {
    const text = buildNudgeMessage({
      participantDisplayName: 'Jordan',
      payerDisplayName: 'Alex',
      amountFormatted: '$12.50',
      eventTitle: 'Dinner',
    });
    expect(text).toContain('$12.50');
    expect(text.length).toBeLessThanOrEqual(160);
  });

  it('includes the total, event count, and details URL for a consolidated reminder', () => {
    const text = buildConsolidatedNudgeMessage({
      participantDisplayName: 'Jordan',
      payerDisplayName: 'Alex',
      totalFormatted: '$45.00',
      eventCount: 2,
      detailsUrl: 'https://letssplyt.app/nudge/abc123',
    });
    expect(text).toContain('$45.00');
    expect(text).toContain('2 events');
    expect(text).toContain('https://letssplyt.app/nudge/abc123');
    expect(text).toContain('See details & pay');
  });

  it('uses singular event wording for one outstanding event', () => {
    const text = buildConsolidatedNudgeMessage({
      participantDisplayName: 'Jordan',
      payerDisplayName: 'Alex',
      totalFormatted: '$20.00',
      eventCount: 1,
      detailsUrl: 'https://letssplyt.app/nudge/abc123',
    });
    expect(text).toContain('1 event');
    expect(text).not.toContain('1 events');
  });
});
