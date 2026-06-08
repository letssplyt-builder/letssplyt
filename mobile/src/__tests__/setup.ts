import { jest, beforeEach } from '@jest/globals';

const mockSecureStoreMap = new Map<string, string>();

jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn().mockReturnValue([{ granted: true }, jest.fn()]),
  CameraView: 'CameraView',
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockSecureStoreMap.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, value: string) => {
    mockSecureStoreMap.set(k, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((k: string) => {
    mockSecureStoreMap.delete(k);
    return Promise.resolve();
  }),
}));

jest.mock('expo-local-authentication', () => ({
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-device', () => ({
  modelId: 'test-device-id',
  osBuildId: 'test-build-id',
  osName: 'iOS',
}));

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement(FlatList, props),
    ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../lib/supabase', () => {
  const { supabaseMock } = require('./mocks/supabase');
  return {
    getSupabase: () => supabaseMock,
    isSupabaseConfigured: () => true,
  };
});

global.fetch = jest.fn() as unknown as typeof fetch;

beforeEach(() => {
  mockSecureStoreMap.clear();
  jest.clearAllMocks();
});
