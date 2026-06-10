import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import { formatCurrency } from '../../infrastructure/security';

export interface PaymentLinkResult {
  provider: PaymentProvider;
  label: string;
  url: string;
}

export interface PayerHandleInput {
  provider: PaymentProvider;
  handle_value: string;
}

/**
 * Build a single payment deep link for a payer handle.
 * amountMajorUnits is in major currency units (e.g. 12.34 for USD).
 */
export function buildPaymentLink(
  provider: PaymentProvider,
  handleValue: string,
  amountMajorUnits: number,
  eventName: string,
  currency: string,
  locale: string,
): PaymentLinkResult | null {
  const encodedNote = encodeURIComponent(`${eventName} split`);
  const numericAmount = amountMajorUnits.toFixed(2);

  switch (provider) {
    case 'venmo':
      return {
        provider: 'venmo',
        label: 'Venmo',
        url: `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(handleValue)}&amount=${numericAmount}&note=${encodedNote}`,
      };

    case 'paypal':
      return {
        provider: 'paypal',
        label: 'PayPal',
        url: `https://paypal.me/${encodeURIComponent(handleValue)}/${numericAmount}`,
      };

    case 'cashapp':
      return {
        provider: 'cashapp',
        label: 'Cash App',
        url: `https://cash.app/${encodeURIComponent(handleValue)}/${numericAmount}`,
      };

    case 'zelle':
      return {
        provider: 'zelle',
        label: 'Zelle',
        url: buildZelleInstruction(handleValue),
      };

    case 'wise':
      return {
        provider: 'wise',
        label: 'Wise',
        url: `https://wise.com/pay/me/${encodeURIComponent(handleValue)}`,
      };

    case 'upi':
      return {
        provider: 'upi',
        label: 'UPI',
        url: `upi://pay?pa=${encodeURIComponent(handleValue)}&am=${numericAmount}&cu=INR&tn=${encodedNote}`,
      };

    case 'bank_transfer':
      return {
        provider: 'bank_transfer',
        label: 'Bank transfer',
        url: buildBankTransferText(handleValue),
      };

    case 'other':
      return null;

    default:
      return null;
  }
}

export function buildZelleInstruction(handle: string): string {
  return `Pay via Zelle — send to: ${handle}`;
}

export function buildBankTransferText(accountDetails: string): string {
  return `Bank transfer details:\n${accountDetails}`;
}

export function buildPaymentLinksForMethods(
  handles: PayerHandleInput[],
  supportedMethods: PaymentProvider[],
  amountMajorUnits: number,
  eventName: string,
  currency: string,
  locale: string,
): PaymentLinkResult[] {
  const links: PaymentLinkResult[] = [];

  for (const handle of handles) {
    if (!supportedMethods.includes(handle.provider)) {
      continue;
    }

    const link = buildPaymentLink(
      handle.provider,
      handle.handle_value,
      amountMajorUnits,
      eventName,
      currency,
      locale,
    );

    if (link) {
      links.push(link);
    }
  }

  return links;
}

export function formatAmountForCurrency(
  amountMajorUnits: number,
  currency: string,
  locale: string,
): string {
  return formatCurrency(amountMajorUnits, currency, locale);
}
