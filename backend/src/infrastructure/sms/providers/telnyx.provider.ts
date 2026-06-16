import logger from '../../logger';
import { formatPhoneE164 } from '../../security/phone-format';
import { telnyxClient } from '../../telnyx';
import type {
  SendOutboundMessageParams,
  SendOutboundMessageResult,
  SMSProvider,
} from '../types';

let whatsappFallbackWarned = false;

export class TelnyxSMSProvider implements SMSProvider {
  readonly name = 'telnyx' as const;
  private readonly fromNumber: string;

  constructor() {
    const fromNumber = process.env.TELNYX_FROM_NUMBER;
    if (!process.env.TELNYX_API_KEY) {
      throw new Error('TELNYX_API_KEY is not configured');
    }
    if (!fromNumber) {
      throw new Error('TELNYX_FROM_NUMBER is not configured');
    }
    this.fromNumber = fromNumber;
  }

  async sendOutboundMessage(
    params: SendOutboundMessageParams,
  ): Promise<SendOutboundMessageResult> {
    const { toE164, body, preferredChannel, statusCallbackUrl } = params;

    if (preferredChannel === 'whatsapp') {
      if (!whatsappFallbackWarned) {
        logger.warn({
          msg: 'Telnyx does not support WhatsApp outbound; sending SMS instead',
        });
        whatsappFallbackWarned = true;
      }
    }

    // Telnyx delivery webhooks use the Messaging Profile URL in Mission Control — not per-message.
    void statusCallbackUrl;

    try {
      const to = formatPhoneE164(toE164);
      if (!to) {
        throw new Error('Invalid destination phone number for Telnyx SMS');
      }
      const from = formatPhoneE164(this.fromNumber);
      if (!from) {
        throw new Error('TELNYX_FROM_NUMBER is not a valid E.164 phone number');
      }

      const response = await telnyxClient.messages.send({
        from,
        to,
        text: body,
      });

      const messageId = response.data?.id;
      if (!messageId) {
        throw new Error('Telnyx messages.send returned no message id');
      }

      return { messageId, channel: 'sms' };
    } catch (error) {
      logger.error({ msg: 'Telnyx SMS send failed', err: error });
      throw error;
    }
  }
}
