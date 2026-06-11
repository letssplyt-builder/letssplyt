import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppError } from '../../../infrastructure/errors';
import {
  guestMarkPaidAll,
  memberConfirmAll,
  memberMarkPaidAll,
  memberSelfReportAll,
} from '../../../modules/settlement/bulk-settlement.service';

jest.mock('../../../modules/settlement/member-detail.service', () => ({
  getMemberDetail: jest.fn(),
}));

jest.mock('../../../modules/settlement/guest-detail.service', () => ({
  getGuestDetail: jest.fn(),
}));

jest.mock('../../../modules/settlement/settlement.service', () => ({
  selfReportPayment: jest.fn(),
  confirmPayment: jest.fn(),
  disputePayment: jest.fn(),
  markParticipantPaid: jest.fn(),
}));

import { getGuestDetail } from '../../../modules/settlement/guest-detail.service';
import { getMemberDetail } from '../../../modules/settlement/member-detail.service';
import {
  confirmPayment,
  markParticipantPaid,
  selfReportPayment,
} from '../../../modules/settlement/settlement.service';

const VIEWER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const COUNTERPARTY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EVENT_A = 'event-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EVENT_B = 'event-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PART_A = 'part-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PART_B = 'part-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('bulk-settlement.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('self-report-all across two events with same payer', async () => {
    jest.mocked(getMemberDetail).mockResolvedValue({
      counterparty: {
        user_id: COUNTERPARTY_ID,
        display_name: 'Alex',
        avatar_colour: '#000',
      },
      net_amount: -60,
      currency: 'USD',
      outstanding: [
        {
          event_id: EVENT_A,
          event_title: 'Dinner A',
          event_date: '2026-01-01',
          amount: 30,
          direction: 'i_owe',
          payment_status: 'pending',
          participant_id: PART_A,
        },
        {
          event_id: EVENT_B,
          event_title: 'Dinner B',
          event_date: '2026-01-02',
          amount: 30,
          direction: 'i_owe',
          payment_status: 'pending',
          participant_id: PART_B,
        },
      ],
      history: [],
    });

    jest.mocked(selfReportPayment).mockResolvedValue({
      participant_id: PART_A,
      payment_status: 'self_reported',
      self_reported_at: '2026-01-01T00:00:00.000Z',
    });

    const result = await memberSelfReportAll(VIEWER_ID, COUNTERPARTY_ID, {
      payment_method: 'venmo',
    });

    expect(result.updated_count).toBe(2);
    expect(selfReportPayment).toHaveBeenCalledTimes(2);
    expect(result.results[0].payment_status).toBe('self_reported');
  });

  it('confirm-all settles both events when last participant confirms', async () => {
    jest.mocked(getMemberDetail).mockResolvedValue({
      counterparty: {
        user_id: COUNTERPARTY_ID,
        display_name: 'Alex',
        avatar_colour: '#000',
      },
      net_amount: 60,
      currency: 'USD',
      outstanding: [
        {
          event_id: EVENT_A,
          event_title: 'Dinner A',
          event_date: '2026-01-01',
          amount: 30,
          direction: 'owed_to_me',
          payment_status: 'self_reported',
          participant_id: PART_A,
        },
        {
          event_id: EVENT_B,
          event_title: 'Dinner B',
          event_date: '2026-01-02',
          amount: 30,
          direction: 'owed_to_me',
          payment_status: 'self_reported',
          participant_id: PART_B,
        },
      ],
      history: [],
    });

    jest.mocked(confirmPayment)
      .mockResolvedValueOnce({
        participant_id: PART_A,
        payment_status: 'confirmed',
        confirmed_at: '2026-01-01T00:00:00.000Z',
        event_fully_settled: false,
      })
      .mockResolvedValueOnce({
        participant_id: PART_B,
        payment_status: 'confirmed',
        confirmed_at: '2026-01-01T00:00:00.000Z',
        event_fully_settled: true,
      });

    const result = await memberConfirmAll(VIEWER_ID, COUNTERPARTY_ID);

    expect(result.updated_count).toBe(2);
    expect(result.events_fully_settled).toEqual([EVENT_B]);
  });

  it('mark-paid-all only targets pending owed_to_me rows', async () => {
    jest.mocked(getMemberDetail).mockResolvedValue({
      counterparty: {
        user_id: COUNTERPARTY_ID,
        display_name: 'Alex',
        avatar_colour: '#000',
      },
      net_amount: 30,
      currency: 'USD',
      outstanding: [
        {
          event_id: EVENT_A,
          event_title: 'Dinner A',
          event_date: '2026-01-01',
          amount: 30,
          direction: 'owed_to_me',
          payment_status: 'pending',
          participant_id: PART_A,
        },
        {
          event_id: EVENT_B,
          event_title: 'Dinner B',
          event_date: '2026-01-02',
          amount: 20,
          direction: 'owed_to_me',
          payment_status: 'self_reported',
          participant_id: PART_B,
        },
      ],
      history: [],
    });

    jest.mocked(markParticipantPaid).mockResolvedValue({
      participant_id: PART_A,
      payment_status: 'confirmed',
      event_fully_settled: true,
    });

    const result = await memberMarkPaidAll(VIEWER_ID, COUNTERPARTY_ID, {
      payment_method: 'cash',
    });

    expect(result.updated_count).toBe(1);
    expect(markParticipantPaid).toHaveBeenCalledTimes(1);
    expect(markParticipantPaid).toHaveBeenCalledWith(
      VIEWER_ID,
      EVENT_A,
      PART_A,
      { payment_method: 'cash' },
    );
  });

  it('guest mark-paid-all uses guest detail outstanding rows only', async () => {
    jest.mocked(getGuestDetail).mockResolvedValue({
      display_name: 'Guest',
      amount: 45,
      currency: 'USD',
      outstanding: [
        {
          event_id: EVENT_A,
          event_title: 'Dinner A',
          amount: 25,
          payment_status: 'pending',
          participant_id: PART_A,
        },
        {
          event_id: EVENT_B,
          event_title: 'Dinner B',
          amount: 20,
          payment_status: 'pending',
          participant_id: PART_B,
        },
      ],
      history: [],
    });

    jest.mocked(markParticipantPaid).mockResolvedValue({
      participant_id: PART_A,
      payment_status: 'confirmed',
      event_fully_settled: false,
    });

    const result = await guestMarkPaidAll(VIEWER_ID, 'phone-hash-abc', {
      payment_method: 'cash',
    });

    expect(result.updated_count).toBe(2);
    expect(getGuestDetail).toHaveBeenCalledWith(VIEWER_ID, 'phone-hash-abc');
    expect(markParticipantPaid).toHaveBeenCalledTimes(2);
  });

  it('skips race conflicts and returns partial updated_count', async () => {
    jest.mocked(getMemberDetail).mockResolvedValue({
      counterparty: {
        user_id: COUNTERPARTY_ID,
        display_name: 'Alex',
        avatar_colour: '#000',
      },
      net_amount: 60,
      currency: 'USD',
      outstanding: [
        {
          event_id: EVENT_A,
          event_title: 'Dinner A',
          event_date: '2026-01-01',
          amount: 30,
          direction: 'owed_to_me',
          payment_status: 'self_reported',
          participant_id: PART_A,
        },
        {
          event_id: EVENT_B,
          event_title: 'Dinner B',
          event_date: '2026-01-02',
          amount: 30,
          direction: 'owed_to_me',
          payment_status: 'self_reported',
          participant_id: PART_B,
        },
      ],
      history: [],
    });

    jest.mocked(confirmPayment)
      .mockRejectedValueOnce(new AppError('INVALID_PAYMENT_STATUS', 'Already confirmed', 409))
      .mockResolvedValueOnce({
        participant_id: PART_B,
        payment_status: 'confirmed',
        confirmed_at: '2026-01-01T00:00:00.000Z',
        event_fully_settled: true,
      });

    const result = await memberConfirmAll(VIEWER_ID, COUNTERPARTY_ID);

    expect(result.updated_count).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].participant_id).toBe(PART_B);
  });
});
