/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'LetsSplyt',
  slug: 'letssplyt',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'letssplyt',
  userInterfaceStyle: 'automatic',
  plugins: [
    'expo-camera',
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
    permissions: ['READ_CONTACTS'],
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
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      '',
  },
};
