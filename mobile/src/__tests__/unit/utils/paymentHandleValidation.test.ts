import { describe, expect, it } from '@jest/globals';
import { validatePaymentHandle } from '@letssplyt/shared/paymentHandleValidation';

describe('paymentHandleValidation', () => {
  it('accepts Venmo with or without @', () => {
    expect(validatePaymentHandle('venmo', '@alex-chen').valid).toBe(true);
    expect(validatePaymentHandle('venmo', 'alex-chen').valid).toBe(true);
    expect(validatePaymentHandle('venmo', 'alex-chen').normalized).toBe('@alex-chen');
  });

  it('rejects short Venmo usernames', () => {
    expect(validatePaymentHandle('venmo', '@test').valid).toBe(false);
  });

  it('accepts PayPal username, path, and full URL', () => {
    expect(validatePaymentHandle('paypal', 'alexchen').valid).toBe(true);
    expect(validatePaymentHandle('paypal', 'paypal.me/alexchen').valid).toBe(true);
    expect(validatePaymentHandle('paypal', 'https://www.paypal.me/alexchen').valid).toBe(true);
    expect(validatePaymentHandle('paypal', 'https://www.paypal.me/alexchen').normalized).toBe(
      'paypal.me/alexchen',
    );
  });

  it('accepts Cash App with or without $', () => {
    expect(validatePaymentHandle('cashapp', '$alexchen').valid).toBe(true);
    expect(validatePaymentHandle('cashapp', 'alexchen').normalized).toBe('$alexchen');
  });

  it('accepts Zelle email and phone', () => {
    expect(validatePaymentHandle('zelle', 'alex@example.com').valid).toBe(true);
    expect(validatePaymentHandle('zelle', '5551234567').valid).toBe(true);
  });
});
