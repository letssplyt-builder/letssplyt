import { describe, expect, it } from '@jest/globals';
import {
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
    it('builds Venmo SMS link without @ in username', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'venmo',
          handleValue: '@marcus-pay',
          amountMajorUnits: 42.5,
          eventName: 'Dinner',
          channel: 'sms',
        }),
      ).toBe(
        'https://venmo.com/marcus-pay?txn=pay&amount=42.50&note=Dinner%20split',
      );
    });

    it('builds Venmo app deep link without @ in recipients', () => {
      expect(
        buildPaymentLinkUrl({
          provider: 'venmo',
          handleValue: '@marcus-pay',
          amountMajorUnits: 42.5,
          eventName: 'Dinner',
          channel: 'app',
        }),
      ).toBe(
        'venmo://paycharge?txn=pay&recipients=marcus-pay&amount=42.50&note=Dinner%20split',
      );
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

  describe('buildZelleInstruction', () => {
    it('formats Zelle payee text', () => {
      expect(buildZelleInstruction('marcus@email.com')).toBe(
        'Pay via Zelle — send to: marcus@email.com',
      );
    });
  });
});
