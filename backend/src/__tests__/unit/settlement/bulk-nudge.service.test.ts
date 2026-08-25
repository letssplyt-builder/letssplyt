import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  nudgeGuestOutstanding,
  nudgeMemberOutstanding,
} from '../../../modules/settlement/bulk-nudge.service';

jest.mock('../../../modules/settlement/member-detail.service', () => ({
  getMemberDetail: jest.fn(),
}));

jest.mock('../../../modules/settlement/guest-detail.service', () => ({
  getGuestDetail: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/opt-out', () => ({
  isPhoneOptedOut: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/outbound-messaging.service', () => ({
  sendOutboundMessage: jest.fn(),
}));

jest.mock('../../../modules/messages/participant-phone', () => ({
  resolveParticipantPhoneContext: jest.fn(),
}));

jest.mock('../../../modules/settlement/settlement-push', () => ({
  notifyMemberNudge: jest.fn(),
}));

import { isPhoneOptedOut } from '../../../infrastructure/notification/opt-out';
import { sendOutboundMessage } from '../../../infrastructure/notification/outbound-messaging.service';
import { resolveParticipantPhoneContext } from '../../../modules/messages/participant-phone';
import { getGuestDetail } from '../../../modules/settlement/guest-detail.service';
import { getMemberDetail } from '../../../modules/settlement/member-detail.service';

const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EVENT_A = 'event-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const EVENT_B = 'event-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PART_A = 'part-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PART_B = 'part-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function memberDetail(overrides: Record<string, unknown> = {}) {
  return {
    counterparty: {
      user_id: MEMBER_ID,
      display_name: 'Jordan',
      avatar_colour: '#000',
    },
    net_amount: 45,
    currency: 'USD' as const,
    outstanding: [
      {
        event_id: EVENT_A,
        event_title: 'Dinner',
        event_date: '2026-08-01',
        amount: 20,
        direction: 'owed_to_me' as const,
        payment_status: 'pending',
        participant_id: PART_A,
        can_nudge: true,
      },
      {
        event_id: EVENT_B,
        event_title: 'Lunch',
        event_date: '2026-08-02',
        amount: 25,
        direction: 'owed_to_me' as const,
        payment_status: 'pending',
        participant_id: PART_B,
        can_nudge: true,
      },
    ],
    history: [],
    ...overrides,
  };
}

describe('bulk-nudge.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    jest.mocked(isPhoneOptedOut).mockResolvedValue(false);
    jest.mocked(sendOutboundMessage).mockResolvedValue({ messageId: 'SMbulk', channel: 'sms' });
    jest.mocked(resolveParticipantPhoneContext).mockResolvedValue({
      phoneE164: '+15005550006',
      resolvedCountry: 'US',
      channel: 'sms',
    });
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === 'claim_participant_nudge') {
        return Promise.resolve({ data: new Date().toISOString(), error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it('sends one SMS covering every outstanding event', async () => {
    jest.mocked(getMemberDetail).mockResolvedValue(memberDetail());
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PART_A,
          event_id: EVENT_A,
          user_id: MEMBER_ID,
          display_name: 'Jordan',
          amount_owed: 20,
          payment_status: 'pending',
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
        },
        {
          id: PART_B,
          event_id: EVENT_B,
          user_id: MEMBER_ID,
          display_name: 'Jordan',
          amount_owed: 25,
          payment_status: 'pending',
          guest_pii_token: null,
          country_code: 'US',
          join_method: 'qr_app',
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', {
      data: [
        { id: EVENT_A, currency: 'USD', locale: 'en-US', payer_id: PAYER_ID, deleted_at: null },
        { id: EVENT_B, currency: 'USD', locale: 'en-US', payer_id: PAYER_ID, deleted_at: null },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('nudge_links', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('nudge_links', {
      data: { token: 'nudge-token-1' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const result = await nudgeMemberOutstanding(PAYER_ID, MEMBER_ID);

    expect(result.sent).toBe(true);
    expect(result.nudged_count).toBe(2);
    expect(result.total_amount).toBe(45);
    expect(sendOutboundMessage).toHaveBeenCalledTimes(1);
    const body = jest.mocked(sendOutboundMessage).mock.calls[0]?.[2] as string;
    expect(body).toContain('$45.00');
    expect(body).toContain('2 events');
    expect(body).toContain('/nudge/nudge-token-1');
  });

  it('returns 429 without SMS when every pending event is in cooldown', async () => {
    jest.mocked(getMemberDetail).mockResolvedValue(
      memberDetail({
        outstanding: [
          {
            event_id: EVENT_A,
            event_title: 'Dinner',
            event_date: '2026-08-01',
            amount: 20,
            direction: 'owed_to_me',
            payment_status: 'pending',
            participant_id: PART_A,
            can_nudge: false,
            last_nudged_at: '2026-08-24T12:00:00.000Z',
          },
        ],
      }),
    );

    await expect(nudgeMemberOutstanding(PAYER_ID, MEMBER_ID)).rejects.toMatchObject({
      code: 'NUDGE_COOLDOWN',
      statusCode: 429,
    });
    expect(sendOutboundMessage).not.toHaveBeenCalled();
  });

  it('refuses guests with no reachable phone', async () => {
    jest.mocked(getGuestDetail).mockResolvedValue({
      display_name: 'Sam',
      amount: 18,
      currency: 'USD',
      outstanding: [
        {
          event_id: EVENT_A,
          event_title: 'Dinner',
          amount: 18,
          payment_status: 'pending',
          participant_id: PART_A,
          can_nudge: false,
        },
      ],
      history: [],
    });

    await expect(nudgeGuestOutstanding(PAYER_ID, 'phone-hash')).rejects.toMatchObject({
      code: 'NO_PHONE',
      statusCode: 400,
    });
    expect(sendOutboundMessage).not.toHaveBeenCalled();
  });
});
