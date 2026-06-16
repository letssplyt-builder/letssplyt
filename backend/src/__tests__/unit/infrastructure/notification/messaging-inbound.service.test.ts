import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../../infrastructure/notification/process-sms-opt-out', () => ({
  processSmsStopOptOut: jest.fn(async () => []),
}));

jest.mock('../../../../infrastructure/notification/process-sms-opt-in', () => ({
  processSmsStartOptIn: jest.fn(async () => undefined),
}));

import { processSmsStartOptIn } from '../../../../infrastructure/notification/process-sms-opt-in';
import { processSmsStopOptOut } from '../../../../infrastructure/notification/process-sms-opt-out';
import {
  handleInboundSmsKeyword,
  INBOUND_REPLY_HELP,
  INBOUND_REPLY_START,
  INBOUND_REPLY_STOP,
} from '../../../../infrastructure/notification/messaging-inbound.service';

describe('handleInboundSmsKeyword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles STOP variants', async () => {
    const action = await handleInboundSmsKeyword('+12125551234', 'stop');

    expect(action).toEqual({ type: 'stop', replyText: INBOUND_REPLY_STOP });
    expect(processSmsStopOptOut).toHaveBeenCalledWith('+12125551234');
  });

  it('handles START', async () => {
    const action = await handleInboundSmsKeyword('+12125551234', 'START');

    expect(action).toEqual({ type: 'start', replyText: INBOUND_REPLY_START });
    expect(processSmsStartOptIn).toHaveBeenCalledWith('+12125551234');
  });

  it('handles HELP without opt-out changes', async () => {
    const action = await handleInboundSmsKeyword('+12125551234', 'help');

    expect(action).toEqual({ type: 'help', replyText: INBOUND_REPLY_HELP });
    expect(processSmsStopOptOut).not.toHaveBeenCalled();
    expect(processSmsStartOptIn).not.toHaveBeenCalled();
  });

  it('returns none for unrelated body', async () => {
    const action = await handleInboundSmsKeyword('+12125551234', 'hello there');

    expect(action).toEqual({ type: 'none' });
  });
});
