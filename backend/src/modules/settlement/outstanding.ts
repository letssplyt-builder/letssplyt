export const OUTSTANDING_PAYMENT_STATUSES = ['pending', 'disputed'] as const;

export function isOutstandingPaymentStatus(status: string): boolean {
  return (OUTSTANDING_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export function sumAmounts(amounts: Array<number | null | undefined>): number {
  return amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
}
