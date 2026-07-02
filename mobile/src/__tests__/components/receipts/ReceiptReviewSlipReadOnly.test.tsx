import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { ReceiptReviewSlipReadOnly } from '../../../components/receipts/ReceiptReviewSlipReadOnly';

describe('ReceiptReviewSlipReadOnly', () => {
  it('renders receipt lines and total in read-only mode', () => {
    render(
      <ReceiptReviewSlipReadOnly
        review={{
          items: [
            {
              id: 'item-1',
              name: 'Burger',
              unit_price: 10,
              quantity: 2,
              confidence: 'high',
            },
          ],
          additional_charges: [{ name: 'Service fee', amount: 2, confidence: 'high' }],
          discounts: [],
          tax_amount: 1.5,
          tip_amount: 3,
          fees_amount: 2,
          discount_amount: 0,
          currency: 'USD',
        }}
      />,
    );

    expect(screen.getByText('Shared bill breakdown')).toBeTruthy();
    expect(screen.getByText('2× Burger')).toBeTruthy();
    expect(screen.getByText('Service fee')).toBeTruthy();
    expect(screen.getByText('Tax')).toBeTruthy();
    expect(screen.getByText('Tip')).toBeTruthy();
    expect(screen.getByText('$26.50')).toBeTruthy();
  });
});
