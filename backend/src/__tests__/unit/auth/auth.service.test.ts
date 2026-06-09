import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { mockSupabase } from '../../mocks/supabase.mock';
import { mockTwilio } from '../../mocks/twilio.mock';
import * as security from '../../../infrastructure/security';
import {
  accountExistsForPhone,
  findAuthUserIdByPhone,
  isPhoneAlreadyRegisteredError,
  phonesMatch,
  resolveUserAfterOtp,
  sendOtp,
  verifyOtpAndCreateSession,
} from '../../../modules/auth/auth.service';
import { upgradeGuestParticipantsToUser } from '../../../modules/participants/participant-link.service';

jest.mock('../../../infrastructure/supabase-auth', () => ({
  createAdminSession: jest.fn(() =>
    Promise.resolve({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    }),
  ),
  internalEmailForUserId: (userId: string) => `${userId}@letssplyt.internal`,
}));

jest.mock('../../../modules/participants/participant-link.service', () => ({
  upgradeGuestParticipantsToUser: jest.fn(() => Promise.resolve()),
}));

const PHONE = '+15005550006';

describe('auth.service OTP verify regressions', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.clearAllMocks();
    process.env.APP_ENV = 'test';
  });

  describe('phonesMatch', () => {
    it('matches E.164 and digits-only phone formats', () => {
      expect(phonesMatch('+15005550006', '15005550006')).toBe(true);
      expect(phonesMatch('+15005550006', '+1 500-555-0006')).toBe(true);
      expect(phonesMatch('+15005550006', '+15005550001')).toBe(false);
    });
  });

  describe('isPhoneAlreadyRegisteredError', () => {
    it('detects Supabase phone collision messages', () => {
      expect(
        isPhoneAlreadyRegisteredError('Phone number already registered by another user'),
      ).toBe(true);
      expect(isPhoneAlreadyRegisteredError('User already registered')).toBe(true);
    });
  });

  describe('resolveUserAfterOtp', () => {
    it('logs in when public.users row exists (register flow)', async () => {
      mockSupabase.__setMockResultForTable('users', {
        data: {
          id: 'user-public-1',
          display_name: 'Alex',
          avatar_colour: '#4F46E5',
        },
        error: null,
      });

      const resolved = await resolveUserAfterOtp(
        PHONE,
        'hash-1',
        'enc-1',
        undefined,
        'register',
      );

      expect(resolved).toEqual({
        userId: 'user-public-1',
        isNewUser: false,
        userDisplayName: 'Alex',
        avatarColour: '#4F46E5',
      });
      expect(upgradeGuestParticipantsToUser).toHaveBeenCalledWith('hash-1', 'user-public-1');
    });

    it('applies web join display_name when public profile still has placeholder name', async () => {
      mockSupabase.__pushMockResultForTable('users', {
        data: {
          id: 'user-public-1',
          display_name: 'LetsSplyt User',
          avatar_colour: '#4F46E5',
        },
        error: null,
      });
      mockSupabase.__pushMockResultForTable('users', {
        data: { display_name: 'Sam Guest' },
        error: null,
      });

      const resolved = await resolveUserAfterOtp(
        PHONE,
        'hash-1',
        'enc-1',
        'Sam Guest',
        'register',
      );

      expect(resolved.userDisplayName).toBe('Sam Guest');
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('logs in on login flow when only auth.users exists (no public profile)', async () => {
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: 'auth-only-1', display_name: 'Jordan', avatar_colour: '#7C3AED' },
        error: null,
      });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [{ id: 'auth-only-1', phone: '15005550006' }] },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'auth-only-1', user_metadata: { display_name: 'Jordan' } } },
        error: null,
      });

      const resolved = await resolveUserAfterOtp(PHONE, 'hash-1', 'enc-1', undefined, 'login');

      expect(resolved.userId).toBe('auth-only-1');
      expect(resolved.isNewUser).toBe(false);
      expect(resolved.userDisplayName).toBe('Jordan');
    });

    it('logs in on register flow when auth user already exists without requiring display_name', async () => {
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', {
        data: { id: 'auth-only-2', display_name: 'Sam', avatar_colour: '#DB2777' },
        error: null,
      });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [{ id: 'auth-only-2', phone: PHONE }] },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'auth-only-2', user_metadata: { display_name: 'Sam' } } },
        error: null,
      });

      const resolved = await resolveUserAfterOtp(
        PHONE,
        'hash-2',
        'enc-2',
        undefined,
        'register',
      );

      expect(resolved.isNewUser).toBe(false);
      expect(resolved.userDisplayName).toBe('Sam');
    });

    it('returns ACCOUNT_NOT_FOUND for login when no auth or public user exists', async () => {
      mockSupabase.__setMockResultForTable('users', { data: null, error: null });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });

      await expect(
        resolveUserAfterOtp(PHONE, 'hash-3', 'enc-3', undefined, 'login'),
      ).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
        statusCode: 404,
        message: 'No account found. Check number and try again.',
      });
    });

    it('returns NAME_REQUIRED for register when user is new and display_name is missing', async () => {
      mockSupabase.__setMockResultForTable('users', { data: null, error: null });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });

      await expect(
        resolveUserAfterOtp(PHONE, 'hash-4', 'enc-4', undefined, 'register'),
      ).rejects.toMatchObject({
        code: 'NAME_REQUIRED',
        statusCode: 400,
      });
    });
  });

  describe('findAuthUserIdByPhone', () => {
    it('finds users when Supabase stores phone without plus prefix', async () => {
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [{ id: 'auth-3', phone: '15005550006' }] },
        error: null,
      });

      await expect(findAuthUserIdByPhone(PHONE)).resolves.toBe('auth-3');
    });
  });

  describe('sendOtp', () => {
    it('rejects login OTP request when no public profile exists', async () => {
      mockSupabase.__setMockResultForTable('users', { data: null, error: null });

      await expect(sendOtp(PHONE, 'sms', 'login')).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
        statusCode: 404,
        message: 'No account found. Check number and try again.',
      });
    });

    it('rejects login when only orphan auth exists (no public profile)', async () => {
      mockSupabase.__setMockResultForTable('users', { data: null, error: null });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [{ id: 'auth-orphan', phone: PHONE }] },
        error: null,
      });

      await expect(sendOtp(PHONE, 'sms', 'login')).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });

    it('returns account_exists true on register when phone already registered', async () => {
      mockSupabase.__setMockResultForTable('users', {
        data: { id: 'user-public-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });

      const result = await sendOtp(PHONE, 'sms', 'register');

      expect(result.sent).toBe(true);
      expect(result.account_exists).toBe(true);
    });
  });

  describe('accountExistsForPhone', () => {
    it('returns true when public.users row exists', async () => {
      mockSupabase.__setMockResultForTable('users', {
        data: { id: 'user-1', display_name: 'A', avatar_colour: '#4F46E5' },
        error: null,
      });

      await expect(accountExistsForPhone(PHONE)).resolves.toBe(true);
    });
  });

  describe('sendOtp with live Twilio', () => {
    it('calls Twilio verifications.create with the normalised phone', async () => {
      process.env.OTP_DEV_BYPASS = 'false';
      process.env.TWILIO_USE_LIVE_VERIFY = 'true';
      mockSupabase.__setMockResultForTable('users', { data: null, error: null });

      await sendOtp('+15005550006', 'sms', 'register');

      const create = mockTwilio.verify.v2.services().verifications.create;
      expect(create).toHaveBeenCalledWith({ to: '+15005550006', channel: 'sms' });
    });
  });

  describe('verifyOtpAndCreateSession', () => {
    it('calls Twilio verificationChecks when dev bypass is disabled', async () => {
      process.env.OTP_DEV_BYPASS = 'false';
      process.env.TWILIO_USE_LIVE_VERIFY = 'true';
      mockSupabase.__setMockResultForTable('users', {
        data: { id: 'user-public-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'user-public-1', email: 'user-public-1@letssplyt.internal' } },
        error: null,
      });

      await verifyOtpAndCreateSession('+15005550006', '123456', undefined, 'login');

      const checks = mockTwilio.verify.v2.services().verificationChecks.create;
      expect(checks).toHaveBeenCalledWith({ to: '+15005550006', code: '123456' });
    });

    it('throws INVALID_CODE when Twilio does not approve the code', async () => {
      process.env.OTP_DEV_BYPASS = 'false';
      process.env.TWILIO_USE_LIVE_VERIFY = 'true';
      const checks = mockTwilio.verify.v2.services().verificationChecks.create;
      checks.mockResolvedValueOnce({ status: 'pending', valid: false });

      await expect(
        verifyOtpAndCreateSession('+15005550006', '000000', undefined, 'login'),
      ).rejects.toMatchObject({ code: 'INVALID_CODE', statusCode: 400 });
    });

    it('hashes and encrypts phone before creating a new user profile', async () => {
      const hashSpy = jest.spyOn(security, 'hashPhone');
      const encryptSpy = jest.spyOn(security, 'encryptPhone');
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', {
        data: { display_name: 'New User', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });
      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'new-user-id' } },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'new-user-id', email: 'new-user-id@letssplyt.internal' } },
        error: null,
      });

      await verifyOtpAndCreateSession('+12025559999', '123456', 'New User', 'register');

      expect(hashSpy).toHaveBeenCalledWith('+12025559999');
      expect(encryptSpy).toHaveBeenCalledWith('+12025559999');
      hashSpy.mockRestore();
      encryptSpy.mockRestore();
    });

    it('calls upsert_user_profile_on_auth RPC for new registrations', async () => {
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', {
        data: { display_name: 'New User', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });
      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'rpc-user-1' } },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'rpc-user-1', email: 'rpc-user-1@letssplyt.internal' } },
        error: null,
      });

      await verifyOtpAndCreateSession('+12025558888', '123456', 'New User', 'register');

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'upsert_user_profile_on_auth',
        expect.objectContaining({
          p_user_id: 'rpc-user-1',
          p_display_name: 'New User',
        }),
      );
    });

    it('returns AUTH_PROFILE_CREATION_FAILED when RPC and direct upsert both fail', async () => {
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });
      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'fail-user-1' } },
        error: null,
      });
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy' },
      });
      const chain = mockSupabase.from('users');
      chain.single.mockImplementationOnce(() => ({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy' },
      }));

      await expect(
        verifyOtpAndCreateSession('+12025557777', '123456', 'Fail User', 'register'),
      ).rejects.toMatchObject({
        code: 'AUTH_PROFILE_CREATION_FAILED',
        statusCode: 500,
      });
    });

    it('returns the same user.id on second verify for the same phone', async () => {
      mockSupabase.__setMockResultForTable('users', {
        data: { id: 'stable-user', display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValue({
        data: { user: { id: 'stable-user', email: 'stable-user@letssplyt.internal' } },
        error: null,
      });

      const first = await verifyOtpAndCreateSession('+15005550006', '123456', undefined, 'login');
      const second = await verifyOtpAndCreateSession('+15005550006', '654321', undefined, 'login');

      expect(second.user.id).toBe(first.user.id);
      expect(second.user.is_new_user).toBe(false);
    });

    it('never includes phone fields in the session response', async () => {
      mockSupabase.__setMockResultForTable('users', {
        data: { id: 'user-public-1', display_name: 'Alex', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'user-public-1', email: 'user-public-1@letssplyt.internal' } },
        error: null,
      });

      const session = await verifyOtpAndCreateSession('+15005550006', '123456', undefined, 'login');

      expect(session).not.toHaveProperty('phone_e164');
      expect(session).not.toHaveProperty('phone_hash');
      expect(session.user).not.toHaveProperty('phone_e164');
    });

    it('creates a session for a brand-new register user with display_name', async () => {
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', {
        data: { display_name: 'New User', avatar_colour: '#4F46E5' },
        error: null,
      });
      mockSupabase.auth.admin.listUsers.mockResolvedValueOnce({
        data: { users: [] },
        error: null,
      });
      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'new-user-id' } },
        error: null,
      });

      const session = await verifyOtpAndCreateSession(
        '+12025559999',
        '123456',
        'New User',
        'register',
      );

      expect(session.access_token).toBe('access-token');
      expect(session.user.id).toBe('new-user-id');
      expect(session.user.display_name).toBe('New User');
      expect(session.user.is_new_user).toBe(true);
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalled();
    });

    it('returns a session for login without display_name when auth user exists', async () => {
      mockSupabase.auth.admin.listUsers.mockReset();
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.__pushMockResultForTable('users', { data: null, error: null });
      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'auth-login-1', phone: PHONE }] },
        error: null,
      });
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { id: 'auth-login-1', user_metadata: { display_name: 'Pawan' } } },
        error: null,
      });

      const session = await verifyOtpAndCreateSession(PHONE, '123456', undefined, 'login');

      expect(session.access_token).toBe('access-token');
      expect(session.user.id).toBe('auth-login-1');
      expect(session.user.is_new_user).toBe(false);
    });
  });
});
