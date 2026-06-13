import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'letssplyt_device_id';

function generateDeviceId(): string {
  return `ls-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable per-install device id for device_sessions and auth headers. */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = generateDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}
