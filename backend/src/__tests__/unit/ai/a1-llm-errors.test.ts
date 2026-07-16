import { describe, expect, it } from '@jest/globals';
import { isTransientAiError } from '../../../modules/ai/a1-llm-errors';
import { AppError } from '../../../infrastructure/errors';

describe('isTransientAiError', () => {
  it('treats timeouts and overloaded responses as transient', () => {
    expect(isTransientAiError(new Error('Gemini timeout'))).toBe(true);
    expect(isTransientAiError(new Error('model is overloaded'))).toBe(true);
    expect(isTransientAiError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isTransientAiError(new Error('Empty or blocked Gemini response'))).toBe(true);
  });

  it('does not treat AppError or quota errors as transient', () => {
    expect(isTransientAiError(new AppError('RECEIPT_UNREADABLE', 'blurry', 400))).toBe(false);
    expect(isTransientAiError(new Error('429 quota exceeded'))).toBe(false);
    expect(isTransientAiError(new Error('API key invalid'))).toBe(false);
  });
});
