import { jest } from '@jest/globals';

export type MockResult = {
  data: unknown;
  error: null | { code: string; message: string };
};

const defaultResult: MockResult = { data: null, error: null };
let mockResult: MockResult = { ...defaultResult };
const tableResults = new Map<string, MockResult>();

type ChainMethod = (...args: unknown[]) => ChainableMock;

function getResultForTable(table: string): MockResult {
  return tableResults.get(table) ?? mockResult;
}

function createChainable(table: string): ChainableMock {
  return {
    select: jest.fn<ChainMethod>().mockReturnThis(),
    eq: jest.fn<ChainMethod>().mockReturnThis(),
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
  };
}

const defaultChainable = createChainable('__default__');

export interface ChainableMock {
  select: jest.Mock<ChainMethod>;
  eq: jest.Mock<ChainMethod>;
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
}

export const mockSupabase = {
  from: jest.fn<(table: string) => ChainableMock>().mockImplementation((table) => createChainable(table)),
  auth: {
    getUser: jest
      .fn<() => Promise<{ data: { user: null }; error: null }>>()
      .mockResolvedValue({ data: { user: null }, error: null }),
    admin: {
      createUser: jest
        .fn<() => Promise<{ data: { user: { id: string } }; error: null }>>()
        .mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      generateLink: jest
        .fn<
          () => Promise<{
            data: { properties: { action_link: string } };
            error: null;
          }>
        >()
        .mockResolvedValue({ data: { properties: { action_link: 'http://test' } }, error: null }),
    },
    setSession: jest
      .fn<() => Promise<{ data: Record<string, never>; error: null }>>()
      .mockResolvedValue({ data: {}, error: null }),
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
  __resetMock: () => {
    mockResult = { ...defaultResult };
    tableResults.clear();
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
