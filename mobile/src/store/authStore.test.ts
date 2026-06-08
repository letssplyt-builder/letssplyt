import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import {
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_TOKEN_KEY,
  useAuthStore,
} from './authStore';
import {
  mockAuthStateCallback,
  mockOnAuthStateChange,
  mockSignOut,
  mockUnsubscribe,
} from '../__tests__/mocks/supabase';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ session: null, user: null, isLoading: false });
    jest.clearAllMocks();
  });

  it('initialises with null session and user', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('setSession persists access and refresh tokens to expo-secure-store', async () => {
    const session = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
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
      user: { id: 'user-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
    });

    await useAuthStore.getState().setSession(session as never);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY, 'test-access-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      AUTH_REFRESH_TOKEN_KEY,
      'test-refresh-token',
    );
    expect(useAuthStore.getState().session).toEqual(session);
    expect(useAuthStore.getState().user?.display_name).toBe('Alex');
  });

  it('logout signs out of Supabase and clears stored tokens', async () => {
    await useAuthStore.getState().setSession({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: null,
    } as never);
    useAuthStore.setState({
      user: { id: 'user-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
    });

    await useAuthStore.getState().logout();

    expect(mockSignOut).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_REFRESH_TOKEN_KEY);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clearSession removes tokens from secure store', async () => {
    await useAuthStore.getState().setSession({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: null,
    } as never);

    await useAuthStore.getState().clearSession();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_REFRESH_TOKEN_KEY);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('applyAuthResponse sets local session immediately even if Supabase setSession fails', async () => {
    const { getSupabase } = jest.requireMock('../lib/supabase') as {
      getSupabase: () => {
        auth: {
          setSession: () => Promise<{ data: { session: null }; error: { message: '404' } }>;
        };
      };
    };
    const supabase = getSupabase();
    supabase.auth.setSession = jest.fn(() =>
      Promise.resolve({ data: { session: null }, error: { message: '404 Not Found' } }),
    );

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
    expect(useAuthStore.getState().user?.display_name).toBe('Sam');
  });

  it('applyAuthResponse stores user profile from backend response', async () => {
    await useAuthStore.getState().applyAuthResponse({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      user: {
        id: 'user-1',
        display_name: 'Sam',
        avatar_colour: '#7C3AED',
        is_new_user: true,
      },
    });

    expect(useAuthStore.getState().user).toEqual({
      id: 'user-1',
      display_name: 'Sam',
      avatar_colour: '#7C3AED',
    });
    expect(useAuthStore.getState().session?.access_token).toBe('access-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY, 'access-1');
  });

  it('initAuthListener wires TOKEN_REFRESHED to setSession', async () => {
    const { unsubscribe } = useAuthStore.getState().initAuthListener();

    expect(mockOnAuthStateChange).toHaveBeenCalled();

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
      user: { id: 'user-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
    });

    await mockAuthStateCallback('TOKEN_REFRESHED', refreshedSession);

    await Promise.resolve();

    expect(useAuthStore.getState().session?.access_token).toBe('new-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY, 'new-token');

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('initAuthListener clears session on SIGNED_OUT', async () => {
    useAuthStore.getState().initAuthListener();

    await useAuthStore.getState().setSession({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: null,
    } as never);

    await mockAuthStateCallback('SIGNED_OUT', null);
    await Promise.resolve();

    expect(useAuthStore.getState().session).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
  });

  it('setLoading updates isLoading flag', () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
