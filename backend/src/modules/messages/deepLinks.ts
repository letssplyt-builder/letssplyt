import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import {
  buildPaymentLinkUrl,
  buildZelleInstruction,
} from '@letssplyt/shared/paymentLinks';
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

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  venmo: 'Venmo',
  paypal: 'PayPal',
  cashapp: 'Cash App',
  zelle: 'Zelle',
  wise: 'Wise',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

/**
 * Build a single payment deep link for a payer handle.
 * amountMajorUnits is in major currency units (e.g. 12.34 for USD).
 */
export function buildPaymentLink(
  provider: PaymentProvider,
  handleValue: string,
  amountMajorUnits: number,
  eventName: string,
  _currency: string,
  _locale: string,
): PaymentLinkResult | null {
  if (provider === 'bank_transfer') {
    return {
      provider,
      label: PROVIDER_LABELS.bank_transfer,
      url: buildBankTransferText(handleValue),
    };
  }

  if (provider === 'other') {
    return null;
  }

  const url = buildPaymentLinkUrl({
    provider,
    handleValue,
    amountMajorUnits,
    eventName,
    channel: 'sms',
  });

  if (!url) {
    return null;
  }

  return {
    provider,
    label: PROVIDER_LABELS[provider],
    url,
  };
}

export { buildZelleInstruction };

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
