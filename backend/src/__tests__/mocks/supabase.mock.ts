import { jest } from '@jest/globals';

export type MockResult = {
  data: unknown;
  error: null | { code: string; message: string };
};

const defaultResult: MockResult = { data: null, error: null };
let mockResult: MockResult = { ...defaultResult };
const tableResults = new Map<string, MockResult>();
const tableResultQueues = new Map<string, MockResult[]>();

type ChainMethod = (...args: unknown[]) => ChainableMock;

function getResultForTable(table: string): MockResult {
  const queue = tableResultQueues.get(table);
  if (queue && queue.length > 0) {
    return queue.shift()!;
  }
  return tableResults.get(table) ?? mockResult;
}

function createChainable(table: string): ChainableMock {
  const chain: ChainableMock = {
    select: jest.fn<ChainMethod>().mockReturnThis(),
    eq: jest.fn<ChainMethod>().mockReturnThis(),
    lt: jest.fn<ChainMethod>().mockReturnThis(),
    neq: jest.fn<ChainMethod>().mockReturnThis(),
    in: jest.fn<ChainMethod>().mockReturnThis(),
    is: jest.fn<ChainMethod>().mockReturnThis(),
    order: jest.fn<ChainMethod>().mockReturnThis(),
    limit: jest.fn<ChainMethod>().mockReturnThis(),
    maybeSingle: jest
      .fn<() => MockResult>()
      .mockImplementation(() => ({ ...getResultForTable(table) })),
    single: jest
      .fn<() => MockResult>()
      .mockImplementation(() => ({ ...getResultForTable(table) })),
    insert: jest.fn<ChainMethod>().mockReturnThis(),
    update: jest.fn<ChainMethod>().mockReturnThis(),
    upsert: jest.fn<ChainMethod>().mockReturnThis(),
    delete: jest.fn<ChainMethod>().mockReturnThis(),
    rpc: jest
      .fn<() => MockResult>()
      .mockImplementation(() => ({ ...getResultForTable(table) })),
    then: jest
      .fn<
        (
          onFulfilled: (value: MockResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise<unknown>
      >()
      .mockImplementation((onFulfilled, onRejected) =>
        Promise.resolve(getResultForTable(table)).then(onFulfilled, onRejected),
      ),
  };
  return chain;
}

const defaultChainable = createChainable('__default__');

export interface ChainableMock {
  select: jest.Mock<ChainMethod>;
  eq: jest.Mock<ChainMethod>;
  lt: jest.Mock<ChainMethod>;
  neq: jest.Mock<ChainMethod>;
  in: jest.Mock<ChainMethod>;
  is: jest.Mock<ChainMethod>;
  order: jest.Mock<ChainMethod>;
  limit: jest.Mock<ChainMethod>;
  maybeSingle: jest.Mock<() => MockResult>;
  single: jest.Mock<() => MockResult>;
  insert: jest.Mock<ChainMethod>;
  update: jest.Mock<ChainMethod>;
  upsert: jest.Mock<ChainMethod>;
  delete: jest.Mock<ChainMethod>;
  rpc: jest.Mock<() => MockResult>;
  then: jest.Mock<
    (
      onFulfilled: (value: MockResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>
  >;
}

export const mockSupabase = {
  from: jest.fn<(table: string) => ChainableMock>().mockImplementation((table) => createChainable(table)),
  rpc: jest
    .fn<
      (fn: string) => Promise<{ data: unknown; error: null | { code: string; message: string } }>
    >()
    .mockImplementation((fn) => {
      if (fn === 'upsert_user_profile_on_auth') {
        return Promise.resolve({
          data: [{ display_name: 'New User', avatar_colour: '#4F46E5' }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  auth: {
    getUser: jest
      .fn<
        () => Promise<{
          data: { user: { id: string; email?: string } | null };
          error: null | { message: string };
        }>
      >()
      .mockResolvedValue({ data: { user: null }, error: null }),
    admin: {
      listUsers: jest
        .fn<
          () => Promise<{
            data: { users: Array<{ id: string; phone?: string }> };
            error: null;
          }>
        >()
        .mockResolvedValue({ data: { users: [] }, error: null }),
      getUserById: jest
        .fn<
          () => Promise<{
            data: {
              user: {
                id: string;
                email?: string;
                user_metadata?: Record<string, unknown>;
              } | null;
            };
            error: null;
          }>
        >()
        .mockResolvedValue({ data: { user: null }, error: null }),
      updateUserById: jest
        .fn<() => Promise<{ data: { user: { id: string } }; error: null }>>()
        .mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      createUser: jest
        .fn<() => Promise<{ data: { user: { id: string } }; error: null }>>()
        .mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      generateLink: jest
        .fn<
          () => Promise<{
            data: { properties: { hashed_token: string; action_link?: string } };
            error: null;
          }>
        >()
        .mockResolvedValue({
          data: { properties: { hashed_token: 'test-token-hash', action_link: 'http://test' } },
          error: null,
        }),
    },
    verifyOtp: jest
      .fn<
        () => Promise<{
          data: {
            session: {
              access_token: string;
              refresh_token: string;
              expires_in: number;
            };
          };
          error: null;
        }>
      >()
      .mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      }),
    setSession: jest
      .fn<() => Promise<{ data: Record<string, never>; error: null }>>()
      .mockResolvedValue({ data: {}, error: null }),
    signOut: jest
      .fn<() => Promise<{ error: null }>>()
      .mockResolvedValue({ error: null }),
  },
  channel: jest.fn<() => ChainableMock>().mockReturnValue(defaultChainable),
  on: jest.fn<ChainMethod>().mockReturnThis(),
  subscribe: jest.fn<ChainMethod>().mockReturnThis(),
  removeChannel: jest.fn<() => void>(),
  __setMockResult: (result: MockResult) => {
    mockResult = result;
  },
  __setMockResultForTable: (table: string, result: MockResult) => {
    tableResults.set(table, result);
  },
  __pushMockResultForTable: (table: string, result: MockResult) => {
    const queue = tableResultQueues.get(table) ?? [];
    queue.push(result);
    tableResultQueues.set(table, queue);
  },
  __resetMock: () => {
    mockResult = { ...defaultResult };
    tableResults.clear();
    tableResultQueues.clear();
  },
  __mockRLSError: () => {
    mockResult = {
      data: null,
      error: { code: 'PGRST116', message: 'Row not found or RLS policy violation' },
    };
  },
  __mockNetworkError: () => {
    mockResult = {
      data: null,
      error: { code: 'NETWORK_ERROR', message: 'Failed to fetch' },
    };
  },
};

export const createClient = jest.fn<() => typeof mockSupabase>().mockReturnValue(mockSupabase);
export default { createClient };
