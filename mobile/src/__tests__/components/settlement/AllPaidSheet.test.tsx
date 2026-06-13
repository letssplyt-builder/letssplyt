import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AllPaidSheet } from '../../../components/settlement/AllPaidSheet';

describe('AllPaidSheet', () => {
  it('allows single payment method selection before confirm', () => {
    const onConfirm = jest.fn();

    render(
      <AllPaidSheet
        visible
        onClose={jest.fn()}
        handles={[
          { provider: 'venmo', handle_display: '@alex' },
          { provider: 'paypal', handle_display: 'alex@example.com' },
        ]}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(screen.getByText('PayPal'));

    fireEvent.press(screen.getByLabelText('OK'));

    expect(onConfirm).toHaveBeenCalledWith('paypal');
  });

  it('shows Cash/Other as a selectable option', () => {
    render(
      <AllPaidSheet
        visible
        onClose={jest.fn()}
        handles={[{ provider: 'venmo', handle_display: '@alex' }]}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByText('Cash/Other')).toBeTruthy();
  });
});
