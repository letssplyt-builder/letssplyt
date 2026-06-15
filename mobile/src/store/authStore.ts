import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import type { AuthSession, AuthUser } from '@letssplyt/shared/auth.types';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { BIOMETRIC_MAX_FAILURES } from '../auth/appLockConfig';
import { getSupabase } from '../lib/supabase';
import {
  clearSupabaseMemorySession,
  setSupabaseSessionPersistenceListener,
} from '../lib/supabaseAuthStorage';
import { useNotificationStore } from './notificationStore';
import { useProfileStore } from './profileStore';
import { useSettlementStore } from './settlementStore';
import {
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_TOKEN_KEY,
  cacheUserProfile,
  clearBiometricStorageMode,
  migrateToBiometricStorage,
  migrateToPlainStorage,
  readCachedUserProfile,
  readStoredTokens,
  resolveStoredCredentialMode,
  setBiometricStorageMode,
  wipeAllStoredCredentials,
  type BiometricStorageMode,
} from '../services/secureTokenStorage';

export { AUTH_TOKEN_KEY, AUTH_REFRESH_TOKEN_KEY };

export type AppUser = Pick<AuthUser, 'id' | 'display_name' | 'avatar_colour'>;

interface AuthState {
  session: Session | null;
  user: AppUser | null;
  isLoading: boolean;
  needsPushPermission: boolean;
  isBootstrapping: boolean;
  isUnlocked: boolean;
  hasStoredCredentials: boolean;
  storageMode: BiometricStorageMode | null;
  pendingBiometricOptIn: boolean;
  setSession: (session: Session | null) => Promise<void>;
  applyAuthResponse: (auth: AuthSession) => Promise<void>;
  bootstrapFromStorage: () => Promise<void>;
  unlockApp: () => Promise<boolean>;
  lockApp: () => Promise<void>;
  enrollBiometricStorage: () => Promise<boolean>;
  skipBiometricStorage: () => Promise<void>;
  clearSession: () => Promise<void>;
  logout: () => Promise<void>;
  dismissPushPermission: () => void;
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
  userId?: string,
  expiresIn = 3600,
): Session {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    token_type: 'bearer',
    user: {
      id: userId ?? 'restored',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  };
}

async function persistSessionTokens(session: Session, mode: BiometricStorageMode): Promise<void> {
  const refresh = session.refresh_token ?? '';
  if (!refresh) return;
  if (mode === 'biometric') {
    await migrateToBiometricStorage(session.access_token, refresh);
  } else {
    await migrateToPlainStorage(session.access_token, refresh);
  }
}

async function hydrateSupabaseSession(session: Session): Promise<Session> {
  const supabase = getSupabase();
  if (!supabase) return session;

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token ?? '',
    });
    if (!error && data.session) {
      return data.session;
    }
  } catch {
    // Keep local session — navigation must not fail on client Supabase errors.
  }
  return session;
}

async function restoreSessionFromStoredTokens(
  mode: BiometricStorageMode,
): Promise<Session | null> {
  const stored = await readStoredTokens(mode);
  if (!stored) return null;

  const cachedUser = await readCachedUserProfile();
  const localSession = buildLocalSessionFromTokens(
    stored.accessToken ?? '',
    stored.refreshToken,
    cachedUser?.id,
  );
  return await hydrateSupabaseSession(localSession);
}

