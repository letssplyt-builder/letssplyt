import type { NextFunction, Request, Response } from 'express';
import logger from '../../infrastructure/logger';
import {
  applyDeliveryUpdate,
  type MappedDeliveryStatus,
} from '../../infrastructure/notification/messaging-delivery.service';
import { handleInboundSmsKeyword } from '../../infrastructure/notification/messaging-inbound.service';
import { sendOutboundMessage } from '../../infrastructure/notification/outbound-messaging.service';

interface TelnyxPhoneRef {
  phone_number?: string;
  status?: string;
}

interface TelnyxMessagePayload {
  id?: string;
  text?: string;
  from?: TelnyxPhoneRef;
  to?: TelnyxPhoneRef[];
}

interface TelnyxWebhookEvent {
  event_type?: string;
  payload?: TelnyxMessagePayload;
}

function mapTelnyxFinalizedStatus(status: string | undefined): MappedDeliveryStatus | null {
  if (status === 'delivered') {
    return 'delivered';
  }
  if (status === 'delivery_failed' || status === 'sending_failed') {
    return 'failed';
  }
  return null;
}

async function sendTelnyxInboundReply(toE164: string, body: string): Promise<void> {
  try {
    await sendOutboundMessage(toE164, 'sms', body);
  } catch (err) {
    logger.warn({ msg: 'Failed to send Telnyx inbound reply SMS', err });
  }
}

export async function handleTelnyxMessaging(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const event = req.body?.data as TelnyxWebhookEvent | undefined;
    if (!event?.event_type) {
      res.status(200).send('');
      return;
    }

    const payload = event.payload;
    const eventType = event.event_type;

    if (eventType === 'message.finalized' && payload?.id) {
      const telnyxStatus = payload.to?.[0]?.status;
      const mapped = mapTelnyxFinalizedStatus(telnyxStatus);
      if (mapped) {
        await applyDeliveryUpdate(payload.id, mapped);
      }
      res.status(200).send('');
      return;
    }

    if (eventType === 'message.received' && payload?.from?.phone_number) {
      const from = payload.from.phone_number;
      const text = payload.text ?? '';
      const action = await handleInboundSmsKeyword(from, text);

      if (action.type !== 'none') {
        await sendTelnyxInboundReply(from, action.replyText);
      }

      res.status(200).send('');
      return;
    }

    res.status(200).send('');
  } catch (err) {
    next(err);
  }
}
