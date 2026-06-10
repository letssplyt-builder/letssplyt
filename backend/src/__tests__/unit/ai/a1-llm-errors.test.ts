import { describe, expect, it } from '@jest/globals';
import { isAiQuotaError, toA1AppError } from '../../../modules/ai/a1-llm-errors';

describe('a1-llm-errors', () => {
  it('detects Gemini quota errors', () => {
    expect(
      isAiQuotaError(
        new Error(
          '[429 Too Many Requests] You exceeded your current quota, please check your plan',
        ),
      ),
    ).toBe(true);
  });

  it('maps quota errors to AI_QUOTA_EXCEEDED without raw SDK text', () => {
    const err = toA1AppError(
      new Error('[429 Too Many Requests] You exceeded your current quota'),
    );
    expect(err.code).toBe('AI_QUOTA_EXCEEDED');
    expect(err.statusCode).toBe(503);
    expect(err.message).not.toContain('googleGenerativeAI');
  });
});
