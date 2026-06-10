import type { PaymentProvider } from '@letssplyt/shared/profile.types';

export type PaymentMethod = PaymentProvider;

export interface CountryPaymentConfig {
  supportedMethods: PaymentMethod[];
}

/**
 * Country code → supported payment methods.
 * Canadian vs US +1: pass resolved ISO country from libphonenumber-js (e.g. 'CA').
 */
export const COUNTRY_PAYMENT_CONFIG: Record<string, CountryPaymentConfig> = {
  '+1': {
    supportedMethods: ['venmo', 'cashapp', 'zelle', 'paypal', 'bank_transfer'],
  },
  CA: {
    supportedMethods: ['paypal', 'wise', 'bank_transfer'],
  },
  '+91': {
    supportedMethods: ['upi', 'paypal', 'wise', 'bank_transfer'],
  },
  '+44': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
  '+49': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
  '+33': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
  '+61': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
  '+64': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
  '+65': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
  '+81': { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
  default: { supportedMethods: ['paypal', 'wise', 'bank_transfer'] },
};

const E164_PREFIXES = [
  '+1',
  '+7',
  '+20',
  '+27',
  '+30',
  '+31',
  '+32',
  '+33',
  '+34',
  '+36',
  '+39',
  '+40',
  '+41',
  '+43',
  '+44',
  '+45',
  '+46',
  '+47',
  '+48',
  '+49',
  '+51',
  '+52',
  '+53',
  '+54',
  '+55',
  '+56',
  '+57',
  '+58',
  '+60',
  '+61',
  '+62',
  '+63',
  '+64',
  '+65',
  '+66',
  '+81',
  '+82',
  '+84',
  '+86',
  '+90',
  '+91',
  '+92',
  '+93',
  '+94',
  '+95',
] as const;

export function getPaymentConfigForPhone(
  phoneE164: string,
  resolvedCountry?: string,
): CountryPaymentConfig {
  if (resolvedCountry && COUNTRY_PAYMENT_CONFIG[resolvedCountry]) {
    return COUNTRY_PAYMENT_CONFIG[resolvedCountry];
  }

  for (const prefix of E164_PREFIXES) {
    if (phoneE164.startsWith(prefix) && COUNTRY_PAYMENT_CONFIG[prefix]) {
      return COUNTRY_PAYMENT_CONFIG[prefix];
    }
  }

  return COUNTRY_PAYMENT_CONFIG.default;
}
