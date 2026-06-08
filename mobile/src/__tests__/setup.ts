import { jest, beforeEach } from '@jest/globals';

const secureStoreMap = new Map<string, string>();

jest.mock('expo-camera', () => ({
  useCameraPermissions: jest
    .fn<() => [{ granted: boolean }, jest.Mock]>()
    .mockReturnValue([{ granted: true }, jest.fn()]),
  CameraView: 'CameraView',
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn<(key: string) => Promise<string | null>>((key: string) =>
    Promise.resolve(secureStoreMap.get(key) ?? null),
  ),
  setItemAsync: jest.fn<(key: string, value: string) => Promise<void>>((key: string, value: string) => {
    secureStoreMap.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn<(key: string) => Promise<void>>((key: string) => {
    secureStoreMap.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock('expo-local-authentication', () => ({
  isEnrolledAsync: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  authenticateAsync: jest.fn<() => Promise<{ success: boolean }>>().mockResolvedValue({ success: true }),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest
    .fn<() => Promise<{ status: string }>>()
    .mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest
    .fn<() => Promise<{ data: string }>>()
    .mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationHandler: jest.fn<() => void>(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn<() => {
    auth: {
      getSession: jest.Mock<() => Promise<{ data: { session: null }; error: null }>>;
      signOut: jest.Mock<() => Promise<{ error: null }>>;
    };
    from: jest.Mock;
  }>().mockReturnValue({
    auth: {
      getSession: jest
        .fn<() => Promise<{ data: { session: null }; error: null }>>()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signOut: jest.fn<() => Promise<{ error: null }>>().mockResolvedValue({ error: null }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest
        .fn<() => Promise<{ data: null; error: null }>>()
        .mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

global.fetch = jest.fn() as unknown as typeof fetch;

beforeEach(() => {
  secureStoreMap.clear();
  jest.clearAllMocks();
});
