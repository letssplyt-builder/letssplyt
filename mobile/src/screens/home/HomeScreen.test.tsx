import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import * as eventService from '../../services/event.service';
import { closePostCreateQrAndOpenEventDetail } from '../../navigation/eventNavigation';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useSettlementStore } from '../../store/settlementStore';

jest.mock('../../services/event.service');
jest.mock('../../navigation/eventNavigation', () => ({
  openEventDetail: jest.fn(),
  closePostCreateQrAndOpenEventDetail: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

describe('HomeScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      needsPushPermission: false,
      session: {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-1',
          app_metadata: {},
          user_metadata: { display_name: 'Alex' },
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
      } as never,
      user: { id: 'user-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
      isLoading: false,
    });
    useEventStore.setState({
      events: [],
      nextCursor: null,
      hasMore: false,
      createModalOpen: false,
      qrPresentation: null,
      isCreating: false,
      isLoadingEvents: false,
    });
    useSettlementStore.setState({
      membersOweYou: [
        {
          user_id: 'member-1',
          display_name: 'Jordan',
          avatar_colour: '#4F46E5',
          net_amount: 25,
        },
      ],
      membersYouOwe: [],
      guests: [],
      memberDetail: null,
      guestDetail: null,
      isLoadingCounterparties: false,
      isLoadingDetail: false,
      counterpartyError: false,
      loadCounterparties: jest.fn(async () => {}),
      loadDashboardCounterparties: jest.fn(async () => {}),
      loadMemberDetail: jest.fn(async () => {}),
      loadGuestDetail: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    });
    jest.mocked(eventService.fetchBalance).mockResolvedValue({
      net_balance: 25,
      currency: 'USD',
      owed_to_you: 40,
      you_owe: 15,
      unavailable: false,
    });
    jest.clearAllMocks();
  });

  const navigation = { navigate: jest.fn() } as never;

  it('shows greeting with display name', async () => {
    render(
      <HomeScreen
        navigation={navigation}
        route={{ key: 'Home', name: 'Home' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Hi, Alex')).toBeTruthy();
    });
  });

  it('opens on Collect From when members owe the viewer', async () => {
    render(
      <HomeScreen
        navigation={navigation}
        route={{ key: 'Home', name: 'Home' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan')).toBeTruthy();
    });
  });

  it('shows pay, collect, and guests tabs', async () => {
    render(
      <HomeScreen
        navigation={navigation}
        route={{ key: 'Home', name: 'Home' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Pay to tab')).toBeTruthy();
      expect(screen.getByLabelText('Collect from tab')).toBeTruthy();
      expect(screen.getByLabelText('Guests tab')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Pay to tab'));

    await waitFor(() => {
      expect(screen.getByText("You don't owe any members right now.")).toBeTruthy();
    });
    expect(screen.queryByText('People who owe you')).toBeNull();
  });

  it('switches to pay tab', async () => {
    useSettlementStore.setState({
      membersOweYou: [],
      membersYouOwe: [
        {
          user_id: 'member-2',
          display_name: 'Sam',
          avatar_colour: '#059669',
          net_amount: 12,
        },
      ],
    });

    render(
      <HomeScreen
        navigation={navigation}
        route={{ key: 'Home', name: 'Home' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sam')).toBeTruthy();
      expect(screen.getByText('$12.00')).toBeTruthy();
    });
  });

  it('shows balance card totals', async () => {
    render(
      <HomeScreen
        navigation={navigation}
        route={{ key: 'Home', name: 'Home' } as never}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByLabelText(
          'Net balance $25.00. Owed to you $40.00. You owe $15.00.',
        ),
      ).toBeTruthy();
      expect(screen.getByText('$40.00')).toBeTruthy();
      expect(screen.getByText('$15.00')).toBeTruthy();
    });
  });

  it('opens event detail when post-create QR is closed', async () => {
    const dismissQrPresentation = jest.fn();
    useEventStore.setState({
      qrPresentation: {
        eventId: 'event-new',
        title: 'Friday Dinner',
        joinUrl: 'https://letssplyt.app/join/abc',
        tokenExpiresAt: '2099-01-01T00:00:00.000Z',
      },
      dismissQrPresentation,
    });

    render(
      <HomeScreen
        navigation={navigation}
        route={{ key: 'Home', name: 'Home' } as never}
      />,
    );

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(closePostCreateQrAndOpenEventDetail).toHaveBeenCalledWith(
      navigation,
      'event-new',
      dismissQrPresentation,
    );
  });
});
