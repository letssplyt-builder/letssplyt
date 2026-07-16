import { AppError } from '../../infrastructure/errors';

export function isAiQuotaError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}

/** Transient model/network failures that should be retried inside A1. */
export function isTransientAiError(err: unknown): boolean {
  if (err instanceof AppError) {
    return false;
  }
  if (isAiQuotaError(err)) {
    return false;
  }
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (
    message.includes('api key') ||
    message.includes('permission') ||
    message.includes('invalid argument')
  ) {
    return false;
  }
  return (
    message.includes('timeout') ||
    message.includes('503') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('unavailable') ||
    message.includes('overloaded') ||
    message.includes('econnreset') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('empty response') ||
    message.includes('blocked') ||
    message.includes('gemini request failed') ||
    message.includes('anthropic request failed') ||
    message.includes('no candidates')
  );
}

/** Map provider SDK failures to operational API errors (no raw SDK dumps to clients). */
export function toA1AppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }

  if (isAiQuotaError(err)) {
    return new AppError(
      'AI_QUOTA_EXCEEDED',
      'Receipt AI is temporarily unavailable (provider quota). Try again later or enter the total manually.',
      503,
    );
  }

  const message = err instanceof Error ? err.message : 'Parse failed';
  return new AppError(
    'PARSE_FAILED',
    'We could not read this receipt. Try again or enter the total manually.',
    500,
    { detail: message },
  );
}
