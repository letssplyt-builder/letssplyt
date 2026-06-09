import { describe, expect, it } from '@jest/globals';
import {
  collectLinkedUserIds,
  resolveLinkedDisplayName,
} from '../../../modules/participants/participant-display-name';

describe('participant-display-name', () => {
  describe('resolveLinkedDisplayName', () => {
    it('returns live user display_name when participant is linked', () => {
      const linkedNames = new Map([['user-b', 'PQR']]);

      expect(
        resolveLinkedDisplayName(
          { user_id: 'user-b', display_name: 'xyz' },
          linkedNames,
        ),
      ).toBe('PQR');
    });

    it('returns participant display_name for guests without user_id', () => {
      const linkedNames = new Map<string, string>();

      expect(
        resolveLinkedDisplayName(
          { user_id: null, display_name: 'Guest Sam' },
          linkedNames,
        ),
      ).toBe('Guest Sam');
    });

    it('falls back to participant display_name when linked user is missing', () => {
      const linkedNames = new Map<string, string>();

      expect(
        resolveLinkedDisplayName(
          { user_id: 'user-b', display_name: 'xyz' },
          linkedNames,
        ),
      ).toBe('xyz');
    });
  });

  describe('collectLinkedUserIds', () => {
    it('returns unique non-null user ids', () => {
      expect(
        collectLinkedUserIds([
          { user_id: 'user-a' },
          { user_id: 'user-b' },
          { user_id: 'user-a' },
          { user_id: null },
        ]),
      ).toEqual(['user-a', 'user-b']);
    });
  });
});
