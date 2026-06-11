import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SplitEntryScreen } from '../../../screens/splits/SplitEntryScreen';
import * as eventService from '../../../services/event.service';
import * as splitsService from '../../../services/splits.service';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

jest.mock('../../../services/event.service');
jest.mock('../../../services/splits.service');

const eventDetail = {
  event: {
    id: 'event-1',
    payer_id: 'payer-1',
    title: 'Dinner',
    event_date: null,
    total_amount: 30,
    currency: 'USD',
    status: 'locked' as const,
    split_mode: null,
    ai_stage: 'parsed_confirmed' as const,
    locale: 'en-US',
    locked_at: null,
    messages_sent_at: null,
    fully_settled_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    payer: { id: 'payer-1', display_name: 'Alex', avatar_colour: '#000' },
  },
  participants: [
    { id: 'p1', display_name: 'Alex', join_method: 'qr_app', payment_status: 'pending', amount_owed: null },
    { id: 'p2', display_name: 'Jordan', join_method: 'manual', payment_status: 'pending', amount_owed: null },
  ],
  join_token: null,
  summary: null,
  receipt_review: {
    items: [
      { id: 'item-1', name: 'Burger', unit_price: 18, quantity: 1, confidence: 'high' as const },
      { id: 'item-2', name: 'Salad', unit_price: 12, quantity: 1, confidence: 'high' as const },
    ],
    additional_charges: [],
    tax_amount: 0,
    tip_amount: 0,
    fees_amount: 0,
    currency: 'USD',
  },
};

describe('SplitEntryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(eventService.fetchEventById).mockResolvedValue(eventDetail);
    jest.mocked(splitsService.calculateSplit).mockResolvedValue({
      splits: [
        { participant_id: 'p1', display_name: 'Alex', amount_owed: 15, item_names: [] },
        { participant_id: 'p2', display_name: 'Jordan', amount_owed: 15, item_names: [] },
      ],
      total_check: 30,
      unassigned_item_ids: [],
      confidence: 1,
      requires_review: false,
    });
  });

  const renderScreen = (mode: 'itemised' | 'manual' = 'itemised') =>
    render(
      <SplitEntryScreen
        navigation={{ navigate: mockNavigate, goBack: mockGoBack } as never}
        route={{
          key: 'SplitEntry-1',
          name: 'SplitEntry',
          params: { eventId: 'event-1', mode },
        }}
      />,
    );

  const switchToCustomSplit = async () => {
    await waitFor(() =>
      expect(screen.getByLabelText('Custom — even, amount, percent, portions')).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText('Custom — even, amount, percent, portions'));
  };

  it('shows equal amounts for all participants on even tab', async () => {
    renderScreen();
    await switchToCustomSplit();
    await waitFor(() => expect(screen.getByText('Alex')).toBeTruthy());
    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0);
  });

  it('shows a single Bill Total input in manual mode without receipt items', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      ...eventDetail,
      receipt_review: null,
      event: { ...eventDetail.event, total_amount: null },
    });
    renderScreen('manual');
    await waitFor(() => expect(screen.getByLabelText('Bill total')).toBeTruthy());
    expect(screen.queryByText('What was the total?')).toBeNull();
    expect(screen.getAllByLabelText('Bill total').length).toBe(1);
  });

  it('disables Review button when amount tab totals do not match', async () => {
    renderScreen();
    await switchToCustomSplit();
    await waitFor(() => expect(screen.getByLabelText('$ Amt')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('$ Amt'));
    fireEvent.changeText(screen.getByLabelText('Amount for Alex'), '10');
    fireEvent.changeText(screen.getByLabelText('Amount for Jordan'), '5');
    const review = screen.getByLabelText('Review split');
    expect(review.props.accessibilityState?.disabled ?? review.props.disabled).toBeTruthy();
  });

});