let unlockFailureCount = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: false,
  needsPushPermission: false,
  isBootstrapping: true,
  isUnlocked: false,
  hasStoredCredentials: false,
  storageMode: null,
  pendingBiometricOptIn: false,

  setSession: async (session) => {
    const mode = get().storageMode ?? (await resolveStoredCredentialMode()) ?? 'plain';

    if (session?.access_token) {
      if (session.user?.id && get().user) {
        await cacheUserProfile(get().user!);
      }
      if (mode === 'plain') {
        try {
          await SecureStore.setItemAsync(AUTH_TOKEN_KEY, session.access_token);
          if (session.refresh_token) {
            await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, session.refresh_token);
          }
        } catch {
          // SecureStore can fail on keystore issues — keep in-memory session.
        }
      } else if (mode === 'biometric' && session.refresh_token) {
        try {
          await migrateToBiometricStorage(session.access_token, session.refresh_token);
        } catch {
          // Best-effort — in-memory session still valid until lock.
        }
      }
    } else {
      clearSupabaseMemorySession();
    }

    set((state) => ({
      session,
      user: session ? state.user : null,
      needsPushPermission: session ? state.needsPushPermission : false,
      isUnlocked: Boolean(session),
      hasStoredCredentials: Boolean(session?.refresh_token) || state.hasStoredCredentials,
    }));
  },

  applyAuthResponse: async (auth) => {
    const appUser: AppUser = {
      id: auth.user.id,
      display_name: auth.user.display_name,
      avatar_colour: auth.user.avatar_colour,
    };

    const localSession = buildLocalSession(auth);

    set({
      session: localSession,
      user: appUser,
      needsPushPermission: auth.user.is_new_user,
      isUnlocked: true,
      hasStoredCredentials: true,
      storageMode: 'plain',
      pendingBiometricOptIn: false,
      isBootstrapping: false,
    });

    void LocalAuthentication.isEnrolledAsync()
      .then((enrolled) => {
        if (enrolled) {
          useAuthStore.setState({ pendingBiometricOptIn: true });
        }
      })
      .catch(() => undefined);

    try {
      await cacheUserProfile(appUser);
      await setBiometricStorageMode('plain');
      await migrateToPlainStorage(auth.access_token, auth.refresh_token);
    } catch {
      // Navigation already switched — keep in-memory session if SecureStore fails.
    }

    void hydrateSupabaseSession(localSession);
  },

  bootstrapFromStorage: async () => {
    if (get().isUnlocked && get().session?.access_token) {
      set({ isBootstrapping: false });
      return;
    }

    set({ isBootstrapping: true });
    try {
      const mode = await resolveStoredCredentialMode();
      if (!mode) {
        set({
          isBootstrapping: false,
          hasStoredCredentials: false,
          storageMode: null,
          isUnlocked: false,
        });
        return;
      }

      const cachedUser = await readCachedUserProfile();
      set({
        hasStoredCredentials: true,
        storageMode: mode,
        user: cachedUser,
      });

      if (mode === 'biometric') {
        set({ isBootstrapping: false, isUnlocked: false, session: null });
        return;
      }

      const session = await restoreSessionFromStoredTokens('plain');
      if (!session) {
        await wipeAllStoredCredentials();
        set({
          isBootstrapping: false,
          hasStoredCredentials: false,
          storageMode: null,
          isUnlocked: false,
          session: null,
          user: null,
        });
        return;
      }

      set({
        session,
        isUnlocked: true,
        isBootstrapping: false,
        user: cachedUser,
      });
    } catch {
      set({ isBootstrapping: false });
    }
  },

  unlockApp: async () => {
    const mode = get().storageMode ?? (await resolveStoredCredentialMode());
    if (!mode) return false;

    if (mode === 'plain') {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (enrolled) {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock LetsSplyt',
          cancelLabel: 'Use phone number',
          disableDeviceFallback: false,
        });
        if (!authResult.success) {
          unlockFailureCount += 1;
          if (unlockFailureCount >= BIOMETRIC_MAX_FAILURES) {
            await get().clearSession();
            unlockFailureCount = 0;
          }
          return false;
        }
      }
    }

    try {
      const session = await restoreSessionFromStoredTokens(mode);
      if (!session) {
        await get().clearSession();
        return false;
      }

      const cachedUser = await readCachedUserProfile();
      unlockFailureCount = 0;
      set({
        session,
        user: cachedUser,
        isUnlocked: true,
        storageMode: mode,
        hasStoredCredentials: true,
      });
      return true;
    } catch {
      unlockFailureCount += 1;
      if (unlockFailureCount >= BIOMETRIC_MAX_FAILURES) {
        await get().clearSession();
        unlockFailureCount = 0;
      }
      return false;
    }
  },

  lockApp: async () => {
    clearSupabaseMemorySession();
    set({
      session: null,
      isUnlocked: false,
    });
  },

  enrollBiometricStorage: async () => {
    const session = get().session;
    if (!session?.refresh_token) return false;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;

    const authResult = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable Face ID or fingerprint',
      cancelLabel: 'Cancel',
    });
    if (!authResult.success) return false;

    await migrateToBiometricStorage(session.access_token, session.refresh_token);
    set({
      storageMode: 'biometric',
      pendingBiometricOptIn: false,
    });
    return true;
  },

  skipBiometricStorage: async () => {
    const session = get().session;
    if (session?.access_token && session.refresh_token) {
      await migrateToPlainStorage(session.access_token, session.refresh_token);
    } else {
      await setBiometricStorageMode('plain');
    }
    set({
      storageMode: 'plain',
      pendingBiometricOptIn: false,
    });
  },

  clearSession: async () => {
    await wipeAllStoredCredentials();
    clearSupabaseMemorySession();
    useNotificationStore.getState().clear();
    useSettlementStore.getState().reset();
    useProfileStore.getState().reset();
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Local wipe is sufficient for client logout.
      }
    }
    unlockFailureCount = 0;
    set({
      session: null,
      user: null,
      needsPushPermission: false,
      isUnlocked: false,
      hasStoredCredentials: false,
      storageMode: null,
      pendingBiometricOptIn: false,
    });
  },

  dismissPushPermission: () => set({ needsPushPermission: false }),

  logout: async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Remote revoke is best-effort — always clear local credentials.
      }
    }
    await get().clearSession();
  },

  setLoading: (isLoading) => set({ isLoading }),

  initAuthListener: () => {
    setSupabaseSessionPersistenceListener(async (sessionJson) => {
      if (!sessionJson) return;
      try {
        const parsed = JSON.parse(sessionJson) as {
          access_token?: string;
          refresh_token?: string;
        };
        if (!parsed.refresh_token || !parsed.access_token) return;
        const mode = get().storageMode ?? 'plain';
        if (get().isUnlocked) {
          await persistSessionTokens(
            {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
              expires_in: 3600,
              token_type: 'bearer',
              user: get().session?.user ?? {
                id: get().user?.id ?? 'unknown',
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString(),
              },
            },
            mode,
          );
        }
      } catch {
        // Ignore malformed session payloads.
      }
    });

    const supabase = getSupabase();
    if (!supabase) {
      return { unsubscribe: () => undefined };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session && get().isUnlocked) {
        void get().setSession(session);
      }
      // Do not clear credentials on SIGNED_OUT — logout() calls clearSession explicitly.
      // Supabase can emit SIGNED_OUT during setSession churn and would trap users on OTP.
      if (event === 'USER_UPDATED') {
        void (async () => {
          const mode = await resolveStoredCredentialMode();
          if (mode !== 'biometric') return;

          const enrolled = await LocalAuthentication.isEnrolledAsync();
          if (!enrolled) {
            await clearBiometricStorageMode();
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
                  void get().enrollBiometricStorage();
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
