import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReceiptReviewSlip } from '../../../components/receipts/ReceiptReviewSlip';
import type { EditableReviewItem } from '../../../screens/receipts/itemReview.utils';

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

describe('ReceiptReviewSlip', () => {
  it('renders compact receipt lines and check chip for low confidence', () => {
    render(
      <ReceiptReviewSlip
        currency="USD"
        items={items}
        charges={[]}
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
  });

  it('expands a line when tapped', () => {
    const onExpandedKeyChange = jest.fn();

    render(
      <ReceiptReviewSlip
        currency="USD"
        items={items}
        charges={[]}
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
});
