import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as settlementService from '../../../services/settlement.service';
import { useSettlementStore } from '../../../store/settlementStore';

jest.mock('../../../services/settlement.service');

describe('settlementStore', () => {
  beforeEach(() => {
    useSettlementStore.setState({
      membersOweYou: [],
      membersYouOwe: [],
      guests: [],
      memberDetail: null,
      guestDetail: null,
      owedToMeRows: [],
      iOweRows: [],
      isLoadingCounterparties: false,
      isLoadingDetail: false,
      isLoadingLedger: false,
      counterpartyError: false,
    });
    jest.clearAllMocks();
  });

  it('loadCounterparties populates members owe_you and you_owe', async () => {
    jest.mocked(settlementService.fetchMemberCounterparties).mockResolvedValue({
      owe_you: [
        {
          user_id: 'u1',
          display_name: 'Jordan',
          avatar_colour: '#4F46E5',
          net_amount: 25,
        },
      ],
      you_owe: [
        {
          user_id: 'u2',
          display_name: 'Sam',
          avatar_colour: '#10B981',
          net_amount: 12,
        },
      ],
    });

    await useSettlementStore.getState().loadCounterparties('members');

    const state = useSettlementStore.getState();
    expect(state.membersOweYou).toHaveLength(1);
    expect(state.membersYouOwe).toHaveLength(1);
    expect(state.counterpartyError).toBe(false);
  });

  it('loadCounterparties populates guests list', async () => {
    jest.mocked(settlementService.fetchGuestCounterparties).mockResolvedValue({
      guests: [
        {
          guest_key: 'hash-1',
          kind: 'phone',
          display_name: 'Guest Sam',
          amount: 30,
        },
        {
          guest_key: 'part-1',
          kind: 'name_only',
          display_name: 'Cash Guest',
          amount: 15,
          event_id: 'event-1',
          participant_id: 'part-1',
        },
      ],
    });

    await useSettlementStore.getState().loadCounterparties('guests');

    const state = useSettlementStore.getState();
    expect(state.guests).toHaveLength(2);
    expect(state.guests[0].kind).toBe('phone');
    expect(state.guests[1].kind).toBe('name_only');
  });

  it('loadMemberDetail populates outstanding and history', async () => {
    jest.mocked(settlementService.fetchMemberDetail).mockResolvedValue({
      counterparty: {
        user_id: 'u1',
        display_name: 'Jordan',
        avatar_colour: '#4F46E5',
      },
      net_amount: 20,
      currency: 'USD',
      outstanding: [
        {
          event_id: 'e1',
          event_title: 'Dinner',
          event_date: '2026-06-08T00:00:00.000Z',
          amount: 20,
          direction: 'owed_to_me',
          payment_status: 'pending',
          participant_id: 'p1',
        },
      ],
      history: [],
    });

    await useSettlementStore.getState().loadMemberDetail('u1');

    const state = useSettlementStore.getState();
    expect(state.memberDetail?.outstanding).toHaveLength(1);
    expect(state.memberDetail?.counterparty.display_name).toBe('Jordan');
  });

  it('loadEventLedger populates i-owe rows', async () => {
    jest.mocked(settlementService.fetchOwedToMe).mockResolvedValue({
      data: [],
      total_owed_minor_units: 0,
      currency: 'USD',
    });
    jest.mocked(settlementService.fetchIOwe).mockResolvedValue({
      data: [
        {
          event_id: 'e1',
          event_title: 'Dinner',
          payer_display_name: 'Alex',
          amount_minor_units: 20,
          currency: 'USD',
          payment_status: 'pending',
          creator_payment_handles: [],
        },
      ],
      total_owe_minor_units: 20,
      currency: 'USD',
    });

    await useSettlementStore.getState().loadEventLedger();

    const state = useSettlementStore.getState();
    expect(state.iOweRows).toHaveLength(1);
    expect(state.getIOweForEvent('e1')?.event_title).toBe('Dinner');
  });

  it('clears stale member rows while loading counterparties', async () => {
    useSettlementStore.setState({
      membersOweYou: [
        {
          user_id: 'member-1',
          display_name: 'Jordan',
          avatar_colour: '#4F46E5',
          net_amount: 25,
        },
      ],
      membersYouOwe: [],
    });

    jest.mocked(settlementService.fetchMemberCounterparties).mockResolvedValue({
      owe_you: [],
      you_owe: [],
    });

    await useSettlementStore.getState().loadCounterparties('members');

    const state = useSettlementStore.getState();
    expect(state.membersOweYou).toEqual([]);
    expect(state.membersYouOwe).toEqual([]);
  });
});
