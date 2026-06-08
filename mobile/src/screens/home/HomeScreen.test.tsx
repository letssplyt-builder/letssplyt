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
      net_balance: 0,
      currency: 'USD',
      unavailable: true,
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

  it('shows balance unavailable when balance endpoint is missing', async () => {
    render(<HomeScreen navigation={navigation} route={{ key: 'HomeTab', name: 'HomeTab' } as never} />);

    await waitFor(() => {
      expect(screen.getByText('Balance unavailable')).toBeTruthy();
    });
  });
});
