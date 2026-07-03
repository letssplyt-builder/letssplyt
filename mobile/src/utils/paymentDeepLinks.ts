import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import { buildPaymentLinkUrl } from '@letssplyt/shared/paymentLinks';

export interface PaymentDeepLink {
  provider: PaymentProvider;
  label: string;
  url: string;
}

const PROVIDER_LABELS: Partial<Record<PaymentProvider, string>> = {
  venmo: 'Venmo',
  paypal: 'PayPal',
  cashapp: 'Cash App',
  zelle: 'Zelle',
  wise: 'Wise',
};

export function buildPaymentDeepLink(
  provider: PaymentProvider,
  handleValue: string,
  amountMajorUnits: number,
  eventName: string,
): PaymentDeepLink | null {
  const url = buildPaymentLinkUrl({
    provider,
    handleValue,
    amountMajorUnits,
    eventName,
    channel: 'app',
  });

  if (!url) {
    return null;
  }

  const label = PROVIDER_LABELS[provider];
  if (!label) {
    return null;
  }

  return {
    provider,
    label,
    url,
  };
}

export function isHttpOrAppUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.includes('://');
}
