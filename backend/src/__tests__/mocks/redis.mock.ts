import { jest } from '@jest/globals';

export const mockRedisPing = jest.fn<() => Promise<string>>().mockResolvedValue('PONG');

export const mockGetRedisClient = jest.fn(() => ({
  ping: mockRedisPing,
}));

export function redisMockFactory(): { getRedisClient: typeof mockGetRedisClient } {
  return { getRedisClient: mockGetRedisClient };
}
