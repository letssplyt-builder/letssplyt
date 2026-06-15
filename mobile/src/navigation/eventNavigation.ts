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

  const state = navigation.getState?.();
  if (state?.routeNames?.includes('EventDetail')) {
    navigation.navigate('EventDetail', { eventId });
    return;
  }

  console.warn('openEventDetail: could not resolve Events stack navigator');
}

/**
 * Leave the inbox without leaving a deep stack, then open the event on EventsTab.
 */
export function navigateFromNotification(
  navigation: NavigationProp<ParamListBase>,
  eventId: string,
): void {
  const state = navigation.getState?.();
  const routeNames = state?.routeNames ?? [];

  if (routeNames.includes('Events') && routeNames.includes('EventDetail')) {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Events' },
          { name: 'EventDetail', params: { eventId } },
        ],
      }),
    );
    return;
  }

  if (routeNames.includes('Home')) {
    if ((state?.index ?? 0) > 0) {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        }),
      );
    }

    const tabNavigation = getTabNavigation(navigation);
    if (tabNavigation) {
      tabNavigation.navigate('EventsTab', { screen: 'EventDetail', params: { eventId } });
      return;
    }
  }

  openEventDetail(navigation, eventId);
}

/** Switch to the Dashboard tab (Home stack root). */
export function navigateToHomeTab(navigation: NavigationProp<ParamListBase>): void {
  const tabNavigation = getTabNavigation(navigation);
  if (tabNavigation) {
    tabNavigation.navigate('HomeTab', { screen: 'Home' });
    return;
  }

  console.warn('navigateToHomeTab: tab navigator not found');
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
