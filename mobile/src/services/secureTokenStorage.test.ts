import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  AUTH_REFRESH_TOKEN_BIO_KEY,
  AUTH_REFRESH_TOKEN_KEY,
  AUTH_TOKEN_KEY,
  BIOMETRIC_MODE_KEY,
  USER_CACHE_KEY,
  wipeAllStoredCredentials,
} from './secureTokenStorage';

describe('secureTokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wipeAllStoredCredentials completes when biometric key delete throws', async () => {
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key, options) => {
      if (key === AUTH_REFRESH_TOKEN_BIO_KEY && options?.requireAuthentication) {
        throw new Error('biometric gate');
      }
    });

    await wipeAllStoredCredentials();

    const deletedKeys = jest.mocked(SecureStore.deleteItemAsync).mock.calls.map((call) => call[0]);
    expect(deletedKeys).toContain(AUTH_TOKEN_KEY);
    expect(deletedKeys).toContain(AUTH_REFRESH_TOKEN_KEY);
    expect(deletedKeys).toContain(AUTH_REFRESH_TOKEN_BIO_KEY);
    expect(deletedKeys).toContain(USER_CACHE_KEY);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(BIOMETRIC_MODE_KEY);
  });
});
