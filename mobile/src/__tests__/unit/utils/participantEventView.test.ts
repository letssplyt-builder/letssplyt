import { describe, expect, it } from '@jest/globals';
import {
  resolveParticipantShareHero,
  splitModeDescription,
} from '../../../utils/participantEventView';

const baseEvent = {
  id: 'event-1',
  payer_id: 'payer-1',
  title: 'Dinner',
  event_date: null,
  total_amount: null,
  currency: 'USD',
  status: 'open' as const,
  split_mode: null,
  ai_stage: 'none' as const,
  locale: 'en-US',
  locked_at: null,
  messages_sent_at: null,
  fully_settled_at: null,
  created_at: '2026-06-08T00:00:00.000Z',
  updated_at: '2026-06-08T00:00:00.000Z',
};

describe('participantEventView', () => {
  it('describes split modes', () => {
    expect(splitModeDescription('equal')).toContain('evenly');
    expect(splitModeDescription('portion')).toContain('portion');
    expect(splitModeDescription('itemised')).toContain('Itemised');
    expect(splitModeDescription(null)).toBeNull();
  });

  it('shows open-group waiting copy when share is not ready', () => {
    const hero = resolveParticipantShareHero(baseEvent, null, 'Alex');
    expect(hero.pending).toBe(true);
    expect(hero.amount).toBeNull();
    expect(hero.statusLine).toContain('This event is still open');
    expect(hero.statusLine).toContain('Alex');
  });

  it('shows locked preparing copy before calculation', () => {
    const hero = resolveParticipantShareHero(
      { ...baseEvent, status: 'locked', ai_stage: 'parsing' },
      null,
      'Alex',
    );
    expect(hero.statusLine).toContain('Bill locked');
    expect(hero.statusLine).toContain('preparing');
  });

  it('shows calculated amount when available', () => {
    const hero = resolveParticipantShareHero(
      { ...baseEvent, status: 'sent', ai_stage: 'complete' },
      42.5,
      'Alex',
    );
    expect(hero.pending).toBe(false);
    expect(hero.amount).toBe(42.5);
  });
});
