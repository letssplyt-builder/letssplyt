import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ItemisedSplitPanel } from '../../../components/splits/ItemisedSplitPanel';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

describe('ItemisedSplitPanel discount display', () => {
  const participants = [
    { id: 'p1', display_name: 'Alex' },
    { id: 'p2', display_name: 'Blake' },
  ];

  it('shows struck-through gross and net when line has a discount', () => {
    render(
      <ItemisedSplitPanel
        items={[
          {
            id: 'a',
            name: 'Item 1',
            price: 20,
            lineDiscount: 5,
            netPrice: 15,
          },
        ]}
        currency="USD"
        assignedCount={0}
        participants={participants}
        assignments={new Map()}
        onAssignItem={jest.fn()}
      />,
    );

    expect(screen.getByText('$20.00')).toBeTruthy();
    expect(screen.getByText('$15.00')).toBeTruthy();
    expect(screen.getByText('−$5.00 off')).toBeTruthy();
  });

  it('shows only one price when there is no discount', () => {
    render(
      <ItemisedSplitPanel
        items={[
          {
            id: 'b',
            name: 'Item 2',
            price: 30,
            lineDiscount: 0,
            netPrice: 30,
          },
        ]}
        currency="USD"
        assignedCount={0}
        participants={participants}
        assignments={new Map()}
        onAssignItem={jest.fn()}
      />,
    );

    expect(screen.getByText('$30.00')).toBeTruthy();
    expect(screen.queryByText('−$5.00 off')).toBeNull();
  });

  it('opens assign popup with discount math', () => {
    render(
      <ItemisedSplitPanel
        items={[
          {
            id: 'a',
            name: 'Item 1',
            price: 20,
            lineDiscount: 5,
            netPrice: 15,
          },
        ]}
        currency="USD"
        assignedCount={0}
        participants={participants}
        assignments={new Map()}
        onAssignItem={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText(/Item 1, \$15\.00 after \$5\.00 off/));
    expect(screen.getByText(/\$20\.00 − \$5\.00 = \$15\.00/)).toBeTruthy();
  });
});
