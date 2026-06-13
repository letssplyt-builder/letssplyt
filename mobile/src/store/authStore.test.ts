import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  AUTH_REFRESH_TOKEN_BIO_KEY,
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_TOKEN_KEY,
  BIOMETRIC_MODE_KEY,
} from '../services/secureTokenStorage';
import { useAuthStore } from './authStore';
import {
  mockAuthStateCallback,
  mockOnAuthStateChange,
  mockSignOut,
  mockUnsubscribe,
} from '../__tests__/mocks/supabase';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      user: null,
      isLoading: false,
      needsPushPermission: false,
      isBootstrapping: false,
      isUnlocked: false,
      hasStoredCredentials: false,
      storageMode: null,
      pendingBiometricOptIn: false,
    });
    jest.clearAllMocks();
  });

  it('initialises with null session and locked state', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.isUnlocked).toBe(false);
  });

  it('applyAuthResponse stores plain tokens and offers biometric opt-in', async () => {
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);

    await useAuthStore.getState().applyAuthResponse({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Sam',
        avatar_colour: '#7C3AED',
        is_new_user: false,
      },
    });

    expect(useAuthStore.getState().session?.access_token).toBe('access-1');
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(useAuthStore.getState().pendingBiometricOptIn).toBe(true);
    expect(useAuthStore.getState().storageMode).toBe('plain');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY, 'access-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_REFRESH_TOKEN_KEY, 'refresh-1');
  });

  it('bootstrapFromStorage restores plain mode silently', async () => {
    await AsyncStorage.setItem(BIOMETRIC_MODE_KEY, 'plain');
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, 'stored-access');
    await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, 'stored-refresh');

    await useAuthStore.getState().bootstrapFromStorage();

    expect(useAuthStore.getState().isUnlocked).toBe(true);
    expect(useAuthStore.getState().session?.access_token).toBe('refreshed-access-token');
    expect(useAuthStore.getState().hasStoredCredentials).toBe(true);
  });

  it('bootstrapFromStorage waits for unlock in biometric mode', async () => {
    jest.mocked(AsyncStorage.getItem).mockImplementation((key) =>
      Promise.resolve(key === BIOMETRIC_MODE_KEY ? 'biometric' : null),
    );

    await useAuthStore.getState().bootstrapFromStorage();

    expect(useAuthStore.getState().isUnlocked).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().hasStoredCredentials).toBe(true);
    expect(useAuthStore.getState().storageMode).toBe('biometric');
  });

  it('skipBiometricStorage keeps plain persisted refresh (Option B)', async () => {
    await useAuthStore.getState().applyAuthResponse({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Sam',
        avatar_colour: '#7C3AED',
        is_new_user: false,
      },
    });

    await useAuthStore.getState().skipBiometricStorage();

    expect(useAuthStore.getState().pendingBiometricOptIn).toBe(false);
    expect(useAuthStore.getState().storageMode).toBe('plain');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_REFRESH_TOKEN_KEY, 'refresh-1');
  });

  it('applyAuthResponse sets session before biometric enrollment check completes', async () => {
    let finishEnrollmentCheck: (value: boolean) => void = () => undefined;
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finishEnrollmentCheck = resolve;
        }),
    );

    const applyPromise = useAuthStore.getState().applyAuthResponse({
      access_token: 'access-immediate',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Sam',
        avatar_colour: '#7C3AED',
        is_new_user: false,
      },
    });

    expect(useAuthStore.getState().session?.access_token).toBe('access-immediate');
    expect(useAuthStore.getState().isUnlocked).toBe(true);
    expect(useAuthStore.getState().pendingBiometricOptIn).toBe(false);

    finishEnrollmentCheck(true);
    await applyPromise;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(useAuthStore.getState().pendingBiometricOptIn).toBe(true);
  });

  it('logout clears local session when Supabase signOut fails', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('network error'));

    await useAuthStore.getState().applyAuthResponse({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
        is_new_user: false,
      },
    });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().hasStoredCredentials).toBe(false);
    expect(useAuthStore.getState().isUnlocked).toBe(false);
  });

  it('enrollBiometricStorage keeps in-memory access token for API calls', async () => {
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true });
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);

    await useAuthStore.getState().applyAuthResponse({
      access_token: 'bio-access',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Sam',
        avatar_colour: '#7C3AED',
        is_new_user: false,
      },
    });

    const enrolled = await useAuthStore.getState().enrollBiometricStorage();
    expect(enrolled).toBe(true);
    expect(useAuthStore.getState().session?.access_token).toBe('bio-access');
    expect(useAuthStore.getState().storageMode).toBe('biometric');
  });

  it('logout signs out of Supabase and clears stored tokens', async () => {
    await useAuthStore.getState().applyAuthResponse({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
        is_new_user: false,
      },
    });

    await useAuthStore.getState().logout();

    expect(mockSignOut).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().hasStoredCredentials).toBe(false);
  });

  it('lockApp clears session memory but keeps stored credentials', async () => {
    await useAuthStore.getState().applyAuthResponse({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
        is_new_user: false,
      },
    });

    await useAuthStore.getState().lockApp();

    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().isUnlocked).toBe(false);
    expect(useAuthStore.getState().hasStoredCredentials).toBe(true);
  });

  it('initAuthListener wires TOKEN_REFRESHED to setSession when unlocked', async () => {
    const { unsubscribe } = useAuthStore.getState().initAuthListener();

    const refreshedSession = {
      access_token: 'new-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'user-1',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z',
      },
    };

    useAuthStore.setState({
      isUnlocked: true,
      user: { id: 'user-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
    });

    await mockAuthStateCallback('TOKEN_REFRESHED', refreshedSession);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(useAuthStore.getState().session?.access_token).toBe('new-token');

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('initAuthListener does not clear session on SIGNED_OUT (logout clears explicitly)', async () => {
    useAuthStore.getState().initAuthListener();

    await useAuthStore.getState().applyAuthResponse({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Alex',
        avatar_colour: '#4F46E5',
        is_new_user: false,
      },
    });

    await mockAuthStateCallback('SIGNED_OUT', null);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(useAuthStore.getState().session?.access_token).toBe('token');
  });

  it('enrollBiometricStorage moves refresh to biometric-protected storage', async () => {
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValue({ success: true });
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValue(true);

    await useAuthStore.getState().applyAuthResponse({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Sam',
        avatar_colour: '#7C3AED',
        is_new_user: false,
      },
    });

    const ok = await useAuthStore.getState().enrollBiometricStorage();
    expect(ok).toBe(true);
    expect(useAuthStore.getState().storageMode).toBe('biometric');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      AUTH_REFRESH_TOKEN_BIO_KEY,
      'refresh-1',
      expect.objectContaining({ requireAuthentication: true }),
    );
  });
});
