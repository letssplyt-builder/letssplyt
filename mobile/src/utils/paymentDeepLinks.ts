import type { PaymentProvider } from '@letssplyt/shared/profile.types';
import { buildPaymentLinkUrl } from '@letssplyt/shared/paymentLinks';

export interface PaymentDeepLink {
  provider: PaymentProvider;
  label: string;
  /** Preferred URL — native scheme in-app when available. */
  url: string;
  /** HTTPS fallback when the native app is not installed. */
  webFallbackUrl?: string;
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

  const webFallbackUrl =
    buildPaymentLinkUrl({
      provider,
      handleValue,
      amountMajorUnits,
      eventName,
      channel: 'sms',
    }) ?? undefined;

  return {
    provider,
    label,
    url,
    webFallbackUrl: webFallbackUrl !== url ? webFallbackUrl : undefined,
  };
}

export function isHttpOrAppUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.includes('://');
}

export function isCustomSchemeUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('http://') && !url.startsWith('https://');
}
