import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DeliveryTrackingScreen } from '../../../screens/messages/DeliveryTrackingScreen';
import * as eventService from '../../../services/event.service';
import * as messagesService from '../../../services/messages.service';
import {
  mockChannel,
  mockChannelOn,
  mockChannelSubscribe,
  mockChannelUnsubscribe,
  mockRemoveChannel,
} from '../../mocks/supabase';

const mockDispatch = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native') as typeof import('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      dispatch: mockDispatch,
    }),
  };
});

jest.mock('../../../services/event.service');
jest.mock('../../../services/messages.service');

describe('DeliveryTrackingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      event: {
        id: 'event-1',
        payer_id: 'payer-1',
        title: 'Dinner',
        event_date: null,
        total_amount: 50,
        currency: 'USD',
        status: 'sent',
        split_mode: 'equal',
        ai_stage: 'complete',
        locale: 'en-US',
        locked_at: '2026-01-01T00:00:00.000Z',
        messages_sent_at: '2026-01-01T00:00:00.000Z',
        fully_settled_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        payer: { id: 'payer-1', display_name: 'Alex', avatar_colour: '#000' },
      },
      participants: [
        {
          id: 'payer-1',
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 0,
          is_organiser: true,
        },
        {
          id: 'p1',
          display_name: 'Jordan',
          join_method: 'manual',
          payment_status: 'pending',
          amount_owed: 25,
          message_sent_at: '2026-01-01T00:00:00.000Z',
          message_delivered_at: null,
          message_failed: false,
        },
        {
          id: 'p2',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'pending',
          amount_owed: 25,
          message_failed: true,
        },
      ],
      join_token: null,
      summary: null,
    });
  });

  it('subscribes to participant realtime updates and unsubscribes on unmount', async () => {
    const { unmount } = render(
      <DeliveryTrackingScreen
        navigation={{ dispatch: mockDispatch } as never}
        route={{
          key: 'DeliveryTracking-1',
          name: 'DeliveryTracking',
          params: { eventId: 'event-1', sendResults: [] },
        }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Jordan — message sent')).toBeTruthy());

    expect(mockChannel).toHaveBeenCalledWith('message-delivery:event-1');
    expect(mockChannelOn).toHaveBeenCalled();
    expect(mockChannelSubscribe).toHaveBeenCalled();

    unmount();
    expect(mockChannelUnsubscribe).toHaveBeenCalled();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });

  it('enables Done when all rows are terminal', async () => {
    render(
      <DeliveryTrackingScreen
        navigation={{ dispatch: mockDispatch } as never}
        route={{
          key: 'DeliveryTracking-1',
          name: 'DeliveryTracking',
          params: {
            eventId: 'event-1',
            sendResults: [{ participant_id: 'p2', status: 'failed' }],
          },
        }}
      />,
    );

    await waitFor(() => {
      const done = screen.getByLabelText('Done');
      expect(done.props.accessibilityState?.disabled ?? done.props.disabled).toBeFalsy();
    });

    fireEvent.press(screen.getByLabelText('Done'));
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  it('shows Retry for failed participants and calls retry API', async () => {
    jest.mocked(messagesService.retryParticipantMessage).mockResolvedValue({
      sent_count: 1,
      skipped_count: 0,
      failed_count: 0,
      event_status: 'sent',
      results: [{ participant_id: 'p2', status: 'sent', twilio_sid: 'SM123' }],
    });

    render(
      <DeliveryTrackingScreen
        navigation={{ dispatch: mockDispatch } as never}
        route={{
          key: 'DeliveryTracking-1',
          name: 'DeliveryTracking',
          params: {
            eventId: 'event-1',
            sendResults: [{ participant_id: 'p2', status: 'failed' }],
          },
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Retry message for Sam')).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText('Retry message for Sam'));

    await waitFor(() => {
      expect(messagesService.retryParticipantMessage).toHaveBeenCalledWith('event-1', 'p2');
    });
  });

  it('excludes manual_name_only members so they never appear as Queued', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      event: {
        id: 'event-1',
        payer_id: 'payer-1',
        title: 'Dinner',
        event_date: null,
        total_amount: 50,
        currency: 'USD',
        status: 'sent',
        split_mode: 'equal',
        ai_stage: 'complete',
        locale: 'en-US',
        locked_at: '2026-01-01T00:00:00.000Z',
        messages_sent_at: '2026-01-01T00:00:00.000Z',
        fully_settled_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        payer: { id: 'payer-1', display_name: 'Alex', avatar_colour: '#000' },
      },
      participants: [
        {
          id: 'payer-1',
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 0,
          is_organiser: true,
        },
        {
          id: 'cash-only',
          display_name: 'Raj',
          join_method: 'manual_name_only',
          payment_status: 'pending',
          amount_owed: 25,
        },
        {
          id: 'p1',
          display_name: 'Jordan',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 25,
          message_sent_at: '2026-01-01T00:00:00.000Z',
          message_delivered_at: null,
          message_failed: false,
        },
      ],
      join_token: null,
      summary: null,
    });

    render(
      <DeliveryTrackingScreen
        navigation={{ dispatch: mockDispatch } as never}
        route={{
          key: 'DeliveryTracking-1',
          name: 'DeliveryTracking',
          params: { eventId: 'event-1', sendResults: [] },
        }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Jordan — message sent')).toBeTruthy());

    expect(screen.queryByText('Raj')).toBeNull();
    expect(screen.queryByText('Queued')).toBeNull();
    expect(screen.queryByLabelText(/Raj/)).toBeNull();
  });

  it('enables Done when only name-only members are excluded from tracking', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      event: {
        id: 'event-1',
        payer_id: 'payer-1',
        title: 'Dinner',
        event_date: null,
        total_amount: 25,
        currency: 'USD',
        status: 'sent',
        split_mode: 'equal',
        ai_stage: 'complete',
        locale: 'en-US',
        locked_at: '2026-01-01T00:00:00.000Z',
        messages_sent_at: '2026-01-01T00:00:00.000Z',
        fully_settled_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        payer: { id: 'payer-1', display_name: 'Alex', avatar_colour: '#000' },
      },
      participants: [
        {
          id: 'payer-1',
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 0,
          is_organiser: true,
        },
        {
          id: 'cash-only',
          display_name: 'Raj',
          join_method: 'manual_name_only',
          payment_status: 'pending',
          amount_owed: 25,
        },
      ],
      join_token: null,
      summary: null,
    });

    render(
      <DeliveryTrackingScreen
        navigation={{ dispatch: mockDispatch } as never}
        route={{
          key: 'DeliveryTracking-1',
          name: 'DeliveryTracking',
          params: { eventId: 'event-1', sendResults: [] },
        }}
      />,
    );

    await waitFor(() => {
      const done = screen.getByLabelText('Done');
      expect(done.props.accessibilityState?.disabled ?? done.props.disabled).toBeFalsy();
    });
  });
});
