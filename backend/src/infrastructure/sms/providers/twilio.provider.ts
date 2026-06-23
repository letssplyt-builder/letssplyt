import { twilioClient } from '../../twilio';
import type {
  SendOutboundMessageParams,
  SendOutboundMessageResult,
  SMSProvider,
} from '../types';

export class TwilioSMSProvider implements SMSProvider {
  readonly name = 'twilio' as const;

  async sendOutboundMessage(params: SendOutboundMessageParams): Promise<SendOutboundMessageResult> {
    const smsFrom = process.env.TWILIO_PHONE_NUMBER;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;
    const { toE164, body, preferredChannel, statusCallbackUrl } = params;

    const baseParams = {
      body,
      ...(statusCallbackUrl ? { statusCallback: statusCallbackUrl } : {}),
    };

    if (preferredChannel === 'sms') {
      if (!smsFrom) {
        throw new Error('TWILIO_PHONE_NUMBER is not configured');
      }
      const message = await twilioClient.messages.create({
        from: smsFrom,
        to: toE164,
        ...baseParams,
      });
      return { messageId: message.sid, channel: 'sms' };
    }

    if (!whatsappFrom) {
      throw new Error('TWILIO_WHATSAPP_NUMBER is not configured');
    }

    try {
      const message = await twilioClient.messages.create({
        from: `whatsapp:${whatsappFrom}`,
        to: `whatsapp:${toE164}`,
        ...baseParams,
      });
      return { messageId: message.sid, channel: 'whatsapp' };
    } catch {
      if (!smsFrom) {
        throw new Error('TWILIO_PHONE_NUMBER is not configured for SMS fallback');
      }
      const message = await twilioClient.messages.create({
        from: smsFrom,
        to: toE164,
        ...baseParams,
      });
      return { messageId: message.sid, channel: 'sms' };
    }
  }
}
