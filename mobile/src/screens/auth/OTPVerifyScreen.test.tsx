import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { OTPVerifyScreen } from './OTPVerifyScreen';
import { useAuthStore } from '../../store/authStore';

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

describe('OTPVerifyScreen', () => {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: null, user: null, isLoading: false });
    mockApiPost.mockReset();
  });

  it('renders 6 individual digit inputs', () => {
    render(
      <OTPVerifyScreen
        navigation={navigation as never}
        route={{
          key: 'OTPVerify',
          name: 'OTPVerify',
          params: { phoneE164: '+15551234567' },
        }}
      />,
    );

    expect(screen.getByText('Enter your code')).toBeTruthy();
    expect(screen.getByLabelText('Digit 1')).toBeTruthy();
    expect(screen.getByLabelText('Digit 6')).toBeTruthy();
  });

  it('shows resend cooldown on mount', () => {
    render(
      <OTPVerifyScreen
        navigation={navigation as never}
        route={{
          key: 'OTPVerify',
          name: 'OTPVerify',
          params: { phoneE164: '+15551234567' },
        }}
      />,
    );

    expect(screen.getByText(/Resend in \d+s/)).toBeTruthy();
  });

  it('verifies OTP and stores session on success', async () => {
    mockApiPost.mockResolvedValue({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
        is_new_user: false,
      },
    });

    render(
      <OTPVerifyScreen
        navigation={navigation as never}
        route={{
          key: 'OTPVerify',
          name: 'OTPVerify',
          params: { phoneE164: '+15551234567', accountExists: true },
        }}
      />,
    );

    for (let i = 1; i <= 6; i++) {
      fireEvent.changeText(screen.getByLabelText(`Digit ${i}`), String(i));
    }

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/otp/verify',
        expect.objectContaining({
          phone_e164: '+15551234567',
          code: '123456',
          context: 'register',
          device_id: expect.any(String),
          platform: expect.any(String),
        }),
      );
    });

    await waitFor(() => {
      expect(useAuthStore.getState().session?.access_token).toBe('access-1');
      expect(useAuthStore.getState().user?.display_name).toBe('Alex');
    });
  });

  it('shows error and clears digits on wrong OTP', async () => {
    const { ApiRequestError: MockApiRequestError } = jest.requireMock('../../services/api') as {
      ApiRequestError: typeof ApiRequestError;
    };
    mockApiPost.mockRejectedValue(
      new MockApiRequestError('INVALID_CODE', 'Invalid OTP code', 400),
    );

    render(
      <OTPVerifyScreen
        navigation={navigation as never}
        route={{
          key: 'OTPVerify',
          name: 'OTPVerify',
          params: { phoneE164: '+15551234567' },
        }}
      />,
    );

    for (let i = 1; i <= 6; i++) {
      fireEvent.changeText(screen.getByLabelText(`Digit ${i}`), '9');
    }

    await waitFor(() => {
      expect(screen.getByText('Incorrect code. Try again.')).toBeTruthy();
    });
    expect(screen.getByLabelText('Digit 1').props.value).toBe('');
  });

  it('sends register context and logs in existing users without a name', async () => {
    mockApiPost.mockResolvedValue({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
        is_new_user: false,
      },
    });

    render(
      <OTPVerifyScreen
        navigation={navigation as never}
        route={{
          key: 'OTPVerify',
          name: 'OTPVerify',
          params: { phoneE164: '+15005550006', accountExists: true },
        }}
      />,
    );

    for (let i = 1; i <= 6; i++) {
      fireEvent.changeText(screen.getByLabelText(`Digit ${i}`), '1');
    }

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/auth/otp/verify',
        expect.objectContaining({
          phone_e164: '+15005550006',
          code: '111111',
          context: 'register',
          device_id: expect.any(String),
          platform: expect.any(String),
        }),
      );
    });
  });

  it('hides name field and shows already-registered banner for existing users', () => {
    render(
      <OTPVerifyScreen
        navigation={navigation as never}
        route={{
          key: 'OTPVerify',
          name: 'OTPVerify',
          params: { phoneE164: '+15005550006', accountExists: true },
        }}
      />,
    );

    expect(
      screen.getByText("You're already registered — just enter the code to sign in."),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('shows name-required message for new users who verify without a name', async () => {
    const { ApiRequestError: MockApiRequestError } = jest.requireMock('../../services/api') as {
      ApiRequestError: typeof ApiRequestError;
    };
    mockApiPost.mockRejectedValue(
      new MockApiRequestError('NAME_REQUIRED', 'display_name is required for new users', 400),
    );

    render(
      <OTPVerifyScreen
        navigation={navigation as never}
        route={{
          key: 'OTPVerify',
          name: 'OTPVerify',
          params: { phoneE164: '+15559999999' },
        }}
      />,
    );

    for (let i = 1; i <= 6; i++) {
      fireEvent.changeText(screen.getByLabelText(`Digit ${i}`), '1');
    }

    await waitFor(() => {
      expect(screen.getByText('Enter your name to create an account.')).toBeTruthy();
    });
  });
});
