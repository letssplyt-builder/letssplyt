import type { PaymentProvider } from '../types/profile.types';

export type PaymentLinkChannel = 'sms' | 'app';

export interface PaymentLinkTargets {
  /** HTTPS pay URL — opens app via universal link when possible, otherwise web checkout. */
  webUrl: string;
  /** Native scheme for mobile web “try app first” (LetsSplyt breakdown page). */
  appUrl?: string;
  /** Android intent URL with browser fallback (breakdown page on Android). */
  androidIntentUrl?: string;
  isInstruction?: boolean;
}

const ANDROID_APP_PACKAGES: Partial<Record<PaymentProvider, string>> = {
  venmo: 'com.venmo',
  cashapp: 'com.squareup.cash',
  paypal: 'com.paypal.android.p2pmobile',
};

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

function paymentNote(eventName: string): string {
  return encodeURIComponent(`${eventName} split`);
}

function paymentAmount(amountMajorUnits: number): string {
  return amountMajorUnits.toFixed(2);
}

/** Venmo web/universal pay URL — works in Safari and SMS (breakdown page). */
export function buildVenmoPayUrl(
  username: string,
  amountMajorUnits: number,
  eventName: string,
): string {
  const numericAmount = paymentAmount(amountMajorUnits);
  return `https://account.venmo.com/pay?txn=pay&recipients=${encodeURIComponent(username)}&amount=${numericAmount}&note=${paymentNote(eventName)}`;
}

/** Venmo native scheme — opens the Venmo app from LetsSplyt mobile. */
export function buildVenmoNativePayUrl(
  username: string,
  amountMajorUnits: number,
  eventName: string,
): string {
  const numericAmount = paymentAmount(amountMajorUnits);
  return `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(username)}&amount=${numericAmount}&note=${paymentNote(eventName)}`;
}

/** Cash App HTTPS universal link — SMS and web breakdown page. */
export function buildCashAppWebPayUrl(bareTag: string, amountMajorUnits: number): string {
  return `https://cash.app/$${bareTag}/${paymentAmount(amountMajorUnits)}`;
}

/** Cash App native scheme — opens Cash App from LetsSplyt mobile. */
export function buildCashAppNativePayUrl(bareTag: string, amountMajorUnits: number): string {
  const cashtag = `$${bareTag}`;
  return `cashme://pay?cashtag=${encodeURIComponent(cashtag)}&amount=${paymentAmount(amountMajorUnits)}`;
}

/** Android intent URL — opens native app or falls back to HTTPS in Chrome. */
export function buildAndroidIntentUrl(
  appUrl: string,
  packageName: string,
  webFallbackUrl: string,
): string {
  const match = appUrl.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (!match) {
    return webFallbackUrl;
  }
  const scheme = match[1]!;
  const pathAndQuery = match[2]!;
  return `intent://${pathAndQuery}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${encodeURIComponent(webFallbackUrl)};end`;
}

/**
 * Web + native targets for a payment handle (breakdown page, optional SMS metadata).
 * SMS/breakdown web href uses HTTPS; breakdown JS tries native first on mobile.
 */
export function buildPaymentLinkTargets(params: {
  provider: PaymentProvider;
  handleValue: string;
  amountMajorUnits: number;
  eventName: string;
}): PaymentLinkTargets | null {
  const webUrl = buildPaymentLinkUrl({ ...params, channel: 'sms' });
  if (!webUrl) {
    return null;
  }

  if (params.provider === 'zelle') {
    return { webUrl, isInstruction: true };
  }

  const appUrl = buildPaymentLinkUrl({ ...params, channel: 'app' });
  const targets: PaymentLinkTargets = { webUrl };

  if (appUrl && appUrl !== webUrl) {
    targets.appUrl = appUrl;
    const androidPackage = ANDROID_APP_PACKAGES[params.provider];
    if (androidPackage) {
      targets.androidIntentUrl = buildAndroidIntentUrl(appUrl, androidPackage, webUrl);
    }
  }

  return targets;
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
  const encodedNote = paymentNote(eventName);
  const numericAmount = paymentAmount(amountMajorUnits);

  switch (provider) {
    case 'venmo': {
      const username = venmoUsernameForLink(handleValue);
      if (!username) {
        return null;
      }
      if (channel === 'app') {
        return buildVenmoNativePayUrl(username, amountMajorUnits, eventName);
      }
      return buildVenmoPayUrl(username, amountMajorUnits, eventName);
    }

    case 'paypal': {
      const slug = paypalSlugForLink(handleValue);
      if (!slug) {
        return null;
      }
      // PayPal has no public native pay URL with amount; paypal.me is best-effort universal link.
      return `https://paypal.me/${encodeURIComponent(slug)}/${numericAmount}`;
    }

    case 'cashapp': {
      const bareTag = cashAppCashtagForLink(handleValue).replace(/^\$+/, '');
      if (!bareTag) {
        return null;
      }
      if (channel === 'app') {
        return buildCashAppNativePayUrl(bareTag, amountMajorUnits);
      }
      return buildCashAppWebPayUrl(bareTag, amountMajorUnits);
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
