import { describe, expect, it } from '@jest/globals';
import {
  canParticipantReceiveSms,
  eventHasSmsRecipients,
} from '../../../utils/messageFlow';

describe('messageFlow', () => {
  it('treats manual_name_only as not SMS-eligible', () => {
    expect(canParticipantReceiveSms('manual_name_only')).toBe(false);
    expect(canParticipantReceiveSms('manual_phone')).toBe(true);
    expect(canParticipantReceiveSms('qr_web')).toBe(true);
  });

  it('detects when an event has no SMS recipients besides the organiser', () => {
    expect(
      eventHasSmsRecipients([
        { is_organiser: true, join_method: 'qr_app' },
        { join_method: 'manual_name_only' },
        { join_method: 'manual_name_only' },
      ]),
    ).toBe(false);

    expect(
      eventHasSmsRecipients([
        { is_organiser: true, join_method: 'qr_app' },
        { join_method: 'manual_name_only' },
        { join_method: 'qr_web' },
      ]),
    ).toBe(true);
  });

  it('does not treat a $0 share as an SMS recipient', () => {
    expect(
      eventHasSmsRecipients([
        { is_organiser: true, join_method: 'qr_app', amount_owed: 40 },
        { join_method: 'qr_web', amount_owed: 0 },
      ]),
    ).toBe(false);

    expect(
      eventHasSmsRecipients([
        { is_organiser: true, join_method: 'qr_app', amount_owed: 20 },
        { join_method: 'qr_web', amount_owed: 0 },
        { join_method: 'manual_phone', amount_owed: 20 },
      ]),
    ).toBe(true);
  });
});
