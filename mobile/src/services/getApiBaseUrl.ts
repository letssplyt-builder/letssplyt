import Constants from 'expo-constants';

const DEFAULT_PORT = 3000;

/** Base URL only — callers append `/api/v1`. Strips a trailing `/api/v1` if misconfigured. */
export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (trimmed.endsWith('/api/v1')) {
    return trimmed.slice(0, -'/api/v1'.length);
  }
  return trimmed;
}

/**
 * Resolves the backend base URL (no trailing path, no `/api/v1` suffix).
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL — explicit override (staging/production or manual LAN IP)
 * 2. Expo Go debugger host — same machine as Metro, works on physical devices on LAN
 * 3. localhost — iOS Simulator / Android emulator only
 */
export function getApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured && !configured.includes('localhost') && !configured.includes('127.0.0.1')) {
    return normalizeApiBaseUrl(configured);
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

  return configured ? normalizeApiBaseUrl(configured) : `http://localhost:${DEFAULT_PORT}`;
}
