import type {
  GuestCounterpartyRow,
  MemberCounterpartyRow,
} from '@letssplyt/shared/counterparty.types';

export type HomeSegment = 'pay' | 'collect' | 'guests';

/** Pick the first dashboard tab that has list data; otherwise Pay to. */
export function pickDefaultHomeSegment(
  membersYouOwe: MemberCounterpartyRow[],
  membersOweYou: MemberCounterpartyRow[],
  guests: GuestCounterpartyRow[],
): HomeSegment {
  if (membersYouOwe.length > 0) {
    return 'pay';
  }
  if (membersOweYou.length > 0) {
    return 'collect';
  }
  if (guests.length > 0) {
    return 'guests';
  }
  return 'pay';
}
