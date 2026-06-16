/** @deprecated Use outbound-messaging.service sendOutboundMessage() — removed in E11-S05 */
import { twilioClient } from '../twilio';
import {
  createDevBypassMessageSid,
  isMessagingDevBypassEnabled,
} from './messaging-dev-bypass';

export interface TwilioSendResult {
  sid: string;
  channel: 'sms' | 'whatsapp';
}

function statusCallbackUrl(): string | undefined {
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  if (!appUrl) return undefined;
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return undefined;
    return `${appUrl}/api/v1/webhooks/twilio/delivery`;
  } catch {
    return undefined;
  }
}

export async function sendTwilioMessage(
  phoneE164: string,
  preferredChannel: 'sms' | 'whatsapp',
  body: string,
  mediaUrl?: string,
): Promise<TwilioSendResult> {
  if (isMessagingDevBypassEnabled()) {
    return {
      sid: createDevBypassMessageSid(),
      channel: preferredChannel === 'whatsapp' ? 'whatsapp' : 'sms',
    };
  }

  const smsFrom = process.env.TWILIO_PHONE_NUMBER;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;
  const callback = statusCallbackUrl();

  const baseParams = {
    body,
    ...(callback ? { statusCallback: callback } : {}),
    ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
  };

  if (preferredChannel === 'sms') {
    if (!smsFrom) {
      throw new Error('TWILIO_PHONE_NUMBER is not configured');
    }
    const message = await twilioClient.messages.create({
      from: smsFrom,
      to: phoneE164,
      ...baseParams,
    });
    return { sid: message.sid, channel: 'sms' };
  }

  if (!whatsappFrom) {
    throw new Error('TWILIO_WHATSAPP_NUMBER is not configured');
  }

  try {
    const message = await twilioClient.messages.create({
      from: `whatsapp:${whatsappFrom}`,
      to: `whatsapp:${phoneE164}`,
      ...baseParams,
    });
    return { sid: message.sid, channel: 'whatsapp' };
  } catch {
    if (!smsFrom) {
      throw new Error('TWILIO_PHONE_NUMBER is not configured for SMS fallback');
    }
    const message = await twilioClient.messages.create({
      from: smsFrom,
      to: phoneE164,
      ...baseParams,
    });
    return { sid: message.sid, channel: 'sms' };
  }
}
