import { describe, expect, it } from '@jest/globals';
import {
  buildAndroidIntentUrl,
  buildPaymentLinkTargets,
  buildPaymentLinkUrl,
  buildZelleInstruction,
  cashAppCashtagForLink,
  paymentHandleForLink,
  paypalSlugForLink,
  venmoUsernameForLink,
} from './paymentLinks';

describe('paymentLinks', () => {
  describe('paymentHandleForLink', () => {
    it('strips @ from stored Venmo handles', () => {
      expect(venmoUsernameForLink('@alex-chen')).toBe('alex-chen');
      expect(venmoUsernameForLink('alex-chen')).toBe('alex-chen');
      expect(venmoUsernameForLink('https://venmo.com/alex-chen')).toBe('alex-chen');
    });

    it('extracts PayPal slug from stored paypal.me paths', () => {
      expect(paypalSlugForLink('paypal.me/alexchen')).toBe('alexchen');
      expect(paypalSlugForLink('https://www.paypal.me/alexchen')).toBe('alexchen');
      expect(paypalSlugForLink('alexchen')).toBe('alexchen');
    });

    it('keeps $ on Cash App cashtags for URLs', () => {
      expect(cashAppCashtagForLink('$marcus')).toBe('$marcus');
      expect(cashAppCashtagForLink('marcus')).toBe('$marcus');
    });

    it('delegates by provider', () => {
      expect(paymentHandleForLink('venmo', '@marcus-pay')).toBe('marcus-pay');
      expect(paymentHandleForLink('paypal', 'paypal.me/marcus')).toBe('marcus');
      expect(paymentHandleForLink('cashapp', '$marcus')).toBe('$marcus');
    });
  });

  describe('buildPaymentLinkUrl', () => {
    it('builds Venmo HTTPS pay link without @ in recipients', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'venmo',
          handleValue: '@marcus-pay',
          amountMajorUnits: 42.5,
          eventName: 'Dinner',
          channel: 'sms',
        }),
      ).toBe(
        'https://account.venmo.com/pay?txn=pay&recipients=marcus-pay&amount=42.50&note=Dinner%20split',
      );
    });

    it('uses native Venmo scheme for in-app channel', () => {
      const url = buildPaymentLinkUrl({
        provider: 'venmo',
        handleValue: '@marcus-pay',
        amountMajorUnits: 42.5,
        eventName: 'Dinner',
        channel: 'app',
      });
      expect(url).toBe(
        'venmo://paycharge?txn=pay&recipients=marcus-pay&amount=42.50&note=Dinner%20split',
      );
      expect(url).not.toContain('https://');
    });

    it('uses native Cash App scheme for in-app channel', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'cashapp',
          handleValue: '$marcus',
          amountMajorUnits: 9.99,
          eventName: 'Dinner',
          channel: 'app',
        }),
      ).toBe('cashme://pay?cashtag=%24marcus&amount=9.99');
    });

    it('builds PayPal link from stored paypal.me handle', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'paypal',
          handleValue: 'paypal.me/marcus',
          amountMajorUnits: 12.34,
          eventName: 'Dinner',
        }),
      ).toBe('https://paypal.me/marcus/12.34');
    });

    it('builds Cash App link with literal $ in path', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'cashapp',
          handleValue: '$marcus',
          amountMajorUnits: 9.99,
          eventName: 'Dinner',
        }),
      ).toBe('https://cash.app/$marcus/9.99');
    });

    it('returns Zelle instruction text instead of a URL', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'zelle',
          handleValue: 'marcus@email.com',
          amountMajorUnits: 10,
          eventName: 'Dinner',
        }),
      ).toBe('Pay via Zelle — send to: marcus@email.com');
    });

    it('builds Wise link from stored handle', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'wise',
          handleValue: 'marcus-wise',
          amountMajorUnits: 20,
          eventName: 'Dinner',
        }),
      ).toBe('https://wise.com/pay/me/marcus-wise');
    });
  });

  describe('buildPaymentLinkTargets', () => {
    it('returns HTTPS web URL plus native targets for Venmo', () => {
      const targets = buildPaymentLinkTargets({
        provider: 'venmo',
        handleValue: '@marcus-pay',
        amountMajorUnits: 42.5,
        eventName: 'Dinner',
      });
      expect(targets?.webUrl).toMatch(/^https:\/\/account\.venmo\.com\/pay\?/);
      expect(targets?.appUrl).toMatch(/^venmo:\/\/paycharge\?/);
      expect(targets?.androidIntentUrl).toContain('intent://paycharge');
      expect(targets?.androidIntentUrl).toContain('com.venmo');
    });

    it('returns HTTPS only for PayPal (no separate native pay URL)', () => {
      const targets = buildPaymentLinkTargets({
        provider: 'paypal',
        handleValue: 'paypal.me/marcus',
        amountMajorUnits: 12.34,
        eventName: 'Dinner',
      });
      expect(targets?.webUrl).toBe('https://paypal.me/marcus/12.34');
      expect(targets?.appUrl).toBeUndefined();
    });

    it('marks Zelle as instruction-only', () => {
      const targets = buildPaymentLinkTargets({
        provider: 'zelle',
        handleValue: 'marcus@email.com',
        amountMajorUnits: 10,
        eventName: 'Dinner',
      });
      expect(targets?.isInstruction).toBe(true);
      expect(targets?.appUrl).toBeUndefined();
    });
  });

  describe('buildAndroidIntentUrl', () => {
    it('embeds browser fallback URL', () => {
      const intent = buildAndroidIntentUrl(
        'venmo://paycharge?txn=pay&recipients=alex&amount=1.00',
        'com.venmo',
        'https://account.venmo.com/pay?txn=pay',
      );
      expect(intent).toContain('intent://paycharge');
      expect(intent).toContain('scheme=venmo');
      expect(intent).toContain('browser_fallback_url');
    });
  });

  describe('buildZelleInstruction', () => {
    it('formats Zelle payee text', () => {
      expect(buildZelleInstruction('marcus@email.com')).toBe(
        'Pay via Zelle — send to: marcus@email.com',
      );
    });
  });
});
