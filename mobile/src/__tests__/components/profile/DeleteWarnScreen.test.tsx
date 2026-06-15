import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DeleteWarnScreen } from '../../../screens/profile/DeleteWarnScreen';
import { fetchBalance } from '../../../services/event.service';

jest.mock('../../../services/event.service', () => ({
  fetchBalance: jest.fn(),
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };
const mockRoute = { key: 'DeleteWarn', name: 'DeleteWarn' as const, params: undefined };
const mockFetchBalance = jest.mocked(fetchBalance);

describe('DeleteWarnScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchBalance.mockResolvedValue({
      net_balance: 0,
      currency: 'USD',
      owed_to_you: 0,
      you_owe: 0,
    });
  });

  it('blocks Continue when you_owe is greater than zero', async () => {
    mockFetchBalance.mockResolvedValue({
      net_balance: -2500,
      currency: 'USD',
      owed_to_you: 0,
      you_owe: 2500,
    });

    render(
      <DeleteWarnScreen navigation={mockNavigation as never} route={mockRoute as never} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Outstanding balance must be settled first')).toBeTruthy();
    });

    expect(screen.queryByText('Continue')).toBeNull();
    expect(screen.getByText('Go back')).toBeTruthy();
  });

  it('navigates to DeleteConfirm when balance is zero', async () => {
    render(
      <DeleteWarnScreen navigation={mockNavigation as never} route={mockRoute as never} />,
    );

    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalled());

    const continueButton = screen.getByLabelText('Continue to account deletion');
    await waitFor(() => {
      expect(continueButton.props.accessibilityState?.disabled).toBe(false);
    });

    fireEvent.press(continueButton);
    expect(mockNavigate).toHaveBeenCalledWith('DeleteConfirm');
  });
});
