import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { AUTH_TOKEN_KEY } from './secureTokenStorage';
import { resolveAccessToken } from './authToken';
import { useAuthStore } from '../store/authStore';

describe('resolveAccessToken', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      isUnlocked: false,
    });
    jest.mocked(SecureStore.getItemAsync).mockReset();
  });

  it('returns in-memory session token when unlocked (biometric mode keeps JWT in memory)', async () => {
    useAuthStore.setState({
      isUnlocked: true,
      session: {
        access_token: 'memory-access',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-1',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
      },
    });

    const token = await resolveAccessToken();
    expect(token).toBe('memory-access');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('falls back to SecureStore when memory session is empty', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('disk-access');

    const token = await resolveAccessToken();
    expect(token).toBe('disk-access');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
  });

  it('returns null when locked with no disk token', async () => {
    useAuthStore.setState({ isUnlocked: false, session: null });
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

    expect(await resolveAccessToken()).toBeNull();
  });
});
