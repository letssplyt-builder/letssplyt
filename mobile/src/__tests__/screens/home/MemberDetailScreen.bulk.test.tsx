import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { MemberDetailScreen } from '../../../screens/home/MemberDetailScreen';
import { useSettlementStore } from '../../../store/settlementStore';

jest.mock('../../../services/settlement.service', () => ({
  memberSelfReportAll: jest.fn(),
}));

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));

describe('MemberDetailScreen pay actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettlementStore.setState({
      memberDetail: {
        counterparty: {
          user_id: 'member-1',
          display_name: 'Jordan',
          avatar_colour: '#4F46E5',
        },
        net_amount: -25,
        currency: 'USD',
        outstanding: [
          {
            event_id: 'event-1',
            event_title: 'Dinner',
            event_date: null,
            participant_id: 'part-1',
            amount: 25,
            direction: 'i_owe',
            payment_status: 'pending',
          },
        ],
        history: [],
      },
      iOweRows: [
        {
          event_id: 'event-1',
          event_title: 'Dinner',
          payer_display_name: 'Jordan',
          payer_user_id: 'member-1',
          amount_minor_units: 25,
          currency: 'USD',
          creator_payment_handles: [
            { provider: 'venmo', handle_display: '@jordan' },
          ],
        },
      ],
      isLoadingDetail: false,
      loadMemberDetail: jest.fn(async () => {}),
      loadEventLedger: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    } as never);
  });

  it('hides Pay all when net amount is positive (they owe you)', async () => {
    useSettlementStore.setState({
      memberDetail: {
        counterparty: {
          user_id: 'member-1',
          display_name: 'Jordan',
          avatar_colour: '#4F46E5',
        },
        net_amount: 25,
        currency: 'USD',
        outstanding: [
          {
            event_id: 'event-1',
            event_title: 'Dinner',
            event_date: null,
            participant_id: 'part-1',
            amount: 25,
            direction: 'owed_to_me',
            payment_status: 'pending',
          },
        ],
        history: [],
      },
      iOweRows: [],
      isLoadingDetail: false,
      loadMemberDetail: jest.fn(async () => {}),
      loadEventLedger: jest.fn(async () => {}),
      clearDetail: jest.fn(),
    } as never);

    render(
      <MemberDetailScreen
        navigation={{ navigate: mockNavigate, goBack: jest.fn() } as never}
        route={{ key: 'MemberDetail-1', name: 'MemberDetail', params: { userId: 'member-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Pay all')).toBeNull();
      expect(screen.queryByText('All paid')).toBeNull();
    });
  });

  it('shows Pay all and All paid without mark-all bulk actions', async () => {
    render(
      <MemberDetailScreen
        navigation={{ navigate: mockNavigate, goBack: jest.fn() } as never}
        route={{ key: 'MemberDetail-1', name: 'MemberDetail', params: { userId: 'member-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Pay all')).toBeTruthy();
      expect(screen.getByText('All paid')).toBeTruthy();
      expect(screen.queryByText('Mark all paid')).toBeNull();
      expect(screen.queryByText('Confirm all')).toBeNull();
    });
  });
});
