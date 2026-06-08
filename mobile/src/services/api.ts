import type { ApiError } from '@letssplyt/shared/api.types';
import { getApiBaseUrl } from './getApiBaseUrl';

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

/** instanceof breaks across Metro module boundaries — use structural check. */
export function isApiRequestError(err: unknown): err is ApiRequestError {
  if (err instanceof ApiRequestError) return true;
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as ApiRequestError).name === 'ApiRequestError' &&
    typeof (err as ApiRequestError).code === 'string' &&
    typeof (err as ApiRequestError).status === 'number'
  );
}

export function getApiErrorCode(err: unknown): string | undefined {
  return isApiRequestError(err) ? err.code : undefined;
}

function resolveErrorMessage(
  path: string,
  code: string,
  apiMessage: string | undefined,
): string {
  const isVerify = path.includes('/otp/verify');
  const sendCodeDefault = "Couldn't send code. Check your number and try again.";
  const verifyDefault = 'Incorrect code. Try again.';

  switch (code) {
    case 'INVALID_PHONE':
    case 'VALIDATION_ERROR':
      return sendCodeDefault;
    case 'INVALID_CODE':
      return verifyDefault;
    case 'CODE_EXPIRED':
      return 'That code has expired. Tap Resend to get a new one.';
    case 'OTP_RATE_LIMITED':
    case 'TOO_MANY_REQUESTS':
    case 'IP_RATE_LIMITED':
      return 'Too many attempts. Wait a minute and try again, or restart the backend in local dev.';
    case 'ACCOUNT_NOT_FOUND':
      return 'No account found. Check number and try again.';
    case 'SESSION_CREATE_FAILED':
      return 'Could not sign you in. Please try again.';
    case 'AUTH_PROFILE_CREATION_FAILED':
      return 'Could not finish setting up your account. Please try again.';
    case 'NETWORK_ERROR':
      return apiMessage ?? 'No connection. Connect to the internet and try again.';
    case 'INVALID_RESPONSE':
      return isVerify ? verifyDefault : sendCodeDefault;
    case 'USER_CREATE_FAILED':
      if (apiMessage?.toLowerCase().includes('already registered')) {
        return 'This number already has an account. Use "I already have an account" to sign in.';
      }
      return apiMessage ?? (isVerify ? verifyDefault : sendCodeDefault);
    default:
      return apiMessage ?? (isVerify ? verifyDefault : sendCodeDefault);
  }
}

export async function apiPost<TResponse>(
  path: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const url = `${getApiBaseUrl()}/api/v1${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    const hint = __DEV__
      ? ` No connection to ${url}. On a physical device: start the backend (cd backend && doppler run -- npm run dev), connect phone and Mac to the same Wi‑Fi, or set EXPO_PUBLIC_API_URL=http://<your-mac-lan-ip>:3000 before npm start.`
      : ' Connect to the internet and try again.';
    throw new ApiRequestError('NETWORK_ERROR', `No connection.${hint}`, 0);
  }

  const payload = (await response.json().catch(() => null)) as TResponse | ApiError | null;

  if (!response.ok) {
    const apiError = payload as ApiError | null;
    const code =
      apiError?.error?.code ??
      (response.status === 404 && path.includes('/auth/otp') ? 'ACCOUNT_NOT_FOUND' : 'UNKNOWN_ERROR');
    const message = resolveErrorMessage(path, code, apiError?.error?.message);
    throw new ApiRequestError(code, message, response.status);
  }

  if (payload === null || typeof payload !== 'object') {
    throw new ApiRequestError(
      'INVALID_RESPONSE',
      __DEV__
        ? `Unexpected empty response from ${url} (HTTP ${response.status})`
        : "Couldn't send code. Check your number and try again.",
      response.status,
    );
  }

  return payload as TResponse;
}
