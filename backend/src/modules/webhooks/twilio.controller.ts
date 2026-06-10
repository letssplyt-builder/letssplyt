import type { NextFunction, Request, Response } from 'express';
import { validateTwilioWebhook } from '../../infrastructure/twilio-signature';
import { hashPhone } from '../../infrastructure/security';
import { supabaseAdmin } from '../../infrastructure/supabase';

function webhookUrl(path: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  return `${base}${path}`;
}

function verifyTwilioSignature(req: Request, path: string): boolean {
  const signature = req.headers['x-twilio-signature'];
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  return validateTwilioWebhook(signature, webhookUrl(path), req.body as Record<string, string>);
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

export async function handleTwilioOptOut(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!verifyTwilioSignature(req, '/api/v1/webhooks/twilio/opt-out')) {
      res.status(403).json({ error: 'Invalid Twilio signature' });
      return;
    }

    const from = req.body.From as string | undefined;
    if (!from) {
      res.status(400).send('Missing From');
      return;
    }

    const phoneHash = hashPhone(from);
    const { error } = await supabaseAdmin.from('sms_opt_outs').upsert(
      {
        phone_hash: phoneHash,
        opt_out_method: 'stop_reply',
      },
      { onConflict: 'phone_hash', ignoreDuplicates: true },
    );

    if (error) {
      res.status(500).send('DB error');
      return;
    }

    res.status(200).type('text/xml').send('<Response></Response>');
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
    if (!verifyTwilioSignature(req, '/api/v1/webhooks/twilio/delivery')) {
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
    const updatePayload: Record<string, unknown> = { status: mappedStatus };
    if (mappedStatus === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString();
    }

    const { error: logError } = await supabaseAdmin
      .from('notification_log')
      .update(updatePayload)
      .eq('twilio_sid', messageSid);

    if (logError) {
      res.status(500).send('DB error');
      return;
    }

    if (mappedStatus === 'failed' || mappedStatus === 'bounced') {
      const { data: logRow } = await supabaseAdmin
        .from('notification_log')
        .select('participant_id')
        .eq('twilio_sid', messageSid)
        .maybeSingle();

      if (logRow?.participant_id) {
        await supabaseAdmin
          .from('participants')
          .update({ message_failed: true })
          .eq('id', logRow.participant_id as string);
      }
    }

    res.status(200).send('');
  } catch (err) {
    next(err);
  }
}
