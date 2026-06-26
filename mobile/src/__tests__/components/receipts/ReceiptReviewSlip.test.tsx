import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReceiptReviewSlip } from '../../../components/receipts/ReceiptReviewSlip';
import type { EditableReviewDiscount, EditableReviewItem } from '../../../screens/receipts/itemReview.utils';

const items: EditableReviewItem[] = [
  {
    localId: 'food-1',
    name: 'Burger',
    unit_price: 10,
    quantity: 1,
    is_fee: false,
    confidence: 'low',
  },
];

const discounts: EditableReviewDiscount[] = [
  {
    localId: 'discount-1',
    name: 'Happy hour',
    type: 'percent',
    value: 10,
    scope: 'bill',
  },
];

const noopDiscountHandlers = {
  discounts: [] as EditableReviewDiscount[],
  onDiscountChange: jest.fn(),
  onDiscountRemove: jest.fn(),
  onAddDiscount: jest.fn(),
};

describe('ReceiptReviewSlip', () => {
  it('renders compact receipt lines and check chip for low confidence', () => {
    render(
      <ReceiptReviewSlip
        currency="USD"
        items={items}
        charges={[]}
        {...noopDiscountHandlers}
        taxInput="1"
        tipInput="2"
        runningTotal={13}
        expandedKey={null}
        onExpandedKeyChange={jest.fn()}
        onItemChange={jest.fn()}
        onItemRemove={jest.fn()}
        onAddItem={jest.fn()}
        onChargeChange={jest.fn()}
        onChargeRemove={jest.fn()}
        onAddCharge={jest.fn()}
        onTaxChange={jest.fn()}
        onTipChange={jest.fn()}
      />,
    );

    expect(screen.getByText('Burger')).toBeTruthy();
    expect(screen.getByText('Check')).toBeTruthy();
    expect(screen.getByLabelText('Total $13.00')).toBeTruthy();
    expect(screen.getByLabelText('Add discount')).toBeTruthy();
  });

  it('expands a line when tapped', () => {
    const onExpandedKeyChange = jest.fn();

    render(
      <ReceiptReviewSlip
        currency="USD"
        items={items}
        charges={[]}
        {...noopDiscountHandlers}
        taxInput="1"
        tipInput="2"
        runningTotal={13}
        expandedKey={null}
        onExpandedKeyChange={onExpandedKeyChange}
        onItemChange={jest.fn()}
        onItemRemove={jest.fn()}
        onAddItem={jest.fn()}
        onChargeChange={jest.fn()}
        onChargeRemove={jest.fn()}
        onAddCharge={jest.fn()}
        onTaxChange={jest.fn()}
        onTipChange={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Burger, tap to edit'));
    expect(onExpandedKeyChange).toHaveBeenCalledWith('item-food-1');
  });

  it('collapses edit mode when Done is pressed', () => {
    const onExpandedKeyChange = jest.fn();

    render(
      <ReceiptReviewSlip
        currency="USD"
        items={items}
        charges={[]}
        {...noopDiscountHandlers}
        taxInput="1"
        tipInput="2"
        runningTotal={13}
        expandedKey="item-food-1"
        onExpandedKeyChange={onExpandedKeyChange}
        onItemChange={jest.fn()}
        onItemRemove={jest.fn()}
        onAddItem={jest.fn()}
        onChargeChange={jest.fn()}
        onChargeRemove={jest.fn()}
        onAddCharge={jest.fn()}
        onTaxChange={jest.fn()}
        onTipChange={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Done editing'));
    expect(onExpandedKeyChange).toHaveBeenCalledWith(null);
  });

  it('shows resolved discount amount on the slip', () => {
    render(
      <ReceiptReviewSlip
        currency="USD"
        items={items}
        charges={[]}
        discounts={discounts}
        onDiscountChange={jest.fn()}
        onDiscountRemove={jest.fn()}
        onAddDiscount={jest.fn()}
        taxInput="0"
        tipInput="0"
        runningTotal={9}
        expandedKey={null}
        onExpandedKeyChange={jest.fn()}
        onItemChange={jest.fn()}
        onItemRemove={jest.fn()}
        onAddItem={jest.fn()}
        onChargeChange={jest.fn()}
        onChargeRemove={jest.fn()}
        onAddCharge={jest.fn()}
        onTaxChange={jest.fn()}
        onTipChange={jest.fn()}
      />,
    );

    expect(screen.getAllByText('−$1.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Total $9.00')).toBeTruthy();
  });
});
