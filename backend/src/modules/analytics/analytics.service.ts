import crypto from 'crypto';
import { AppError } from '../../infrastructure/errors';
import { supabaseAdmin } from '../../infrastructure/supabase';
import { isAnalyticsEventName, type AnalyticsEventName } from './events.enum';

export interface AnalyticsEventInput {
  name: AnalyticsEventName;
  properties: Record<string, unknown>;
  timestamp: number;
}

export interface RecordAnalyticsEventsOptions {
  userId: string;
  sessionId?: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  ipHash?: string;
}

/** HMAC-SHA256(userId, ANALYTICS_SALT) — never store raw user UUID in analytics_events. */
export function hashAnalyticsUserId(userId: string): string {
  const salt = process.env.ANALYTICS_SALT;
  if (!salt) {
    throw new AppError('INTERNAL_ERROR', 'ANALYTICS_SALT not configured', 500, undefined, false);
  }
  return crypto.createHmac('sha256', salt).update(userId).digest('hex');
}

export function validateAnalyticsEvents(events: AnalyticsEventInput[]): void {
  for (const event of events) {
    if (!isAnalyticsEventName(event.name)) {
      throw new AppError('VALIDATION_ERROR', `Unknown analytics event: ${event.name}`, 400);
    }
  }
}

/**
 * Batch insert analytics rows. Raw user UUID is hashed into anonymous_id; user_id stays NULL.
 */
export async function recordAnalyticsEvents(
  events: AnalyticsEventInput[],
  options: RecordAnalyticsEventsOptions,
): Promise<number> {
  validateAnalyticsEvents(events);

  const userHash = hashAnalyticsUserId(options.userId);
  const rows = events.map((event) => ({
    user_id: null,
    anonymous_id: userHash,
    session_id: options.sessionId ?? null,
    event_name: event.name,
    properties: event.properties,
    platform: options.platform ?? null,
    app_version: options.appVersion ?? null,
    ip_address: options.ipHash ?? null,
    created_at: new Date(event.timestamp).toISOString(),
  }));

  const { error } = await supabaseAdmin.from('analytics_events').insert(rows);

  if (error) {
    throw new AppError('INTERNAL_ERROR', `Failed to record analytics: ${error.message}`, 500);
  }

  return rows.length;
}
