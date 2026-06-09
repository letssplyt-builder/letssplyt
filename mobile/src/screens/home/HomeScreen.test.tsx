import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';
import * as eventService from '../../services/event.service';
import { useAuthStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';

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
    jest.mocked(eventService.fetchEvents).mockResolvedValue({
      events: [],
      next_cursor: null,
      has_more: false,
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
    render(<HomeScreen navigation={navigation} route={{ key: 'HomeTab', name: 'HomeTab' } as never} />);

    await waitFor(() => {
      expect(screen.getByText('Hi, Alex')).toBeTruthy();
    });
  });

  it('shows owed to you and you owe in balance card', async () => {
    render(<HomeScreen navigation={navigation} route={{ key: 'HomeTab', name: 'HomeTab' } as never} />);

    await waitFor(() => {
      expect(screen.getByText('Owed to you')).toBeTruthy();
      expect(screen.getByText('You owe')).toBeTruthy();
      expect(screen.getByText('$40.00')).toBeTruthy();
      expect(screen.getByText('$15.00')).toBeTruthy();
    });
  });

  it('shows created and joined event sections', async () => {
    useEventStore.setState({
      events: [
        {
          id: 'e-created',
          title: 'Friday Dinner',
          status: 'open',
          participant_count: 2,
          total_amount: null,
          created_at: '2026-06-08T00:00:00.000Z',
          role: 'creator',
          creator_name: null,
        },
        {
          id: 'e-joined',
          title: 'Team Lunch',
          status: 'sent',
          participant_count: 4,
          total_amount: 120,
          created_at: '2026-06-07T00:00:00.000Z',
          role: 'participant',
          creator_name: 'Jordan',
        },
      ],
    });

    render(<HomeScreen navigation={navigation} route={{ key: 'HomeTab', name: 'HomeTab' } as never} />);

    await waitFor(() => {
      expect(screen.getByText('Events you created')).toBeTruthy();
      expect(screen.getByText('Events you joined')).toBeTruthy();
      expect(screen.getByText('Friday Dinner')).toBeTruthy();
      expect(screen.getByText('Team Lunch')).toBeTruthy();
    });
  });
});
