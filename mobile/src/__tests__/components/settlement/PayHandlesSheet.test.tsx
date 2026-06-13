import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { PayHandlesSheet } from '../../../components/settlement/PayHandlesSheet';

describe('PayHandlesSheet', () => {
  it('opens payment deep link when a handle card is pressed', async () => {
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    render(
      <PayHandlesSheet
        visible
        onClose={jest.fn()}
        title="Pay now"
        subtitle="Dinner"
        amount={25}
        currency="USD"
        payerDisplayName="Alex"
        eventTitleForLink="Dinner"
        handles={[{ provider: 'venmo', handle_display: '@alex' }]}
      />,
    );

    fireEvent.press(screen.getByLabelText('Pay via Venmo — @alex'));

    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('venmo://'));
  });
});
