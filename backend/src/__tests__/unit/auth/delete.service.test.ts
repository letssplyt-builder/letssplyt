import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import {
  assertAccountDeletionAllowed,
  deleteUserAccount,
} from '../../../modules/profile/delete-account.service';

jest.mock('../../../modules/profile/balance.service', () => ({
  getUserBalance: jest.fn(),
}));

import { getUserBalance } from '../../../modules/profile/balance.service';

const USER_ID = 'delete-user-1111-1111-1111-111111111111';
const mockGetUserBalance = jest.mocked(getUserBalance);

function getUsersUpdatePayloads(): Array<Record<string, unknown>> {
  const payloads: Array<Record<string, unknown>> = [];
  for (let i = 0; i < mockSupabase.from.mock.calls.length; i += 1) {
    const table = mockSupabase.from.mock.calls[i]?.[0];
    if (table !== 'users') continue;
    const chain = mockSupabase.from.mock.results[i]!.value as { update: jest.Mock };
    for (const call of chain.update.mock.calls) {
      payloads.push(call[0] as Record<string, unknown>);
    }
  }
  return payloads;
}

function mockDeleteTables(usersQueue?: Array<{ data: unknown; error: null | { code: string; message: string } }>) {
  mockSupabase.__setMockResultForTable('user_payment_handles', { data: null, error: null });
  mockSupabase.__setMockResultForTable('participants', { data: [], error: null });
  if (usersQueue) {
    for (const result of usersQueue) {
      mockSupabase.__pushMockResultForTable('users', result);
    }
  } else {
    mockSupabase.__pushMockResultForTable('users', { data: [{ id: USER_ID }], error: null });
  }
  mockSupabase.__setMockResultForTable('device_sessions', { data: null, error: null });
  mockSupabase.__setMockResultForTable('user_notifications', { data: null, error: null });
}

describe('delete-account.service', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    mockGetUserBalance.mockResolvedValue({
      net_balance: 0,
      currency: 'USD',
      owed_to_you: 0,
      you_owe: 0,
    });
  });

  describe('assertAccountDeletionAllowed', () => {
    it('throws OUTSTANDING_BALANCE when you_owe is greater than zero', async () => {
      mockGetUserBalance.mockResolvedValue({
        net_balance: -2500,
        currency: 'USD',
        owed_to_you: 0,
        you_owe: 2500,
      });

      await expect(assertAccountDeletionAllowed(USER_ID)).rejects.toMatchObject({
        code: 'OUTSTANDING_BALANCE',
        statusCode: 409,
      });
    });
  });

  describe('deleteUserAccount', () => {
    it('deletes all payment handles', async () => {
      mockDeleteTables();

      await deleteUserAccount(USER_ID);

      const fromCalls = mockSupabase.from.mock.calls.map((call) => call[0]);
      expect(fromCalls).toContain('user_payment_handles');
    });

    it('wipes phone_encrypted (sets to NULL when allowed)', async () => {
      mockDeleteTables();

      await deleteUserAccount(USER_ID);

      const payloads = getUsersUpdatePayloads();
      expect(payloads[0]?.phone_encrypted).toBeNull();
    });

    it('falls back to DELETED tombstone when phone_encrypted cannot be NULL', async () => {
      mockDeleteTables([
        {
          data: [],
          error: {
            code: '23502',
            message: 'null value in column phone_encrypted violates not-null constraint',
          },
        },
        { data: [{ id: USER_ID }], error: null },
      ]);

      await deleteUserAccount(USER_ID);

      const payloads = getUsersUpdatePayloads();
      expect(payloads.length).toBe(2);
      expect(payloads[1]?.phone_encrypted).toBe('DELETED');
    });

    it('falls back to DELETED tombstone when NULL update matches zero rows', async () => {
      mockDeleteTables([
        { data: [], error: null },
        { data: [{ id: USER_ID }], error: null },
      ]);

      await deleteUserAccount(USER_ID);

      const payloads = getUsersUpdatePayloads();
      expect(payloads.length).toBe(2);
      expect(payloads[1]).toMatchObject({ phone_encrypted: 'DELETED' });
    });

    it('retries without name_encrypted when column is missing from schema', async () => {
      mockDeleteTables([
        {
          data: [],
          error: {
            code: 'PGRST204',
            message: "Could not find the 'name_encrypted' column of 'users' in the schema cache",
          },
        },
        {
          data: [],
          error: {
            code: 'PGRST204',
            message: "Could not find the 'name_encrypted' column of 'users' in the schema cache",
          },
        },
        { data: [{ id: USER_ID }], error: null },
      ]);

      await deleteUserAccount(USER_ID);

      const payloads = getUsersUpdatePayloads();
      expect(payloads.length).toBe(3);
      expect(payloads[2]).toMatchObject({
        phone_encrypted: null,
        display_name: 'Deleted User',
      });
      expect(payloads[2]).not.toHaveProperty('name_encrypted');
    });

    it('sets phone_hash to DELETED tombstone prefix', async () => {
      mockDeleteTables();

      await deleteUserAccount(USER_ID);

      const usersIndex = mockSupabase.from.mock.calls.findIndex((call) => call[0] === 'users');
      const chain = mockSupabase.from.mock.results[usersIndex]!.value as { update: jest.Mock };
      const updatePayload = chain.update.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(String(updatePayload.phone_hash)).toMatch(/^DELETED-[a-f0-9]{32}$/);
    });

    it('sets display_name to Deleted User', async () => {
      mockDeleteTables();

      await deleteUserAccount(USER_ID);

      const usersIndex = mockSupabase.from.mock.calls.findIndex((call) => call[0] === 'users');
      const chain = mockSupabase.from.mock.results[usersIndex]!.value as { update: jest.Mock };
      const updatePayload = chain.update.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(updatePayload.display_name).toBe('Deleted User');
      expect(updatePayload.deleted_at).toBeTruthy();
    });

    it('deletes device_sessions', async () => {
      mockDeleteTables();

      await deleteUserAccount(USER_ID);

      const fromCalls = mockSupabase.from.mock.calls.map((call) => call[0]);
      expect(fromCalls).toContain('device_sessions');
    });

    it('calls supabase admin deleteUser', async () => {
      mockDeleteTables();

      await deleteUserAccount(USER_ID);

      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith(USER_ID);
    });
  });
});
