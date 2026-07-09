import type { NavigationState, PartialState } from '@react-navigation/native';
import { navigationRef } from '../navigation/navigationRef';

const ROUTE_LABELS: Record<string, string> = {
  HomeTab: 'Dashboard',
  EventsTab: 'Events',
  SettingsTab: 'Settings',
  Home: 'Dashboard',
  Events: 'Events',
  Settings: 'Settings',
  Profile: 'Profile',
  EventDetail: 'Event details',
  ReceiptCapture: 'Receipt scan',
  ReceiptReview: 'Receipt review',
  SplitSetup: 'Split setup',
  SplitPreview: 'Split preview',
  Settlement: 'Settlement',
  AddHandle: 'Payment handles',
};

function formatRouteName(name: string): string {
  return ROUTE_LABELS[name] ?? name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function collectActiveRouteNames(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string[] {
  if (!state?.routes?.length) {
    return [];
  }

  const index = state.index ?? 0;
  const route = state.routes[index];
  if (!route) {
    return [];
  }

  const names = [formatRouteName(route.name)];
  if (route.state) {
    names.push(...collectActiveRouteNames(route.state));
  }
  return names;
}

/** Human-readable screen trail for spark note context (UI preview only). */
export function getSparkFeedbackContextLabel(): string {
  if (!navigationRef.isReady()) {
    return 'LetsSplyt';
  }

  const names = collectActiveRouteNames(navigationRef.getRootState());
  const unique = names.filter((name, index) => index === 0 || name !== names[index - 1]);
  return unique.slice(-2).join(' · ') || 'LetsSplyt';
}
