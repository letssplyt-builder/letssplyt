import type {
  GuestCounterpartyRow,
  MemberCounterpartyRow,
} from '@letssplyt/shared/counterparty.types';

export type HomeSegment = 'pay' | 'collect';

/** Pick Collect from when anyone owes the viewer; otherwise Pay to. */
export function pickDefaultHomeSegment(
  membersYouOwe: MemberCounterpartyRow[],
  membersOweYou: MemberCounterpartyRow[],
  guests: GuestCounterpartyRow[],
): HomeSegment {
  if (membersYouOwe.length > 0) {
    return 'pay';
  }
  if (membersOweYou.length > 0 || guests.length > 0) {
    return 'collect';
  }
  return 'pay';
}

export function sumMemberCollectTotal(rows: MemberCounterpartyRow[]): number {
  return rows.reduce((sum, row) => sum + row.net_amount, 0);
}

export function sumGuestCollectTotal(rows: GuestCounterpartyRow[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}
