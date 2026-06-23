import { jest, beforeEach } from '@jest/globals';
import { configure } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

configure({ asyncUtilTimeout: 8000 });

Dimensions.set({
  window: { width: 390, height: 844, scale: 1, fontScale: 1 },
  screen: { width: 390, height: 844, scale: 1, fontScale: 1 },
});

const mockSecureStoreMap = new Map<string, string>();

const defaultContactsData = [
  {
    id: 'c1',
    firstName: 'Jordan',
    lastName: 'Lee',
    phoneNumbers: [{ number: '+1 202 555 0100' }],
  },
  {
    id: 'c2',
    firstName: 'Sam',
    lastName: 'T',
    phoneNumbers: [{ number: '+1 202 555 0200' }],
  },
];

function resetExpoContactsMock(): void {
  const Contacts = jest.requireMock<typeof import('expo-contacts')>('expo-contacts');
  Contacts.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  Contacts.getContactsAsync.mockResolvedValue({ data: defaultContactsData } as never);
}

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: View,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('react-native-document-scanner-plugin', () => ({
  __esModule: true,
  default: {
    scanDocument: jest.fn(() =>
      Promise.resolve({
        scannedImages: ['file://scanned-receipt.jpg'],
        status: 'success',
      }),
    ),
  },
  ScanDocumentResponseStatus: {
    Success: 'success',
    Cancel: 'cancel',
  },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn((uri: string) => Promise.resolve({ uri: `${uri}-compressed` })),
  SaveFormat: { JPEG: 'jpeg' },
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
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  canUseBiometricAuthentication: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-local-authentication', () => ({
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationHandler: jest.fn(),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-device', () => ({
  modelId: 'test-device-id',
  osBuildId: 'test-build-id',
  osName: 'iOS',
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    React.createElement(Text, { accessibilityLabel: `icon-${name}` }, name);
  return {
    Ionicons: MockIcon,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: View,
    Swipeable: ({
      children,
      renderRightActions,
      renderLeftActions,
    }: {
      children: React.ReactNode;
      renderRightActions?: () => React.ReactNode;
      renderLeftActions?: () => React.ReactNode;
    }) =>
      React.createElement(
        View,
        null,
        renderLeftActions ? renderLeftActions() : null,
        children,
        renderRightActions ? renderRightActions() : null,
      ),
  };
});

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

jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ value }: { value: string }) =>
      React.createElement(View, { accessibilityLabel: `QR code ${value}` }),
  };
});

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  presentContactPickerAsync: jest.fn(() => Promise.resolve(null)),
  getContactsAsync: jest.fn(() =>
    Promise.resolve({
      data: [
        {
          id: 'c1',
          firstName: 'Jordan',
          lastName: 'Lee',
          phoneNumbers: [{ number: '+1 202 555 0100' }],
        },
        {
          id: 'c2',
          firstName: 'Sam',
          lastName: 'T',
          phoneNumbers: [{ number: '+1 202 555 0200' }],
        },
      ],
    }),
  ),
  Fields: {
    PhoneNumbers: 'phoneNumbers',
    Name: 'name',
    FirstName: 'firstName',
    LastName: 'lastName',
  },
  SortTypes: {
    FirstName: 'firstName',
  },
}));

global.fetch = jest.fn() as unknown as typeof fetch;

beforeEach(() => {
  mockSecureStoreMap.clear();
  // Do not use jest.clearAllMocks() here — it wipes mock implementations from jest.mock()
  // factories and causes flaky async failures when individual suites forget to re-stub.
  resetExpoContactsMock();
});
