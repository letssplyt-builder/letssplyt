import Constants from 'expo-constants';

const DEFAULT_PORT = 3000;

/**
 * Resolves the backend base URL (no trailing path).
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL — explicit override (staging/production or manual LAN IP)
 * 2. Expo Go debugger host — same machine as Metro, works on physical devices on LAN
 * 3. localhost — iOS Simulator / Android emulator only
 */
export function getApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return configured.replace(/\/$/, '');
  }

  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${DEFAULT_PORT}`;
    }
  }

  return configured?.replace(/\/$/, '') ?? `http://localhost:${DEFAULT_PORT}`;
}
