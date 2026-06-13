import type { NavigationProp, ParamListBase } from '@react-navigation/native';
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
    tabNavigation.navigate('EventsTab', { screen, params });
    return;
  }

  navigation.navigate(screen as string, params as object);
}
