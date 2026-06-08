import { describe, expect, it } from '@jest/globals';
import { ApiRequestError, getApiErrorCode, isApiRequestError } from './api';

describe('api error helpers', () => {
  it('recognises ApiRequestError via instanceof', () => {
    const err = new ApiRequestError('ACCOUNT_NOT_FOUND', 'No account found.', 404);
    expect(isApiRequestError(err)).toBe(true);
    expect(getApiErrorCode(err)).toBe('ACCOUNT_NOT_FOUND');
  });

  it('recognises plain objects that look like ApiRequestError (Metro module boundary)', () => {
    const plain = Object.assign(new Error('No account found.'), {
      name: 'ApiRequestError',
      code: 'ACCOUNT_NOT_FOUND',
      status: 404,
    });
    expect(isApiRequestError(plain)).toBe(true);
    expect(getApiErrorCode(plain)).toBe('ACCOUNT_NOT_FOUND');
  });

  it('returns undefined for non-api errors', () => {
    expect(isApiRequestError(new Error('nope'))).toBe(false);
    expect(getApiErrorCode('string')).toBeUndefined();
  });
});
