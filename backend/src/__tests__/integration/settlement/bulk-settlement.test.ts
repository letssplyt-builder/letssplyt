import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app';
import { AppError } from '../../../infrastructure/errors';

jest.mock('../../../modules/settlement/member-detail.service', () => ({
  getMemberDetail: jest.fn(),
}));

jest.mock('../../../modules/settlement/settlement.service', () => ({
  selfReportPayment: jest.fn(),
  confirmPayment: jest.fn(),
  disputePayment: jest.fn(),
  markParticipantPaid: jest.fn(),
  nudgeParticipant: jest.fn(),
}));

import { getMemberDetail } from '../../../modules/settlement/member-detail.service';
import { confirmPayment, selfReportPayment } from '../../../modules/settlement/settlement.service';
import { mockSupabase } from '../../mocks/supabase.mock';

const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EVENT_A = 'event-bulk-1111-1111-1111-111111111111';
const EVENT_B = 'event-bulk-2222-2222-2222-222222222222';
const PART_A = 'part-bulk-1111-1111-1111-111111111111';
const PART_B = 'part-bulk-2222-2222-2222-222222222222';
const AUTH_PAYER = { Authorization: 'Bearer mock-token-payer' };

function mockAuth(userId: string): void {
  mockSupabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id: userId, email: `${userId}@letssplyt.internal` } },
    error: null,
  });
}

function owedToMeOutstanding(): ReturnType<typeof getMemberDetail> extends Promise<infer T> ? T : never {
  return {
    counterparty: {
      user_id: MEMBER_ID,
      display_name: 'Jordan',
      avatar_colour: '#6366F1',
    },
    net_amount: 50,
    currency: 'USD',
    outstanding: [
      {
        event_id: EVENT_A,
        event_title: 'Dinner A',
        event_date: '2026-01-01',
        amount: 25,
        direction: 'owed_to_me',
        payment_status: 'self_reported',
        participant_id: PART_A,
      },
      {
        event_id: EVENT_B,
        event_title: 'Dinner B',
        event_date: '2026-01-02',
        amount: 25,
        direction: 'owed_to_me',
        payment_status: 'self_reported',
        participant_id: PART_B,
      },
    ],
    history: [],
  };
}

describe('Bulk settlement API integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
  });

  it('member confirm-all across two events', async () => {
    mockAuth(PAYER_ID);
    jest.mocked(getMemberDetail).mockResolvedValue(owedToMeOutstanding());

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

    const response = await request(app)
      .post(`/api/v1/settlement/member/${MEMBER_ID}/confirm-all`)
      .set(AUTH_PAYER)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.updated_count).toBe(2);
    expect(response.body.events_fully_settled).toEqual([EVENT_B]);
    expect(confirmPayment).toHaveBeenCalledTimes(2);
  });

  it('returns 403 when confirmPayment rejects caller', async () => {
    mockAuth(PAYER_ID);
    jest.mocked(getMemberDetail).mockResolvedValue(owedToMeOutstanding());
    jest.mocked(confirmPayment).mockRejectedValue(
      new AppError('FORBIDDEN', 'Only the event creator can confirm payments', 403),
    );

    const response = await request(app)
      .post(`/api/v1/settlement/member/${MEMBER_ID}/confirm-all`)
      .set(AUTH_PAYER)
      .send();

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe('FORBIDDEN');
  });

  it('member self-report-all returns zero when no pending i_owe rows', async () => {
    mockAuth(MEMBER_ID);
    jest.mocked(getMemberDetail).mockResolvedValue({
      counterparty: {
        user_id: PAYER_ID,
        display_name: 'Payer',
        avatar_colour: '#000',
      },
      net_amount: 0,
      currency: 'USD',
      outstanding: [
        {
          event_id: EVENT_A,
          event_title: 'Dinner',
          event_date: '2026-01-01',
          amount: 25,
          direction: 'i_owe',
          payment_status: 'self_reported',
          participant_id: PART_A,
        },
      ],
      history: [],
    });

    const response = await request(app)
      .post(`/api/v1/settlement/member/${PAYER_ID}/self-report-all`)
      .set({ Authorization: 'Bearer mock-token-member' })
      .send({ payment_method: 'venmo' });

    expect(response.status).toBe(200);
    expect(response.body.updated_count).toBe(0);
    expect(selfReportPayment).not.toHaveBeenCalled();
  });
});
