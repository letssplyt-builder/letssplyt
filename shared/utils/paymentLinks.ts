import type { PaymentProvider } from '../types/profile.types';

export type PaymentLinkChannel = 'sms' | 'app';

/** Bare Venmo username for URLs (stored value is usually @username). */
export function venmoUsernameForLink(stored: string): string {
  let value = stored.trim();
  value = value.replace(/^https?:\/\/(account\.)?(www\.)?venmo\.com\//i, '');
  value = value.replace(/^venmo\.com\//i, '');
  value = value.replace(/^@+/, '');
  value = (value.split(/[/?#]/)[0] ?? value).trim();
  return value;
}

/** PayPal.me slug for URLs (stored value is usually paypal.me/slug). */
export function paypalSlugForLink(stored: string): string {
  let value = stored.trim();
  value = value.replace(/^https?:\/\/(www\.)?paypal\.me\//i, '');
  value = value.replace(/^paypal\.me\//i, '');
  value = value.replace(/\/+$/, '');
  return (value.split(/[/?#]/)[0] ?? value).trim();
}

/** Cashtag with leading $ for Cash App URLs (stored value is usually $tag). */
export function cashAppCashtagForLink(stored: string): string {
  const tag = stored.trim().replace(/^\$+/, '');
  return `$${tag}`;
}

export function zelleHandleForLink(stored: string): string {
  return stored.trim();
}

export function wiseHandleForLink(stored: string): string {
  return stored
    .trim()
    .replace(/^https?:\/\/(www\.)?wise\.com\/pay\/me\//i, '')
    .replace(/\/+$/, '')
    .split(/[/?#]/)[0]!
    .trim();
}

export function paymentHandleForLink(provider: PaymentProvider, stored: string): string {
  switch (provider) {
    case 'venmo':
      return venmoUsernameForLink(stored);
    case 'paypal':
      return paypalSlugForLink(stored);
    case 'cashapp':
      return cashAppCashtagForLink(stored);
    case 'zelle':
      return zelleHandleForLink(stored);
    case 'wise':
      return wiseHandleForLink(stored);
    default:
      return stored.trim();
  }
}

export function buildZelleInstruction(handle: string): string {
  return `Pay via Zelle — send to: ${zelleHandleForLink(handle)}`;
}

/**
 * Build a payment URL or Zelle instruction from a stored profile handle.
 * SMS channel uses HTTPS universal links where possible; app channel prefers native schemes.
 */
export function buildPaymentLinkUrl(params: {
  provider: PaymentProvider;
  handleValue: string;
  amountMajorUnits: number;
  eventName: string;
  channel?: PaymentLinkChannel;
}): string | null {
  const { provider, handleValue, amountMajorUnits, eventName } = params;
  const channel = params.channel ?? 'sms';
  const encodedNote = encodeURIComponent(`${eventName} split`);
  const numericAmount = amountMajorUnits.toFixed(2);

  switch (provider) {
    case 'venmo': {
      const username = venmoUsernameForLink(handleValue);
      if (!username) {
        return null;
      }
      if (channel === 'app') {
        return `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(username)}&amount=${numericAmount}&note=${encodedNote}`;
      }
      return `https://venmo.com/${encodeURIComponent(username)}?txn=pay&amount=${numericAmount}&note=${encodedNote}`;
    }

    case 'paypal': {
      const slug = paypalSlugForLink(handleValue);
      if (!slug) {
        return null;
      }
      return `https://paypal.me/${encodeURIComponent(slug)}/${numericAmount}`;
    }

    case 'cashapp': {
      const bareTag = cashAppCashtagForLink(handleValue).replace(/^\$+/, '');
      if (!bareTag) {
        return null;
      }
      return `https://cash.app/$${bareTag}/${numericAmount}`;
    }

    case 'zelle':
      return buildZelleInstruction(handleValue);

    case 'wise': {
      const handle = wiseHandleForLink(handleValue);
      if (!handle) {
        return null;
      }
      return `https://wise.com/pay/me/${encodeURIComponent(handle)}`;
    }

    case 'upi': {
      const handle = handleValue.trim();
      if (!handle) {
        return null;
      }
      return `upi://pay?pa=${encodeURIComponent(handle)}&am=${numericAmount}&cu=INR&tn=${encodedNote}`;
    }

    default:
      return null;
  }
}
