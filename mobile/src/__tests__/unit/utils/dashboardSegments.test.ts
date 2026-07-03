import { describe, expect, it } from '@jest/globals';
import { pickDefaultHomeSegment } from '../../../utils/dashboardSegments';

describe('pickDefaultHomeSegment', () => {
  it('prefers Pay to when viewer owes members', () => {
    expect(
      pickDefaultHomeSegment(
        [{ user_id: 'u1', display_name: 'Sam', avatar_colour: '#000', net_amount: 12 }],
        [{ user_id: 'u2', display_name: 'Jordan', avatar_colour: '#000', net_amount: 25 }],
        [],
      ),
    ).toBe('pay');
  });

  it('prefers Collect From when only members owe the viewer', () => {
    expect(
      pickDefaultHomeSegment(
        [],
        [{ user_id: 'u2', display_name: 'Jordan', avatar_colour: '#000', net_amount: 25 }],
        [],
      ),
    ).toBe('collect');
  });

  it('prefers Guest Collect when only guests owe the viewer', () => {
    expect(
      pickDefaultHomeSegment(
        [],
        [],
        [{ guest_key: 'g1', kind: 'phone', display_name: 'Guest', amount: 15 }],
      ),
    ).toBe('guests');
  });

  it('defaults to Pay to when all lists are empty', () => {
    expect(pickDefaultHomeSegment([], [], [])).toBe('pay');
  });
});
