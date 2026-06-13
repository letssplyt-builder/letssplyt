import type { PaymentProvider } from '@letssplyt/shared/profile.types';

export interface PaymentDeepLink {
  provider: PaymentProvider;
  label: string;
  url: string;
}

export function buildPaymentDeepLink(
  provider: PaymentProvider,
  handleValue: string,
  amountMajorUnits: number,
  eventName: string,
): PaymentDeepLink | null {
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
        url: `zelle://pay?email=${encodeURIComponent(handleValue)}&amount=${numericAmount}`,
      };
    case 'wise':
      return {
        provider: 'wise',
        label: 'Wise',
        url: `https://wise.com/pay/me/${encodeURIComponent(handleValue)}`,
      };
  }

  return null;
}

export function isHttpOrAppUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://') || url.includes('://');
}
