import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MemberDetailScreen } from '../../../screens/home/MemberDetailScreen';
import * as settlementService from '../../../services/settlement.service';
import { useSettlementStore } from '../../../store/settlementStore';

jest.mock('../../../services/settlement.service', () => ({
  memberSelfReportAll: jest.fn(),
  nudgeMemberOutstanding: jest.fn(),
  memberMarkPaidAll: jest.fn(),
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
      expect(screen.getByLabelText('Mark all paid')).toBeTruthy();
    });
  });

  it('shows Pay all and All paid without Confirm all when the viewer owes', async () => {
    render(
      <MemberDetailScreen
        navigation={{ navigate: mockNavigate, goBack: jest.fn() } as never}
        route={{ key: 'MemberDetail-1', name: 'MemberDetail', params: { userId: 'member-1' } }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Pay all')).toBeTruthy();
      expect(screen.getByText('All paid')).toBeTruthy();
      expect(screen.queryByLabelText('Mark all paid')).toBeNull();
      expect(screen.queryByText('Confirm all')).toBeNull();
    });
  });

  it('marks every pending owed_to_me event paid after confirm', async () => {
    const loadCounterparties = jest.fn(async () => {});
    const loadEventLedger = jest.fn(async () => {});
    const loadMemberDetail = jest.fn(async () => {});
    jest.mocked(settlementService.memberMarkPaidAll).mockResolvedValue({
      updated_count: 2,
    });
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirm = buttons?.find((button) => button.text === 'Mark paid');
      confirm?.onPress?.();
    });

    useSettlementStore.setState({
      memberDetail: {
        counterparty: {
          user_id: 'member-1',
          display_name: 'Jordan',
          avatar_colour: '#4F46E5',
        },
        net_amount: 42,
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
          {
            event_id: 'event-2',
            event_title: 'Brunch',
            event_date: null,
            participant_id: 'part-2',
            amount: 17,
            direction: 'owed_to_me',
            payment_status: 'pending',
          },
        ],
        history: [],
      },
      iOweRows: [],
      isLoadingDetail: false,
      loadMemberDetail,
      loadCounterparties,
      loadEventLedger,
      clearDetail: jest.fn(),
    } as never);

    render(
      <MemberDetailScreen
        navigation={{ navigate: mockNavigate, goBack: jest.fn() } as never}
        route={{ key: 'MemberDetail-1', name: 'MemberDetail', params: { userId: 'member-1' } }}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Mark all paid'));

    await waitFor(() => {
      expect(settlementService.memberMarkPaidAll).toHaveBeenCalledWith('member-1', 'cash');
      expect(loadMemberDetail).toHaveBeenCalledWith('member-1');
      expect(loadCounterparties).toHaveBeenCalledWith('members');
      expect(loadEventLedger).toHaveBeenCalled();
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Mark all paid?',
      'Mark 2 events paid for Jordan? Total $42.00.',
      expect.any(Array),
    );
  });

  it('hides Mark all paid when owed_to_me rows are only disputed', async () => {
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
            payment_status: 'disputed',
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

    await waitFor(() => expect(screen.getByText('Dinner')).toBeTruthy());
    expect(screen.queryByLabelText('Mark all paid')).toBeNull();
  });
});
