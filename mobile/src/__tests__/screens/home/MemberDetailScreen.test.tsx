import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MemberDetailScreen } from '../../../screens/home/MemberDetailScreen';
import { useSettlementStore } from '../../../store/settlementStore';

const mockTabNavigate = jest.fn();

function createHomeNavigationMock() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    getState: () => ({
      routeNames: ['Home', 'MemberDetail'],
      index: 1,
      routes: [],
      key: 'home-stack',
    }),
    getParent: () => ({
      getState: () => ({
        routeNames: ['HomeTab', 'EventsTab'],
        index: 0,
        routes: [],
        key: 'main-tabs',
      }),
      navigate: mockTabNavigate,
    }),
  };
}

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

  it('opens event on the Events stack (single EventDetail instance)', async () => {
    render(
      <MemberDetailScreen
        navigation={createHomeNavigationMock() as never}
        route={{ key: 'MemberDetail-1', name: 'MemberDetail', params: { userId: 'member-1' } }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Friday Dinner')).toBeTruthy());
    fireEvent.press(screen.getByText('Friday Dinner'));

    expect(mockTabNavigate).toHaveBeenCalledWith('EventsTab', {
      screen: 'EventDetail',
      params: { eventId: 'event-1' },
    });
  });
});
