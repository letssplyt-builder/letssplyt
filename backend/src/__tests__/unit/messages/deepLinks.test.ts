import { describe, expect, it } from '@jest/globals';
import {
  buildBankTransferText,
  buildPaymentLink,
  buildPaymentLinksForMethods,
  buildZelleInstruction,
  formatAmountForCurrency,
} from '../../../modules/messages/deepLinks';

describe('deepLinks', () => {
  it('builds Venmo deep link format', () => {
    const link = buildPaymentLink('venmo', 'marcus-pay', 42.5, 'Dinner', 'USD', 'en-US');
    expect(link?.url).toBe(
      'venmo://paycharge?txn=pay&recipients=marcus-pay&amount=42.50&note=Dinner%20split',
    );
  });

  it('builds PayPal link format', () => {
    const link = buildPaymentLink('paypal', 'marcus', 12.34, 'Dinner', 'USD', 'en-US');
    expect(link?.url).toBe('https://paypal.me/marcus/12.34');
  });

  it('builds Cash App link format', () => {
    const link = buildPaymentLink('cashapp', '$marcus', 9.99, 'Dinner', 'USD', 'en-US');
    expect(link?.url).toBe('https://cash.app/%24marcus/9.99');
  });

  it('returns Zelle instruction text without app deep link', () => {
    const instruction = buildZelleInstruction('marcus@email.com');
    expect(instruction).toBe('Pay via Zelle — send to: marcus@email.com');
    expect(instruction.startsWith('http')).toBe(false);
    expect(instruction.startsWith('venmo')).toBe(false);

    const link = buildPaymentLink('zelle', 'marcus@email.com', 10, 'Dinner', 'USD', 'en-US');
    expect(link?.url).toContain('marcus@email.com');
    expect(link?.url.startsWith('http')).toBe(false);
  });

  it('builds Wise link format', () => {
    const link = buildPaymentLink('wise', 'marcus-wise', 20, 'Dinner', 'USD', 'en-US');
    expect(link?.url).toBe('https://wise.com/pay/me/marcus-wise');
  });

  it('formats amount per currency via formatCurrency', () => {
    expect(formatAmountForCurrency(12.34, 'USD', 'en-US')).toContain('12.34');
    expect(formatAmountForCurrency(1234.56, 'INR', 'en-IN')).toContain('1,234.56');
  });

  it('filters payment links by supported methods', () => {
    const links = buildPaymentLinksForMethods(
      [
        { provider: 'venmo', handle_value: 'venmo-user' },
        { provider: 'paypal', handle_value: 'paypal-user' },
        { provider: 'cashapp', handle_value: '$cash' },
      ],
      ['paypal', 'wise'],
      15,
      'Dinner',
      'USD',
      'en-US',
    );

    expect(links.map((l) => l.provider)).toEqual(['paypal']);
  });

  it('builds bank transfer text block', () => {
    expect(buildBankTransferText('Acct 123')).toBe('Bank transfer details:\nAcct 123');
  });
});
