import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GuestDetailScreen } from '../../../screens/home/GuestDetailScreen';
import { useSettlementStore } from '../../../store/settlementStore';

const mockNavigate = jest.fn();

describe('GuestDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettlementStore.setState({
      guestDetail: {
        display_name: 'Sam Guest',
        phone_hash: 'hash-1',
        net_amount: 18,
        outstanding: [
          {
            event_id: 'event-guest-1',
            event_title: 'Lunch',
            participant_id: 'part-guest-1',
            amount: 18,
            direction: 'owed_to_me',
          },
        ],
        history: [],
      },
      isLoadingDetail: false,
      loadGuestDetail: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    } as never);
  });

  it('opens event on Home stack without polluting Events tab', async () => {
    render(
      <GuestDetailScreen
        navigation={{ navigate: mockNavigate, goBack: jest.fn() } as never}
        route={{
          key: 'GuestDetail-1',
          name: 'GuestDetail',
          params: { phoneHash: 'hash-1' },
        }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Lunch')).toBeTruthy());
    fireEvent.press(screen.getByText('Lunch'));

    expect(mockNavigate).toHaveBeenCalledWith('EventDetail', { eventId: 'event-guest-1' });
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'EventsTab',
      expect.objectContaining({ screen: 'EventDetail' }),
    );
  });
});
