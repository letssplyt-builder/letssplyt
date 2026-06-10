import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import * as eventService from '../../services/event.service';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useSettlementStore } from '../../store/settlementStore';

jest.mock('../../services/event.service');

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

  it('shows members toggle and people who owe you list', async () => {
    render(
      <HomeScreen
        navigation={navigation}
        route={{ key: 'Home', name: 'Home' } as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Members')).toBeTruthy();
      expect(screen.getByText('People who owe you')).toBeTruthy();
      expect(screen.getByText('Jordan')).toBeTruthy();
      expect(screen.getByText('$25.00')).toBeTruthy();
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
      expect(screen.getByText('Owed to you')).toBeTruthy();
      expect(screen.getByText('You owe')).toBeTruthy();
      expect(screen.getByText('$40.00')).toBeTruthy();
      expect(screen.getByText('$15.00')).toBeTruthy();
    });
  });
});
