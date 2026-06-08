import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CreateEventResponse, EventDetailResponse } from '@letssplyt/shared/event.types';
import * as eventService from '../../../services/event.service';
import { useEventStore } from '../../../store/eventStore';

jest.mock('../../../services/event.service');

const mockCreateResponse: CreateEventResponse = {
  id: 'event-1',
  title: 'Friday Dinner',
  status: 'open',
  join_url: 'https://letssplyt.app/join/token-1',
  token_expires_at: '2026-06-09T00:00:00.000Z',
};

const mockDetail: EventDetailResponse = {
  event: {
    id: 'event-1',
    payer_id: 'user-1',
    title: 'Friday Dinner',
    event_date: null,
    total_amount: null,
    currency: 'USD',
    status: 'open',
    split_mode: null,
    ai_stage: 'none',
    locale: 'en-US',
    locked_at: null,
    messages_sent_at: null,
    fully_settled_at: null,
    created_at: '2026-06-08T00:00:00.000Z',
    updated_at: '2026-06-08T00:00:00.000Z',
    payer: { id: 'user-1', display_name: 'Alex', avatar_colour: '#6366F1' },
  },
  participants: [
    {
      id: 'p-1',
      display_name: 'Sam',
      join_method: 'qr_web',
      payment_status: 'pending',
      amount_owed: null,
    },
  ],
  join_token: {
    token: 'token-1',
    join_url: 'https://letssplyt.app/join/token-1',
    expires_at: '2026-06-09T00:00:00.000Z',
    is_active: true,
  },
  summary: null,
};

describe('eventStore', () => {
  beforeEach(() => {
    useEventStore.setState({
      events: [],
      nextCursor: null,
      hasMore: false,
      currentEvent: null,
      isLoadingEvents: false,
      isLoadingDetail: false,
      isCreating: false,
      isLocking: false,
      createModalOpen: false,
      qrPresentation: null,
    });
    jest.clearAllMocks();
  });

  it('createEvent adds to events list', async () => {
    jest.mocked(eventService.createEvent).mockResolvedValue(mockCreateResponse);

    await useEventStore.getState().createEvent('Friday Dinner');

    expect(useEventStore.getState().events).toHaveLength(1);
    expect(useEventStore.getState().events[0]?.title).toBe('Friday Dinner');
    expect(useEventStore.getState().qrPresentation?.joinUrl).toBe(mockCreateResponse.join_url);
  });

  it('loadParticipants populates participants for current event', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue(mockDetail);

    await useEventStore.getState().loadParticipants('event-1');

    expect(eventService.fetchEventById).toHaveBeenCalledWith('event-1');
    expect(useEventStore.getState().currentEvent?.participants).toHaveLength(1);
    expect(useEventStore.getState().currentEvent?.participants[0]?.display_name).toBe('Sam');
  });

  it('lockEvent updates event status', async () => {
    jest.mocked(eventService.lockEvent).mockResolvedValue({
      event_id: 'event-1',
      status: 'locked',
      locked_at: '2026-06-08T12:00:00.000Z',
      participant_count: 2,
    });
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetail,
      event: { ...mockDetail.event, status: 'locked' },
    });
    useEventStore.setState({
      events: [
        {
          id: 'event-1',
          title: 'Friday Dinner',
          status: 'open',
          participant_count: 2,
          total_amount: null,
          created_at: '2026-06-08T00:00:00.000Z',
        },
      ],
    });

    await useEventStore.getState().lockEvent('event-1');

    expect(useEventStore.getState().currentEvent?.event.status).toBe('locked');
    expect(useEventStore.getState().events[0]?.status).toBe('locked');
  });
});
