import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PhoneEntryScreen } from './PhoneEntryScreen';

const mockApiPost = jest.fn();

class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

jest.mock('../../services/api', () => {
  class MockApiRequestError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = 'ApiRequestError';
      this.code = code;
      this.status = status;
    }
  }

  const isApiRequestError = (err: unknown): err is MockApiRequestError =>
    err instanceof MockApiRequestError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as MockApiRequestError).name === 'ApiRequestError' &&
      typeof (err as MockApiRequestError).code === 'string');

  return {
    ApiRequestError: MockApiRequestError,
    apiPost: (...args: unknown[]) => mockApiPost(...args),
    isApiRequestError,
    getApiErrorCode: (err: unknown) => (isApiRequestError(err) ? err.code : undefined),
  };
});

describe('PhoneEntryScreen', () => {
  const navigation = { navigate: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiPost.mockReset();
  });

  it('shows register CTA when login send-code returns ACCOUNT_NOT_FOUND', async () => {
    const { ApiRequestError: MockApiRequestError } = jest.requireMock('../../services/api') as {
      ApiRequestError: typeof ApiRequestError;
    };
    mockApiPost.mockRejectedValue(
      new MockApiRequestError('ACCOUNT_NOT_FOUND', 'No account found. Check number and try again.', 404),
    );

    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{
          key: 'PhoneEntry',
          name: 'PhoneEntry',
          params: { mode: 'login' },
        }}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Phone number'), '2025550100');
    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => {
      expect(screen.getByText('No account found. Check number and try again.')).toBeTruthy();
      expect(screen.getByText('New here?')).toBeTruthy();
      expect(screen.getByText('Create an account')).toBeTruthy();
    });
  });

  it('navigates to register mode with initialPhone when Register CTA is pressed', async () => {
    const { ApiRequestError: MockApiRequestError } = jest.requireMock('../../services/api') as {
      ApiRequestError: typeof ApiRequestError;
    };
    mockApiPost.mockRejectedValue(
      new MockApiRequestError('ACCOUNT_NOT_FOUND', 'No account found. Check number and try again.', 404),
    );

    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{
          key: 'PhoneEntry',
          name: 'PhoneEntry',
          params: { mode: 'login' },
        }}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Phone number'), '2025550100');
    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => {
      expect(screen.getByText('Create an account')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Create an account'));

    expect(navigation.navigate).toHaveBeenCalledWith('PhoneEntry', {
      mode: 'register',
      initialPhone: '+12025550100',
    });
  });

  it('navigates to OTP with accountExists when register send-code finds existing account', async () => {
    mockApiPost.mockResolvedValue({
      sent: true,
      channel: 'sms',
      expires_in_seconds: 600,
      account_exists: true,
    });

    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{
          key: 'PhoneEntry',
          name: 'PhoneEntry',
          params: { mode: 'register' },
        }}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Phone number'), '5005550006');
    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('OTPVerify', {
        phoneE164: '+15005550006',
        mode: 'register',
        accountExists: true,
      });
    });
  });
});
