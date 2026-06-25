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

  it('renders unified phone entry copy', () => {
    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{ key: 'PhoneEntry', name: 'PhoneEntry', params: {} }}
      />,
    );

    expect(screen.getByText('Enter your\nphone number')).toBeTruthy();
    expect(screen.getByText("We'll text you a\none-time code.")).toBeTruthy();
    expect(screen.getByText(/Msg & data rates may apply/)).toBeTruthy();
    expect(screen.getByText(/Reply STOP to opt out/)).toBeTruthy();
    expect(screen.queryByText('Welcome back')).toBeNull();
    expect(screen.queryByText('New account')).toBeNull();
  });

  it('navigates to legal documents when Terms or Privacy links are pressed', () => {
    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{ key: 'PhoneEntry', name: 'PhoneEntry', params: {} }}
      />,
    );

    fireEvent.press(screen.getByText('Terms'));
    expect(navigation.navigate).toHaveBeenCalledWith('LegalDocument', { document: 'terms' });

    fireEvent.press(screen.getByText('Privacy'));
    expect(navigation.navigate).toHaveBeenCalledWith('LegalDocument', { document: 'privacy' });
  });

  it('always requests OTP with register context', async () => {
    mockApiPost.mockResolvedValue({
      sent: true,
      channel: 'sms',
      expires_in_seconds: 600,
    });

    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{ key: 'PhoneEntry', name: 'PhoneEntry', params: {} }}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Phone number'), '5005550006');
    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/auth/otp/request', {
        phone_e164: '+15005550006',
        context: 'register',
      });
    });
  });

  it('navigates to OTP with accountExists when send-code finds existing account', async () => {
    mockApiPost.mockResolvedValue({
      sent: true,
      channel: 'sms',
      expires_in_seconds: 600,
      account_exists: true,
    });

    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{ key: 'PhoneEntry', name: 'PhoneEntry', params: {} }}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Phone number'), '5005550006');
    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('OTPVerify', {
        phoneE164: '+15005550006',
        accountExists: true,
      });
    });
  });

  it('shows inline error when send-code fails', async () => {
    const { ApiRequestError: MockApiRequestError } = jest.requireMock('../../services/api') as {
      ApiRequestError: typeof ApiRequestError;
    };
    mockApiPost.mockRejectedValue(
      new MockApiRequestError('OTP_RATE_LIMITED', 'Too many attempts. Wait a minute and try again.', 429),
    );

    render(
      <PhoneEntryScreen
        navigation={navigation as never}
        route={{ key: 'PhoneEntry', name: 'PhoneEntry', params: {} }}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Phone number'), '5005550006');
    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => {
      expect(screen.getByText('Too many attempts. Wait a minute and try again.')).toBeTruthy();
    });
  });
});
