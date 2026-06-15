import { CommonActions } from '@react-navigation/native';
import {
  navigateFromNotification,
  navigateToHomeTab,
  openEventDetail,
} from '../../../navigation/eventNavigation';

function createMockNavigation(routeNames: string[], index = 0, parent?: unknown) {
  const dispatch = jest.fn();
  const navigate = jest.fn();
  const getState = jest.fn(() => ({
    routeNames,
    index,
    routes: routeNames.map((name, routeIndex) => ({
      name,
      key: `${name}-${routeIndex}`,
    })),
  }));

  const navigation = {
    dispatch,
    navigate,
    getState,
    getParent: jest.fn(() => parent),
  };

  return { navigation, dispatch, navigate };
}

describe('eventNavigation', () => {
  it('openEventDetail switches to EventsTab when tab navigator is available', () => {
    const tabNavigate = jest.fn();
    const tabNavigation = {
      navigate: tabNavigate,
      getState: jest.fn(() => ({
        routeNames: ['HomeTab', 'EventsTab', 'ProfileTab'],
        index: 0,
      })),
      getParent: jest.fn(),
    };
    const { navigation } = createMockNavigation(['Home', 'Notifications'], 1, tabNavigation);

    openEventDetail(navigation as never, 'event-1');

    expect(tabNavigate).toHaveBeenCalledWith('EventsTab', {
      screen: 'EventDetail',
      params: { eventId: 'event-1' },
    });
  });

  it('navigateFromNotification resets Home stack and opens EventsTab event detail', () => {
    const tabNavigate = jest.fn();
    const tabNavigation = {
      navigate: tabNavigate,
      getState: jest.fn(() => ({
        routeNames: ['HomeTab', 'EventsTab', 'ProfileTab'],
        index: 0,
      })),
      getParent: jest.fn(),
    };
    const { navigation, dispatch } = createMockNavigation(['Home', 'Notifications'], 1, tabNavigation);

    navigateFromNotification(navigation as never, 'event-42');

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      }),
    );
    expect(tabNavigate).toHaveBeenCalledWith('EventsTab', {
      screen: 'EventDetail',
      params: { eventId: 'event-42' },
    });
  });

  it('navigateFromNotification resets Events stack when opened from Events notifications', () => {
    const { navigation, dispatch } = createMockNavigation(
      ['Events', 'Notifications', 'EventDetail'],
      1,
    );

    navigateFromNotification(navigation as never, 'event-99');

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Events' },
          { name: 'EventDetail', params: { eventId: 'event-99' } },
        ],
      }),
    );
  });

  it('navigateToHomeTab uses tab navigator', () => {
    const tabNavigate = jest.fn();
    const tabNavigation = {
      navigate: tabNavigate,
      getState: jest.fn(() => ({
        routeNames: ['HomeTab', 'EventsTab', 'ProfileTab'],
        index: 2,
      })),
      getParent: jest.fn(),
    };
    const { navigation } = createMockNavigation(['Profile', 'AddHandle'], 0, tabNavigation);

    navigateToHomeTab(navigation as never);

    expect(tabNavigate).toHaveBeenCalledWith('HomeTab', { screen: 'Home' });
  });
});
