import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import type { AuthSession, AuthUser } from '@letssplyt/shared/auth.types';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { getSupabase } from '../lib/supabase';

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export type AppUser = Pick<AuthUser, 'id' | 'display_name' | 'avatar_colour'>;

interface AuthState {
  session: Session | null;
  user: AppUser | null;
  isLoading: boolean;
  setSession: (session: Session | null) => Promise<void>;
  applyAuthResponse: (auth: AuthSession) => Promise<void>;
  restoreFromSecureStore: () => Promise<void>;
  clearSession: () => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  initAuthListener: () => { unsubscribe: () => void };
}

function buildLocalSession(auth: AuthSession): Session {
  return {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    expires_in: auth.expires_in,
    token_type: 'bearer',
    user: {
      id: auth.user.id,
      app_metadata: {},
      user_metadata: { display_name: auth.user.display_name },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

function buildLocalSessionFromTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn = 3600,
): Session {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    token_type: 'bearer',
    user: {
      id: 'restored',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: false,

  setSession: async (session) => {
    if (session?.access_token) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, session.access_token);
      if (session.refresh_token) {
        await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, session.refresh_token);
      }
    } else {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(AUTH_REFRESH_TOKEN_KEY);
    }
    set((state) => ({
      session,
      user: session ? state.user : null,
    }));
  },

  applyAuthResponse: async (auth) => {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, auth.access_token);
    await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, auth.refresh_token);

    const appUser: AppUser = {
      id: auth.user.id,
      display_name: auth.user.display_name,
      avatar_colour: auth.user.avatar_colour,
    };
    const localSession = buildLocalSession(auth);

    // Commit session immediately so navigation can switch to Home.
    set({ session: localSession, user: appUser });

    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
      });

      if (!error && data.session) {
        set({ session: data.session, user: appUser });
      }
    } catch {
      // Keep local session from backend — navigation must not fail on client Supabase errors.
    }
  },

  restoreFromSecureStore: async () => {
    const accessToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    if (!accessToken) return;

    const refreshToken = (await SecureStore.getItemAsync(AUTH_REFRESH_TOKEN_KEY)) ?? '';
    const supabase = getSupabase();

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await get().setSession(data.session);
        return;
      }
      if (refreshToken) {
        const { data: setData, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error && setData.session) {
          await get().setSession(setData.session);
          return;
        }
      }
    }

    set({ session: buildLocalSessionFromTokens(accessToken, refreshToken) });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(AUTH_REFRESH_TOKEN_KEY);
    set({ session: null, user: null });
  },

  logout: async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    await get().clearSession();
  },

  setLoading: (isLoading) => set({ isLoading }),

  initAuthListener: () => {
    const supabase = getSupabase();
    if (!supabase) {
      return { unsubscribe: () => undefined };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        void get().setSession(session);
      }
      if (event === 'SIGNED_OUT') {
        void get().clearSession();
      }
      if (event === 'USER_UPDATED') {
        void (async () => {
          const biometricEnabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
          if (biometricEnabled !== 'true') return;

          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (!enrolled) {
            await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
            Alert.alert(
              'Biometric login disabled',
              'Please sign in with your phone number again.',
            );
            return;
          }

          Alert.alert(
            'Update biometric login',
            'Your account was updated. Re-enable Face ID or fingerprint for faster sign-in?',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Enable',
                onPress: () => {
                  void LocalAuthentication.authenticateAsync({
                    promptMessage: 'Confirm to enable biometric login',
                  }).then((result) => {
                    if (!result.success) {
                      void AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
                    }
                  });
                },
              },
            ],
          );
        })();
      }
    });

    return { unsubscribe: () => subscription.unsubscribe() };
  },
}));
