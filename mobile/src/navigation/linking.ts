import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store/authStore';
import { useJoinStore } from '../store/joinStore';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

const APP_DOMAIN = process.env.EXPO_PUBLIC_APP_DOMAIN ?? 'letssplyt.app';

function extractJoinToken(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? '';
    const match = path.match(/^\/?join\/([^/?#]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);

    const hostname = parsed.hostname ?? '';
    if (hostname && path.startsWith('join/')) {
      const segment = path.replace(/^join\//, '').split('/')[0];
      return segment ? decodeURIComponent(segment) : null;
    }
  } catch {
    return null;
  }
  return null;
}

function handleJoinDeepLink(url: string): string | null {
  const token = extractJoinToken(url);
  if (!token) return url;

  useJoinStore.getState().setPendingJoinToken(token);

  const isAuthenticated = Boolean(useAuthStore.getState().session?.access_token);
  if (isAuthenticated && navigationRef.isReady()) {
    navigationRef.navigate('AppJoin', { token });
    return url;
  }

  if (!isAuthenticated && navigationRef.isReady()) {
    navigationRef.navigate('PhoneEntry', { joinToken: token });
    return null;
  }

  return isAuthenticated ? url : null;
}

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    `https://${APP_DOMAIN}`,
    `https://staging.${APP_DOMAIN}`,
    'letssplyt://',
  ],
  config: {
    screens: {
      AppJoin: 'join/:token',
      MainTabs: {
        screens: {
          EventsTab: {
            screens: {
              EventDetail: 'events/:eventId',
            },
          },
        },
      },
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (!url) return null;
    return handleJoinDeepLink(url);
  },
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const handled = handleJoinDeepLink(url);
      if (handled) listener(handled);
    });
    return () => subscription.remove();
  },
};
