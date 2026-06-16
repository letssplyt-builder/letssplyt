import { jest } from '@jest/globals';

type TelnyxSendResponse = { data?: { id?: string } };

export const mockTelnyxMessages = {
  send: jest
    .fn<() => Promise<TelnyxSendResponse>>()
    .mockResolvedValue({ data: { id: 'telnyx-msg-test-123' } }),
};

export const mockTelnyxClient = {
  messages: mockTelnyxMessages,
};

export function telnyxMockFactory(): jest.Mock<() => typeof mockTelnyxClient> {
  return jest.fn<() => typeof mockTelnyxClient>().mockImplementation(() => mockTelnyxClient);
}
