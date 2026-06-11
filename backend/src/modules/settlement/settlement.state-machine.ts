export type PaymentStatus =
  | 'pending'
  | 'self_reported'
  | 'payer_marked'
  | 'confirmed'
  | 'disputed'
  | 'opted_out'
  | 'settled';

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['self_reported', 'confirmed', 'payer_marked', 'opted_out'],
  self_reported: ['confirmed', 'disputed'],
  payer_marked: ['confirmed'],
  confirmed: ['settled'],
  disputed: ['pending'],
  opted_out: [],
  settled: [],
};

export function assertTransitionAllowed(from: PaymentStatus, to: PaymentStatus): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid settlement transition: ${from} → ${to}`);
  }
}

export function isSettlementCompleteStatus(status: string): boolean {
  return (
    status === 'confirmed' ||
    status === 'settled' ||
    status === 'opted_out' ||
    status === 'payer_marked'
  );
}
