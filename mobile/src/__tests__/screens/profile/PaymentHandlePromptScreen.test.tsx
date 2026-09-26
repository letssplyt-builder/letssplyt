import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaymentHandlePromptScreen } from '../../../screens/profile/PaymentHandlePromptScreen';
import { useAuthStore } from '../../../store/authStore';

const mockReplace = jest.fn();

describe('PaymentHandlePromptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ needsPaymentHandlePrompt: true });
  });

  it('lets a new user skip and continue to home', () => {
    render(
      <PaymentHandlePromptScreen
        navigation={{ replace: mockReplace } as never}
        route={{ key: 'PaymentHandlePrompt', name: 'PaymentHandlePrompt', params: undefined }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Skip for now'));

    expect(useAuthStore.getState().needsPaymentHandlePrompt).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('MainTabs');
  });

  it('reveals the handle form when the user chooses to add a method', () => {
    render(
      <PaymentHandlePromptScreen
        navigation={{ replace: mockReplace } as never}
        route={{ key: 'PaymentHandlePrompt', name: 'PaymentHandlePrompt', params: undefined }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Add payment method'));

    expect(screen.getByPlaceholderText('@username')).toBeTruthy();
    expect(screen.getByText('Venmo')).toBeTruthy();
  });
});
