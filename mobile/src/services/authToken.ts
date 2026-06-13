import * as SecureStore from 'expo-secure-store';
import { AUTH_TOKEN_KEY } from './secureTokenStorage';
import { useAuthStore } from '../store/authStore';

/** Active JWT for API calls — memory session first (biometric mode drops disk access token). */
export async function resolveAccessToken(): Promise<string | null> {
  const { session, isUnlocked } = useAuthStore.getState();
  if (isUnlocked && session?.access_token) {
    return session.access_token;
  }
  return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}
