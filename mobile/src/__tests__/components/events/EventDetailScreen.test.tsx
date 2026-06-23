import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  mockChannel,
  mockChannelOn,
  mockChannelSubscribe,
  mockChannelUnsubscribe,
  mockRemoveChannel,
} from '../../mocks/supabase';
import { EventDetailScreen } from '../../../screens/events/EventDetailScreen';
import { ApiRequestError } from '../../../services/api';
import * as eventService from '../../../services/event.service';
import { useEventStore } from '../../../store/eventStore';
import { useSettlementStore } from '../../../store/settlementStore';

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
    useIsFocused: () => true,
  };
});

jest.mock('../../../services/event.service');
jest.mock('../../../services/settlement.service', () => ({
  confirmPayment: jest.fn(),
  disputePayment: jest.fn(),
  nudgeParticipant: jest.fn(),
  markParticipantPaid: jest.fn(),
  selfReportPayment: jest.fn(),
}));

import * as settlementService from '../../../services/settlement.service';

let mockAuthUser: { id: string; display_name: string; avatar_colour: string } | null = {
  id: 'user-1',
  display_name: 'Alex',
  avatar_colour: '#6366F1',
};

jest.mock('../../../store/authStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mockAuthUser }) => unknown) =>
    selector({ user: mockAuthUser }),
}));

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

const mockDetailLocked = {
  ...mockDetailOpen,
  event: {
    ...mockDetailOpen.event,
    status: 'locked' as const,
    locked_at: '2026-06-08T12:00:00.000Z',
  },
  participants: [
    {
      id: 'p-1',
      display_name: 'Sam',
      join_method: 'qr_web',
      payment_status: 'pending',
      amount_owed: 30,
    },
  ],
  summary: {
    total: 60,
    collected: 0,
    outstanding: 60,
    confirmed_count: 0,
    pending_count: 1,
  },
};

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
} as never;

