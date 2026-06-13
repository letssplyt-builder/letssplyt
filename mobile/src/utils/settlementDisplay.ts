import { providerLabel } from './profile';

const COMPLETE_PAYMENT_STATUSES = new Set([
  'confirmed',
  'payer_marked',
  'settled',
]);

export function isViewerPaymentComplete(status: string | null | undefined): boolean {
  if (!status) return false;
  return COMPLETE_PAYMENT_STATUSES.has(status) || status === 'opted_out';
}

export function paymentMethodDisplayLabel(method: string | null | undefined): string | null {
  if (!method) return null;
  const known = ['venmo', 'paypal', 'cashapp', 'zelle', 'wise', 'cash', 'bank_transfer', 'other'];
  if (known.includes(method)) {
    if (method === 'cash') return 'Cash';
    if (method === 'bank_transfer') return 'Bank transfer';
    if (method === 'other') return 'Other';
    return providerLabel(method as 'venmo');
  }
  return method;
}

export interface RosterPaymentStatusDisplay {
  label: string;
  tone: 'paid' | 'pending' | 'disputed' | 'muted';
}

export function rosterPaymentStatusDisplay(
  paymentStatus: string,
  paymentMethod?: string | null,
): RosterPaymentStatusDisplay {
  if (paymentStatus === 'opted_out') {
    return { label: 'Opted out', tone: 'muted' };
  }

  if (paymentStatus === 'disputed') {
    return { label: 'Disputed. Pending', tone: 'disputed' };
  }

  if (
    paymentStatus === 'confirmed' ||
    paymentStatus === 'payer_marked' ||
    paymentStatus === 'settled' ||
    paymentStatus === 'self_reported'
  ) {
    const methodLabel = paymentMethodDisplayLabel(paymentMethod);
    return {
      label: methodLabel ? `Paid by ${methodLabel}` : 'Paid',
      tone: 'paid',
    };
  }

  if (paymentStatus === 'pending') {
    return { label: 'Pending', tone: 'pending' };
  }

  return { label: paymentStatus.replace(/_/g, ' '), tone: 'muted' };
}
