import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../modules/messages/a3.agent', () => ({
  composeParticipantMessage: jest.fn(),
}));

jest.mock('../../../modules/profile/profile.service', () => ({
  getHandles: jest.fn(),
}));

jest.mock('../../../modules/messages/participant-phone', () => ({
  resolveParticipantPhoneContext: jest.fn(),
}));

jest.mock('../../../modules/messages/breakdown-token.service', () => ({
  ensureParticipantBreakdownUrl: jest.fn(),
}));

import { mockSupabase } from '../../mocks/supabase.mock';
import { composeParticipantMessage } from '../../../modules/messages/a3.agent';
import { ensureParticipantBreakdownUrl } from '../../../modules/messages/breakdown-token.service';
import { buildMessagePreviewsForEvent } from '../../../modules/messages/messages.service';
import { resolveParticipantPhoneContext } from '../../../modules/messages/participant-phone';
import { getHandles } from '../../../modules/profile/profile.service';

const EVENT_ID = 'event-eeee-eeee-eeee-eeee-eeee-eeee-eeee';
const PAYER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PARTICIPANT_WITH_PHONE = 'part-a-1111-1111-1111-111111111111';
const PARTICIPANT_NAME_ONLY = 'part-b-2222-2222-2222-222222222222';
const BREAKDOWN_URL = 'https://letssplyt.app/split/testtoken123';

function mockPreviewContext(): void {
  mockSupabase.__pushMockResultForTable('events', {
    data: {
      id: EVENT_ID,
      payer_id: PAYER_ID,
      title: 'Dinner',
      status: 'locked',
      ai_stage: 'messaging',
      currency: 'USD',
      locale: 'en-US',
      total_amount: 40,
    },
    error: null,
  });

  mockSupabase.__pushMockResultForTable('users', {
    data: { display_name: 'Alex Payer' },
    error: null,
  });

  mockSupabase.__pushMockResultForTable('participants', {
    data: [
      {
        id: PARTICIPANT_WITH_PHONE,
        user_id: MEMBER_USER_ID,
        display_name: 'Jordan',
        amount_owed: 20,
        guest_pii_token: null,
        country_code: 'US',
        join_method: 'qr_app',
      },
      {
        id: PARTICIPANT_NAME_ONLY,
        user_id: null,
        display_name: 'Raj',
        amount_owed: 20,
        guest_pii_token: null,
        country_code: null,
        join_method: 'manual_name_only',
      },
    ],
    error: null,
  });

  mockSupabase.__pushMockResultForTable('item_assignments', { data: [], error: null });
}

describe('buildMessagePreviewsForEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.__resetMock();

    jest.mocked(getHandles).mockResolvedValue([]);
    jest.mocked(ensureParticipantBreakdownUrl).mockResolvedValue(BREAKDOWN_URL);
    jest.mocked(composeParticipantMessage).mockResolvedValue({
      messageText: 'Hi Jordan — your share is $20.00.',
      channel: 'sms',
      paymentLinks: [],
    });
    jest.mocked(resolveParticipantPhoneContext).mockImplementation(async (participant) => {
      if (participant.join_method === 'manual_name_only') {
        return { phoneE164: null, resolvedCountry: undefined, channel: 'sms' };
      }
      return {
        phoneE164: '+15005550001',
        resolvedCountry: 'US',
        channel: 'sms',
      };
    });
  });

  it('omits manual_name_only members from previews', async () => {
    mockPreviewContext();

    const previews = await buildMessagePreviewsForEvent(EVENT_ID, PAYER_ID);

    expect(previews).toHaveLength(1);
    expect(previews[0]?.participant_id).toBe(PARTICIPANT_WITH_PHONE);
    expect(previews.map((row) => row.display_name)).not.toContain('Raj');
  });

  it('does not compose or generate breakdown links for manual_name_only members', async () => {
    mockPreviewContext();

    await buildMessagePreviewsForEvent(EVENT_ID, PAYER_ID);

    expect(composeParticipantMessage).toHaveBeenCalledTimes(1);
    expect(ensureParticipantBreakdownUrl).toHaveBeenCalledTimes(1);
    expect(ensureParticipantBreakdownUrl).toHaveBeenCalledWith(PARTICIPANT_WITH_PHONE);
    expect(resolveParticipantPhoneContext).toHaveBeenCalledWith(
      expect.objectContaining({ join_method: 'manual_name_only' }),
    );
  });
});
