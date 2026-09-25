import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GuestDetailScreen } from '../../../screens/home/GuestDetailScreen';
import * as settlementService from '../../../services/settlement.service';
import { useSettlementStore } from '../../../store/settlementStore';

jest.mock('../../../services/settlement.service', () => ({
  nudgeGuestOutstanding: jest.fn(),
  guestMarkPaidAll: jest.fn(),
}));

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
      loadCounterparties: jest.fn(async () => {}),
      loadEventLedger: jest.fn(async () => {}),
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
    expect(screen.getByLabelText('Mark all paid')).toBeTruthy();
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
    expect(screen.getByLabelText('Mark all paid')).toBeTruthy();
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
    expect(screen.getByLabelText('Mark all paid')).toBeTruthy();
  });

  it('marks every pending event paid after confirm', async () => {
    const loadCounterparties = jest.fn(async () => {});
    const loadEventLedger = jest.fn(async () => {});
    const loadGuestDetail = jest.fn(async () => {});
    jest.mocked(settlementService.guestMarkPaidAll).mockResolvedValue({
      updated_count: 2,
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.find((button) => button.text === 'Mark paid');
      confirm?.onPress?.();
    });

    useSettlementStore.setState({
      guestDetail: {
        display_name: 'Sam Guest',
        amount: 30,
        currency: 'USD',
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
          {
            event_id: 'event-guest-2',
            event_title: 'Dinner',
            participant_id: 'part-guest-2',
            amount: 12,
            direction: 'owed_to_me',
            payment_status: 'pending',
            can_nudge: true,
          },
        ],
        history: [],
      },
      isLoadingDetail: false,
      loadGuestDetail,
      loadCounterparties,
      loadEventLedger,
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

    fireEvent.press(await screen.findByLabelText('Mark all paid'));

    await waitFor(() => {
      expect(settlementService.guestMarkPaidAll).toHaveBeenCalledWith('hash-1', 'cash');
      expect(loadGuestDetail).toHaveBeenCalledWith('hash-1');
      expect(loadCounterparties).toHaveBeenCalledWith('guests');
      expect(loadEventLedger).toHaveBeenCalled();
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Mark all paid?',
      'Mark 2 events paid for Sam Guest? Total $30.00.',
      expect.any(Array),
    );
  });

  it('hides Mark all paid when outstanding rows are only disputed', async () => {
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
            payment_status: 'disputed',
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
    expect(screen.queryByLabelText('Mark all paid')).toBeNull();
  });
});
