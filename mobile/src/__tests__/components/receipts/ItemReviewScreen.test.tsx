import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';
import { ItemReviewScreen } from '../../../screens/receipts/ItemReviewScreen';
import * as receiptsService from '../../../services/receipts.service';
import * as eventService from '../../../services/event.service';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
  }),
}));

jest.mock('../../../services/receipts.service');
jest.mock('../../../services/event.service', () => ({
  fetchEventById: jest.fn(),
}));

const parseResult = {
  items: [
    { name: 'Burger', unit_price: 10, quantity: 1, confidence: 'high' as const },
    { name: 'Salad', unit_price: 8, quantity: 1, confidence: 'low' as const },
  ],
  additional_charges: [{ name: 'SVC Fee', amount: 2, confidence: 'high' as const }],
  discounts: [],
  tax_amount: 1,
  tip_amount: 2,
  fees_amount: 2,
  total_amount: 23,
  currency: 'USD',
  storage_path: 'event-1/receipt.jpg',
};

describe('ItemReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(receiptsService.confirmReceipt).mockResolvedValue({
      confirmed: true,
      total_amount: 23,
    });
  });

  const renderScreen = () =>
    render(
      <ItemReviewScreen
        navigation={
          {
            navigate: mockNavigate,
            replace: mockReplace,
            goBack: mockGoBack,
          } as never
        }
        route={{
          key: 'ItemReview-1',
          name: 'ItemReview',
          params: {
            eventId: 'event-1',
            storagePath: 'event-1/receipt.jpg',
            parseResult,
          },
        }}
      />,
    );

  it('renders all items from parse result', () => {
    renderScreen();
    expect(screen.getByText('Burger')).toBeTruthy();
    expect(screen.getByText('Salad')).toBeTruthy();
    expect(screen.getByText('SVC Fee')).toBeTruthy();
  });

  it('shows check chip on low-confidence items', () => {
    renderScreen();
    expect(screen.getByText('Check')).toBeTruthy();
  });

  it('editing item name updates the list', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Burger, tap to edit'));
    const nameInput = screen.getByLabelText('Burger, edit name');
    fireEvent.changeText(nameInput, 'Double Burger');
    expect(screen.getByDisplayValue('Double Burger')).toBeTruthy();
  });

  it('confirm button calls receipts service and navigates to split', async () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Confirm items'));

    await waitFor(() => {
      expect(receiptsService.confirmReceipt).toHaveBeenCalled();
    });

    expect(receiptsService.confirmReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'event-1',
        tax: 1,
        tip: 2,
        fees: 2,
        discounts: [],
        discount_total: 0,
      }),
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('SplitEntry', {
        eventId: 'event-1',
        mode: 'itemised',
      });
    });
  });

  it('deleting item updates running total', () => {
    renderScreen();
    fireEvent.press(screen.getByLabelText('Delete Salad'));
    expect(screen.queryByText('Salad')).toBeNull();
    expect(screen.getByLabelText('Total $15.00')).toBeTruthy();
  });

  it('confirm sends percent discount in the confirm payload', async () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Add discount'));
    fireEvent.changeText(screen.getByPlaceholderText('Discount description'), 'Happy hour');
    fireEvent.changeText(screen.getByPlaceholderText('10'), '10');
    fireEvent.press(screen.getByLabelText('Confirm items'));

    await waitFor(() => {
      expect(receiptsService.confirmReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-1',
          discounts: [{ name: 'Happy hour', type: 'percent', value: 10, scope: 'bill' }],
          discount_total: 1.8,
        }),
      );
    });
  });

  it('confirm sends stacked percent and amount discounts', async () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Add discount'));
    fireEvent.changeText(screen.getByPlaceholderText('Discount description'), 'Happy hour');
    fireEvent.changeText(screen.getByPlaceholderText('10'), '10');
    fireEvent.press(screen.getByLabelText('Done editing'));

    fireEvent.press(screen.getByLabelText('Add discount'));
    const nameFields = screen.getAllByPlaceholderText('Discount description');
    fireEvent.changeText(nameFields[nameFields.length - 1], 'Comp');
    fireEvent.press(screen.getAllByText('$').at(-1)!);
    fireEvent.changeText(screen.getByPlaceholderText('5.00'), '3');
    fireEvent.press(screen.getByLabelText('Confirm items'));

    await waitFor(() => {
      expect(receiptsService.confirmReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          discounts: [
            { name: 'Happy hour', type: 'percent', value: 10, scope: 'bill' },
            { name: 'Comp', type: 'amount', value: 3, scope: 'bill' },
          ],
          discount_total: 4.8,
        }),
      );
    });
  });

  it('confirm omits discounts with empty name or zero value', async () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Add discount'));
    fireEvent.changeText(screen.getByPlaceholderText('10'), '15');
    fireEvent.press(screen.getByLabelText('Confirm items'));

    await waitFor(() => {
      expect(receiptsService.confirmReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          discounts: [],
          discount_total: 0,
        }),
      );
    });
  });

  it('pull-to-refresh applies receipt_review discounts from the server', async () => {
    jest.mocked(eventService.fetchEventById).mockResolvedValue({
      event: {
        id: 'event-1',
        title: 'Dinner',
        status: 'locked',
        ai_stage: 'parsed',
        currency: 'USD',
      },
      participants: [],
      receipt_review: {
        items: [{ id: 'item-1', name: 'Burger', unit_price: 10, quantity: 1, confidence: 'high' }],
        additional_charges: [],
        discounts: [{ name: 'Comp', type: 'amount', value: 2, scope: 'bill' }],
        tax_amount: 0,
        tip_amount: 0,
        fees_amount: 0,
        discount_amount: 2,
        currency: 'USD',
      },
    } as never);

    const { UNSAFE_getByType } = renderScreen();
    const refreshControl = UNSAFE_getByType(RefreshControl);
    await refreshControl.props.onRefresh();

    await waitFor(() => {
      expect(screen.getByText('Comp')).toBeTruthy();
      expect(screen.getByLabelText('Total $8.00')).toBeTruthy();
    });
  });
});
