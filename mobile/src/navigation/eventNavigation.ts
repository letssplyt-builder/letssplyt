import {
  CommonActions,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import type { EventsStackParamList, MainTabParamList } from './types';

/** Find the bottom-tab navigator (Dashboard / Events). */
export function getTabNavigation(
  navigation: NavigationProp<ParamListBase>,
): NavigationProp<MainTabParamList> | undefined {
  let current: NavigationProp<ParamListBase> | undefined = navigation;

  while (current) {
    const state = current.getState?.();
    if (
      state?.routeNames?.includes('HomeTab') &&
      state?.routeNames?.includes('EventsTab')
    ) {
      return current as NavigationProp<MainTabParamList>;
    }
    current = current.getParent?.() as NavigationProp<ParamListBase> | undefined;
  }

  return undefined;
}

/** Always open event detail on the Events stack (single source of truth for event flows). */
export function openEventDetail(
  navigation: NavigationProp<ParamListBase>,
  eventId: string,
): void {
  const tabNavigation = getTabNavigation(navigation);
  if (tabNavigation) {
    tabNavigation.navigate('EventsTab', { screen: 'EventDetail', params: { eventId } });
    return;
  }

  navigation.navigate('EventDetail', { eventId });
}

/**
 * After message delivery, collapse the Events stack to [Events, EventDetail].
 * Prevents deep stacks (Split Review, Preview, etc.) from accumulating.
 */
export function finishEventFlowToEventDetail(
  navigation: NavigationProp<ParamListBase>,
  eventId: string,
): void {
  navigation.dispatch(
    CommonActions.reset({
      index: 1,
      routes: [
        { name: 'Events' },
        { name: 'EventDetail', params: { eventId } },
      ],
    }),
  );
}
