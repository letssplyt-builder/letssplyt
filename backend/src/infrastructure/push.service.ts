import Expo, { type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import logger from './logger';
import { supabaseAdmin } from './supabase';

const expo = new Expo();

export type PushDataPayload = Record<string, string>;

async function clearInvalidToken(expoPushToken: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('device_sessions')
    .update({ expo_push_token: null })
    .eq('expo_push_token', expoPushToken);

  if (error) {
    logger.warn({
      msg: 'Failed to clear stale expo push token',
      error: error.message,
    });
  }
}

async function handlePushTickets(tickets: ExpoPushTicket[], tokens: string[]): Promise<void> {
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const token = tokens[i];
    if (!ticket || !token) continue;

    if (ticket.status === 'error') {
      logger.warn({
        msg: 'Expo push ticket error',
        error: ticket.message,
        details: ticket.details,
      });
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await clearInvalidToken(token);
      }
    }
  }
}

async function lookupLatestPushToken(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('device_sessions')
    .select('expo_push_token')
    .eq('user_id', userId)
    .not('expo_push_token', 'is', null)
    .order('last_active_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn({ msg: 'Push token lookup failed', userId, error: error.message });
    return null;
  }

  const token = data?.expo_push_token as string | undefined;
  return token ?? null;
}

/**
 * Sends a push notification to the user's most recently active device.
 * Silently skips when no token, invalid token, or APP_ENV=development (logs only).
 */
export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data: PushDataPayload = {},
): Promise<void> {
  if (process.env.APP_ENV === 'development') {
    logger.info({
      msg: '[DEV] Push notification (not sent)',
      userId,
      title,
      body,
      data,
    });
    return;
  }

  const expoPushToken = await lookupLatestPushToken(userId);
  if (!expoPushToken) {
    return;
  }

  if (!Expo.isExpoPushToken(expoPushToken)) {
    logger.warn({ msg: 'Invalid Expo push token format', userId });
    await clearInvalidToken(expoPushToken);
    return;
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  const chunks = expo.chunkPushNotifications([message]);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      await handlePushTickets(tickets, chunk.map((entry) => entry.to as string));
    } catch (err) {
      logger.warn({
        msg: 'Expo push send failed',
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
