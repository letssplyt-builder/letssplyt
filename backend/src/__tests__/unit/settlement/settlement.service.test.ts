import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  confirmPayment,
  disputePayment,
  markParticipantPaid,
  nudgeParticipant,
  selfReportPayment,
} from '../../../modules/settlement/settlement.service';

jest.mock('../../../infrastructure/notification/opt-out', () => ({
  isPhoneOptedOut: jest.fn(),
}));

jest.mock('../../../infrastructure/notification/twilio-messaging', () => ({
  sendTwilioMessage: jest.fn(),
}));

jest.mock('../../../modules/messages/participant-phone', () => ({
  resolveParticipantPhoneContext: jest.fn(),
}));

import { isPhoneOptedOut } from '../../../infrastructure/notification/opt-out';
import { sendTwilioMessage } from '../../../infrastructure/notification/twilio-messaging';
import { resolveParticipantPhoneContext } from '../../../modules/messages/participant-phone';

const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PARTICIPANT_USER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const EVENT_ID = 'event-1111-1111-1111-111111111111';
const PARTICIPANT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function pushEvent(): void {
  mockSupabase.__pushMockResultForTable('events', {
    data: {
      id: EVENT_ID,
      payer_id: PAYER_ID,
      title: 'Dinner',
      status: 'sent',
      currency: 'USD',
      locale: 'en-US',
      deleted_at: null,
    },
    error: null,
  });
}

function pushParticipantRow(overrides: Record<string, unknown> = {}): void {
  mockSupabase.__pushMockResultForTable('participants', {
    data: {
      id: PARTICIPANT_ID,
      event_id: EVENT_ID,
      user_id: PARTICIPANT_USER,
      display_name: 'Jordan',
      amount_owed: 25,
      payment_status: 'pending',
      disputed_count: 0,
      last_nudged_at: null,
      nudge_count: 0,
      guest_pii_token: null,
      country_code: 'US',
      join_method: 'manual_phone',
      ...overrides,
    },
    error: null,
  });
}

describe('settlement.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    jest.mocked(isPhoneOptedOut).mockResolvedValue(false);
    jest.mocked(sendTwilioMessage).mockResolvedValue({ sid: 'SMnudge', channel: 'sms' });
    jest.mocked(resolveParticipantPhoneContext).mockResolvedValue({
      phoneE164: '+15005550002',
      resolvedCountry: 'US',
      channel: 'sms',
    });
  });

  it('self-report rejects when status is already confirmed', async () => {
    pushParticipantRow({ payment_status: 'confirmed' });

    await expect(
      selfReportPayment(PARTICIPANT_USER, EVENT_ID, PARTICIPANT_ID, {
        payment_method: 'venmo',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PAYMENT_STATUS' });
  });

  it('self-report confirms payment immediately', async () => {
    pushParticipantRow();
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 25 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: { payer_id: PAYER_ID },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ID,
          user_id: PARTICIPANT_USER,
          payment_status: 'confirmed',
          amount_owed: 25,
        },
      ],
      error: null,
    });

    const result = await selfReportPayment(PARTICIPANT_USER, EVENT_ID, PARTICIPANT_ID, {
      payment_method: 'venmo',
    });

    expect(result.payment_status).toBe('confirmed');
    expect(mockSupabase.from).toHaveBeenCalledWith('settlement_log');
  });

  it('confirm sets event settled when last owing participant confirms', async () => {
    pushEvent();
    pushParticipantRow({ payment_status: 'self_reported' });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 25 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: { payer_id: PAYER_ID },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ID,
          user_id: PARTICIPANT_USER,
          payment_status: 'confirmed',
          amount_owed: 25,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const result = await confirmPayment(PAYER_ID, EVENT_ID, PARTICIPANT_ID);

    expect(result.payment_status).toBe('confirmed');
    expect(result.event_fully_settled).toBe(true);
  });

  it('confirm rejects when status is already confirmed', async () => {
    pushEvent();
    pushParticipantRow({ payment_status: 'confirmed' });

    await expect(confirmPayment(PAYER_ID, EVENT_ID, PARTICIPANT_ID)).rejects.toMatchObject({
      code: 'INVALID_PAYMENT_STATUS',
      statusCode: 409,
    });
  });

  it('dispute moves confirmed payment to disputed', async () => {
    pushEvent();
    pushParticipantRow({ payment_status: 'confirmed', disputed_count: 0 });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const result = await disputePayment(PAYER_ID, EVENT_ID, PARTICIPANT_ID, {});

    expect(result.payment_status).toBe('disputed');
    expect(result.disputed_count).toBe(1);
  });

  it('nudge rejects within 48h cooldown with retry timestamp', async () => {
    pushEvent();
    const recent = new Date(Date.now() - 1000).toISOString();
    pushParticipantRow({ last_nudged_at: recent });
    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex' },
      error: null,
    });

    await expect(nudgeParticipant(PAYER_ID, EVENT_ID, PARTICIPANT_ID)).rejects.toMatchObject({
      code: 'NUDGE_COOLDOWN',
      statusCode: 429,
    });
  });

  it('mark-paid sets confirmed and may settle event', async () => {
    pushEvent();
    pushParticipantRow({ payment_status: 'pending' });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 25 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: { id: PARTICIPANT_ID, amount_owed: 25 },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('events', {
      data: { payer_id: PAYER_ID },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', {
      data: [
        {
          id: PARTICIPANT_ID,
          user_id: PARTICIPANT_USER,
          payment_status: 'confirmed',
          amount_owed: 25,
        },
      ],
      error: null,
    });
    mockSupabase.__pushMockResultForTable('events', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const result = await markParticipantPaid(PAYER_ID, EVENT_ID, PARTICIPANT_ID, {
      payment_method: 'cash',
    });

    expect(result.payment_status).toBe('confirmed');
    expect(result.event_fully_settled).toBe(true);
  });

  it('nudge sends Twilio message after cooldown expires', async () => {
    pushEvent();
    const old = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    pushParticipantRow({ last_nudged_at: old, nudge_count: 1 });
    mockSupabase.__pushMockResultForTable('users', {
      data: { display_name: 'Alex' },
      error: null,
    });
    mockSupabase.__pushMockResultForTable('participants', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('notification_log', { data: null, error: null });
    mockSupabase.__pushMockResultForTable('settlement_log', { data: null, error: null });

    const result = await nudgeParticipant(PAYER_ID, EVENT_ID, PARTICIPANT_ID);

    expect(result.sent).toBe(true);
    expect(sendTwilioMessage).toHaveBeenCalledTimes(1);
    expect(result.next_nudge_available_at).toBeTruthy();
  });
});
