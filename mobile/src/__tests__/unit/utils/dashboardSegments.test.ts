import { describe, expect, it } from '@jest/globals';
import {
  pickDefaultHomeSegment,
  sumGuestCollectTotal,
  sumMemberCollectTotal,
} from '../../../utils/dashboardSegments';

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

  it('prefers Collect from when only members owe the viewer', () => {
    expect(
      pickDefaultHomeSegment(
        [],
        [{ user_id: 'u2', display_name: 'Jordan', avatar_colour: '#000', net_amount: 25 }],
        [],
      ),
    ).toBe('collect');
  });

  it('prefers Collect from when only guests owe the viewer', () => {
    expect(
      pickDefaultHomeSegment(
        [],
        [],
        [{ guest_key: 'g1', kind: 'phone', display_name: 'Guest', amount: 15 }],
      ),
    ).toBe('collect');
  });

  it('defaults to Pay to when all lists are empty', () => {
    expect(pickDefaultHomeSegment([], [], [])).toBe('pay');
  });
});

describe('collect totals', () => {
  it('sums member and guest amounts', () => {
    expect(
      sumMemberCollectTotal([
        { user_id: 'u1', display_name: 'A', avatar_colour: '#000', net_amount: 10 },
        { user_id: 'u2', display_name: 'B', avatar_colour: '#000', net_amount: 5.5 },
      ]),
    ).toBe(15.5);
    expect(
      sumGuestCollectTotal([
        { guest_key: 'g1', kind: 'phone', display_name: 'C', amount: 8 },
        { guest_key: 'g2', kind: 'name_only', display_name: 'D', amount: 2 },
      ]),
    ).toBe(10);
  });
});
