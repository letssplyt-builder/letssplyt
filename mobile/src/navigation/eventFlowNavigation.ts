import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { EventsStackParamList, MainTabParamList } from './types';

type EventsFlowScreen = Exclude<keyof EventsStackParamList, 'Events'>;

/**
 * Navigate to receipt/split/message screens from EventDetail whether it lives
 * on the Events stack or the Home stack (dashboard member/guest flow).
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

  const tabNavigation = navigation.getParent?.() as NavigationProp<MainTabParamList> | undefined;
  if (tabNavigation) {
    tabNavigation.navigate('EventsTab', { screen, params });
    return;
  }

  // Events stack (and test mocks without parent navigator).
  navigation.navigate(screen as string, params as object);
}
