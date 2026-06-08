import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import {
  mockChannel,
  mockChannelOn,
  mockChannelSubscribe,
  mockChannelUnsubscribe,
  mockRemoveChannel,
} from '../../mocks/supabase';
import { EventDetailScreen } from '../../../screens/events/EventDetailScreen';
import * as eventService from '../../../services/event.service';
import { useEventStore } from '../../../store/eventStore';

jest.mock('../../../services/event.service');

const mockDetailOpen = {
  event: {
    id: 'event-1',
    payer_id: 'user-1',
    title: 'Friday Dinner',
    event_date: null,
    total_amount: null,
    currency: 'USD',
    status: 'open' as const,
    split_mode: null,
    ai_stage: 'none' as const,
    locale: 'en-US',
    locked_at: null,
    messages_sent_at: null,
    fully_settled_at: null,
    created_at: '2026-06-08T00:00:00.000Z',
    updated_at: '2026-06-08T00:00:00.000Z',
    payer: { id: 'user-1', display_name: 'Alex', avatar_colour: '#6366F1' },
  },
  participants: [] as Array<{
    id: string;
    display_name: string;
    join_method: string;
    payment_status: string;
    amount_owed: number | null;
  }>,
  join_token: {
    token: 'token-1',
    join_url: 'https://letssplyt.app/join/token-1',
    expires_at: '2099-06-09T00:00:00.000Z',
    is_active: true,
  },
  summary: null,
};

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
} as never;

describe('EventDetailScreen', () => {
  beforeEach(() => {
    useEventStore.setState({
      currentEvent: null,
      isLoadingDetail: false,
      isLocking: false,
    });
    jest.clearAllMocks();
    jest.mocked(eventService.fetchEventById).mockResolvedValue(mockDetailOpen);
  });

  it('renders participant list', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailOpen,
      participants: [
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'pending',
          amount_owed: null,
        },
      ],
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sam')).toBeTruthy();
    });
  });

  it('shows Lock button disabled with 0 participants', async () => {
    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      const lockButton = screen.getByLabelText('Lock group, 0 members');
      expect(lockButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  it('shows Lock button enabled with 1+ participants', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailOpen,
      participants: [
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'manual_name_only',
          payment_status: 'pending',
          amount_owed: null,
        },
      ],
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sam')).toBeTruthy();
    });

    const lockButton = screen.getByLabelText('Lock group, 1 members');
    expect(lockButton.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('subscribes to Realtime on mount', async () => {
    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith('event-members:event-1');
      expect(mockChannelOn).toHaveBeenCalled();
      expect(mockChannelSubscribe).toHaveBeenCalled();
    });
  });

  it('unsubscribes from Realtime on unmount (no memory leaks)', async () => {
    const { unmount } = render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(mockChannelSubscribe).toHaveBeenCalled();
    });

    unmount();

    expect(mockChannelUnsubscribe).toHaveBeenCalled();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});
