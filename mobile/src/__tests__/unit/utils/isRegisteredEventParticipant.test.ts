import { describe, expect, it } from '@jest/globals';
import { isRegisteredEventParticipant } from '../../../utils/events';

describe('isRegisteredEventParticipant', () => {
  it('returns true when user_id is present', () => {
    expect(isRegisteredEventParticipant('user-1')).toBe(true);
  });

  it('returns false when user_id is null or missing', () => {
    expect(isRegisteredEventParticipant(null)).toBe(false);
    expect(isRegisteredEventParticipant(undefined)).toBe(false);
    expect(isRegisteredEventParticipant('')).toBe(false);
  });
});
