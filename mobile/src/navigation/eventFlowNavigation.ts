import type { NavigationProp, NavigatorScreenParams, ParamListBase } from '@react-navigation/native';
import type { EventsStackParamList } from './types';
import { getTabNavigation } from './eventNavigation';

type EventsFlowScreen = Exclude<keyof EventsStackParamList, 'Events'>;

/**
 * Navigate to receipt/split/message screens on the Events stack.
 * If the caller is on Home tab, switches to EventsTab first.
 */
export function navigateInEventFlow(
  navigation: NavigationProp<ParamListBase>,
  screen: EventsFlowScreen,
  params: EventsStackParamList[EventsFlowScreen],
): void {
  const state = navigation.getState?.();
  if (state?.routeNames?.includes(screen)) {
    navigation.navigate(screen as string, params as object);
    return;
  }

  const tabNavigation = getTabNavigation(navigation);
  if (tabNavigation) {
    tabNavigation.navigate('EventsTab', {
      screen,
      params,
    } as NavigatorScreenParams<EventsStackParamList>);
    return;
  }

  navigation.navigate(screen as string, params as object);
}

type StackNavigationLike = NavigationProp<ParamListBase> & {
  replace?: (name: string, params?: object) => void;
};

/** Replace the current Events-stack screen (e.g. after send from Split Review). */
export function replaceInEventFlow(
  navigation: NavigationProp<ParamListBase>,
  screen: EventsFlowScreen,
  params: EventsStackParamList[EventsFlowScreen],
): void {
  const state = navigation.getState?.();
  if (state?.routeNames?.includes(screen)) {
    const stackNavigation = navigation as StackNavigationLike;
    if (stackNavigation.replace) {
      stackNavigation.replace(screen as string, params as object);
      return;
    }
  }

  navigateInEventFlow(navigation, screen, params);
}
