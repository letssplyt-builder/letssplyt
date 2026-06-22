const APP_ENV = process.env.APP_ENV ?? process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

const envProfiles = {
  development: {
    name: 'LetsSplyt Dev',
    bundleIdentifier: 'com.letssplyt.dev',
    androidPackage: 'com.letssplyt.dev',
    adaptiveIconBackground: '#4F46E5',
  },
  staging: {
    name: 'LetsSplyt Staging',
    bundleIdentifier: 'com.letssplyt.staging',
    androidPackage: 'com.letssplyt.staging',
    adaptiveIconBackground: '#059669',
  },
  production: {
    name: 'LetsSplyt',
    bundleIdentifier: 'com.letssplyt.app',
    androidPackage: 'com.letssplyt.app',
    adaptiveIconBackground: '#111827',
  },
};

const profile = envProfiles[APP_ENV] ?? envProfiles.development;

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: profile.name,
  slug: 'letssplyt',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'letssplyt',
  userInterfaceStyle: 'automatic',
  plugins: [
    'expo-dev-client',
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
          'LetsSplyt uses your contacts to add members to your event.',
      },
    ],
    'expo-local-authentication',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: profile.adaptiveIconBackground,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { useFrameworks: 'static' },
        android: {
          enableEdgeToEdge: true,
          softwareKeyboardLayoutMode: 'resize',
        },
      },
    ],
  ],
  ios: {
    bundleIdentifier: profile.bundleIdentifier,
    buildNumber: '1',
    supportsTablet: false,
    associatedDomains: ['applinks:letssplyt.app', 'applinks:staging.letssplyt.app'],
    infoPlist: {
      NSContactsUsageDescription:
        'LetsSplyt uses your contacts to add members to your event.',
      NSFaceIDUsageDescription:
        'LetsSplyt uses Face ID to unlock your account and sign you in faster.',
    },
  },
  android: {
    package: profile.androidPackage,
    adaptiveIcon: {
      backgroundColor: profile.adaptiveIconBackground,
    },
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
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? 'development',
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      '',
  },
};
