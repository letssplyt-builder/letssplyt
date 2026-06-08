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
      },
    ],
  ],
  ios: {
    bundleIdentifier: 'com.letssplyt.app',
    supportsTablet: false,
  },
  android: {
    package: 'com.letssplyt.app',
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
