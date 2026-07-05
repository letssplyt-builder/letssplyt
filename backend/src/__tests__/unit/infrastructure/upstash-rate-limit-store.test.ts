import { describe, expect, it, jest } from '@jest/globals';
import { UpstashRateLimitStore } from '../../../infrastructure/upstash-rate-limit-store';

const mockIncr = jest.fn<() => Promise<number>>();
const mockExpire = jest.fn<() => Promise<number>>();
const mockPttl = jest.fn<() => Promise<number>>();
const mockDecr = jest.fn<() => Promise<number>>();
const mockDel = jest.fn<() => Promise<number>>();

jest.mock('../../../infrastructure/redis', () => ({
  getRedisClient: jest.fn(() => ({
    incr: mockIncr,
    expire: mockExpire,
    pttl: mockPttl,
    decr: mockDecr,
    del: mockDel,
  })),
}));

describe('UpstashRateLimitStore', () => {
  it('increments key and sets expiry on first hit', async () => {
    mockIncr.mockResolvedValueOnce(1);
    mockExpire.mockResolvedValueOnce(1);
    mockPttl.mockResolvedValueOnce(60_000);

    const store = new UpstashRateLimitStore('test', 60_000);
    const result = await store.increment('203.0.113.1');

    expect(mockIncr).toHaveBeenCalledWith('ratelimit:test:203.0.113.1');
    expect(mockExpire).toHaveBeenCalledWith('ratelimit:test:203.0.113.1', 60);
    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
  });
});
