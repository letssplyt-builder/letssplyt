/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'LetsSplyt',
  slug: 'letssplyt',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'letssplyt',
  userInterfaceStyle: 'automatic',
  plugins: [
    [
      'react-native-document-scanner-plugin',
      {
        cameraPermission: 'LetsSplyt needs camera access to scan your receipt.',
      },
    ],
    [
      'expo-contacts',
      {
        contactsPermission:
          'LetsSplyt uses your contacts to add members to your group.',
      },
    ],
    'expo-local-authentication',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#4F46E5',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { useFrameworks: 'static' },
        android: {
          // Respect system navigation bar insets on gesture + 3-button nav devices.
          enableEdgeToEdge: true,
          softwareKeyboardLayoutMode: 'resize',
        },
      },
    ],
  ],
  ios: {
    bundleIdentifier: 'com.letssplyt.app',
    supportsTablet: false,
    associatedDomains: ['applinks:letssplyt.app', 'applinks:staging.letssplyt.app'],
    infoPlist: {
      NSContactsUsageDescription:
        'LetsSplyt uses your contacts to add members to your group.',
    },
  },
  android: {
    package: 'com.letssplyt.app',
    permissions: ['READ_CONTACTS', 'CAMERA'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'letssplyt.app', pathPrefix: '/join/' },
          { scheme: 'https', host: 'staging.letssplyt.app', pathPrefix: '/join/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  extra: {
    eas: {
      projectId: '86a779d7-3bdf-4af9-ab0a-0e597e113aaa',
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      '',
  },
};
