import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MemberDetailScreen } from '../../../screens/home/MemberDetailScreen';
import { useSettlementStore } from '../../../store/settlementStore';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

describe('MemberDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettlementStore.setState({
      memberDetail: {
        counterparty: {
          user_id: 'member-1',
          display_name: 'Jordan',
          avatar_colour: '#4F46E5',
        },
        net_amount: 25,
        outstanding: [
          {
            event_id: 'event-1',
            event_title: 'Friday Dinner',
            participant_id: 'part-1',
            amount: 25,
            direction: 'owed_to_me',
          },
        ],
        history: [],
      },
      isLoadingDetail: false,
      loadMemberDetail: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    } as never);
  });

  it('opens event on Home stack without polluting Events tab', async () => {
    render(
      <MemberDetailScreen
        navigation={{ navigate: mockNavigate, goBack: jest.fn() } as never}
        route={{ key: 'MemberDetail-1', name: 'MemberDetail', params: { userId: 'member-1' } }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Friday Dinner')).toBeTruthy());
    fireEvent.press(screen.getByText('Friday Dinner'));

    expect(mockNavigate).toHaveBeenCalledWith('EventDetail', { eventId: 'event-1' });
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'EventsTab',
      expect.objectContaining({ screen: 'EventDetail' }),
    );
  });
});
