import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AppUser } from '../store/authStore';

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_REFRESH_TOKEN_KEY = 'auth_refresh_token';
export const AUTH_REFRESH_TOKEN_BIO_KEY = 'auth_refresh_token_bio';
export const USER_CACHE_KEY = 'auth_user_cache';
export const BIOMETRIC_MODE_KEY = 'biometric_mode';

export type BiometricStorageMode = 'biometric' | 'plain';

const BIO_SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getBiometricStorageMode(): Promise<BiometricStorageMode | null> {
  const mode = await AsyncStorage.getItem(BIOMETRIC_MODE_KEY);
  if (mode === 'biometric' || mode === 'plain') return mode;
  return null;
}

export async function setBiometricStorageMode(mode: BiometricStorageMode): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_MODE_KEY, mode);
}

export async function clearBiometricStorageMode(): Promise<void> {
  await AsyncStorage.removeItem(BIOMETRIC_MODE_KEY);
}

export async function cacheUserProfile(user: AppUser): Promise<void> {
  await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(user));
}

export async function readCachedUserProfile(): Promise<AppUser | null> {
  const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export async function hasStoredRefreshToken(mode: BiometricStorageMode | null): Promise<boolean> {
  if (mode === 'biometric') return true;
  if (mode === 'plain') {
    return Boolean(await SecureStore.getItemAsync(AUTH_REFRESH_TOKEN_KEY));
  }
  return false;
}

export async function resolveStoredCredentialMode(): Promise<BiometricStorageMode | null> {
  const mode = await getBiometricStorageMode();
  if (mode === 'biometric') return 'biometric';
  const plain = await SecureStore.getItemAsync(AUTH_REFRESH_TOKEN_KEY);
  if (plain) return 'plain';
  return null;
}

export async function hasAnyStoredCredentials(): Promise<boolean> {
  return (await resolveStoredCredentialMode()) !== null;
}

interface StoredTokens {
  accessToken: string | null;
  refreshToken: string;
}

export async function readStoredTokens(mode: BiometricStorageMode): Promise<StoredTokens | null> {
  if (mode === 'biometric') {
    const refreshToken = await SecureStore.getItemAsync(
      AUTH_REFRESH_TOKEN_BIO_KEY,
      BIO_SECURE_OPTIONS,
    );
    if (!refreshToken) return null;
    const accessToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    return { accessToken, refreshToken };
  }

  const refreshToken = await SecureStore.getItemAsync(AUTH_REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const accessToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  return { accessToken, refreshToken };
}

export async function writeStoredTokens(
  mode: BiometricStorageMode,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  if (mode === 'biometric') {
    await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_BIO_KEY, refreshToken, BIO_SECURE_OPTIONS);
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken);
    await SecureStore.deleteItemAsync(AUTH_REFRESH_TOKEN_KEY);
    return;
  }

  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, refreshToken);
  await SecureStore.deleteItemAsync(AUTH_REFRESH_TOKEN_BIO_KEY);
}

export async function migrateToBiometricStorage(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await writeStoredTokens('biometric', accessToken, refreshToken);
  await setBiometricStorageMode('biometric');
}

export async function migrateToPlainStorage(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await writeStoredTokens('plain', accessToken, refreshToken);
  await setBiometricStorageMode('plain');
}

export async function wipeAllStoredCredentials(): Promise<void> {
  const deleteSafe = async (key: string, options?: SecureStore.SecureStoreOptions) => {
    try {
      await SecureStore.deleteItemAsync(key, options);
    } catch {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Best-effort wipe — continue clearing other keys.
      }
    }
  };

  await deleteSafe(AUTH_TOKEN_KEY);
  await deleteSafe(AUTH_REFRESH_TOKEN_KEY);
  await deleteSafe(AUTH_REFRESH_TOKEN_BIO_KEY, BIO_SECURE_OPTIONS);
  await deleteSafe(AUTH_REFRESH_TOKEN_BIO_KEY);
  await deleteSafe(USER_CACHE_KEY);
  await clearBiometricStorageMode();
}
