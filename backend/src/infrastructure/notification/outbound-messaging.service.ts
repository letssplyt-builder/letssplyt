import { createSMSProvider } from '../sms/factory';
import type { MessageChannel } from '../sms/types';
import {
  createDevBypassMessageSid,
  isMessagingDevBypassEnabled,
} from './messaging-dev-bypass';

export interface OutboundMessageResult {
  messageId: string;
  channel: MessageChannel;
}

function publicStatusCallbackUrl(provider: 'twilio' | 'telnyx'): string | undefined {
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  if (!appUrl) return undefined;
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return undefined;
    if (provider === 'twilio') {
      return `${appUrl}/api/v1/webhooks/twilio/delivery`;
    }
    return `${appUrl}/api/v1/webhooks/telnyx/messaging`;
  } catch {
    return undefined;
  }
}

/**
 * Send an outbound SMS or WhatsApp message via the configured SMS provider.
 * Decrypt phone numbers immediately before calling; do not retain phoneE164 after return.
 */
export async function sendOutboundMessage(
  phoneE164: string,
  preferredChannel: MessageChannel,
  body: string,
): Promise<OutboundMessageResult> {
  if (isMessagingDevBypassEnabled()) {
    return {
      messageId: createDevBypassMessageSid(),
      channel: preferredChannel === 'whatsapp' ? 'whatsapp' : 'sms',
    };
  }

  const smsProvider = createSMSProvider();
  const statusCallbackUrl = publicStatusCallbackUrl(smsProvider.name);

  const result = await smsProvider.sendOutboundMessage({
    toE164: phoneE164,
    body,
    preferredChannel,
    statusCallbackUrl,
  });

  return { messageId: result.messageId, channel: result.channel };
}
