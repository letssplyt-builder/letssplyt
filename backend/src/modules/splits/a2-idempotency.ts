import type { AiStage } from '@letssplyt/shared/event.types';
import { supabaseAdmin } from '../../infrastructure/supabase';

export class A2IdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'A2IdempotencyError';
  }
}

const CALCULATED_STAGES: AiStage[] = ['calculated', 'messaging', 'complete'];

/**
 * Atomically transition ai_stage to 'calculating' from 'parsed_confirmed'.
 * Receipt must be human-confirmed before A2 runs.
 */
export async function claimCalculatingSlot(eventId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .update({ ai_stage: 'calculating' })
    .eq('id', eventId)
    .eq('ai_stage', 'parsed_confirmed')
    .select('id');

  if (error) {
    throw new A2IdempotencyError(error.message);
  }

  return (data?.length ?? 0) > 0;
}

export async function setAiStage(eventId: string, stage: AiStage): Promise<void> {
  const { error } = await supabaseAdmin.from('events').update({ ai_stage: stage }).eq('id', eventId);

  if (error) {
    throw new Error(`Failed to set ai_stage for event ${eventId}: ${error.message}`);
  }
}

export async function getAiStage(eventId: string): Promise<AiStage> {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('ai_stage')
    .eq('id', eventId)
    .single();

  if (error || !data) {
    throw new Error(`Cannot read ai_stage for event ${eventId}: ${error?.message ?? 'not found'}`);
  }

  return data.ai_stage as AiStage;
}

export function isPastCalculating(stage: AiStage): boolean {
  return CALCULATED_STAGES.includes(stage);
}