describe('EventDetailScreen', () => {
  beforeEach(() => {
    mockAuthUser = {
      id: 'user-1',
      display_name: 'Alex',
      avatar_colour: '#6366F1',
    };
    useEventStore.setState({
      currentEvent: null,
      isLoadingDetail: false,
      isLocking: false,
    });
    jest.clearAllMocks();
    jest.mocked(eventService.fetchEventById).mockResolvedValue(mockDetailOpen);
    jest.mocked(eventService.deleteParticipant).mockResolvedValue(undefined);
    jest.mocked(eventService.reopenEvent).mockResolvedValue({
      join_token: 'token-2',
      join_url: 'https://letssplyt.app/join/token-2',
      expires_at: '2099-06-10T00:00:00.000Z',
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const removeButton = buttons?.find((button) => button.text === 'Remove');
      removeButton?.onPress?.();
    });
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

    expect(await screen.findByText('Sam')).toBeTruthy();
  });

  it('shows Lock button disabled with 0 participants', async () => {
    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      const lockButton = screen.getByLabelText('Lock event, 0 members');
      expect(lockButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  it('shows Lock button disabled with 1 participant', async () => {
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

    const lockButton = screen.getByLabelText('Lock event, 1 members');
    expect(lockButton.props.accessibilityState?.disabled).toBe(true);
    expect(
      screen.getByText('Add at least one more member besides you to lock this event.'),
    ).toBeTruthy();
  });

  it('shows Lock button enabled with 2+ participants', async () => {
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
        {
          id: 'p-2',
          display_name: 'Jordan',
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

    const lockButton = screen.getByLabelText('Lock event, 2 members');
    expect(lockButton.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('opens AddMembersSheet from + Add manually and batch-adds members', async () => {
    jest.mocked(eventService.addManualParticipant).mockResolvedValue({
      id: 'p-new',
      display_name: 'Chris',
      join_method: 'manual_name_only',
      payment_status: 'pending',
      amount_owed: null,
    } as never);

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('+ Add manually')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('+ Add manually'));
    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.press(screen.getByText('Done · add 1 member'));

    await waitFor(() => {
      expect(eventService.addManualParticipant).toHaveBeenCalledWith('event-1', {
        display_name: 'Chris',
        join_method: 'manual_name_only',
      });
    });
  });

  it('shows partial batch-add toast when some members fail', async () => {
    jest
      .mocked(eventService.addManualParticipant)
      .mockResolvedValueOnce({
        id: 'p-new',
        display_name: 'Chris',
        join_method: 'manual_name_only',
        payment_status: 'pending',
        amount_owed: null,
      } as never)
      .mockRejectedValueOnce(new ApiRequestError('Already on this event', 409, 'DUPLICATE_PHONE'));

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('+ Add manually')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('+ Add manually'));
    fireEvent.press(screen.getByText('By name'));
    fireEvent.changeText(screen.getByLabelText('Person 1 name'), 'Chris');
    fireEvent.press(screen.getByText('+ Add another person'));
    fireEvent.changeText(screen.getByLabelText('Person 2 name'), 'Sam');
    fireEvent.press(screen.getByText('Done · add 2 members'));

    await waitFor(() => {
      expect(screen.getByText('✓ Added 1 members · 1 could not be added')).toBeTruthy();
    });
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

  it('shows remove control on participant rows when event open', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailOpen,
      participants: [
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'manual_phone',
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
      expect(screen.getByLabelText('Remove Sam')).toBeTruthy();
    });
  });

  it('remove calls deleteParticipant and updates list', async () => {
    jest
      .mocked(eventService.fetchEventById)
      .mockResolvedValueOnce({
        ...mockDetailOpen,
        participants: [
          {
            id: 'p-1',
            display_name: 'Sam',
            join_method: 'manual_phone',
            payment_status: 'pending',
            amount_owed: null,
          },
        ],
      })
      .mockResolvedValue({
        ...mockDetailOpen,
        participants: [],
      });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Remove Sam')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Remove Sam'));

    await waitFor(() => {
      expect(eventService.deleteParticipant).toHaveBeenCalledWith('event-1', 'p-1');
    });

    await waitFor(() => {
      expect(screen.queryByText('Sam')).toBeNull();
    });
  });

  it('hides remove when event locked', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue(mockDetailLocked);

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sam')).toBeTruthy();
    });

    expect(screen.queryByLabelText('Remove Sam')).toBeNull();
  });

  it('shows settlement summary labels in full (three-column card)', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      summary: {
        total: 120,
        collected: 45,
        outstanding: 75,
        confirmed_count: 1,
        pending_count: 2,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Settlement phase')).toBeTruthy();
      expect(screen.getByText('Total bill')).toBeTruthy();
      expect(screen.getByText('Collected')).toBeTruthy();
      expect(screen.getByText('Outstanding')).toBeTruthy();
      expect(screen.getByText('$120.00')).toBeTruthy();
      expect(screen.getByText('$45.00')).toBeTruthy();
      expect(screen.getByText('$75.00')).toBeTruthy();
    });
  });

  it('shows scan and enter total when locked and receipt not scanned', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue(mockDetailLocked);

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Scan receipt for itemised split')).toBeTruthy();
      expect(screen.getByLabelText('Enter total for custom split')).toBeTruthy();
    });
  });

  it('shows split footer CTAs when event status is calculating', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        status: 'calculating',
        ai_stage: 'calculated',
        total_amount: 90,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Edit split')).toBeTruthy();
    });
  });

  it('shows Review items when receipt parsed but not confirmed', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: { ...mockDetailLocked.event, ai_stage: 'parsed' },
      receipt_review: {
        items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax_amount: 0,
        tip_amount: 0,
        fees_amount: 0,
        discount_amount: 0,
        currency: 'USD',
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Review receipt items')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Scan receipt for itemised split')).toBeNull();
    expect(screen.queryByLabelText('Enter total for custom split')).toBeNull();
  });

  it('navigates to manual SplitEntry after Enter total flow without receipt scan', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        ai_stage: 'calculated',
        split_mode: 'equal',
        total_amount: 120,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Edit split')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Edit split'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('SplitEntry', {
        eventId: 'event-1',
        mode: 'manual',
      });
    });
  });

  it('navigates to SplitEntry from Edit share CTA', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: { ...mockDetailLocked.event, ai_stage: 'parsed_confirmed' },
      receipt_review: {
        items: [{ id: 'item-1', name: 'Burger', unit_price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax_amount: 0,
        tip_amount: 0,
        fees_amount: 0,
        discount_amount: 0,
        currency: 'USD',
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Edit split')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Edit split'));

    expect(navigation.navigate).toHaveBeenCalledWith('SplitEntry', {
      eventId: 'event-1',
      mode: 'itemised',
    });
  });

  it('resets expenses and returns to scan or enter total', async () => {
    const calculatedDetail = {
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        ai_stage: 'calculated' as const,
        split_mode: 'equal' as const,
        total_amount: 90,
      },
    };
    const resetDetail = {
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        ai_stage: 'none' as const,
        split_mode: null,
        total_amount: null,
      },
    };
    jest.mocked(eventService.fetchEventById).mockResolvedValue(calculatedDetail);
    jest.mocked(eventService.resetEventExpenses).mockImplementation(async () => {
      jest.mocked(eventService.fetchEventById).mockResolvedValue(resetDetail);
      return {
        reset: true,
        event_id: 'event-1',
        ai_stage: 'none',
      };
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('More options')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('More options'));
    fireEvent.press(screen.getByLabelText('Reset expenses'));

    const resetButton = Alert.alert.mock.calls[0]?.[2]?.find((b) => b.text === 'Reset');
    resetButton?.onPress?.();

    await waitFor(() => {
      expect(eventService.resetEventExpenses).toHaveBeenCalledWith('event-1');
      expect(screen.getByLabelText('Scan receipt for itemised split')).toBeTruthy();
    });
  });

  it('shows Edit share after itemization is confirmed', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: { ...mockDetailLocked.event, ai_stage: 'parsed_confirmed' },
      receipt_review: {
        items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax_amount: 0,
        tip_amount: 0,
        fees_amount: 0,
        discount_amount: 0,
        currency: 'USD',
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Edit split')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Scan receipt for itemised split')).toBeNull();
  });

  it('shows Review items when receipt_review exists but ai_stage is stale none', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: { ...mockDetailLocked.event, ai_stage: 'none' },
      receipt_review: {
        items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax_amount: 0,
        tip_amount: 0,
        fees_amount: 0,
        discount_amount: 0,
        currency: 'USD',
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Review receipt items')).toBeTruthy();
    });
    expect(screen.queryByLabelText('Scan receipt for itemised split')).toBeNull();
  });

  it('navigates to ItemReview from Review items CTA', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: { ...mockDetailLocked.event, ai_stage: 'parsed' },
      receipt_review: {
        items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
        additional_charges: [],
        discounts: [],
        tax_amount: 1,
        tip_amount: 2,
        fees_amount: 0,
        discount_amount: 0,
        currency: 'USD',
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Review receipt items')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Review receipt items'));

    expect(navigation.navigate).toHaveBeenCalledWith(
      'ItemReview',
      expect.objectContaining({
        eventId: 'event-1',
        parseResult: expect.objectContaining({
          items: [{ name: 'Burger', unit_price: 10, quantity: 1 }],
          currency: 'USD',
        }),
      }),
    );
  });

  it('shows Reopen join window when event locked (payer)', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue(mockDetailLocked);

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('More options')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('More options'));

    expect(screen.getByLabelText('Reopen join window')).toBeTruthy();
  });

  it('reopen calls reopenEvent and transitions to joining phase', async () => {
    jest
      .mocked(eventService.fetchEventById)
      .mockResolvedValueOnce(mockDetailLocked)
      .mockResolvedValue({
        ...mockDetailOpen,
        join_token: {
          token: 'token-2',
          join_url: 'https://letssplyt.app/join/token-2',
          expires_at: '2099-06-10T00:00:00.000Z',
          is_active: true,
        },
      });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('More options')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('More options'));
    fireEvent.press(screen.getByLabelText('Reopen join window'));

    const reopenAlert = Alert.alert.mock.calls.find((call) => call[0] === 'Reopen join window?');
    const reopenButton = reopenAlert?.[2]?.find((b) => b.text === 'Reopen');
    reopenButton?.onPress?.();

    await waitFor(() => {
      expect(eventService.reopenEvent).toHaveBeenCalledWith('event-1');
    });

    await waitFor(() => {
      expect(screen.getByLabelText('QR code https://letssplyt.app/join/token-2')).toBeTruthy();
    });
  });

  it('non-payer sees participant view without creator controls', async () => {
    mockAuthUser = {
      id: 'user-2',
      display_name: 'Guest',
      avatar_colour: '#6366F1',
    };

    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailOpen,
      join_token: null,
      participants: [
        {
          id: 'p-self',
          display_name: 'Guest',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: null,
          is_self: true,
        },
        {
          id: 'p-organiser',
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: null,
          is_organiser: true,
        },
      ],
    });

    const { unmount } = render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Your share')).toBeTruthy();
      expect(screen.getByText(/This event is still open/)).toBeTruthy();
      expect(screen.getByText('You')).toBeTruthy();
      expect(screen.getByText('Alex')).toBeTruthy();
    });

    expect(screen.queryByLabelText(/QR code/)).toBeNull();
    expect(screen.queryByText('Copy link')).toBeNull();
    expect(screen.queryByText('+ Add manually')).toBeNull();
    expect(screen.queryByText(/Lock event/)).toBeNull();
    expect(screen.queryByLabelText('Remove Alex')).toBeNull();
    unmount();

    useEventStore.setState({ currentEvent: null });
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      join_token: null,
      summary: null,
      participants: [
        {
          id: 'p-self',
          display_name: 'Guest',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: null,
          is_self: true,
        },
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'pending',
          amount_owed: 0,
          is_organiser: false,
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
      expect(screen.getByText(/Bill locked/)).toBeTruthy();
    });

    expect(screen.queryByText('Settlement phase')).toBeNull();
    expect(screen.queryByText('Reopen join window')).toBeNull();
  });

  it('participant view shows calculated share and split mode', async () => {
    mockAuthUser = {
      id: 'user-2',
      display_name: 'Guest',
      avatar_colour: '#6366F1',
    };

    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailOpen,
      event: {
        ...mockDetailOpen.event,
        status: 'sent',
        ai_stage: 'complete',
        split_mode: 'equal',
        total_amount: 100,
      },
      join_token: null,
      participants: [
        {
          id: 'p-self',
          display_name: 'Guest',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 25,
          is_self: true,
        },
        {
          id: 'p-organiser',
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 25,
          is_organiser: true,
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
      expect(screen.getAllByText('$25.00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Split evenly among all members/)).toBeTruthy();
    });
  });

  it('shows toast when remove fails with CANNOT_REMOVE_ACTIVE_PARTICIPANT', async () => {
    jest.mocked(eventService.deleteParticipant).mockRejectedValue(
      new ApiRequestError('CANNOT_REMOVE_ACTIVE_PARTICIPANT', 'Cannot remove', 400),
    );
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailOpen,
      participants: [
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'manual_phone',
          payment_status: 'confirmed',
          amount_owed: 20,
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
      expect(screen.getByLabelText('Remove Sam')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Remove Sam'));

    await waitFor(() => {
      expect(screen.getByText('Only pending members can be removed.')).toBeTruthy();
    });
  });

  it('settlement phase shows Dispute swipe on paid registered member', async () => {
    jest.mocked(settlementService.disputePayment).mockResolvedValue({
      payment_status: 'disputed',
    });
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        status: 'sent',
        messages_sent_at: '2026-06-08T12:00:00.000Z',
      },
      participants: [
        {
          id: 'p-1',
          user_id: 'user-member-1',
          display_name: 'Sam',
          join_method: 'qr_app',
          payment_status: 'confirmed',
          amount_owed: 30,
          self_reported_method: 'venmo',
        },
      ],
      summary: {
        total: 60,
        collected: 30,
        outstanding: 0,
        confirmed_count: 1,
        pending_count: 0,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Paid by Venmo')).toBeTruthy();
      expect(screen.getByLabelText('Dispute')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Dispute'));

    await waitFor(() => {
      expect(settlementService.disputePayment).toHaveBeenCalledWith('event-1', 'p-1');
    });
  });

  it('shows Dispute for registered user who joined via browser (qr_web)', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        status: 'sent',
        messages_sent_at: '2026-06-08T12:00:00.000Z',
      },
      participants: [
        {
          id: 'p-1',
          user_id: 'user-member-2',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'confirmed',
          amount_owed: 30,
          self_reported_method: 'venmo',
        },
      ],
      summary: {
        total: 60,
        collected: 30,
        outstanding: 0,
        confirmed_count: 1,
        pending_count: 0,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Dispute')).toBeTruthy();
    });
  });

  it('does not show Dispute swipe for guest without user_id', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        status: 'sent',
        messages_sent_at: '2026-06-08T12:00:00.000Z',
      },
      participants: [
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'confirmed',
          amount_owed: 30,
          self_reported_method: 'venmo',
        },
      ],
      summary: {
        total: 60,
        collected: 30,
        outstanding: 0,
        confirmed_count: 1,
        pending_count: 0,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Paid by Venmo')).toBeTruthy();
      expect(screen.queryByLabelText('Dispute')).toBeNull();
    });
  });

  it('hides swipe actions until payment messages are sent', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        status: 'locked',
        ai_stage: 'calculated',
        messages_sent_at: null,
      },
      participants: [
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'pending',
          amount_owed: 30,
        },
      ],
      summary: {
        total: 60,
        collected: 0,
        outstanding: 30,
        confirmed_count: 0,
        pending_count: 1,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Sam')).toBeTruthy();
      expect(screen.queryByLabelText('Paid')).toBeNull();
      expect(screen.queryByLabelText('Dispute')).toBeNull();
    });
  });

  it('settlement roster lists organiser and all members including zero-share rows', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        status: 'sent',
        messages_sent_at: '2026-06-08T12:00:00.000Z',
      },
      participants: [
        {
          id: 'p-organiser',
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 40,
          is_organiser: true,
          is_self: true,
        },
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'pending',
          amount_owed: 30,
          is_organiser: false,
        },
        {
          id: 'p-2',
          display_name: 'Mia',
          join_method: 'manual_name_only',
          payment_status: 'opted_out',
          amount_owed: 0,
          is_organiser: false,
        },
      ],
      summary: {
        total: 100,
        collected: 0,
        outstanding: 30,
        confirmed_count: 0,
        pending_count: 1,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Members · 3')).toBeTruthy();
      expect(screen.getByText('You')).toBeTruthy();
      expect(screen.getByText('Sam')).toBeTruthy();
      expect(screen.getByText('Mia')).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();
      expect(screen.getByLabelText('Paid')).toBeTruthy();
      expect(screen.queryByLabelText('Nudge')).toBeNull();
      expect(screen.queryByLabelText('Mark cash')).toBeNull();
    });
  });

  it('organiser sees Expenses Share status after messages sent', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      event: {
        ...mockDetailLocked.event,
        status: 'sent',
        messages_sent_at: '2026-06-08T12:00:00.000Z',
      },
      participants: [
        {
          id: 'p-1',
          display_name: 'Sam',
          join_method: 'qr_web',
          payment_status: 'pending',
          amount_owed: 30,
        },
      ],
      summary: {
        total: 60,
        collected: 0,
        outstanding: 30,
        confirmed_count: 0,
        pending_count: 1,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Expenses Share')).toBeTruthy();
    });
  });

  it('participant does not see pay actions before payment messages are sent', async () => {
    mockAuthUser = {
      id: 'user-2',
      display_name: 'Guest',
      avatar_colour: '#6366F1',
    };

    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      join_token: null,
      event: {
        ...mockDetailLocked.event,
        status: 'locked',
        ai_stage: 'calculated',
        messages_sent_at: null,
      },
      participants: [
        {
          id: 'p-self',
          display_name: 'Guest',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 30,
          is_self: true,
        },
      ],
      summary: null,
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Your share')).toBeTruthy();
      expect(screen.queryByText('Pay now')).toBeNull();
      expect(screen.queryByText('All paid')).toBeNull();
    });
  });

  it('participant with pending share sees Pay now and All paid actions', async () => {
    mockAuthUser = {
      id: 'user-2',
      display_name: 'Guest',
      avatar_colour: '#6366F1',
    };

    jest.mocked(settlementService.selfReportPayment).mockResolvedValue({
      payment_status: 'self_reported',
    });

    useSettlementStore.setState({
      iOweRows: [
        {
          event_id: 'event-1',
          event_title: 'Friday Dinner',
          payer_display_name: 'Alex',
          amount_minor_units: 30,
          currency: 'USD',
          payment_status: 'pending',
          creator_payment_handles: [{ provider: 'venmo', handle_display: '@alex' }],
        },
      ],
      loadEventLedger: jest.fn(async () => {}),
    } as never);

    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      join_token: null,
      event: {
        ...mockDetailLocked.event,
        status: 'sent',
        messages_sent_at: '2026-06-08T12:00:00.000Z',
      },
      participants: [
        {
          id: 'p-self',
          display_name: 'Guest',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 30,
          is_self: true,
        },
        {
          id: 'p-organiser',
          display_name: 'Alex',
          join_method: 'qr_app',
          payment_status: 'pending',
          amount_owed: 0,
          is_organiser: true,
        },
      ],
      summary: {
        total: 60,
        collected: 0,
        outstanding: 30,
        confirmed_count: 0,
        pending_count: 1,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Pay now')).toBeTruthy();
      expect(screen.getByText('All paid')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('All paid'));

    await waitFor(() => {
      expect(screen.getByText('Which payment method did you use?')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('OK'));

    await waitFor(() => {
      expect(settlementService.selfReportPayment).toHaveBeenCalledWith(
        'event-1',
        'p-self',
        'venmo',
      );
    });
  });

  it('participant who has paid sees Settled status and Paid share label', async () => {
    mockAuthUser = {
      id: 'user-2',
      display_name: 'Guest',
      avatar_colour: '#6366F1',
    };

    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...mockDetailLocked,
      join_token: null,
      event: {
        ...mockDetailLocked.event,
        status: 'sent',
        messages_sent_at: '2026-06-08T12:00:00.000Z',
      },
      participants: [
        {
          id: 'p-self',
          display_name: 'Guest',
          join_method: 'qr_app',
          payment_status: 'confirmed',
          amount_owed: 30,
          is_self: true,
        },
      ],
      summary: {
        total: 60,
        collected: 30,
        outstanding: 0,
        confirmed_count: 1,
        pending_count: 0,
      },
    });

    render(
      <EventDetailScreen
        navigation={navigation}
        route={{ key: 'detail', name: 'EventDetail', params: { eventId: 'event-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Settled')).toBeTruthy();
      expect(screen.getByText('Paid')).toBeTruthy();
      expect(screen.queryByText('Payment request')).toBeNull();
      expect(screen.queryByText('Pay now')).toBeNull();
    });
  });
});
