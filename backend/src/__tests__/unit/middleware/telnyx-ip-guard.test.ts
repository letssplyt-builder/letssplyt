import { describe, expect, it } from '@jest/globals';
import { isTelnyxWebhookIp } from '../../../middleware/telnyx-ip-guard';

describe('isTelnyxWebhookIp', () => {
  it('accepts IPs in Telnyx webhook CIDR', () => {
    expect(isTelnyxWebhookIp('192.76.120.200')).toBe(true);
    expect(isTelnyxWebhookIp('::ffff:192.76.120.200')).toBe(true);
  });

  it('rejects IPs outside Telnyx webhook CIDR', () => {
    expect(isTelnyxWebhookIp('8.8.8.8')).toBe(false);
  });
});
