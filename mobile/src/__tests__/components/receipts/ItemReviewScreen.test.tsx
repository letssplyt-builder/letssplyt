import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ItemReviewScreen } from '../../../screens/receipts/ItemReviewScreen';
import * as receiptsService from '../../../services/receipts.service';

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
});
