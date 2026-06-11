import { describe, expect, it, jest } from '@jest/globals';
import { navigateInEventFlow } from '../../../navigation/eventFlowNavigation';

describe('navigateInEventFlow', () => {
  it('navigates directly when the screen exists on the current stack', () => {
    const navigation = {
      getState: () => ({
        routeNames: ['Events', 'EventDetail', 'ReceiptScan'],
        index: 1,
        routes: [],
        key: 'events-stack',
      }),
      getParent: jest.fn(),
      navigate: jest.fn(),
    };

    navigateInEventFlow(navigation as never, 'ReceiptScan', { eventId: 'event-1' });

    expect(navigation.navigate).toHaveBeenCalledWith('ReceiptScan', { eventId: 'event-1' });
    expect(navigation.getParent).not.toHaveBeenCalled();
  });

  it('delegates to EventsTab when opened from the Home stack', () => {
    const tabNavigate = jest.fn();
    const navigation = {
      getState: () => ({
        routeNames: ['Home', 'MemberDetail', 'EventDetail'],
        index: 2,
        routes: [],
        key: 'home-stack',
      }),
      getParent: jest.fn(() => ({ navigate: tabNavigate })),
      navigate: jest.fn(),
    };

    navigateInEventFlow(navigation as never, 'SplitEntry', {
      eventId: 'event-1',
      mode: 'manual',
    });

    expect(tabNavigate).toHaveBeenCalledWith('EventsTab', {
      screen: 'SplitEntry',
      params: { eventId: 'event-1', mode: 'manual' },
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
