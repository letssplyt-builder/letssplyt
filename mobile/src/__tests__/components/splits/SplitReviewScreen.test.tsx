import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SplitReviewScreen } from '../../../screens/splits/SplitReviewScreen';
import { useSplitStore } from '../../../store/splitStore';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

describe('SplitReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders per-person breakdown', () => {
    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('Jordan')).toBeTruthy();
    expect(screen.getByText('Burger')).toBeTruthy();
  });

  it('shows sum invariant with checkmark when balanced', () => {
    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );
    expect(screen.getByText(/Total: \$30\.00 ✓/)).toBeTruthy();
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
        navigation={{ goBack: mockGoBack } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );
    const send = screen.getByLabelText('Send to all');
    expect(send.props.accessibilityState?.disabled ?? send.props.disabled).toBeTruthy();
  });

  it('opens edit sheet when tapping a row', () => {
    render(
      <SplitReviewScreen
        navigation={{ goBack: mockGoBack } as never}
        route={{ key: 'SplitReview-1', name: 'SplitReview', params: { eventId: 'event-1' } }}
      />,
    );
    fireEvent.press(screen.getByLabelText('Alex, owes $15.00'));
    expect(screen.getByText('Edit amount')).toBeTruthy();
  });
});
