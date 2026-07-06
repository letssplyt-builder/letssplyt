import { describe, expect, it } from '@jest/globals';
import { CurrencyFormatError, formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('CurrencyFormatError has expected shape', () => {
    const err = new CurrencyFormatError('invalid currency formatting');
    expect(err.name).toBe('CurrencyFormatError');
    expect(err.code).toBe('CURRENCY_FORMAT_ERROR');
    expect(err.message).toBe('invalid currency formatting');
  });

  it('formats USD with correct symbol and separator', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('formats INR with correct symbol and separator', () => {
    expect(formatCurrency(1234.56, 'INR', 'en-IN')).toBe('₹1,234.56');
  });

  it('formats EUR with correct symbol and separator', () => {
    expect(formatCurrency(12.34, 'EUR', 'de-DE')).toMatch(/12,34/);
    expect(formatCurrency(12.34, 'EUR', 'de-DE')).toMatch(/€/);
  });

  it('formats GBP with correct symbol and separator', () => {
    expect(formatCurrency(12.34, 'GBP', 'en-GB')).toBe('£12.34');
  });

  it('falls back for unknown currency code without throwing', () => {
    expect(formatCurrency(100, 'XYZ')).toMatch(/XYZ.*100/);
  });

  it('handles zero correctly ($0.00)', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles negative amounts (-$12.50)', () => {
    expect(formatCurrency(-12.5, 'USD')).toBe('-$12.50');
  });

  it('falls back when Intl.NumberFormat throws', () => {
    const OriginalNumberFormat = Intl.NumberFormat;
    Object.defineProperty(global.Intl, 'NumberFormat', {
      configurable: true,
      value: class {
        constructor() {
          throw new Error('Intl format failure');
        }
      },
    });
    try {
      expect(formatCurrency(100, 'USD')).toBe('USD 100');
    } finally {
      Object.defineProperty(global.Intl, 'NumberFormat', {
        configurable: true,
        value: OriginalNumberFormat,
      });
    }
  });
});
