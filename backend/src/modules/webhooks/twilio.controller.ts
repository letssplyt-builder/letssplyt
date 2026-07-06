import type { NextFunction, Request, Response } from 'express';
import {
  handleInboundSmsKeyword,
  INBOUND_REPLY_STOP,
} from '../../infrastructure/notification/messaging-inbound.service';
import { applyDeliveryUpdate } from '../../infrastructure/notification/messaging-delivery.service';
import { validateTwilioWebhook } from '../../infrastructure/twilio-signature';
import { getConfig } from '../../infrastructure/config';

function webhookUrl(req: Request): string {
  const base = getConfig().appUrl;
  return `${base}${req.baseUrl}${req.path}`;
}

function verifyTwilioSignature(req: Request): boolean {
  const signature = req.headers['x-twilio-signature'];
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  return validateTwilioWebhook(signature, webhookUrl(req), req.body as Record<string, string>);
}

function mapDeliveryStatus(messageStatus: string): 'sent' | 'delivered' | 'failed' | 'bounced' {
  if (messageStatus === 'delivered') {
    return 'delivered';
  }
  if (messageStatus === 'failed' || messageStatus === 'undelivered') {
    return 'failed';
  }
  if (messageStatus === 'bounced') {
    return 'bounced';
  }
  return 'sent';
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlMessage(text: string): string {
  return `<Response><Message>${escapeXml(text)}</Message></Response>`;
}

export async function handleTwilioOptOut(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!verifyTwilioSignature(req)) {
      res.status(403).json({ error: 'Invalid Twilio signature' });
      return;
    }

    const from = req.body.From as string | undefined;
    if (!from) {
      res.status(400).send('Missing From');
      return;
    }

    const body = (req.body.Body as string | undefined) ?? 'STOP';
    const action = await handleInboundSmsKeyword(from, body);
    const replyText = action.type === 'none' ? INBOUND_REPLY_STOP : action.replyText;

    res.status(200).type('text/xml').send(twimlMessage(replyText));
  } catch (err) {
    next(err);
  }
}

export async function handleTwilioDelivery(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!verifyTwilioSignature(req)) {
      res.status(403).json({ error: 'Invalid Twilio signature' });
      return;
    }

    const messageSid = req.body.MessageSid as string | undefined;
    const messageStatus = req.body.MessageStatus as string | undefined;

    if (!messageSid || !messageStatus) {
      res.status(400).send('Missing fields');
      return;
    }

    const mappedStatus = mapDeliveryStatus(messageStatus);
    await applyDeliveryUpdate(messageSid, mappedStatus);

    res.status(200).send('');
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Failed to')) {
      res.status(500).send('DB error');
      return;
    }
    next(err);
  }
}
