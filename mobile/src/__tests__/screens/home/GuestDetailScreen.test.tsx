import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GuestDetailScreen } from '../../../screens/home/GuestDetailScreen';
import { useSettlementStore } from '../../../store/settlementStore';

const mockTabNavigate = jest.fn();

function createHomeNavigationMock() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    getState: () => ({
      routeNames: ['Home', 'GuestDetail'],
      index: 1,
      routes: [],
      key: 'home-stack',
    }),
    getParent: () => ({
      getState: () => ({
        routeNames: ['HomeTab', 'EventsTab'],
        index: 0,
        routes: [],
        key: 'main-tabs',
      }),
      navigate: mockTabNavigate,
    }),
  };
}

describe('GuestDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettlementStore.setState({
      guestDetail: {
        display_name: 'Sam Guest',
        amount: 18,
        outstanding: [
          {
            event_id: 'event-guest-1',
            event_title: 'Lunch',
            participant_id: 'part-guest-1',
            amount: 18,
            direction: 'owed_to_me',
            payment_status: 'pending',
            can_nudge: true,
          },
        ],
        history: [],
      },
      isLoadingDetail: false,
      loadGuestDetail: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    } as never);
  });

  it('opens event on the Events stack (single EventDetail instance)', async () => {
    render(
      <GuestDetailScreen
        navigation={createHomeNavigationMock() as never}
        route={{
          key: 'GuestDetail-1',
          name: 'GuestDetail',
          params: { phoneHash: 'hash-1' },
        }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Lunch')).toBeTruthy());
    fireEvent.press(screen.getByText('Lunch'));

    expect(mockTabNavigate).toHaveBeenCalledWith('EventsTab', {
      screen: 'EventDetail',
      params: { eventId: 'event-guest-1' },
    });
  });

  it('shows Nudge for guests with a phone number', async () => {
    render(
      <GuestDetailScreen
        navigation={createHomeNavigationMock() as never}
        route={{
          key: 'GuestDetail-1',
          name: 'GuestDetail',
          params: { phoneHash: 'hash-1' },
        }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Nudge')).toBeTruthy());
    expect(screen.getByText('Nudge')).toBeTruthy();
  });

  it('hides Nudge for guests without a phone number', async () => {
    useSettlementStore.setState({
      guestDetail: {
        display_name: 'Name Only',
        amount: 18,
        outstanding: [
          {
            event_id: 'event-guest-1',
            event_title: 'Lunch',
            participant_id: 'part-guest-1',
            amount: 18,
            direction: 'owed_to_me',
            payment_status: 'pending',
            can_nudge: false,
          },
        ],
        history: [],
      },
      isLoadingDetail: false,
      loadGuestDetail: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    } as never);

    render(
      <GuestDetailScreen
        navigation={createHomeNavigationMock() as never}
        route={{
          key: 'GuestDetail-1',
          name: 'GuestDetail',
          params: { phoneHash: 'hash-1' },
        }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Lunch')).toBeTruthy());
    expect(screen.queryByLabelText('Nudge')).toBeNull();
    expect(screen.queryByLabelText('Nudge cooldown')).toBeNull();
  });

  it('disables Nudge during the 48-hour cooldown', async () => {
    useSettlementStore.setState({
      guestDetail: {
        display_name: 'Sam Guest',
        amount: 18,
        outstanding: [
          {
            event_id: 'event-guest-1',
            event_title: 'Lunch',
            participant_id: 'part-guest-1',
            amount: 18,
            direction: 'owed_to_me',
            payment_status: 'pending',
            can_nudge: false,
            last_nudged_at: '2026-08-21T12:00:00.000Z',
          },
        ],
        history: [],
      },
      isLoadingDetail: false,
      loadGuestDetail: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    } as never);

    render(
      <GuestDetailScreen
        navigation={createHomeNavigationMock() as never}
        route={{
          key: 'GuestDetail-1',
          name: 'GuestDetail',
          params: { phoneHash: 'hash-1' },
        }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Nudge cooldown')).toBeTruthy());
    expect(screen.queryByLabelText('Nudge')).toBeNull();
  });
});
