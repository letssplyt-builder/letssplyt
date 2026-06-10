import { jest } from '@jest/globals';

type VerificationResult = { sid: string; status: string };
type VerificationCheckResult = { status: string; valid: boolean };
type MessageResult = { sid: string; status: string };

export const mockTwilio = {
  verify: {
    v2: {
      services: jest.fn<() => {
        verifications: { create: jest.Mock<() => Promise<VerificationResult>> };
        verificationChecks: { create: jest.Mock<() => Promise<VerificationCheckResult>> };
      }>().mockReturnValue({
        verifications: {
          create: jest
            .fn<() => Promise<VerificationResult>>()
            .mockResolvedValue({ sid: 'VEtest123', status: 'pending' }),
        },
        verificationChecks: {
          create: jest
            .fn<() => Promise<VerificationCheckResult>>()
            .mockResolvedValue({ status: 'approved', valid: true }),
        },
      }),
    },
  },
  messages: {
    create: jest
      .fn<() => Promise<MessageResult>>()
      .mockResolvedValue({ sid: 'SMtest123', status: 'queued' }),
  },
};

export const mockValidateRequest = jest
  .fn<(authToken: string, signature: string, url: string, params: Record<string, string>) => boolean>()
  .mockReturnValue(true);

export function twilioMockFactory(): jest.Mock<() => typeof mockTwilio> & {
  validateRequest: typeof mockValidateRequest;
} {
  const factory = jest.fn<() => typeof mockTwilio>().mockReturnValue(mockTwilio) as jest.Mock<
    () => typeof mockTwilio
  > & {
    validateRequest: typeof mockValidateRequest;
  };
  factory.validateRequest = mockValidateRequest;
  return factory;
}
