import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SplitReviewScreen } from '../../../screens/splits/SplitReviewScreen';
import { useEventStore } from '../../../store/eventStore';
import { useSplitStore } from '../../../store/splitStore';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
}));

jest.mock('../../../services/messages.service', () => ({
  confirmEventSplit: jest.fn(),
  fetchMessagePreviews: jest.fn(),
  sendEventMessages: jest.fn(),
  resendRevisionMessages: jest.fn(),
}));

jest.mock('../../../utils/messageFlow', () => ({
  continueMessagingAfterSplitConfirm: jest.fn(),
  eventHasSmsRecipients: jest.fn(),
}));

import { continueMessagingAfterSplitConfirm, eventHasSmsRecipients } from '../../../utils/messageFlow';

describe('SplitReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(eventHasSmsRecipients).mockReturnValue(true);
    useEventStore.setState({
      currentEvent: {
        event: {
          id: 'event-1',
          payer_id: 'payer-1',
          title: 'Friday Dinner',
          event_date: null,
          total_amount: 30,
          currency: 'USD',
          status: 'locked',
          split_mode: 'equal',
          ai_stage: 'calculated',
          locale: 'en-US',
          locked_at: '2026-01-01T00:00:00.000Z',
          messages_sent_at: null,
          fully_settled_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        participants: [
          {
            id: 'p1',
            display_name: 'Alex',
            join_method: 'qr_app',
            payment_status: 'pending',
            amount_owed: 15,
            is_organiser: true,
          },
          {
            id: 'p2',
            display_name: 'Jordan',
            join_method: 'qr_web',
            payment_status: 'pending',
            amount_owed: 15,
          },
        ],
        join_token: null,
        summary: null,
      },
    });
    useSplitStore.setState({
      eventId: 'event-1',
      currency: 'USD',
      billTotal: 30,
      totalCheck: 30,
      splits: [
        { participant_id: 'p1', display_name: 'Alex', amount_owed: 15, item_names: ['Burger'] },
        { participant_id: 'p2', display_name: 'Jordan', amount_owed: 15, item_names: ['Salad'] },
      ],
    });
  });

  it('renders a read-only member breakdown', () => {
    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('Jordan')).toBeTruthy();
    expect(screen.getByText('Burger')).toBeTruthy();
    expect(screen.getByText('Salad')).toBeTruthy();
    expect(screen.getByText('Friday Dinner')).toBeTruthy();
    expect(screen.getByLabelText('Alex, owes $15.00')).toBeTruthy();
    expect(screen.queryByText('Edit amount')).toBeNull();
    expect(screen.queryByText('Share')).toBeNull();
  });

  it('shows sum invariant with checkmark when balanced', () => {
    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );
    expect(screen.getByText(/\$30\.00 ✓/)).toBeTruthy();
  });

  it('disables Send when amounts missing', () => {
    useSplitStore.setState({
      splits: [
        { participant_id: 'p1', display_name: 'Alex', amount_owed: 0, item_names: [] },
        { participant_id: 'p2', display_name: 'Jordan', amount_owed: 30, item_names: [] },
      ],
      totalCheck: 30,
    });
    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );
    const preview = screen.getByLabelText('Preview messages');
    expect(preview.props.accessibilityState?.disabled ?? preview.props.disabled).toBeTruthy();
  });

  it('shows Complete event when no members can receive SMS', () => {
    jest.mocked(eventHasSmsRecipients).mockReturnValue(false);

    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );

    expect(screen.getByLabelText('Complete event without sending SMS')).toBeTruthy();
  });

  it('continues without preview when confirming a name-only group', async () => {
    jest.mocked(eventHasSmsRecipients).mockReturnValue(false);
    jest.mocked(continueMessagingAfterSplitConfirm).mockResolvedValue(undefined);

    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack, navigate: mockNavigate } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Complete event without sending SMS'));

    await waitFor(() => {
      expect(continueMessagingAfterSplitConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ navigate: mockNavigate }),
        'event-1',
        { isPostSendRevision: false },
      );
    });
  });
});
