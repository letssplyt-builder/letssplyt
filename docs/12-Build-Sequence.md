# LetsSplyt — Build Sequence & Testing Framework
**Version:** 1.0 | **Date:** June 2026
**Purpose:** The daily working document for building LetsSplyt block by block. Each story is one Cursor session. Do not start a story until its dependencies are complete and acceptance criteria verified.

---

## How to Use This Document

This document is your daily build companion. Each of the 46 stories in this document maps to a single Cursor session. Here is the exact workflow for every story, without exception.

First, confirm that all dependencies listed at the top of the epic are fully complete — meaning you have verified every acceptance criterion in those stories on your phone or in your terminal. Do not skip this check. A broken foundation cascades into hours of debugging later.

Open Cursor Composer and paste the story's Prompt verbatim. Do not paraphrase it. The prompts were written with deliberate precision about file names, function signatures, environment variable names, and architectural constraints. Changing the wording changes what gets built.

Let Cursor finish before you touch anything. Read the generated code before accepting it — check that the file names match what is listed in "Files created," that no hardcoded secrets appear, and that no raw phone numbers are stored or logged.

Then verify every acceptance criterion, in order, on your actual phone using Expo Go (for mobile stories) or in your terminal using curl (for backend stories). Do not mark a criterion done until you have personally seen the correct behaviour. "It looks right in the code" is not verification.

Run the specified tests with `npm test` or the relevant `npm run test:unit` / `npm run test:integration` script. All tests must pass before the story is marked done. If a test fails, fix the code before moving on — failing tests are a signal, not a formality.

Only after all acceptance criteria are verified and all tests pass, mark the story complete in your task tracker and move to the next story. Starting the next story before the current one is fully verified is the most common cause of wasted build time in solo projects.

**After each confirmed story:** Cursor commits all changed files to git with message `E##-S##: [story name]` and pushes to `origin main`. Do not confirm a story done until all its tests pass — committing broken code means the next story starts from a broken base.

**When uncertain, stop.** If anything in a story's requirements is ambiguous, not fully specified by the referenced documentation, or if two docs appear to contradict each other — STOP before writing any code. Do not guess. Do not invent a solution to fill the gap. State clearly what is unclear and ask Pawan for clarification. This is especially critical for financial arithmetic (`splitCalculator.ts`), PII handling (`crypto.ts`, `sanitize.ts`), and all security-related code, where a confident wrong answer is worse than asking.

---

## Testing Philosophy

Automated tests in LetsSplyt exist alongside manual testing on Expo Go, not instead of it. They serve different purposes and catch different classes of bugs.

Manual testing on Expo Go catches UX problems — a button that is hard to tap, a screen that flickers, a flow that feels wrong. No automated test can replace actually using the app on a phone. Every acceptance criterion that says "on Expo Go" must be verified by a human.

Automated tests catch correctness problems that are invisible during casual use. There are four categories.

Unit tests catch logic errors in isolated functions. The `splitCalculator` and `largestRemainderRound` functions are pure TypeScript that process money — a bug here means real users send wrong amounts to real people. Encryption and decryption utilities protect PII — a bug here means a data breach. AI prompt safety functions prevent injection attacks. These are tested in isolation, without network calls, without databases, and without UI.

Integration tests catch API contract breaks between the mobile app and the backend. They use `supertest` to send real HTTP requests to the Express app and assert on response shapes, status codes, and database side effects. When you change an endpoint's response format, integration tests tell you immediately that the mobile app will break.

RLS (Row Level Security) tests catch security holes in the database. They create real Supabase clients authenticated as different test users and assert that User A cannot read User B's data, that anon clients cannot read events, and that financial fields cannot be written by the mobile client. These tests run against a local Supabase instance (`supabase start`). A passing RLS test suite means the database is enforcing its own security guarantees.

Coverage thresholds — 80% line coverage for backend, 70% for mobile — are minimums, not targets. Hitting exactly 80% and stopping is fine. Chasing 100% coverage is a trap that incentivises testing trivial code instead of critical code.

Write tests first for critical financial logic: `splitCalculator`, `largestRemainderRound`, `encrypt`, `decrypt`, and `hashPhone`. These are the functions where a silent bug causes real money errors. Write tests after for everything else — route handlers, store actions, screen rendering. Tests run automatically on every push via GitHub Actions, so any regression is caught before it reaches the main branch.

---

## Testing Infrastructure

### Backend Testing Stack

**Libraries to install:**
```bash
cd backend
npm install --save-dev jest ts-jest @types/jest supertest @types/supertest
```

**`backend/jest.config.ts`:**
```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 70,
      functions: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['./src/__tests__/setup.ts'],
  moduleNameMapper: {
    '@letssplyt/shared/(.*)': '<rootDir>/../shared/types/$1',
  },
};

export default config;
```

**`backend/src/__tests__/setup.ts`:**
```typescript
import { jest } from '@jest/globals';

// Mock Doppler / process.env — all secrets pre-set for tests
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';
process.env.SUPABASE_SECRET_KEY = 'test-service-role-key';
process.env.PHONE_ENCRYPTION_KEY = 'test-encryption-key-32-bytes-here';
process.env.PII_HMAC_SALT = 'test-pii-hmac-salt-for-testing-only';
process.env.HANDLE_ENCRYPTION_KEY = 'test-handle-encryption-key-32b!!';
process.env.TWILIO_ACCOUNT_SID = 'ACtest';
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest';
process.env.AI_PROVIDER_A1 = 'gemini';
process.env.AI_MODEL_A1 = 'gemini-2.5-flash';
process.env.AI_PROVIDER_A2 = 'gemini';
process.env.AI_MODEL_A2 = 'gemini-2.5-flash';
process.env.AI_PROVIDER_A3 = 'gemini';
process.env.AI_MODEL_A3 = 'gemini-2.5-flash';
process.env.APP_DOMAIN = 'http://localhost:3000';
process.env.PORT = '3001';

// Mock Twilio
jest.mock('twilio', () => require('./__mocks__/twilio.mock').twilioMockFactory());

// Mock Supabase
jest.mock('@supabase/supabase-js', () => require('./__mocks__/supabase.mock'));

// Mock LLM factory
jest.mock('../infrastructure/llm/factory', () =>
  require('./__mocks__/llm.mock'),
);

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

**`backend/src/__tests__/mocks/supabase.mock.ts`:**
```typescript
/**
 * Chainable Supabase mock that supports:
 *   .from('table').select('*').eq('id', id).single()
 *   .from('table').insert({ ... }).select().single()
 *   .from('table').update({ ... }).eq('id', id)
 * Can simulate RLS errors (code: 'PGRST116') and network errors per test.
 */

type MockResult = { data: unknown; error: null | { code: string; message: string } };

const defaultResult: MockResult = { data: null, error: null };
let mockResult: MockResult = { ...defaultResult };
let mockCount: number | null = null;

const chainable = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockImplementation(() => ({ ...mockResult })),
  single: jest.fn().mockImplementation(() => ({ ...mockResult })),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockImplementation(() => ({ ...mockResult })),
};

export const mockSupabase = {
  from: jest.fn().mockReturnValue(chainable),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    admin: {
      createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      generateLink: jest.fn().mockResolvedValue({ data: { properties: { action_link: 'http://test' } }, error: null }),
    },
    setSession: jest.fn().mockResolvedValue({ data: {}, error: null }),
  },
  channel: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  removeChannel: jest.fn(),
  // Test helpers — call these in your tests to configure return values
  __setMockResult: (result: MockResult) => { mockResult = result; },
  __setMockCount: (count: number) => { mockCount = count; },
  __resetMock: () => { mockResult = { ...defaultResult }; mockCount = null; },
  // Simulate RLS violation
  __mockRLSError: () => {
    mockResult = {
      data: null,
      error: { code: 'PGRST116', message: 'Row not found or RLS policy violation' },
    };
  },
  // Simulate network error
  __mockNetworkError: () => {
    mockResult = {
      data: null,
      error: { code: 'NETWORK_ERROR', message: 'Failed to fetch' },
    };
  },
};

// Support both named and default export patterns
export const createClient = jest.fn().mockReturnValue(mockSupabase);
export default { createClient };
```

**`backend/src/__tests__/mocks/twilio.mock.ts`:**
```typescript
/**
 * Twilio mock — covers Verify (OTP), Programmable Messaging (SMS/WhatsApp).
 * Override per test:
 *   mockTwilio.verify.v2.services().verificationChecks.create.mockResolvedValueOnce({ status: 'pending' })
 */

export const mockTwilio = {
  verify: {
    v2: {
      services: jest.fn().mockReturnValue({
        verifications: {
          create: jest.fn().mockResolvedValue({ sid: 'VEtest123', status: 'pending' }),
        },
        verificationChecks: {
          create: jest.fn().mockResolvedValue({ status: 'approved' }),
        },
      }),
    },
  },
  messages: {
    create: jest.fn().mockResolvedValue({ sid: 'SMtest123', status: 'queued' }),
  },
};

export function twilioMockFactory() {
  return jest.fn().mockReturnValue(mockTwilio);
}
```

**`backend/src/__tests__/mocks/llm.mock.ts`:**
```typescript
/**
 * LLM factory mock — returns a predictable MockLLMProvider.
 * Default response is a valid ReceiptParseResult JSON.
 * Override per test:
 *   mockLLMProvider.complete.mockResolvedValueOnce({ text: '{"error":"unreadable","reason":"blurry"}', usage: {...}, modelUsed: 'mock' })
 */

export const mockLLMProvider = {
  supportsVision: true,
  complete: jest.fn().mockResolvedValue({
    text: JSON.stringify({
      items: [
        { id: '00000000-0000-0000-0000-000000000001', name: 'Test Item', price: 10.00, quantity: 1, confidence: 0.95 },
      ],
      subtotal: 10.00,
      tax: 1.00,
      tip: 2.00,
      total: 13.00,
      currency: 'USD',
      parse_confidence: 0.95,
    }),
    usage: { inputTokens: 100, outputTokens: 50 },
    modelUsed: 'mock-model',
  }),
};

export const createLLMProvider = jest.fn().mockReturnValue(mockLLMProvider);
```

**`backend/package.json` scripts:**
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn src/server.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:rls": "jest --testPathPattern=rls",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  }
}
```

### Mobile Testing Stack

```bash
cd mobile
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
npm install --save-dev @testing-library/user-event react-test-renderer
```

**`mobile/jest.config.ts`:**
```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'react-native',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    './src/__tests__/setup.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@unimodules|unimodules|sentry-expo|native-base|@react-navigation|react-navigation|@letssplyt)/)',
  ],
  moduleNameMapper: {
    '@letssplyt/shared/(.*)': '<rootDir>/../shared/types/$1',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/__tests__/mocks/fileMock.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      branches: 60,
    },
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};

export default config;
```

**`mobile/src/__tests__/setup.ts`:**
```typescript
import '@testing-library/jest-native/extend-expect';

// Mock expo-camera
jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn().mockReturnValue([{ granted: true }, jest.fn()]),
  CameraView: 'CameraView',
}));

// Mock expo-secure-store (in-memory Map so tests can read/write)
const secureStoreMap = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(secureStoreMap.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    secureStoreMap.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    secureStoreMap.delete(key);
    return Promise.resolve();
  }),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  setNotificationHandler: jest.fn(),
}));

// Mock Supabase — mobile should never hit real Supabase in unit tests
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

// Spy on fetch for API calls
global.fetch = jest.fn();

// Clear the in-memory store and mocks between tests
beforeEach(() => {
  secureStoreMap.clear();
  jest.clearAllMocks();
});
```

**`mobile/package.json` scripts:**
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

### Database (RLS) Testing

```typescript
// backend/src/__tests__/rls/rls-test-helpers.ts
/**
 * Creates Supabase clients authenticated as specific test users.
 * Requires local Supabase running: `supabase start`
 * Uses the seed.sql test users (see E02-S02).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? 'test-anon-key';
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY ?? 'test-service-role-key';

// Known test user IDs from seed.sql
export const TEST_USER_A = '00000000-0000-0000-0000-000000000001'; // Alex (payer)
export const TEST_USER_B = '00000000-0000-0000-0000-000000000002'; // Jordan (participant)
export const TEST_USER_C = '00000000-0000-0000-0000-000000000003'; // Sam (not in active event)
export const TEST_EVENT_ACTIVE = '20000000-0000-0000-0000-000000000002';
export const TEST_EVENT_SETTLED = '20000000-0000-0000-0000-000000000001';

// generateLink requires email — LetsSplyt users are phone-only. createSession works with just userId.

/**
 * Creates a Supabase client authenticated as a specific user.
 * Uses a signed JWT generated for the test user via the service role.
 */
// rls-test-helpers.ts — correct pattern for phone-only users
async function createClientAsUser(userId: string): Promise<SupabaseClient> {
  // Use createSession (available in supabase-js v2) to get a session for a user by ID
  const { data: { session }, error } = await supabaseAdmin.auth.admin.createSession({
    userId,           // The user's UUID from auth.users
    expiresIn: 3600,  // 1 hour — plenty for tests
  });
  if (error || !session) throw new Error(`Could not create test session: ${error?.message}`);
  
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return client;
}
export { createClientAsUser };

export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY);
}

export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}
```

### Coverage Reporting

```yaml
# .github/workflows/coverage.yml snippet
- name: Upload backend coverage
  uses: codecov/codecov-action@v4
  with:
    directory: ./backend/coverage
    flags: backend
    token: ${{ secrets.CODECOV_TOKEN }}

- name: Upload mobile coverage
  uses: codecov/codecov-action@v4
  with:
    directory: ./mobile/coverage
    flags: mobile
    token: ${{ secrets.CODECOV_TOKEN }}
```

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install root dependencies
        run: npm ci

      - name: Install backend dependencies
        run: cd backend && npm ci

      - name: Install mobile dependencies
        run: cd mobile && npm ci

      - name: Lint backend
        run: cd backend && npm run lint

      - name: Lint mobile
        run: cd mobile && npm run lint

      - name: Typecheck shared
        run: cd shared && npx tsc --noEmit

      - name: Typecheck backend
        run: cd backend && npm run typecheck

      - name: Typecheck mobile
        run: cd mobile && npm run typecheck

  backend-tests:
    runs-on: ubuntu-latest
    needs: lint-typecheck
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start local Supabase
        run: supabase start

      - name: Wait for Supabase to be ready
        run: supabase status

      - name: Install backend dependencies
        run: cd backend && npm ci

      - name: Run backend tests with coverage
        run: cd backend && npm run test:coverage
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_PUBLISHABLE_KEY: ${{ env.SUPABASE_ANON_KEY }}
          SUPABASE_SECRET_KEY: ${{ env.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Upload backend coverage
        uses: codecov/codecov-action@v4
        with:
          directory: ./backend/coverage
          flags: backend
          token: ${{ secrets.CODECOV_TOKEN }}

  mobile-tests:
    runs-on: ubuntu-latest
    needs: lint-typecheck
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install mobile dependencies
        run: cd mobile && npm ci

      - name: Run mobile tests with coverage
        run: cd mobile && npm run test:coverage

      - name: Upload mobile coverage
        uses: codecov/codecov-action@v4
        with:
          directory: ./mobile/coverage
          flags: mobile
          token: ${{ secrets.CODECOV_TOKEN }}
```

---

## Epic Dependency Map

```
TIER 1 — FOUNDATION (must build first, everything depends on this)
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ E01: Infra &    │   │ E02: Database   │   │ E03: Auth       │
│ Security Layer  │──▶│ Schema & RLS    │──▶│ (OTP + Session) │
└─────────────────┘   └─────────────────┘   └─────────────────┘
                                                      │
TIER 2 — CORE CREATOR FLOW (build left to right)      ▼
                              ┌─────────────────────────────┐
                              │ E04: Profile & Handles      │
                              └──────────────┬──────────────┘
                                             ▼
                              ┌─────────────────────────────┐
                              │ E05: Event Creation & QR    │
                              └──────────────┬──────────────┘
                                             ▼
              ┌──────────────────────────────┤
              ▼                              ▼
┌─────────────────┐              ┌─────────────────────────────┐
│ E06: Join Flows │              │ E07: AI Receipt Pipeline    │
│ (Web + App)     │              │ (A1 + A2 + Calculator)      │
└─────────────────┘              └──────────────┬──────────────┘
                                                ▼
                              ┌─────────────────────────────┐
                              │ E08: Message System         │
                              │ (A3 + Twilio Send)          │
                              └──────────────┬──────────────┘
                                             ▼
                              ┌─────────────────────────────┐
                              │ E09: Settlement Tracking    │
                              └─────────────────────────────┘

TIER 3 — OPERATIONS (build after core flow is working)
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ E10: Background │   │ E11: Account    │   │ E12: Analytics, │
│ Jobs & Push     │   │ Management      │   │ Monitoring &    │
│ Notifications   │   │                 │   │ Launch Ready    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## EPIC 1 — Infrastructure & Security Foundation
**Depends on:** Nothing — build first
**Delivers:** Working monorepo skeleton with all middleware, security utilities, and test infrastructure in place
**Before starting:** The project has been scaffolded and an empty git repository exists

### E01-S01 — Monorepo Scaffold + TypeScript Config

**Description:** Create the complete monorepo structure with correct package.json workspaces, tsconfig path aliases, and shared types package. This is the foundation everything imports from. No application code is written in this story — only the project structure.

**Prompt:**
*"Scaffold the complete LetsSplyt monorepo. Create: (1) Root package.json with name: 'letssplyt-monorepo', workspaces: ['mobile', 'backend', 'shared'], and scripts: { 'test': 'npm run test --workspaces', 'lint': 'npm run lint --workspaces --if-present', 'typecheck': 'npm run typecheck --workspaces --if-present' }. (2) Root tsconfig.base.json with compilerOptions: { strict: true, esModuleInterop: true, skipLibCheck: true, resolveJsonModule: true, target: 'ES2022', module: 'commonjs' } and paths: { '@letssplyt/shared/*': ['./shared/types/*'] }. (3) shared/package.json with name: '@letssplyt/shared', version: '1.0.0', main: './types/index.ts', types: './types/index.ts'. (4) shared/types/index.ts that re-exports everything from all type files. (5) shared/types/ directory with empty but correctly typed files: auth.types.ts (export type placeholder), event.types.ts, participant.types.ts, receipt.types.ts, settlement.types.ts, api.types.ts — each with a comment placeholder and one empty export type to avoid TypeScript empty module errors. (6) backend/package.json with name: 'letssplyt-backend', dependencies: { express: '^4.18', '@supabase/supabase-js': '^2', twilio: '^5', '@upstash/qstash': '^2', zod: '^3', bcryptjs: '^2', libphonenumber-js: '^1', sharp: '^0.33', pino: '^9' }, devDependencies: { jest: '^29', 'ts-jest': '^29', '@types/jest': '^29', supertest: '^7', '@types/supertest': '^6', typescript: '^5', 'ts-node-dev': '^2', '@types/express': '^4', '@types/bcryptjs': '^2', '@types/node': '^22' }. (7) backend/tsconfig.json extending '../../tsconfig.base.json' with outDir: 'dist', rootDir: 'src', references: [{ path: '../../shared' }]. (8) mobile/package.json with name: 'letssplyt-mobile', dependencies matching a standard Expo SDK 51 project plus: zustand, @react-navigation/native, @react-navigation/native-stack, @react-navigation/bottom-tabs, react-native-phone-number-input. devDependencies: { jest: '^29', '@testing-library/react-native': '^12', '@testing-library/jest-native': '^5', typescript: '^5', '@types/react': '^18', '@types/react-native': '^0.72' }. (9) mobile/tsconfig.json extending '../../tsconfig.base.json' with jsx: 'react-native'. Do not write any application logic — only the project scaffold. Also create `.gitignore` at the project root with exactly this content:

```gitignore
# Dependencies
node_modules/

# TypeScript build outputs
dist/
*.js.map
*.d.ts.map
*.tsbuildinfo

# Expo / React Native generated
.expo/
mobile/ios/
mobile/android/

# Test coverage
coverage/

# Environment files (use Doppler)
.env
.env.*
!.env.example

# Supabase local
supabase/.branches/
supabase/.temp/
.supabase/

# Logs
logs/
*.log
npm-debug.log*

# EAS build artifacts
*.ipa
*.apk
*.aab

# OS / editor
.DS_Store
Thumbs.db
```"*

**Files created:**
- `package.json` (root)
- `tsconfig.base.json` (root)
- `.gitignore` (root)
- `shared/package.json`
- `shared/types/index.ts`
- `shared/types/auth.types.ts`
- `shared/types/event.types.ts`
- `shared/types/participant.types.ts`
- `shared/types/receipt.types.ts`
- `shared/types/settlement.types.ts`
- `shared/types/api.types.ts`
- `backend/package.json`
- `backend/tsconfig.json`
- `mobile/package.json`
- `mobile/tsconfig.json`

**Acceptance Criteria:**
1. `npm install` from the repo root completes without errors and installs all three workspaces
2. `cd shared && npx tsc --noEmit` passes with zero errors
3. `cd backend && npx tsc --noEmit` passes with zero errors (even with empty src)
4. `cd mobile && npx tsc --noEmit` passes with zero errors (even with empty src)
5. A file in `backend/src/` containing `import type { AuthUser } from '@letssplyt/shared/auth.types'` resolves without a TypeScript error

**Tests required:** None for this story — test infrastructure is set up in E01-S05.

---

### E01-S02 — Express Application + All Middleware

**Description:** Build the Express application with every piece of middleware in the correct order: rate limiter, PII scrubber (strips sensitive field names from responses recursively), JWT authenticate middleware (verifies tokens via Supabase, never decodes without verification), and a structured logger that scrubs phone numbers from log output. Also create a health endpoint so you can verify the server starts.

**Prompt:**
*"Build the Express application in backend/src/app.ts and backend/src/server.ts. app.ts: create an Express app and register middleware in this exact order: (1) cors() with allowed origins from process.env.APP_DOMAIN — split on comma to support multiple domains. (2) express.json() with limit: '10mb' (receipt images need headroom). (3) rateLimiter: use express-rate-limit — global limit: 100 requests per 15 minutes per IP, separate stricter limit: 5 requests per 60 seconds for routes matching /auth/*. (4) piiScrubberMiddleware: intercepts res.json() by wrapping it — before the JSON is sent to the client, recursively walk the response object and delete any key named exactly: phone_e164, phone_hash, phone_encrypted, name_encrypted, guest_pii_token, handle_encrypted. The scrubber must handle nested objects and arrays. It must not modify the object in-place for the rest of the request lifecycle — work on a deep clone. (5) authenticate middleware in backend/src/middleware/authenticate.ts: reads the Authorization header, expects 'Bearer <token>', calls supabaseAnon.auth.getUser(token) (NEVER jwt.decode or jwt.verify directly — only supabase.auth.getUser can be used for token verification), attaches the result to req.user as a typed Express Request extension. Returns { error: 'Unauthorized', code: 'AUTH_REQUIRED' } with status 401 if header is missing, malformed, or if getUser returns an error. Note: the authenticate middleware is NOT automatically applied globally — it is applied per-router on protected routes. server.ts: import app, add GET /health route returning { status: 'ok', timestamp: ISO string }, listen on process.env.PORT || 3000, log on startup using pino: { msg: 'LetsSplyt backend running', port: PORT }. Create backend/src/infrastructure/logger.ts: export a pino logger instance configured with level: 'info' in production, 'debug' otherwise. Add a redact option to pino config that redacts any field paths named phone_e164, phone_hash, phoneE164, and patterns matching E.164 format (/\\+[0-9]{7,15}/) from log output. Export the logger as the default export. All TypeScript with strict types — extend Express Request type in backend/src/types/express.d.ts to add user: { id: string; email?: string } | null."*

**Files created:**
- `backend/src/app.ts`
- `backend/src/server.ts`
- `backend/src/middleware/authenticate.ts`
- `backend/src/middleware/piiScrubber.ts`
- `backend/src/middleware/rateLimiter.ts`
- `backend/src/middleware/requestId.ts`
- `backend/src/middleware/validate.ts`
- `backend/src/infrastructure/logger.ts`
- `backend/src/types/express.d.ts`

**Acceptance Criteria:**
1. `doppler run -- npm run dev` starts without TypeScript errors and logs `LetsSplyt backend running` in the terminal
2. `curl http://localhost:3000/health` returns `{"status":"ok","timestamp":"..."}` with status 200
3. `curl -X POST http://localhost:3000/api/v1/auth/otp/request` (without Authorization header — this route will be built in E03, for now add a placeholder that returns 501) returns 401 when authenticate middleware is manually applied — verify the middleware logic in the unit tests
4. Send a response body `{"phone_e164":"+15005550001","name":"Test User"}` through the PII scrubber — verify the client receives `{"name":"Test User"}` with `phone_e164` removed (test this via the unit test, not a live endpoint for now)
5. In the terminal, make any request — confirm no E.164 phone number pattern appears in any log line (even in debug mode)
6. `requestId` middleware added to Express app at startup (generates UUID per request, attaches to `req.requestId`, included in all log entries). File: `backend/src/middleware/requestId.ts`
7. `validate` middleware in `backend/src/middleware/validate.ts`: `(schema: ZodSchema) => RequestHandler` — validates `req.body` against schema, returns 400 with validation errors as `{ error: { code: 'VALIDATION_ERROR', details: ZodError.issues } }` if invalid. Used by all subsequent stories.

**Tests required:**
```
backend/src/__tests__/unit/middleware/piiScrubber.test.ts
  - strips phone_e164 from a flat response object
  - strips phone_hash from a flat response object
  - strips name_encrypted from a nested object (e.g. { user: { name_encrypted: '...' } })
  - strips handle_encrypted recursively from an array of objects
  - does not strip non-PII fields (id, display_name, status, amount_owed)
  - handles null values without throwing
  - handles undefined values without throwing
  - handles empty objects and empty arrays without throwing
  - returns a deep clone — does not mutate the original object

backend/src/__tests__/unit/middleware/authenticate.test.ts
  - returns 401 when Authorization header is missing entirely
  - returns 401 when Authorization header is present but not in 'Bearer <token>' format
  - returns 401 when supabase.auth.getUser returns an error
  - attaches user to req.user when getUser returns a valid user
  - calls supabase.auth.getUser (not jwt.decode or jwt.verify directly)
  - does not attach user when getUser returns null user
```

---

### E01-S03 — Supabase Client Singletons

**Description:** Create the two Supabase client instances that the entire backend uses. The anon client respects RLS. The admin client bypasses RLS and must only be used for specific operations. Never mix them up. A `getSupabaseForUser` helper allows user-scoped queries without creating a new connection.

**Prompt:**
*"Create backend/src/infrastructure/supabase.ts. Export three things: (1) supabaseAnon: a SupabaseClient created with SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from process.env. This client respects Row Level Security and must be used for all user-facing read operations. It should be created with auth: { persistSession: false, autoRefreshToken: false } since the backend does not persist user sessions. (2) supabaseAdmin: a SupabaseClient created with SUPABASE_URL and SUPABASE_SECRET_KEY from process.env, also with auth: { persistSession: false }. This client has service role access and bypasses Row Level Security. Add a JSDoc block on this export that says exactly: '@RESTRICTED USE ONLY. supabaseAdmin bypasses Row Level Security. Permitted uses: (a) auth flows — creating and verifying users, (b) background jobs and webhook handlers, (c) analytics writes, (d) cross-user writes like inserting a guest participant. NEVER use supabaseAdmin in user-facing read endpoints. If you are in a route handler reading data for the authenticated user, use getSupabaseForUser(jwt) instead.' (3) getSupabaseForUser(jwt: string): SupabaseClient — creates a new Supabase client using the anon key and calls client.auth.setSession({ access_token: jwt, refresh_token: jwt }) to scope it to that user's session. This is the correct pattern for all authenticated user operations — the client will automatically apply the user's JWT to each request, making RLS work correctly. Do not reuse the supabaseAnon singleton for user-scoped queries — always create a new client per request with getSupabaseForUser."*

**Files created:**
- `backend/src/infrastructure/supabase.ts`

**Acceptance Criteria:**
1. `import { supabaseAnon, supabaseAdmin, getSupabaseForUser } from './infrastructure/supabase'` compiles without TypeScript errors
2. `supabaseAnon` uses `SUPABASE_PUBLISHABLE_KEY` — confirm this by reading the source: the string `SUPABASE_SECRET_KEY` must not appear in the supabaseAnon creation call
3. `supabaseAdmin` uses `SUPABASE_SECRET_KEY` — confirm the JSDoc restriction comment is present in the source file
4. `getSupabaseForUser('some-jwt')` returns a client instance (not the supabaseAnon singleton) — these must be different object references
5. `cd backend && npm run typecheck` passes with zero errors

**Tests required:**
```
backend/src/__tests__/unit/infrastructure/supabase.test.ts
  - supabaseAnon is initialised with SUPABASE_PUBLISHABLE_KEY, not SUPABASE_SECRET_KEY
  - supabaseAdmin is initialised with SUPABASE_SECRET_KEY
  - getSupabaseForUser returns a new client instance (not the supabaseAnon singleton)
  - getSupabaseForUser calls setSession with the provided JWT as access_token
  - two successive calls to getSupabaseForUser return two different instances
```

---

### E01-S04 — LLM Provider Factory

**Description:** Build the AI provider factory as specified in `docs/07-AI-Agent-Specification.md` Section 2. The factory reads per-agent environment variables and returns the correct adapter. All three AI agents (A1, A2, A3) use this factory exclusively — harness files must never import AI SDKs directly.

**Prompt:**
*"Build the LLM provider factory as specified in docs/07-AI-Agent-Specification.md Section 2. Copy the exact code from that document — do not paraphrase or simplify it. Create these files in order: (1) backend/src/infrastructure/llm/llm.provider.ts — copy the exact LLMProvider interface, LLMMessage, LLMContentBlock, LLMTextBlock, LLMImageBlock, LLMUsage, LLMResponse, and LLMCompletionOptions types from the spec. (2) backend/src/infrastructure/llm/providers/gemini.adapter.ts — copy the exact GeminiAdapter class from the spec. Add exponential backoff with full jitter retry logic wrapping the provider.complete() call: 3 max attempts, base delay 500ms, max delay 10,000ms, jitter = Math.random() * exponential. The adapter itself does not have retry — the retry logic wraps the generateContent call inside a for-loop in the complete() method. (3) backend/src/infrastructure/llm/providers/anthropic.adapter.ts — copy the exact AnthropicAdapter from the spec. Same retry pattern. NOTE: OpenAI is not a supported provider for LetsSplyt. Only Gemini (dev/staging) and Claude Haiku (production) are used — do NOT create openai.adapter.ts or openai-compat.adapter.ts. (4) backend/src/infrastructure/llm/factory.ts — the function is named `createLLMProvider` (not `resolveProvider`). Add one additional guard: if agent is 'A1' and the resolved provider has supportsVision === false, throw new Error('Provider for A1 does not support vision input. A1 requires vision capability.'). Export type AgentKey = 'A1' | 'A2' | 'A3'. (5) backend/src/infrastructure/llm/index.ts — re-export createLLMProvider and AgentKey from factory.ts, and LLMProvider, LLMMessage, LLMResponse from llm.provider.ts. RULE: No file outside of providers/ may import @google/generative-ai or @anthropic-ai/sdk directly. (6) backend/src/infrastructure/errors.ts — export AppError class extending Error with fields: code: string, statusCode: number, details?: unknown. Export Errors convenience namespace with static constructors: Errors.notFound(message), Errors.forbidden(message), Errors.conflict(message, code), Errors.validation(message, details), Errors.internal(message). (7) backend/src/infrastructure/llm/ai-audit.ts — export writeAuditLog(params: { agent: AgentKey, eventId: string, inputTokens: number, outputTokens: number, modelUsed: string, success: boolean, errorCode?: string }): void (fire-and-forget — never throws, catches all errors internally and logs them). (8) backend/src/modules/receipts/receipt.repository.ts — export storeReceiptItems(eventId: string, items: ReceiptItem[]): Promise<void> (stub implementation for now — actual logic filled in E07 stories)."*

**Files created:**
- `backend/src/infrastructure/llm/llm.provider.ts`
- `backend/src/infrastructure/llm/providers/gemini.adapter.ts`
- `backend/src/infrastructure/llm/providers/anthropic.adapter.ts`
- `backend/src/infrastructure/llm/factory.ts`
- `backend/src/infrastructure/llm/ai-audit.ts`
- `backend/src/infrastructure/llm/index.ts`
- `backend/src/infrastructure/errors.ts`
- `backend/src/modules/receipts/receipt.repository.ts` (stub)

**Acceptance Criteria:**
1. With `AI_PROVIDER_A1=gemini AI_MODEL_A1=gemini-2.5-flash` in the environment, `createLLMProvider('A1')` returns an instance whose constructor name is `GeminiAdapter`
2. With `AI_PROVIDER_A1=anthropic`, `createLLMProvider('A1')` returns an `AnthropicAdapter` instance
3. With `AI_PROVIDER_A1=unknown`, `createLLMProvider('A1')` throws an error containing the string `Unknown AI provider`
4. `AppError` instances have `code`, `statusCode`, and optional `details` fields — `Errors.notFound('Event not found')` returns an `AppError` with `statusCode: 404`
5. `writeAuditLog(...)` never throws even when the DB call fails — wrap in try/catch internally
6. `cd backend && npm run typecheck` passes with zero errors

**Tests required:**
```
backend/src/__tests__/unit/infrastructure/llm/factory.test.ts
  - returns GeminiAdapter when AI_PROVIDER_A1=gemini
  - returns AnthropicAdapter when AI_PROVIDER_A1=anthropic
  - throws for unknown provider string (e.g. AI_PROVIDER_A1=openai — not supported)
  - each agent reads its own env vars (A1 can have different provider than A2)
  - throws vision error when non-vision provider is configured for A1

backend/src/__tests__/unit/infrastructure/llm/gemini.adapter.test.ts
  - complete() calls generateContent with the correct model name
  - returns LLMResponse with text, usage, and modelUsed fields
  - retries up to 3 times on network failure
  - throws after 3 failed attempts
  - delay between retries uses full jitter (test that delay is between 0 and exponential cap)
  - does not retry on non-retriable errors (e.g. invalid API key — 400 status)

backend/src/__tests__/unit/infrastructure/llm/anthropic.adapter.test.ts
  - complete() calls messages.create with the correct model and max_tokens
  - returns LLMResponse with correct fields
  - same retry tests as Gemini adapter
```

---

### E01-S05 — Test Infrastructure Setup

**Description:** Install and configure the complete testing infrastructure: Jest for backend and mobile, all mock files, ESLint, and the GitHub Actions CI pipeline. Every file described in the "Testing Infrastructure" section of this document is created in this story.

**Prompt:**
*"Set up the complete testing infrastructure for the LetsSplyt monorepo. Create all files exactly as specified in the 'Testing Infrastructure' section of 12-Build-Sequence.md: (1) backend/jest.config.ts — exact content from the document. (2) backend/src/__tests__/setup.ts — exact content from the document, including all process.env pre-sets, jest.mock calls for twilio, @supabase/supabase-js, and the llm factory, and the beforeEach clearAllMocks call. (3) backend/src/__tests__/mocks/supabase.mock.ts — exact content from the document including the chainable mock, __setMockResult, __mockRLSError, __mockNetworkError helpers. (4) backend/src/__tests__/mocks/twilio.mock.ts — exact content from the document. (5) backend/src/__tests__/mocks/llm.mock.ts — exact content from the document. (6) mobile/jest.config.ts — exact content from the document. (7) mobile/src/__tests__/setup.ts — exact content from the document including all expo module mocks and the in-memory SecureStore. (8) .github/workflows/ci.yml — exact content from the document. (9) .eslintrc.js at the repo root with rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/explicit-function-return-type': 'warn', 'no-console': 'warn' }, parser: '@typescript-eslint/parser', plugins: ['@typescript-eslint'], extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended']. Install eslint, @typescript-eslint/eslint-plugin, @typescript-eslint/parser as devDependencies in the root package.json. Add npm run lint and npm run typecheck scripts to both backend/package.json and mobile/package.json as shown in the document."*

**Files created:**
- `backend/jest.config.ts`
- `backend/src/__tests__/setup.ts`
- `backend/src/__tests__/mocks/supabase.mock.ts`
- `backend/src/__tests__/mocks/twilio.mock.ts`
- `backend/src/__tests__/mocks/llm.mock.ts`
- `mobile/jest.config.ts`
- `mobile/src/__tests__/setup.ts`
- `.github/workflows/ci.yml`
- `.eslintrc.js`

**Acceptance Criteria:**
1. `cd backend && npm test` runs without crashing — output shows "No tests found" or runs any existing tests without errors (the mock setup must not itself error)
2. `cd mobile && npm test` runs without crashing on expo module imports — the setup.ts mocks must prevent "Native module not found" errors
3. `cd backend && npm run typecheck` passes with zero TypeScript errors
4. `cd mobile && npm run typecheck` passes with zero TypeScript errors
5. After pushing to GitHub, the Actions tab shows the CI workflow triggered and the `lint-typecheck` job passes
6. `git-secrets` pre-commit hook installed: `git secrets --install && git secrets --register-aws`. Prevents committing AWS keys, and configured to also scan for Supabase JWT secrets and Twilio auth tokens via `git secrets --add 'SUPABASE_SERVICE_ROLE_KEY.*='` pattern.

**Tests required:**
```
backend/src/__tests__/unit/mocks/supabase.mock.test.ts
  - chainable mock: .from('users').select().eq().single() returns configured data
  - __setMockResult changes what single() returns
  - __mockRLSError causes single() to return the PGRST116 error code
  - __resetMock restores the default null result
  - different from() calls to different tables can be configured independently
```

---

### E01-S06 — Security Utilities

**Description:** Build `encrypt`, `decrypt`, `hashPhone`, `sanitizePromptInput`, and `formatCurrency`. These are called throughout the system. The encryption and hashing functions protect real PII. Write the tests for encrypt/decrypt and hashPhone before writing the implementation — this is the one story in the entire build sequence where test-first is mandatory, not optional.

**Prompt:**
*"Build the security utility functions in backend/src/infrastructure/security/. IMPORTANT: Write the test files first (see 'Tests required' below for exact test cases), then write the implementation to make them pass. (1) backend/src/infrastructure/security/crypto.ts: export function encrypt(plaintext: string, key: string): string — uses Node.js built-in crypto module, AES-256-GCM algorithm. Generate a random 12-byte IV using crypto.randomBytes(12). Encrypt the plaintext. Return a single string in the format: base64(iv):base64(authTag):base64(ciphertext) — all three parts base64-encoded, joined by colons. The key must be exactly 32 bytes — if the provided key is shorter, derive a 32-byte key using crypto.scryptSync(key, 'letssplyt-salt', 32). Throws EncryptionError (custom error class extending Error, with code: 'ENCRYPTION_ERROR') if encryption fails — the error message must never include the plaintext value. export function decrypt(encryptedString: string, key: string): string — reverses encrypt. Splits on colon, decodes each part from base64, decrypts with AES-256-GCM. Throws EncryptionError with message 'Decryption failed' (not 'Wrong key' or anything that reveals key information) if auth tag verification fails. export function hashPhone(phoneE164: string): string — HMAC-SHA256 using process.env.PII_HMAC_SALT as the key, returns lowercase hex string. Throws HashError (custom error class) if PII_HMAC_SALT is not set. (2) backend/src/infrastructure/security/sanitize.ts: export function sanitizePromptInput(input: string, maxLength: number = 200): string — strips: newline characters (\\n \\r), pipe characters (|), backtick characters (`), sequences of three or more dashes (---), XML-like tags (<word> and </word>), then trims whitespace, then truncates to maxLength. Never throws — returns empty string for null/undefined input. export function formatCurrency(amount: number, currency: string, locale?: string): string — uses Intl.NumberFormat. Supported currencies: USD (default locale en-US), INR (en-IN), EUR (de-DE), GBP (en-GB), AUD (en-AU), CAD (en-CA), SGD (en-SG), JPY (ja-JP). Throws CurrencyFormatError with message 'Unsupported currency: XYZ. Supported: USD, INR, EUR, GBP, AUD, CAD, SGD, JPY' for any unlisted currency code. (3) backend/src/infrastructure/security/index.ts — re-exports all functions and error classes from both files."*

**Files created:**
- `backend/src/infrastructure/security/crypto.ts`
- `backend/src/infrastructure/security/sanitize.ts`
- `backend/src/infrastructure/security/index.ts`

**Additional deliverable — `resolveParticipantPhone`:**

Add `resolveParticipantPhone` to `backend/src/infrastructure/security/sanitize.ts`:

```typescript
export async function resolveParticipantPhone(
  participant: {
    user_id: string | null;
    phone_encrypted: string | null;  // only set for guests (from guest_pii join)
  }
): Promise<string | null>
```

- For guests (`user_id` is null): decrypts `phone_encrypted` using `decrypt(phone_encrypted, process.env.PHONE_ENCRYPTION_KEY)`
- For App Members (`user_id` is set): calls `supabaseAdmin.auth.admin.getUserById(user_id)` to retrieve the phone number from Supabase Auth
- Returns `null` if neither is available (manual-name-only participant with no phone)
- The decrypted phone must NEVER be logged or stored in any intermediate variable that could outlive the function call

Add acceptance criterion: "`resolveParticipantPhone` returns null for a name-only participant with no phone_encrypted and no user_id"

Also re-export `resolveParticipantPhone` from `backend/src/infrastructure/security/index.ts`.

**Acceptance Criteria:**
1. `encrypt('hello world', 'my-secret-key')` returns a string in the format `xxx:yyy:zzz` (three colon-separated base64 segments) and never contains the substring `hello world`
2. `decrypt(encrypt('hello world', key), key)` returns `'hello world'` exactly
3. `decrypt(encrypt('hello world', 'key-a'), 'key-b')` throws `EncryptionError` — the error message must not contain `key-a`, `key-b`, or the plaintext
4. `hashPhone('+15005550001')` called twice returns the same string both times (deterministic)
5. `sanitizePromptInput('item\n| DROP TABLE users; --\n<script>')` returns a string containing none of the injected characters
6. `formatCurrency(1234.56, 'USD')` returns `'$1,234.56'`
7. `formatCurrency(1234.56, 'INR', 'en-IN')` returns `'₹1,234.56'`
8. `formatCurrency(100, 'XYZ')` throws `CurrencyFormatError`

**Tests required (write BEFORE implementation for encrypt/decrypt/hashPhone):**
```
backend/src/__tests__/unit/security/crypto.test.ts  ← WRITE TESTS FIRST
  - encrypt → decrypt round trip returns the original plaintext exactly
  - encrypting the same string twice produces different ciphertexts (random IV)
  - decrypting with the wrong key throws EncryptionError
  - the encrypted output never contains the plaintext as a substring
  - encrypting an empty string works without error
  - encrypting a 10,000 character string works without error
  - error messages from EncryptionError never include the plaintext value

backend/src/__tests__/unit/security/hashPhone.test.ts  ← WRITE TESTS FIRST
  - same input produces the same hash every time (deterministic)
  - different inputs produce different hashes
  - the hash output does not contain the original phone number as a substring
  - the hash is a 64-character hex string (SHA-256 output length)
  - throws HashError when PII_HMAC_SALT env var is not set

backend/src/__tests__/unit/security/sanitize.test.ts
  - strips newline characters (\n and \r)
  - strips pipe characters
  - strips backtick characters
  - strips triple-dash sequences
  - strips XML-like tags
  - truncates to maxLength
  - returns empty string for null input
  - returns empty string for undefined input
  - formatCurrency: correct symbol and separator for USD, INR, EUR, GBP
  - formatCurrency: throws CurrencyFormatError for unknown currency code
  - formatCurrency: handles zero correctly ($0.00)
  - formatCurrency: handles negative amounts (-$12.50)
```

---

## EPIC 2 — Database Schema & RLS
**Depends on:** E01 complete (monorepo scaffold, TypeScript config, security utilities)
**Delivers:** All tables, RLS policies, triggers, indexes, and seed data applied to local Supabase

### E02-S01 — Core Tables + Indexes

**What this builds:** All PostgreSQL tables and indexes via Supabase migration — no triggers, no RLS yet.

**Prompt:**
Read docs/04-Data-Architecture.md for the authoritative schema. Create `supabase/migrations/20240101000001_core_tables.sql` with:

1. Extensions: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`, `pgcrypto`, `moddatetime`
2. All CREATE TABLE statements for: users, events, participants, guest_pii, receipt_items, payment_handles, sms_opt_outs, settlement_confirmations, funnel_checkpoints, device_sessions — exact column names, types, defaults and constraints from 04-Data-Architecture.md. The `users` table must include `is_opted_out BOOLEAN NOT NULL DEFAULT false` (set to TRUE when user sends STOP via Twilio SMS).
3. The circular FK fix: after all tables are created, add `ALTER TABLE users ADD COLUMN acquisition_event_id UUID REFERENCES events(id) ON DELETE SET NULL`
4. All indexes listed in 04-Data-Architecture.md (including the partial unique index `idx_participants_guest_unique` on `(event_id, guest_pii_token) WHERE guest_pii_token IS NOT NULL`)
5. No triggers, no RLS policies in this file

Run `npx supabase db push` and confirm all tables exist.

**Files created:**
- `supabase/migrations/20240101000001_core_tables.sql`

**Acceptance criteria:**
- [ ] All 10 tables created with correct columns and types
- [ ] `uuid-ossp`, `pgcrypto`, `moddatetime` extensions enabled
- [ ] `acquisition_event_id` added via ALTER TABLE after events table exists
- [ ] Partial unique index on participants for guest deduplication
- [ ] `supabase db push` exits with code 0
- [ ] `SELECT tablename FROM pg_tables WHERE schemaname = 'public'` returns all 10 tables

**Tests to run:**
```bash
npx supabase db push
```

**Expected output:** Migration applied successfully, 10 tables visible in Supabase dashboard.

---

### E02-S02 — Triggers + Functions

**What this builds:** All PostgreSQL trigger functions and triggers — updated_at automation, guest PII purge scheduling, analytics partitioning.

**Prompt:**
Read docs/04-Data-Architecture.md for trigger specifications. Create `supabase/migrations/20240101000002_triggers_functions.sql` with:

1. `updated_at` trigger function using moddatetime extension
2. Apply `updated_at` trigger to all tables that have an `updated_at` column: users, events, participants, guest_pii, payment_handles, settlement_confirmations
3. `guest_pii_set_purge_after()` trigger function: when a participant's `settlement_status` changes to `CONFIRMED`, set `guest_pii.purge_after = NOW() + INTERVAL '30 days'` for that participant's guest_pii record
4. Analytics partition creation function (creates monthly partitions for funnel_checkpoints if the table is partitioned, otherwise a no-op stub)

Run `npx supabase db push`.

**Files created:**
- `supabase/migrations/20240101000002_triggers_functions.sql`

**Acceptance criteria:**
- [ ] `updated_at` auto-updates on row modification for all 6 applicable tables
- [ ] Guest PII purge trigger sets `purge_after` correctly on CONFIRMED status
- [ ] `supabase db push` exits with code 0
- [ ] Manually updating a row confirms `updated_at` changes

**Tests to run:**
```bash
npx supabase db push
```

**Expected output:** Migration applied, triggers visible in Supabase dashboard under Database → Triggers.

---

### E02-S03 — RLS Policies

**What this builds:** Row Level Security policies for all tables — enforcing per-user data isolation.

**Prompt:**
Read docs/04-Data-Architecture.md for the exact RLS policy specifications. Create `supabase/migrations/20240101000003_rls_policies.sql` with:

1. `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY` for all 10 tables
2. All RLS policies exactly as specified in 04-Data-Architecture.md. Key rules:
   - `users`: users can only read/update their own row (`auth.uid() = id`)
   - `events`: creator can do all; participants can read events they are in
   - `participants`: payer can read all in their events; participants can read their own row; service role bypasses all
   - `guest_pii`: service role only
   - `receipt_items`: creator of the event can CRUD; participants can read
   - `payment_handles`: owner only
   - `sms_opt_outs`: service role only
   - `settlement_confirmations`: payer can read all in their events; participant can read their own
   - `funnel_checkpoints` and `device_sessions`: service role only
3. Note: payer is identified via `events.payer_id`, NOT `events.creator_id`

Also create `backend/src/tests/rls.test.ts` using the test helper pattern:
- Use `supabaseAdmin.auth.admin.createSession({ userId })` to create test sessions (NOT generateLink — LetsSplyt users have no email)
- Test that each policy allows what it should and blocks what it should
- At minimum: test that user A cannot read user B's payment handles, and that a participant can read event details

Run `npx supabase db push` then `npm test backend/src/tests/rls.test.ts`.

**Files created:**
- `supabase/migrations/20240101000003_rls_policies.sql`
- `backend/src/tests/rls.test.ts`

**Acceptance criteria:**
- [ ] RLS enabled on all 10 tables
- [ ] All policies use `payer_id` not `creator_id` for event ownership checks
- [ ] Service role bypasses RLS (used in backend for admin operations)
- [ ] RLS tests pass — at minimum user isolation and participant read access verified
- [ ] `supabase db push` exits with code 0

**Tests to run:**
```bash
npx supabase db push
cd backend && npm test src/tests/rls.test.ts
```

**Expected output:** All RLS tests pass. Supabase dashboard shows RLS enabled on all tables.

---

### E02-S04 — Seed Data

**Description:** Create comprehensive seed data for development. Three test users, two events representing every lifecycle state, all four payment statuses, and enough data to exercise every screen in the app without setting up real data each time.

**Prompt:**
*"Create supabase/seed.sql with the complete development seed data from Section 11 of docs/04-Data-Architecture.md. Copy the exact INSERT statements from that document. The seed must create: (1) Three test users with the exact UUIDs and placeholder hashes shown in the document: User 1 Alex R. (id 00000000-0000-0000-0000-000000000001, phone Twilio magic number +15005550001), User 2 Jordan K. (id ...000000000002, phone +15005550002), User 3 Sam T. (id ...000000000003, phone +15005550003). Use the exact dev-placeholder hash and encrypted values from the document — these are intentionally fake dev values, not real encrypted data. (2) Three payment handles for User 1 (Alex): venmo and cashapp. One handle for User 2 (Jordan): venmo. All using the dev_encrypted_handle placeholder format from the document. (3) Event 1: 'Team Dinner — Osteria Morini', status='settled', ai_stage='complete', split_mode='equal', with all timestamps set as shown in the document. (4) Four participants for Event 1 covering all payment statuses: Alex (confirmed), Jordan (confirmed), Sam (self_reported — payer has not yet confirmed), Casey M. (opted_out, manual_name_only, user_id NULL). (5) Event 2: 'Birthday Brunch', status='open', ai_stage='none', total_amount NULL (no receipt scanned yet). (6) Two participants for Event 2: Alex and Jordan, both pending. (7) One active join token for Event 2 with token 'dev-seed-token-birthday-brunch-2026' and expires_at NOW() + 23 hours. After creating all tables, also insert three funnel_checkpoint rows for the birthday brunch event showing the join flow for Jordan: join_page_loaded, otp_sent, join_confirmed."*

**Files created:**
- `supabase/seed.sql`

**Acceptance Criteria:**
1. `supabase db reset` completes with zero SQL errors
2. In Supabase Studio, `SELECT count(*) FROM users` returns 3
3. `SELECT count(*) FROM events` returns 2
4. `SELECT payment_status FROM participants WHERE event_id = '20000000-0000-0000-0000-000000000001' ORDER BY payment_status` returns four rows: `confirmed`, `confirmed`, `opted_out`, `self_reported` (Jordan and Alex both confirmed, Sam self_reported, Casey opted_out)
5. `SELECT count(*) FROM user_payment_handles` returns 3
6. `SELECT is_active, token FROM event_join_tokens WHERE event_id = '20000000-0000-0000-0000-000000000002'` returns one row with `is_active = true` and `token = 'dev-seed-token-birthday-brunch-2026'`

**Tests required:**
```
backend/src/__tests__/integration/seed.test.ts
  - all three users exist with correct display_names (Alex R., Jordan K., Sam T.)
  - Event 1 has status='settled' and ai_stage='complete'
  - Event 2 has status='open' and ai_stage='none'
  - Event 1 has exactly four participants
  - payment_status values for Event 1 cover: confirmed, confirmed, self_reported, opted_out
  - payment handles exist for User 1 (Alex)
  - active join token exists for Event 2
  - funnel_checkpoints exist for the Birthday Brunch event
```

---

## EPIC 3 — Authentication
**Depends on:** E01 complete + E02 complete (database tables and RLS must exist)
**Delivers:** Working phone OTP login, Supabase session creation, JWT storage in SecureStore, session restoration on app relaunch

### E03-S01 — OTP Request Endpoint

**Description:** Build `POST /api/v1/auth/otp/request`. This endpoint normalises the phone number, hashes it, checks for opt-outs, and sends an OTP via Twilio Verify. The phone number must never appear in any log or response.

**Prompt:**
*"Build the POST /api/v1/auth/otp/request endpoint. Create backend/src/modules/auth/auth.routes.ts, auth.controller.ts, and auth.service.ts. Request body schema (validated with Zod): { phone_e164: z.string().regex(/^\\+[1-9]\\d{7,14}$/, 'Must be a valid E.164 phone number') }. Service logic in auth.service.ts (class AuthService, all methods async): (1) Normalise and validate the phone using libphonenumber-js: parsePhoneNumber(input) — if invalid, throw a ZodError-compatible ValidationError. (2) Compute phone_hash = hashPhone(normalised phone) using the hashPhone utility from backend/src/infrastructure/security/. (3) Check sms_opt_outs table via supabaseAdmin: SELECT id FROM sms_opt_outs WHERE phone_hash = hash. If a row exists, return { sent: false, reason: 'OTP_UNAVAILABLE' } — never reveal that the number is opted out. (4) Rate limit: check in-memory Map (or Upstash Redis key 'otp_rate:<phone_hash>') for request count in last 10 minutes — if 3 or more requests exist, return 429 with { error: 'RATE_LIMITED', retryAfterSeconds: 600 }. (5) Call Twilio Verify: twilioClient.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({ to: normalisedPhone, channel: 'sms' }). (6) Return { sent: true } with status 200. The controller must never log the phone number — only log phone_hash. Register the route at POST /api/v1/auth/otp/request in auth.routes.ts. Register auth.routes.ts in app.ts. Add OtpRequestBody and OtpRequestResponse types to shared/types/auth.types.ts. Import and use the pino logger from infrastructure/logger.ts — never use console.log in this file."*

**Files created:**
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.routes.ts`
- `shared/types/auth.types.ts` (updated)

**Acceptance Criteria:**
1. `curl -X POST http://localhost:3000/api/v1/auth/otp/request -H "Content-Type: application/json" -d '{"phone_e164":"+15005550001"}'` returns `{"sent":true}` with status 200 (Twilio test mode — no real SMS sent)
2. `curl` with body `{"phone_e164":"not-a-phone"}` returns status 400 with `{"error":"VALIDATION_ERROR"}` and a fields object describing the phone error
3. Manually insert a row into `sms_opt_outs` with the hash of `+15005550001`, then call the endpoint — it returns `{"sent":false,"reason":"OTP_UNAVAILABLE"}` with status 200 (not 4xx)
4. Send 4 requests for the same phone within 60 seconds — the 4th returns status 429
5. Search the terminal output for `+15005550001` — it must not appear in any log line; only the hash may appear

**Tests required:**
```
backend/src/__tests__/unit/auth/auth.service.test.ts
  - calls hashPhone before any database query
  - returns { sent: false, reason: 'OTP_UNAVAILABLE' } when phone hash exists in sms_opt_outs
  - calls Twilio verifications.create with the normalised phone number
  - normalises '5005550001' (no plus) to '+15005550001' using libphonenumber-js
  - throws ValidationError for a non-phone string like 'hello'
  - does not call Twilio when phone is opted out

backend/src/__tests__/integration/auth/otp-request.test.ts  (supertest)
  - POST with valid phone returns 200 { sent: true }
  - POST with invalid phone returns 400 with validation error
  - POST with opted-out phone (seeded in sms_opt_outs) returns 200 { sent: false, reason: 'OTP_UNAVAILABLE' }
  - POST 4 times in quick succession returns 429 on the 4th request
```

---

### E03-S02 — OTP Verify + Session Creation

**Description:** Build `POST /api/v1/auth/otp/verify`. Verifies the code with Twilio, creates or upserts the user in both Supabase Auth and the public users table, and returns a JWT. The user ID in `auth.users` must match the ID in `public.users`.

**Prompt:**
*"Build POST /api/v1/auth/otp/verify in auth.service.ts and auth.controller.ts. Request body (Zod): { phone_e164: string (E.164), code: string (exactly 6 digits: z.string().regex(/^[0-9]{6}$/)) }. Service logic: (1) Validate with Zod. (2) Normalise phone with libphonenumber-js. (3) Call twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({ to: normalisedPhone, code }). If result.status !== 'approved', return { verified: false, error: 'INVALID_CODE' } with status 400. (4) Compute phone_hash = hashPhone(normalised) and phone_encrypted = encrypt(normalised, process.env.PHONE_ENCRYPTION_KEY). (5) Check if user exists: SELECT id FROM users WHERE phone_hash = hash via supabaseAdmin. (6) If user does not exist: generate a new UUID with crypto.randomUUID(). Insert into public.users: { id: newUuid, phone_hash, phone_encrypted, display_name: '' } via supabaseAdmin. Then create a Supabase Auth user: supabaseAdmin.auth.admin.createUser({ id: newUuid, phone: normalisedPhone, phone_confirm: true, user_metadata: { letssplyt_user: true } }). IMPORTANT: The id passed to createUser must be the same UUID inserted into public.users so the two rows share the same primary key. (7) If user exists: retrieve their id from public.users. (8) Generate a session token: use supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: userId + '@letssplyt.internal' }) to get an access token. Alternatively, if your supabase-js version supports it, use supabaseAdmin.auth.admin.createSession({ user_id: userId }). Return the access_token and refresh_token from whichever method works. (9) Return: { verified: true, access_token: string, refresh_token: string, user: { id: string, display_name: string } }. Add OtpVerifyBody and AuthSession to shared/types/auth.types.ts."*

**Files created:**
- `backend/src/modules/auth/auth.service.ts` (updated)
- `backend/src/modules/auth/auth.controller.ts` (updated)
- `shared/types/auth.types.ts` (updated with OtpVerifyBody, AuthSession)

**Response shape:** The OTP verify endpoint must return exactly this shape:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "display_name": "Pawan",
    "avatar_colour": "#4F46E5",
    "is_new_user": true
  }
}
```

On new user creation, randomly assign `avatar_colour` from a predefined palette of 8 colors: `['#4F46E5','#7C3AED','#DB2777','#DC2626','#D97706','#059669','#0284C7','#0891B2']`. Persist the assigned colour in `public.users.avatar_colour` — it must not change on subsequent logins.

**Acceptance Criteria:**
1. `curl -X POST http://localhost:3000/api/v1/auth/otp/verify -H "Content-Type: application/json" -d '{"phone_e164":"+15005550001","code":"000000"}'` with Twilio test mode returns `{"verified":true,"access_token":"...","refresh_token":"...","user":{"id":"...","display_name":"","avatar_colour":"#XXXXXX","is_new_user":true}}`
2. Sending code `"111111"` (wrong code in Twilio test mode) returns `{"verified":false,"error":"INVALID_CODE"}` with status 400
3. After a successful verify for `+15005550009` (a new number), `SELECT count(*) FROM public.users WHERE phone_hash = hashPhone('+15005550009')` returns 1 (new row created)
4. Calling verify twice for the same number returns the same `user.id` both times (idempotent upsert)
5. Decode the returned `access_token` at jwt.io — the `sub` claim must match the `user.id` in the response
6. OTP verify rate limit: 5 incorrect-code attempts per phone per 10 minutes — the 6th attempt within that window returns 429 with `{ error: { code: 'TOO_MANY_REQUESTS', retry_after_seconds: N } }`
7. Response includes `is_new_user: boolean` — true if this OTP verify created the user record (first login), false for returning users
8. Response includes `user.avatar_colour: string` — a randomly-assigned hex color from the palette on first creation, persisted thereafter (same colour returned on every subsequent login)

**Tests required:**
```
backend/src/__tests__/unit/auth/auth.service.test.ts  (extend existing file)
  - calls Twilio verificationChecks.create with correct phone and code
  - returns { verified: false, error: 'INVALID_CODE' } when Twilio status is not 'approved'
  - encrypts phone with PHONE_ENCRYPTION_KEY before inserting into users
  - hashes phone with PII_HMAC_SALT before inserting into users
  - inserts into public.users with the same UUID used for auth.users
  - returns the same user.id on second call for the same phone (idempotent)
  - response object never contains phone_e164 or phone_hash
  - creates public.users row using the same ID as auth.users
  - if public.users upsert returns 0 rows: retries once
  - returns AUTH_PROFILE_CREATION_FAILED after two failures
  - second login for same phone: returns existing user ID (idempotent)

backend/src/__tests__/integration/auth/otp-verify.test.ts  (supertest)
  - POST with Twilio magic code 000000 for valid test number returns 200 with access_token
  - POST with wrong code returns 400 INVALID_CODE
  - POST twice for same phone returns same user.id both times
```

**Service logic for user creation (step 4):** Use a retry loop with idempotent upsert to handle partial failures:
(1) Check if a public.users row exists for this phone_hash. If yes, get the user_id.
(2) If no public.users row exists: call supabaseAdmin.auth.admin.createUser({ phone: phone_e164, phone_confirm: true, user_metadata: { phone_hash } }). Get the returned user.id.
(3) Upsert into public.users: INSERT INTO users (id, phone_hash, phone_encrypted) VALUES (user.id, phoneHash, phoneEncrypted) ON CONFLICT (id) DO NOTHING.
(4) If the upsert returns 0 rows AND no users row exists with this id: retry once (handles the race where auth.users was created but public.users write failed).
(5) If after retry the public.users row still doesn't exist: return 500 AUTH_PROFILE_CREATION_FAILED.

Important: The user.id from auth.users must equal the id in public.users. They are the same UUID. This is enforced by using the auth user's returned ID as the primary key in public.users.

---

### E03-S03 — Welcome + PhoneEntry Screens + authStore

**What this builds:** The first two auth screens and the Zustand auth store skeleton — phone entry triggers OTP request.

**Prompt:**
Read docs/08-Mobile-App-Specification.md for screen specs and the authStore spec. Build:

1. `mobile/src/screens/auth/WelcomeScreen.tsx` — app logo/name, tagline, single "Get Started" button that navigates to PhoneEntry
2. `mobile/src/screens/auth/PhoneEntryScreen.tsx` — phone number text input (E.164 format helper), country code picker defaulting to +1, "Send Code" button that calls `POST /auth/otp/request`, loading state, error display
3. `mobile/src/store/authStore.ts` — Zustand store with:
   - State: `session: Session | null`, `user: User | null`, `isLoading: boolean`
   - Actions: `setSession(session)`, `clearSession()`, `setLoading(bool)`
   - Uses `expo-secure-store` to persist the access token (key: `auth_token`) — NEVER AsyncStorage
4. Wire WelcomeScreen and PhoneEntryScreen into `mobile/src/navigation/RootNavigator.tsx` auth stack

Match the visual design in `prototype/dusk-auth.html`.

**Files created:**
- `mobile/src/screens/auth/WelcomeScreen.tsx`
- `mobile/src/screens/auth/PhoneEntryScreen.tsx`
- `mobile/src/store/authStore.ts`
- Updates to `mobile/src/navigation/RootNavigator.tsx`

**Acceptance criteria:**
- [ ] Welcome screen renders with "Get Started" button
- [ ] PhoneEntry screen accepts phone number and calls `/auth/otp/request`
- [ ] authStore uses expo-secure-store, never AsyncStorage
- [ ] Loading state shown during API call
- [ ] Error message shown if API returns error
- [ ] Navigation: Welcome → PhoneEntry works

**Tests to run:**
```bash
cd mobile && npm test src/screens/auth/WelcomeScreen.test.tsx
cd mobile && npm test src/store/authStore.test.ts
```

**Expected output:** Screens render without errors. Store initialises with null session.

---

### E03-S04 — OTPVerify Screen + initAuthListener + Token Refresh

**What this builds:** OTP verification screen, completes the authStore with JWT refresh listener, and handles the biometric re-enrolment edge case.

**Prompt:**
Read docs/08-Mobile-App-Specification.md for the OTPVerify screen spec and the `initAuthListener` specification. Build:

1. `mobile/src/screens/auth/OTPVerifyScreen.tsx`:
   - 6-digit OTP input (individual digit boxes per prototype)
   - "Verify" button calls `POST /auth/otp/verify` with phone + OTP
   - On success: calls `authStore.setSession()`, stores token in expo-secure-store, navigates to Home
   - "Resend" link (cooldown 30 seconds)
   - Error display for wrong OTP

2. Complete `mobile/src/store/authStore.ts` with `initAuthListener()`:
   - Calls `supabase.auth.onAuthStateChange((event, session) => ...)`
   - On `TOKEN_REFRESHED`: calls `setSession(session)`, updates expo-secure-store
   - On `SIGNED_OUT`: calls `clearSession()`, removes from expo-secure-store
   - This must be called once in the app root (RootNavigator) on mount
   - Biometric re-enrolment edge case: if `event === 'USER_UPDATED'` and biometric was previously enrolled, prompt re-enrolment

3. Call `authStore.getState().initAuthListener()` in RootNavigator on mount

Match the OTP screen design in `prototype/dusk-auth.html`.

**Files created:**
- `mobile/src/screens/auth/OTPVerifyScreen.tsx`
- Updates to `mobile/src/store/authStore.ts` (add initAuthListener)
- Updates to `mobile/src/navigation/RootNavigator.tsx` (call initAuthListener on mount)

**Acceptance criteria:**
- [ ] OTP screen renders 6 individual digit inputs
- [ ] Correct OTP navigates to Home and stores token in expo-secure-store
- [ ] Wrong OTP shows error message
- [ ] Resend shows 30-second cooldown
- [ ] `initAuthListener` wired in RootNavigator
- [ ] TOKEN_REFRESHED event updates stored token
- [ ] SIGNED_OUT event clears store and secure storage
- [ ] OTP request rate limit: 3 requests per phone per 10 minutes, 20 requests per IP per hour. Returns 429 with `{ error: { code: 'TOO_MANY_REQUESTS', retry_after_seconds: N } }` when exceeded.
- [ ] OTP verify rate limit: 5 incorrect-code attempts per phone per 10 minutes. Returns 429 when exceeded.
- [ ] Wrong OTP code returns an inline error message with the code input cleared and the phone field pre-filled for re-entry.

**Tests to run:**
```bash
cd mobile && npm test src/screens/auth/OTPVerifyScreen.test.tsx
cd mobile && npm test src/store/authStore.test.ts
```

**Expected output:** OTP flow tests pass, token refresh path covered.

---

## EPIC 4 — Profile & Payment Handles
**Depends on:** E03 complete (user can log in and has a valid JWT)
**Delivers:** Creator can add, view, reorder, and delete payment handles; handles are encrypted in the database and decrypted only when returned to the authenticated owner

### E04-S01 — Profile API Endpoints

**Description:** Build the five profile endpoints. Handle encryption and decryption happens entirely in the service layer — encrypted values reach the database, decrypted values reach the client. The authenticated user can only read and modify their own profile.

**Prompt:**
*"Build the profile module in backend/src/modules/profile/. All routes require the authenticate middleware. (1) GET /api/v1/users/me — use getSupabaseForUser(jwt) to fetch the user row by req.user.id. Return { id, display_name, avatar_colour, avatar_url, total_events_created, total_events_joined, created_at }. NEVER return phone_hash, phone_encrypted, or name_encrypted — these must be explicitly excluded from the SELECT query. (2) PATCH /api/v1/users/me — accepts { display_name?: string, expo_push_token?: string, avatar_colour?: string }. Validate with Zod (display_name max 50 chars, expo_push_token max 200 chars). If display_name provided: UPDATE users SET display_name = $1 WHERE id = req.user.id via getSupabaseForUser. If expo_push_token provided: read X-Device-ID header (required if expo_push_token is present — return 400 if missing), read X-Platform header (must be 'ios' or 'android'), then upsert into device_sessions: { user_id: req.user.id, device_id: deviceId, expo_push_token, platform, last_active_at: new Date() } ON CONFLICT (user_id, device_id) DO UPDATE SET expo_push_token = EXCLUDED.expo_push_token, last_active_at = NOW(). Return the updated user object. (3) GET /api/v1/users/me/handles — SELECT id, provider, handle_encrypted, display_order FROM user_payment_handles WHERE user_id = req.user.id AND is_active = true ORDER BY display_order ASC via supabaseAdmin (must use admin to decrypt — anon key cannot read handle_encrypted). Decrypt each handle_encrypted using decrypt(handle_encrypted, process.env.HANDLE_ENCRYPTION_KEY). Return [{ id, provider, handle_value, display_order }] — never return handle_encrypted in the response. (4) POST /api/v1/users/me/handles — accepts { provider: z.enum(['venmo','paypal','cashapp','zelle','wise','upi','bank_transfer','other']), handle_value: z.string().min(1).max(100) }. Encrypt handle_value: encryptedValue = encrypt(handle_value, process.env.HANDLE_ENCRYPTION_KEY). Get current max display_order for this user and add 1 for the new handle's order. INSERT into user_payment_handles. Return { id, provider, display_order }. (5) DELETE /api/v1/users/me/handles/:id — first verify ownership: SELECT user_id FROM user_payment_handles WHERE id = handleId via supabaseAdmin — if user_id !== req.user.id, return 403 { error: 'FORBIDDEN' }. If owner, perform a soft delete: UPDATE user_payment_handles SET is_active = false WHERE id = handleId. All types in shared/types/profile.types.ts. Register routes in backend/src/app.ts."*

**Files created:**
- `backend/src/modules/profile/profile.service.ts`
- `backend/src/modules/profile/profile.controller.ts`
- `backend/src/modules/profile/profile.routes.ts`
- `shared/types/profile.types.ts`

**Acceptance Criteria:**
1. `GET /api/v1/users/me` with a valid JWT returns a user object — verify that `phone_hash` and `phone_encrypted` are NOT present in the JSON response body
2. `POST /api/v1/users/me/handles` with `{ provider: "venmo", handle_value: "@myhandle" }` succeeds — then run `SELECT handle_encrypted FROM user_payment_handles WHERE user_id = '...'` in Supabase Studio — the stored value must NOT contain `@myhandle` (it must be an encrypted blob)
3. `GET /api/v1/users/me/handles` returns the handle with `handle_value: "@myhandle"` (decrypted) and no `handle_encrypted` field
4. `DELETE /api/v1/users/me/handles/<id-of-another-users-handle>` returns 403
5. `PATCH /api/v1/users/me` with `{ expo_push_token: "ExponentPushToken[test123]" }` and headers `X-Device-ID: test-device-001` and `X-Platform: ios` — then `SELECT expo_push_token FROM device_sessions WHERE user_id = '...'` — returns `ExponentPushToken[test123]`

**Tests required:**
```
backend/src/__tests__/unit/profile/profile.service.test.ts
  - GET me: response object does not contain phone_hash or phone_encrypted
  - POST handles: calls encrypt() before inserting into the database
  - GET handles: calls decrypt() on handle_encrypted before returning
  - GET handles: returned object contains handle_value, not handle_encrypted
  - DELETE handles: returns 403 when handleId belongs to a different user
  - PATCH me: upserts device_sessions with expo_push_token when provided
  - PATCH me: returns 400 when expo_push_token is present but X-Device-ID header is missing

backend/src/__tests__/integration/profile/profile.test.ts  (supertest)
  - Full CRUD cycle: POST handle → GET handles → verify decrypted value matches → DELETE handle → GET handles returns empty
  - GET me returns user without phone fields
  - DELETE another user's handle returns 403
```

---

### E04-S02 — Profile Mobile Screens

**Description:** Build ProfileScreen and AddHandleScreen. The user can view their profile, edit their display name inline, manage payment handles with drag-to-reorder and swipe-to-delete. Payment handles are the data that A3 uses to generate payment links — they must be saved correctly.

**Prompt:**
*"Build the profile screens. Refer to Prototype/dusk-auth.html in the project for visual design — use the same colour palette and card-based layout. (1) mobile/src/screens/profile/ProfileScreen.tsx: at the top show a coloured circle avatar with the user's initials (derived from display_name — e.g. 'Alex R.' → 'AR'), the avatar background colour from users.avatar_colour. Below the avatar, show the display_name in large text — tapping it makes it editable inline (TextInput replaces the Text, auto-focused, on blur call PATCH /api/v1/users/me with the new display_name). Below that, a section titled 'Payment methods' showing the list of payment handles as cards: each card shows the provider name capitalised and the handle_value. Use react-native-draggable-flatlist for the list so handles can be reordered by long-pressing and dragging. On drag-complete, call PATCH /api/v1/users/me/handles/reorder with the new ordered array of IDs (add this endpoint to profile.routes.ts: PATCH /api/v1/users/me/handles/reorder, body: { orderedIds: string[] }, updates display_order for each handle). Each card has a delete action: swipe left to reveal a red Delete button, tap to call DELETE /api/v1/users/me/handles/:id after showing a confirmation Alert. At the bottom of the handles list: a '+ Add payment method' button navigating to AddHandleScreen. Below all handles: a 'Settings' tappable row (placeholder navigation for now). At the very bottom of the screen: a 'Log out' button calling authStore.logout() then navigating to WelcomeScreen, and a 'Delete account' link (placeholder for now). (2) mobile/src/screens/profile/AddHandleScreen.tsx: a horizontal scrollable list of provider chips at the top: Venmo, PayPal, Cash App, Zelle, Wise, Bank Transfer, Other. Tapping a chip highlights it as selected and updates a text input placeholder: Venmo → '@username', PayPal → 'paypal.me/username', Cash App → '$cashtag', Zelle → 'phone number or email', Wise → 'wise.com/pay/me/link', Bank Transfer → 'account details', Other → 'payment handle'. A text input for the handle value. A 'Save' button that calls POST /api/v1/users/me/handles, navigates back on success and shows a brief success toast 'Payment method saved'. Validate that a provider chip is selected and handle_value is not empty before enabling Save. (3) mobile/src/store/profileStore.ts: Zustand store with state { user: UserProfile | null, handles: PaymentHandle[], isLoading: boolean }, actions { loadProfile(): fetches GET /users/me and GET /users/me/handles with the stored JWT, addHandle(handle): optimistically adds to handles list then confirms from API response, deleteHandle(id): removes from list optimistically, reorderHandles(orderedIds): updates display_order locally, setUser(user) }. Load profileStore on ProfileScreen mount via useEffect. (4) mobile/src/services/profile.service.ts: typed wrapper functions for all profile API calls."*

**Files created:**
- `mobile/src/screens/profile/ProfileScreen.tsx`
- `mobile/src/screens/profile/AddHandleScreen.tsx`
- `mobile/src/store/profileStore.ts`
- `mobile/src/services/profile.service.ts`
- `backend/src/modules/profile/profile.routes.ts` (updated with reorder endpoint)
- `backend/src/modules/profile/profile.service.ts` (updated with reorderHandles)

**Acceptance Criteria:**
1. On Expo Go: ProfileScreen shows the user's initials avatar, their display name, and any saved payment handles
2. Tap the display name → it becomes editable → type a new name → tap outside → `GET /api/v1/users/me` returns the updated name
3. Tap "+ Add payment method" → AddHandleScreen → tap "Venmo" chip (it highlights) → type "@testhandle" → tap Save → navigate back → "Venmo @testhandle" appears in the handles list on ProfileScreen
4. Swipe left on a handle → red Delete button appears → tap Delete → confirmation alert appears → confirm → handle disappears from the list
5. In Supabase Studio: `SELECT handle_encrypted FROM user_payment_handles WHERE is_active = true` — the stored values are encrypted blobs, not readable handle strings
6. `PushPermissionScreen` is rendered when `is_new_user === true` after OTP verify (routed from OTPVerifyScreen)
7. `PushPermissionScreen` shows explanation: 'Enable notifications to get payment reminders and confirmations'
8. 'Allow' button on `PushPermissionScreen` → calls `POST /api/v1/users/me/push-token` with `{ device_id, token, platform }` → navigates to HomeScreen
9. 'Not now' button on `PushPermissionScreen` → skips token registration, navigates to HomeScreen
10. If user already has a push token (`is_new_user === false`), `PushPermissionScreen` is NOT shown

**Tests required:**
```
mobile/src/__tests__/unit/store/profileStore.test.ts
  - loadProfile() calls both GET /users/me and GET /users/me/handles
  - addHandle() adds the handle optimistically before the API response
  - addHandle() confirms the handle from the API response (updates with real ID)
  - deleteHandle() removes the handle from the list immediately
  - reorderHandles() updates display_order values in the local list

mobile/src/__tests__/components/profile/AddHandleScreen.test.tsx
  - renders all provider chip options (Venmo, PayPal, Cash App, Zelle, Wise, Bank Transfer, Other)
  - selecting a provider chip updates the input placeholder text
  - Save button is disabled when no provider is selected
  - Save button is disabled when handle_value is empty
  - pressing Save calls profile service addHandle with correct provider and handle_value
  - navigates back after successful save
```

---

*End of first half. Document continues in the second half with Epics E05–E12.*

## EPIC 5 — Event Creation, QR & Live Member List
**Depends on:** E04 complete
**Delivers:** Creator can create an event, display a QR code, see participants join in real time, add manually, lock the group

### E05-S01 — Event CRUD API

**Description:** Build all event endpoints: create, list (paginated), get by ID, lock, reopen, regenerate expired token. These endpoints are the backbone of the entire event lifecycle and must handle token generation, ownership verification, and state transitions correctly before any UI is built.

**Prompt:**
*"Build the complete event CRUD API for LetsSplyt. (1) POST /api/v1/events: body { title: string, date?: string }, creates event with payer_id=req.user.id, status='open', ai_stage='none', generates join token using crypto.randomBytes(18).toString('base64url') stored in event_join_tokens with expires_at=NOW()+24h, returns { id, title, status, join_url: process.env.APP_DOMAIN+'/join/'+token, token_expires_at }. (2) GET /api/v1/events: cursor pagination (cursor + limit query params, default limit 20), returns { events: [...], next_cursor, has_more }, each event includes { id, title, status, participant_count, total_amount, created_at }. (3) GET /api/v1/events/:id: returns full event including participant list (display_name only, no phone), join_url if status='open', settlement summary if status!='open'. (4) POST /api/v1/events/:id/lock: verifies payer_id=req.user.id, checks participant count >= 2, sets status='locked' and locked_at=NOW(), returns updated event. (5) POST /api/v1/events/:id/reopen: verifies payer_id, sets status='open', generates new join token (old one deactivated via is_active=false), returns new join_url. (6) POST /api/v1/events/:id/join-token/regenerate: for expired tokens with status='open', generates new token and deactivates the old one. All routes require authenticate middleware. Use `events.title` (not `events.name`) for the event title column in all SQL queries and TypeScript types. Place shared types in shared/types/event.types.ts."*

**Files created:**
- `backend/src/modules/events/event.controller.ts`
- `backend/src/modules/events/event.service.ts`
- `backend/src/modules/events/event.routes.ts`
- `shared/types/event.types.ts`
- `backend/src/__tests__/unit/events/event.service.test.ts`
- `backend/src/__tests__/integration/events/events.test.ts`

**Acceptance Criteria:**
1. POST /events returns join_url containing the join token
2. GET /events returns paginated results with next_cursor when more than 20 events exist
3. POST /events/:id/lock with < 2 participants returns 400 with error 'MINIMUM_PARTICIPANTS_REQUIRED'
4. POST /events/:id/lock with valid event (2+ participants) returns status='locked' and locked_at is set
5. POST /events/:id/reopen generates a NEW token — SELECT is_active FROM event_join_tokens WHERE token=oldToken returns false
6. User B cannot lock User A's event — returns 403

**Tests required:**
```
backend/src/__tests__/unit/events/event.service.test.ts
  - creates event with correct payer_id
  - generates cryptographically random token (not sequential, not predictable)
  - lock rejects when participant count < 2
  - lock sets locked_at timestamp
  - reopen deactivates old token and creates new one
  - list returns cursor-paginated results

backend/src/__tests__/integration/events/events.test.ts
  - POST /events → 201 with join_url
  - GET /events → paginated list belonging to auth user
  - GET /events/:id → event with participants (display_name only)
  - POST /events/:id/lock → 200 or 400 (min participants)
  - Another user's lock attempt → 403
```

---

### E05-S02 — Add Participant API + Manual Add

**Description:** Build the Add Participant endpoint for manually adding participants (with or without phone), and the participant list endpoint. Phone numbers must be hashed before storage — never stored in plaintext. Ownership and event-state checks must be enforced on every write.

**Prompt:**
*"Build the manual participant management API for LetsSplyt. (1) POST /api/v1/events/:id/participants/manual: body { display_name: string, phone_e164?: string, join_method: 'manual_phone'|'manual_name_only' }, verifies event belongs to req.user.id and status='open', if phone provided: hash it using hashPhone(), encrypt it using encrypt(), check sms_opt_outs by hash, create participant row with hashed+encrypted phone. If name-only: create participant with user_id=null and no phone fields stored. Returns created participant { id, display_name, join_method, payment_status }. (2) DELETE /api/v1/events/:id/participants/:participantId: verifies event owner, removes participant only if payment_status='pending', returns 400 CANNOT_REMOVE_ACTIVE_PARTICIPANT if participant has any non-pending status. Both routes check event status is 'open' and return 400 GROUP_IS_LOCKED if not. Return 403 if requesting user does not own the event."*

**Files created:**
- `backend/src/modules/events/participant.controller.ts`
- `backend/src/modules/events/participant.service.ts`
- `backend/src/__tests__/unit/events/participant.service.test.ts`
- `backend/src/__tests__/integration/events/participants.test.ts`

**Acceptance Criteria:**
1. POST manual participant with phone — SELECT phone_hash FROM participants WHERE id=... returns a hash string, not the original phone number
2. POST name-only participant — participant created with user_id=null and no phone_hash or phone_encrypted fields
3. DELETE participant with payment_status='self_reported' returns 400 CANNOT_REMOVE_ACTIVE_PARTICIPANT
4. Add participant to locked event returns 400 GROUP_IS_LOCKED
5. Another user adding to someone else's event returns 403

**Tests required:**
```
backend/src/__tests__/unit/events/participant.service.test.ts
  - manual add with phone: hashes phone before storing
  - manual add name-only: creates with user_id=null
  - delete: rejects if payment_status is not 'pending'
  - add to locked event: returns GROUP_IS_LOCKED error

backend/src/__tests__/integration/events/participants.test.ts
  - POST manual participant → 201, participant visible in GET /events/:id
  - Phone stored as hash not plaintext (DB check)
  - DELETE pending participant → 204
  - DELETE self_reported participant → 400
```

---

### E05-S03 — Mobile Event Screens (Create + QR + Detail)

**Description:** Build CreateEventModal, QRDisplayModal, EventDetailScreen (joining phase with Realtime), HomeScreen, and EventsScreen. The EventDetailScreen uses Supabase Realtime to update the member list automatically when new participants join — the creator should see new members appear without refreshing.

**Prompt:**
*"Build the complete event creation and management screens for LetsSplyt mobile. IMPORTANT: The event title field from the API is `event.title` (not `event.name`) — use `event.title` in all TypeScript component code, Zustand store, and API calls. (1) HomeScreen: net balance hero card (green if positive 'You're owed $X', red if negative 'You owe $X', grey if zero), Needs attention section (pending confirmations), recent events list (last 3 — display `event.title` for each), FAB '+ New event' → CreateEventModal. Balance fetched from GET /api/v1/users/me/balance (built in E09-S02 — see E05-S03 acceptance criteria for graceful degradation). (2) EventsScreen: segmented control Active|Settled, paginated list of event cards (`event.title`, date, participant count, status chip, outstanding amount), FAB → CreateEventModal, tap card → EventDetailScreen. (3) CreateEventModal (bottom sheet): title input autofocused (label 'Event title'), Create button → POST /events with body `{ title }`, on success dismiss modal then open QRDisplayModal. (4) QRDisplayModal (fullscreen): large QR code using react-native-qrcode-svg, `event.title` above, Copy link + Share buttons below, Expired state shows 'Regenerate' button that calls POST /events/:id/join-token/regenerate. (5) EventDetailScreen (joining phase, refer to prototype/participant.html): display `event.title` at top, QR below (tap → fullscreen QRDisplayModal), live member list via Supabase Realtime channel 'event-members:[eventId]', each member shows display_name + join_method chip (QR Web / App / Manual), '+Add manually' button → AddParticipantModal (bottom sheet: name field + optional phone with country picker, or 'Name only' toggle), 'Lock group →' button disabled if fewer than 2 members with count badge '3 members'. On Realtime event: subscribe to channel 'event-members:[eventId]', on ANY change re-fetch GET /events/:id (never use payload.new directly to update state). Zustand eventStore: events list, currentEvent, participants list — actions: createEvent, loadEvents, loadParticipants, lockEvent."*

**Files created:**
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/screens/EventsScreen.tsx`
- `mobile/src/components/events/CreateEventModal.tsx`
- `mobile/src/components/events/QRDisplayModal.tsx`
- `mobile/src/screens/EventDetailScreen.tsx`
- `mobile/src/components/events/AddParticipantModal.tsx`
- `mobile/src/store/eventStore.ts`
- `mobile/src/__tests__/unit/store/eventStore.test.ts`
- `mobile/src/__tests__/components/events/CreateEventModal.test.tsx`
- `mobile/src/__tests__/components/events/EventDetailScreen.test.tsx`

**Acceptance Criteria:**
1. Tap "+ New event" → modal opens with name input automatically focused
2. Type "Friday Dinner" and tap Create → QR code modal appears with a scannable QR code encoding the join URL
3. Open the join URL on another device's browser → web join form loads correctly
4. When the browser device joins, the member list on the creator's phone updates AUTOMATICALLY within 2 seconds (Realtime working)
5. Lock group button is disabled when 0 members are shown, enabled when 1 or more members are present
6. Tap Lock → event status transitions → screen moves to settlement phase view
7. Balance card calls `GET /api/v1/users/me/balance` but gracefully degrades: if the endpoint returns 404 or the call fails, show 'Balance unavailable' placeholder. Do NOT hard-fail. The endpoint is built in E09-S02.
8. Do NOT call any settlement endpoint that isn't built yet. Use a stub response shape for the balance card.

**Tests required:**
```
mobile/src/__tests__/unit/store/eventStore.test.ts
  - createEvent adds to events list
  - loadParticipants populates participants for current event
  - lockEvent updates event status

mobile/src/__tests__/components/events/CreateEventModal.test.tsx
  - renders name input autofocused
  - Create button calls event service
  - shows loading while creating
  - dismisses on success

mobile/src/__tests__/components/events/EventDetailScreen.test.tsx
  - renders participant list
  - shows Lock button disabled with 0 participants
  - shows Lock button enabled with 1+ participants
  - subscribes to Realtime on mount
  - unsubscribes from Realtime on unmount (no memory leaks)
```

---

## EPIC 6 — Join Flows (Web + App)
**Depends on:** E05 complete (events must exist before joining)
**Delivers:** Guests join via browser, App Members join via deep link, both appear in creator's real-time member list

### E06-S01 — Web Join Page (Server-Rendered HTML)

**Description:** The web join page is a server-rendered Express route returning HTML — not React Native. Guests on any device open it in their browser and it must work without JavaScript enabled. OTP verification, opt-out checking, and participant creation all happen server-side. A successful join triggers a Supabase Realtime event that updates the creator's EventDetailScreen.

**Prompt:**
*"Build the server-rendered web join flow for LetsSplyt. All routes return HTML, not JSON. (1) GET /join/:token: Express route returning HTML. Validate token in event_join_tokens (is_active=true, expires_at>NOW()). If expired: return HTML page 'This QR code has expired. Ask the bill payer to regenerate the code.' If group locked: return HTML page 'This group is no longer accepting new members.' If valid: return HTML form with name field (required), phone field with <select> of E.164 country code prefixes for major countries (US +1, CA +1, GB +44, AU +61, IN +91, etc.), and submit button 'Join →'. Style all pages to match prototype/participant.html and prototype/guest.html (translate CSS to inline <style> tag in the HTML). (2) POST /join/:token: receives { name, phone_e164 } from form. Validate E.164 format. Check sms_opt_outs table by phone_hash. Check if phone_hash already in participants for this event — if so: redirect to success page (idempotent). Send OTP via Twilio Verify. Write funnel_checkpoint row { checkpoint: 'phone_entered', event_id }. Return OTP entry page HTML with a 6-digit code input form. (3) POST /join/:token/verify-otp: receives { code, phone_e164 }. Call Twilio verificationChecks.create. If approved: hash+encrypt phone, create participant row (join_method='qr_web', message_channel based on phone country). Write funnel_checkpoint 'join_confirmed'. Return success HTML page 'You're in! The bill payer will message you when the split is ready.' The participant INSERT triggers Supabase Realtime broadcast to 'event-members:[eventId]' channel."*

**Files created:**
- `backend/src/modules/join/join-web.controller.ts`
- `backend/src/modules/join/join-web.service.ts`
- `backend/src/modules/join/join-web.routes.ts`
- `backend/src/modules/join/templates/join-form.html.ts`
- `backend/src/modules/join/templates/otp-entry.html.ts`
- `backend/src/modules/join/templates/join-success.html.ts`
- `backend/src/modules/join/templates/expired.html.ts`
- `backend/src/modules/join/templates/locked.html.ts`
- `backend/src/__tests__/integration/join/web-join.test.ts`
- `backend/src/__tests__/unit/join/join.service.test.ts`

**Acceptance Criteria:**
1. Open the join URL in a desktop browser → HTML form with name and phone fields is shown (no app required)
2. Submit valid name + phone → receives OTP (Twilio test mode shows OTP in terminal logs)
3. Enter OTP code `000000` (Twilio test magic code in test environment) → success page shown
4. On creator's phone, the new member appears in EventDetailScreen within 2 seconds of OTP verification
5. Visiting an expired token URL shows the expiry message page, not a 404 or crash
6. Visiting a locked group's URL shows the locked message page
7. **Existing user detection:** Before creating a guest participant, the server hashes the submitted phone and queries the `users` table. If a matching user exists (`phone_hash` match), return 409 with `{ error: { code: 'APP_USER_REDIRECT', deep_link_url: 'letssplyt://join/:token' } }`. The web page shows: 'You already have LetsSplyt! Open the app to join.' with a deep-link button.
8. **Race condition with event lock:** If the event locks WHILE the guest is entering their phone/OTP (between `GET /join/:token` and `POST /join/:token/otp/verify`), the server returns 409 `EVENT_LOCKED`. The web page shows: 'This event has been locked. Ask the bill payer to unlock it or contact them directly.'
9. **Wrong OTP code HTML response:** Invalid OTP code on `POST /join/:token/otp/verify` returns the web page (not JSON) with an error message inline. The phone input remains populated. The code input is cleared.

**Tests required:**
```
backend/src/__tests__/integration/join/web-join.test.ts (supertest)
  - GET /join/:validToken → 200 HTML with form
  - GET /join/:expiredToken → 200 HTML with expiry message (NOT 404)
  - GET /join/:lockedToken → 200 HTML with locked message
  - POST /join/:token with valid phone → OTP sent (Twilio mock called), funnel_checkpoint written
  - POST /join/:token/verify-otp with '000000' → participant created in DB
  - Second join attempt with same phone → redirected (idempotent)

backend/src/__tests__/unit/join/join.service.test.ts
  - phone hashed before participant creation
  - phone encrypted before participant creation
  - sms_opt_outs checked by hash before OTP send
  - funnel_checkpoint written at phone_entered and join_confirmed
```

---

### E06-S02 — In-App Join + Deep Link Handler

**PREREQUISITE: Complete E06-S03 (Deep Link Infrastructure) BEFORE running E06-S02's Xcode/Android acceptance tests.** The Universal Link test in E06-S02 ('paste URL → app opens') requires the AASA file served by E06-S03's backend changes. Build E06-S03 first, deploy it, then return to E06-S02.

**Description:** When a participant with the app installed taps the join link, the app intercepts it via Universal Link and handles joining in-app. Must work in all three app states: open (foreground), backgrounded, and completely closed (cold start). Unauthenticated users are routed through auth and returned to the join flow after logging in.

**Prompt:**
*"Build the in-app join flow and deep link handler for LetsSplyt. (1) Backend: POST /api/v1/join/:token/app-join (requires authenticate middleware): verify token is active and not expired, verify event status is not 'locked', create participant row with join_method='qr_app' and user_id=req.user.id, write funnel_checkpoint 'join_confirmed'. Return { eventId, eventName, amount_owed: null }. If event is locked return 400 GROUP_IS_LOCKED. If participant already exists for this user+event return 409 ALREADY_JOINED. (2) Mobile — NavigationContainer linking config in RootNavigator.tsx: prefixes [process.env.EXPO_PUBLIC_APP_DOMAIN], config { screens: { AppJoin: 'join/:token' } }. Implement getInitialURL for cold start (app was closed). Implement subscribe for warm start (app was backgrounded). When token received and user is NOT authenticated: navigate to PhoneEntryScreen with returnTo: { screen: 'AppJoin', params: { token } } so user is returned to the join screen after completing auth. (3) AppJoinScreen: fetches event name from GET /api/v1/join/:token/preview (add this lightweight endpoint returning { eventName, creatorName }), shows event name and creator name, single 'Join →' button that calls POST /api/v1/join/:token/app-join, on success navigates to AppJoinedScreen, if response is GROUP_IS_LOCKED navigates to AppLockedScreen. (4) AppJoinedScreen: 'You've joined!' message, event name displayed, 'View event →' button navigates to EventDetailScreen. (5) AppLockedScreen: locked message, 'Go home →' button navigates to HomeScreen."*

**Files created:**
- `backend/src/modules/join/join-app.controller.ts`
- `backend/src/modules/join/join-app.service.ts`
- `backend/src/modules/join/join-app.routes.ts`
- `mobile/src/navigation/RootNavigator.tsx` (updated with linking config)
- `mobile/src/screens/AppJoinScreen.tsx`
- `mobile/src/screens/AppJoinedScreen.tsx`
- `mobile/src/screens/AppLockedScreen.tsx`
- `backend/src/__tests__/integration/join/app-join.test.ts`
- `mobile/src/__tests__/components/join/AppJoinScreen.test.tsx`

**Acceptance Criteria:**
1. Paste the join URL into an Android browser while LetsSplyt is installed → app opens to AppJoinScreen (not the browser web form)
2. Tap "Join" → POST /api/v1/join/:token/app-join succeeds → AppJoinedScreen shown with event name
3. Creator sees the new App Member appear in EventDetailScreen within 2 seconds (Realtime)
4. Joining a locked event from the app shows AppLockedScreen message, not a crash
5. Tapping the join link while not logged in → PhoneEntryScreen → after completing auth → returned to AppJoinScreen (not HomeScreen)

**Tests required:**
```
backend/src/__tests__/integration/join/app-join.test.ts
  - authenticated user joins valid event → 201 participant created
  - join locked event → 400 GROUP_IS_LOCKED
  - join twice with same token → 409 ALREADY_JOINED
  - join another user's event → 200 (any authenticated user can join)

mobile/src/__tests__/components/join/AppJoinScreen.test.tsx
  - renders event name from route params
  - Join button calls join service
  - navigates to AppJoinedScreen on success
  - navigates to AppLockedScreen when event is locked
```

---

### E06-S03 — Deep Link Infrastructure (AASA, App Links, Expo Config)

**What:** Serve the Universal Links (iOS) and App Links (Android) verification files from the backend, and configure the Expo app to intercept LetsSplyt deep links.

**Acceptance Criteria:**
- `GET /.well-known/apple-app-site-association` served as `application/json`, no redirect, no `.json` extension. Content includes the app's bundle ID and team ID. File stored at `backend/public/.well-known/apple-app-site-association`.
- `GET /.well-known/assetlinks.json` served as `application/json`. Content includes the app's SHA-256 fingerprint and package name. File stored at `backend/public/.well-known/assetlinks.json`.
- Express serves the `backend/public/` directory as static files (add `app.use(express.static('public'))` before all routes).
- In `mobile/app.config.js`, configure:
  - iOS: `expo.ios.associatedDomains: ['applinks:letssplyt.app', 'applinks:staging.letssplyt.app']`
  - Android: `expo.android.intentFilters` with `action: 'VIEW'`, `category: ['BROWSABLE', 'DEFAULT']`, `data: { scheme: 'https', host: 'letssplyt.app', pathPrefix: '/join/' }`
- `app.config.js` does NOT include `expo-router` plugin — confirm this is absent.
- Test: On iOS simulator, tapping a `https://letssplyt.app/join/abc123` link opens the app (not Safari). On Android, same with intent filter.
- Test: `curl -I http://localhost:3000/.well-known/apple-app-site-association` returns 200 with `Content-Type: application/json`.

**Prompt:**
Read CLAUDE.md, BUILD-PROGRESS.md, and this story. Read `backend/src/app.ts`, `mobile/app.config.js`, and `docs/02-User-Flows.md` (deep link handling section). Then implement:

1. Create `backend/public/.well-known/apple-app-site-association` JSON file.
2. Create `backend/public/.well-known/assetlinks.json` JSON file.
3. Add `express.static('public')` to `backend/src/app.ts` before any routes.
4. Update `mobile/app.config.js` to add `associatedDomains` (iOS) and `intentFilters` (Android). Do NOT add expo-router plugin.

Use placeholder values for bundle ID (`com.letssplyt.app`), team ID (`TEAMID_PLACEHOLDER`), SHA-256 fingerprint (`00:11:22:...`). These will be replaced with real values when Apple Developer and Google Play accounts are set up.

Run: `curl http://localhost:3000/.well-known/apple-app-site-association` and verify 200 response with JSON.

**Files created:**
- `backend/public/.well-known/apple-app-site-association`
- `backend/public/.well-known/assetlinks.json`
- Updates to `backend/src/app.ts` (add static file serving)
- Updates to `mobile/app.config.js` (add associatedDomains and intentFilters)

---

## EPIC 7 — AI Receipt Pipeline (A1 + A2 + Split Calculator)
**Depends on:** E05 + E06 complete (event must be locked before scanning)
**Delivers:** Creator scans receipt → AI extracts items → creator reviews → split calculated → split review shown

### E07-S01 — Receipt Image Upload

**Description:** Handle receipt image upload from mobile to Supabase Storage. The image is compressed on the mobile side to under 500KB, the backend issues a signed upload URL, and the mobile app uploads directly to Supabase Storage (not through the backend). Upload progress is shown to the user and failures show a retry option.

**Prompt:**
*"Build the receipt image upload flow for LetsSplyt. (1) Backend: POST /api/v1/receipts/upload-url (requires authenticate middleware): body { event_id }. Verifies event belongs to req.user.id and event.status='locked' (return 400 if not locked). Generates a Supabase Storage signed upload URL for bucket 'receipts' at path [eventId]/[uuid].jpg using supabase.storage.from('receipts').createSignedUploadUrl(path). Returns { upload_url, storage_path }. (2) Mobile ReceiptScanScreen (refer to prototype/receipt-split.html ID 'scan_receipt'): full-screen expo-camera view with a circular capture button at the bottom. On capture: use expo-image-manipulator to resize to max 1200px width and compress to JPEG quality 0.7 (this keeps files under ~500KB for typical receipts). Call POST /receipts/upload-url to get the signed URL. Then PUT the compressed image binary to upload_url with header Content-Type: image/jpeg using fetch(). Show a progress indicator (ActivityIndicator or progress bar) while uploading. On upload success: automatically call POST /receipts/parse (E07-S02) and navigate to ItemReviewScreen. On upload failure: show error toast with a 'Retry' button that repeats only the PUT (reuse the same signed URL if not expired). 'Enter total manually' link at bottom skips camera and navigates to SplitEntryScreen."*

**Files created:**
- `backend/src/modules/receipts/receipts.controller.ts`
- `backend/src/modules/receipts/receipts.service.ts`
- `backend/src/modules/receipts/receipts.routes.ts`
- `mobile/src/screens/ReceiptScanScreen.tsx`
- `mobile/src/services/receipts.service.ts`
- `backend/src/__tests__/unit/receipts/receipts.service.test.ts`
- `mobile/src/__tests__/unit/services/receipts.service.test.ts`

**Acceptance Criteria:**
1. Open ReceiptScanScreen → camera preview is visible with a circular capture button
2. Take a photo → progress indicator appears while image is being compressed and uploaded
3. After upload, file is visible in Supabase Storage dashboard at receipts/[eventId]/[uuid].jpg
4. Uploaded file size is under 600KB regardless of the original photo resolution
5. Tap "Enter total manually" link → navigates to SplitEntryScreen, bypassing the camera flow

**Tests required:**
```
mobile/src/__tests__/unit/services/receipts.service.test.ts
  - requests upload URL from backend
  - compresses image before upload
  - uploads to the signed URL with correct content-type header
  - calls parse endpoint after successful upload

backend/src/__tests__/unit/receipts/receipts.service.test.ts
  - upload-url: verifies event belongs to requesting user
  - upload-url: returns 400 when event status is not 'locked'
  - generates signed URL for correct storage path format
```

---

### E07-S02 — A1 Receipt Parsing (AI Agent)

**Description:** The core AI feature. Takes the uploaded receipt image path, sends to Gemini (dev) or Claude Haiku (prod) via the LLM factory, extracts line items with Zod validation, handles partial failures gracefully, and uses an atomic idempotency guard to prevent duplicate AI calls from concurrent requests.

**Prompt:**
*"Build the A1 receipt parsing AI agent for LetsSplyt. POST /api/v1/receipts/parse (requires authenticate middleware): body { event_id, storage_path }. (1) Atomic idempotency guard: run UPDATE events SET ai_stage='parsing' WHERE id=event_id AND ai_stage='none' — if 0 rows were updated, check the current ai_stage: if 'parsing' return 409 ALREADY_PROCESSING, if at any stage past 'parsing' call getCachedReceiptResult(event_id) and return it without calling AI. (2) Get a signed download URL from Supabase Storage for the storage_path. (3) Provider routing: for Gemini pass the URL directly as an image part; for Anthropic fetch the image bytes and convert to base64. (4) Call `createLLMProvider('A1')` from `src/infrastructure/llm/factory.ts`, call provider.complete() with the A1 system prompt from docs/07-AI-Agent-Specification.md. Call sanitizePromptInput() on any user-provided context before including in the prompt. (5) Validate the AI response text with Zod against ReceiptParseResult schema: { items: [{ name: string, price: number, quantity: number, confidence: 'high'|'medium'|'low' }], tax: number, tip: number, total: number, currency: string, locale: string }. Note: the `receipt_items` table column is named `name` (not `description`) — use `item.name` throughout. — all monetary amounts in minor units (integer cents or paise). If Zod validation fails: UPDATE events SET ai_stage='failed', return 500 PARSE_FAILED. (6) On success: write all items to receipt_items table, UPDATE events SET ai_stage='parsed'. Return the ReceiptParseResult. (7) getCachedReceiptResult(eventId): reads receipt_items joined with events to get tax, tip, total, currency, locale from the events table (not from receipt_items columns)."*

**Files created:**
- `backend/src/modules/ai/a1-receipt-parser.ts`
- `backend/src/modules/ai/a1-idempotency.ts`
- `backend/src/__tests__/unit/ai/a1-receipt-parser.test.ts`
- `backend/src/__tests__/unit/ai/a1-idempotency.test.ts`

**Acceptance Criteria:**
1. POST /receipts/parse with a valid storage_path → returns JSON with items array, tax, tip, total, and currency fields
2. SELECT ai_stage FROM events WHERE id=... shows 'parsed' after a successful parse
3. POST with the same event_id a second time → returns cached result from the database, AI provider is NOT called again (verify via mock call count)
4. Two concurrent POST requests for the same event_id → exactly one AI call is made (atomic idempotency works)
5. If AI returns malformed JSON that fails Zod validation → endpoint returns 500 PARSE_FAILED and ai_stage is set to 'failed'

**Tests required:**
```
backend/src/__tests__/unit/ai/a1-receipt-parser.test.ts
  - calls LLM factory (not direct SDK)
  - validates AI response with Zod before writing to DB
  - rejects malformed AI response with PARSE_FAILED
  - atomic idempotency: concurrent calls result in one AI call
  - getCachedReceiptResult reads from events table for financial fields (not receipt_items)
  - sanitizePromptInput called on all user-provided context

backend/src/__tests__/unit/ai/a1-idempotency.test.ts
  - claimParsingSlot returns true on first call
  - claimParsingSlot returns false on second concurrent call
  - ai_stage='failed' allows retry (claimParsingSlot succeeds again)
```

---

### E07-S03 — Item Review Screen (Mobile)

**Description:** After A1 parsing, show the creator an editable list of receipt items so they can correct AI mistakes before splitting. Low-confidence items are visually flagged. The screen recalculates the running total live as items are edited. Confirming sends the finalised item list to the backend.

**Prompt:**
*"Build the ItemReviewScreen and the receipts confirm endpoint for LetsSplyt. (1) Mobile ItemReviewScreen (refer to prototype/receipt-split.html ID 'item_review'): editable FlatList of receipt items, each row shows item name (tapping opens an inline TextInput), price (tapping opens a numeric TextInput), and quantity. Swipe left on a row reveals a red delete button. 'Add item' button at the bottom of the list adds a new empty row. Tax field pre-filled from the AI parse result (editable). Tip field pre-filled (editable). Running total shown live = sum of all items + tax + tip. Items with confidence='low' are shown with an amber left border and amber background tint. CTA button 'Confirm items →' at the bottom calls POST /api/v1/receipts/confirm, then navigates to SplitEntryScreen. Pull-to-refresh re-fetches GET /events/:id and re-displays the stored items — it does NOT re-run the AI. (2) Backend: POST /api/v1/receipts/confirm (requires authenticate middleware): body { event_id, items: [{ id?: string, name: string, price: number, quantity: number }], tax: number, tip: number }. Atomic guard: UPDATE events SET ai_stage='parsed_confirmed' WHERE id=event_id AND ai_stage='parsed' — return 400 if 0 rows updated. Delete existing receipt_items rows for event_id (allows re-confirmation). Insert final items array as new receipt_items rows. UPDATE events SET total_amount=sum(items)+tax+tip, tax_amount=tax, tip_amount=tip. Return { confirmed: true }."*

**Files created:**
- `mobile/src/screens/ItemReviewScreen.tsx`
- `mobile/src/__tests__/components/receipts/ItemReviewScreen.test.tsx`
- `backend/src/__tests__/unit/receipts/confirm.test.ts`

**Acceptance Criteria:**
1. ItemReviewScreen displays all items from the AI parse result with names and prices populated
2. Tap an item name → TextInput appears, type a new name, tap away → item name updates in the list
3. Low-confidence items (confidence='low') have a visible amber left border distinguishing them from others
4. Swipe left on an item → delete button appears → tap → item is removed and running total recalculates immediately
5. Tap "Add item" → a new empty row appears at the bottom with editable fields
6. Tap "Confirm items" → navigates to SplitEntryScreen

**Tests required:**
```
mobile/src/__tests__/components/receipts/ItemReviewScreen.test.tsx
  - renders all items from parse result
  - low-confidence items have amber styling
  - editing item name updates the list
  - deleting item updates running total
  - confirm button calls receipts service

backend/src/__tests__/unit/receipts/confirm.test.ts
  - updates ai_stage to 'parsed_confirmed'
  - rejects if ai_stage is not 'parsed'
  - calculates total_amount correctly
```

---

### E07-S04 — Split Calculator

**What this builds:** Pure TypeScript split calculator — the arithmetic core of the entire app. 100% test coverage required.

> **Canonical file path:** The split calculator file is: `shared/utils/splitCalculator.ts` (in the shared workspace, importable by both mobile and backend). The backend's A2 harness imports it as: `import { calculateSplits } from '@letssplyt/shared/utils/splitCalculator'`. Do NOT place this file in `backend/src/modules/splits/splitCalculator.ts` or `src/modules/ai/split-calculator/split-calculator.ts` — only `shared/utils/splitCalculator.ts` is correct.

**Prompt:**
Read docs/07-AI-Agent-Specification.md for the split calculator specification. Create `shared/utils/splitCalculator.ts` as a pure TypeScript module with zero AI, zero side effects, zero network calls:

1. `getCurrencyMinorUnits(currency: string): number` — returns decimal places per currency:
   - JPY, KRW, VND, CLP → 0
   - BHD, KWD, OMR → 3
   - All others (USD, EUR, GBP, INR, AUD, etc.) → 2
   - NEVER multiply all amounts by 100 universally

2. `toMinorUnits(amount: number, currency: string): number` — converts decimal amount to minor units

3. `fromMinorUnits(amount: number, currency: string): number` — converts minor units back to decimal

4. `calculateSplits(items, assignments, totals, participantNames, currencyCode): ParticipantSplit[]` — takes AI-generated item assignments and produces final owed amounts per participant. Performs all arithmetic internally (item prices → subtotal per person → proportional tax/tip → largest-remainder rounding). Sum invariant: all shares must sum exactly to the event total ± 1 minor unit.

5. `largestRemainderRound(shares: number[], currency: string): number[]` — the correct algorithm for rounding currency splits. Takes fractional major-unit amounts, returns integer minor-unit amounts. Distributes the rounding remainder to participants with the largest fractional parts. Deterministic tiebreaker: lowest original index receives extra minor unit first. Sum invariant: `sum(output) === Math.round(sum(shares) * multiplier) ± 1`.

Create `shared/utils/splitCalculator.test.ts` with 100% coverage:
- Even split: 3-way split of $10.00 → [334, 333, 333] cents, sum = 1000
- Even split: JPY ¥1000 3-way → [334, 333, 333], sum = 1000 (no decimal conversion)
- Even split: BHD 10.000 3-way → correct millifils
- Edge case: 1 participant gets 100%
- Edge case: amounts already divide evenly
- Itemised: assignments sum to total
- Itemised: rounding gap distributed correctly
- Percentage: 33.33% + 33.33% + 33.34% = 100%, sum invariant holds

**Files created:**
- `shared/utils/splitCalculator.ts`
- `shared/utils/splitCalculator.test.ts`

**Acceptance criteria:**
- [ ] All currency minor unit values correct (JPY=0, BHD=3, USD=2)
- [ ] Sum invariant holds for all split modes — shares always sum to total ± 0
- [ ] Largest-remainder rounding distributes extra cents correctly
- [ ] 100% line, branch, and function coverage
- [ ] Zero dependencies on AI, network, or database

**Tests to run:**
```bash
cd shared && npm test utils/splitCalculator.test.ts -- --coverage
```

**Expected output:** All tests pass. Coverage report shows 100% for splitCalculator.ts.

---

### E07-S05 — A2 NLP Assignment Agent

**What this builds:** The AI agent that reads natural language item assignments and maps them to participants — all math delegated to splitCalculator.ts.

**Prompt:**
Read docs/07-AI-Agent-Specification.md for the A2 agent specification. Build:

1. `backend/src/modules/splits/a2.agent.ts`:
   - `assignItems(eventId, rawText, items, participants)` function
   - Uses `createLLMProvider()` from `src/infrastructure/llm/factory.ts`
   - Calls `sanitizePromptInput()` on ALL user-supplied text before inserting into prompt
   - Prompt: given a list of receipt items and participant names, return a JSON mapping of which participant gets which items (NLP only — no math)
   - Validates response with Zod schema
   - Atomic idempotency: `UPDATE events SET ai_stage='calculating' WHERE id=$1 AND ai_stage='parsed'` — if 0 rows updated, return cached result
   - On success: update `ai_stage='calculated'`, store assignments in `receipt_items`
   - Exponential backoff with full jitter on LLM errors (3 retries max)
   - After NLP assignment, calls `calculateSplits()` from `import { calculateSplits } from '@letssplyt/shared/utils/splitCalculator'` for the actual math

2. `backend/src/modules/splits/splits.router.ts`:
   - `POST /events/:id/splits/assign` — triggers A2 agent, returns assignments
   - `POST /events/:id/splits/calculate` — accepts manual assignments or mode (`equal` | `itemised` | `portion`), calls splitCalculator, returns shares per participant

**Files created:**
- `backend/src/modules/splits/a2.agent.ts`
- `backend/src/modules/splits/splits.router.ts`

**Acceptance criteria:**
- [ ] A2 agent uses `createLLMProvider()` from `factory.ts`, never hardcodes provider
- [ ] `sanitizePromptInput()` called on all user text before LLM prompt
- [ ] Atomic ai_stage guard: `UPDATE events SET ai_stage='calculating' WHERE id=$1 AND ai_stage='parsed'` — prevents double-processing
- [ ] On success: `ai_stage` updated to `'calculated'`
- [ ] All math done by splitCalculator.ts — agent does zero arithmetic
- [ ] Zod validation on LLM response
- [ ] Exponential backoff on LLM failure

**Tests to run:**
```bash
cd backend && npm test src/modules/splits/a2.agent.test.ts
cd backend && npm test src/modules/splits/splits.router.test.ts
```

**Expected output:** All tests pass with mocked LLM provider.

---

### E07-S06 — Split Entry + Review Screens (Mobile)

**Description:** Four-tab split mode picker and the split review screen showing per-person amounts. The most complex mobile screen in the app — it must keep a live sum invariant check, support drag-and-drop item assignment, and integrate with A2 NLP for natural language assignment. The Review screen must confirm the sum before enabling the Send button.

**Prompt:**
*"Build SplitEntryScreen and SplitReviewScreen for LetsSplyt mobile. (1) SplitEntryScreen (refer to prototype/receipt-split.html IDs 'split_mode', 'custom_amounts', 'assign_tap'): four tab modes at the top — '= Even' auto-calculates equal shares immediately on load, '$ Amount' shows a numeric TextInput per participant for manual entry with a live counter 'Allocated: $X / Total: $Y' that turns red when the sum does not match the total, '% Percent' same with percentage inputs, '⅟ Portion' accepts integer ratios (e.g. 2:1:1). Itemised mode: 'Assign items' button opens an item assignment bottom sheet — react-native-draggable-flatlist showing a grid of receipt items, each participant shown as a column drop target. NLP input field below the item grid with placeholder 'Describe who had what...' and a submit button; tapping submit calls POST /splits/nlp-assign; unassigned items are highlighted in amber after a partial result. 'Review split →' button at the bottom is enabled only when the sum constraint is satisfied. Tapping it calls POST /splits/calculate then navigates to SplitReviewScreen. (2) SplitReviewScreen (refer to prototype/receipt-split.html ID 'split_breakdown'): per-person table — avatar initial, display name, item list if itemised mode, subtotal, tax+tip share, TOTAL in bold. Sum invariant line at the bottom 'Total: $47.35 ✓' in green. Tap any amount row → numeric input bottom sheet to override that participant's amount (re-validates sum constraint). 'Send to all →' button navigates to MessagePreviewScreen; disabled if any amounts are missing or sum fails."*

**Files created:**
- `mobile/src/screens/SplitEntryScreen.tsx`
- `mobile/src/screens/SplitReviewScreen.tsx`
- `mobile/src/components/splits/ItemAssignmentSheet.tsx`
- `mobile/src/__tests__/components/splits/SplitEntryScreen.test.tsx`
- `mobile/src/__tests__/components/splits/SplitReviewScreen.test.tsx`

**Acceptance Criteria:**
1. Even tab: selecting Even mode auto-fills all participant amounts and they sum correctly to the event total
2. Amount tab: entering amounts shows live "Allocated: $X / Total: $Y" counter that turns red when the values do not sum to the receipt total
3. NLP field: type "Mark had the salmon", tap submit → loading indicator → Mark's row shows the salmon item highlighted in the assignment grid
4. SplitReviewScreen: all participant amounts are shown in a table and the sum at the bottom matches the receipt total with a checkmark
5. "Send to all" button is disabled if any participant has no amount assigned or the sum constraint fails

**Tests required:**
```
mobile/src/__tests__/components/splits/SplitEntryScreen.test.tsx
  - Even tab: shows equal amounts for all participants
  - Amount tab: disables Review button when amounts don't sum to total
  - NLP submit calls splits service
  - unassigned items shown in amber after partial NLP result

mobile/src/__tests__/components/splits/SplitReviewScreen.test.tsx
  - renders per-person breakdown
  - shows sum invariant at bottom
  - Send button disabled when amounts missing
  - tap amount row opens edit sheet
```

---

## EPIC 8 — Message System (A3 + Twilio)
**Depends on:** E07 complete (split must be calculated before messages)
**Delivers:** Creator previews AI-generated messages, sends to all via Twilio, sees real-time delivery tracking

### E08-S01 — A3 Message Generation + Preview API

**Description:** A3 generates personalised payment request messages for each participant. Names and payment links are assembled AFTER the AI call completes — never inside the AI prompt — to prevent PII from appearing in prompt logs or AI training data. Payment deep links are filtered by the participant's country.

**Prompt:**
*"Build the A3 message generation and preview API for LetsSplyt. POST /api/v1/messages/preview (requires authenticate middleware): body { event_id }. (1) Atomic guard: UPDATE events SET ai_stage='messaging' WHERE id=event_id AND ai_stage='calculated' — return 409 if 0 rows updated. (2) Load participants, receipt summary, and the payer's payment handles from the database. (3) For each participant: build the A3 prompt using ONLY sanitized item names and the amount formatted via formatCurrency(amount, event.currency, event.locale). Use the label 'Recipient' as the placeholder — never include the participant's real name or phone number in the prompt. Call createLLMProvider('A3') from `src/infrastructure/llm/factory.ts` and call provider.complete() with the A3 system prompt from docs/07-AI-Agent-Specification.md. The AI generates: greeting text (generic), message body listing items and the formatted amount, closing text. (4) AFTER the AI call returns: string-replace 'Recipient' with participant.display_name in the generated text. (5) Generate payment deep links from the payer's handles: Venmo deep link format venmo://paycharge?txn=pay&recipients={handle}&amount={amount}&note={note}, PayPal format https://paypal.me/{handle}/{amount}, CashApp format https://cash.app/${cashtag}/{amount}, Zelle: return the handle text only (no universal deep link exists), Wise format https://wise.com/pay/me/{handle}. Filter links by participant country: Canadian (+1 with area codes 204/226/236/249/250/289/306/343/365/387/403/416/418/431/437/438/450/506/514/519/548/579/581/587/604/613/639/647/672/705/709/742/753/778/780/782/807/819/825/867/873/902/905) removes Venmo and Zelle links. Indian numbers (+91) removes Venmo and CashApp, adds Wise. (6) Return array of { participant_id, display_name, message_text, payment_links: [{ provider, label, url|handle }], amount }."*

**Files created:**
- `backend/src/modules/messages/messages.controller.ts`
- `backend/src/modules/messages/messages.service.ts`
- `backend/src/modules/messages/deepLinks.ts`
- `backend/src/modules/messages/messages.routes.ts`
- `backend/src/__tests__/unit/ai/a3-message.test.ts`
- `backend/src/__tests__/unit/messages/deepLinks.test.ts`

**Acceptance Criteria:**
1. POST /messages/preview returns an array with exactly one entry per participant
2. Each entry has a personalised greeting using the participant's display_name (not the placeholder 'Recipient')
3. Each entry has payment links appropriate for the participant's country
4. A participant with a Canadian mobile number (e.g. +1 416 555 0000) does NOT have Venmo or Zelle links in their payment_links array
5. No phone number appears in any message_text field and no phone number appears in AI prompt logs (verify via mock)

**Tests required:**
```
backend/src/__tests__/unit/ai/a3-message.test.ts
  - builds A3 prompt WITHOUT participant names or phone numbers
  - inserts real display_name AFTER AI call (not inside prompt)
  - generates correct deep link format per provider
  - Canadian +1 numbers: excludes Venmo and Zelle links
  - Indian numbers: includes Wise, excludes Venmo and CashApp
  - formatCurrency called with event currency (not hardcoded $)
  - sanitizePromptInput called on all item names

backend/src/__tests__/unit/messages/deepLinks.test.ts
  - Venmo link format: venmo://paycharge?txn=pay&recipients=...
  - PayPal link format: https://paypal.me/{handle}/{amount}
  - CashApp link format: https://cash.app/${cashtag}/{amount}
  - Zelle: returns handle text (no deep link)
  - Wise: https://wise.com/pay/me/{handle}
  - Amount correctly formatted per currency
```

---

### E08-S02 — Send Messages + Twilio Delivery

**Description:** Send all messages via Twilio Programmable Messaging, write delivery records per participant, and expose a webhook for Twilio delivery status callbacks and opt-out handling. Twilio signature verification must be enforced on all webhook endpoints — unsigned requests are rejected with 403.

**Prompt:**
*"Build the message sending service and Twilio webhooks for LetsSplyt. (1) POST /api/v1/messages/send (requires authenticate middleware): body { event_id, participant_ids?: string[] } — if participant_ids is omitted or empty, send to all participants. For each participant: check sms_opt_outs by phone_hash and skip if opted out. Determine channel: US and Canadian numbers → SMS (from: process.env.TWILIO_PHONE_NUMBER), all other countries → attempt WhatsApp first (from: 'whatsapp:'+process.env.TWILIO_WHATSAPP_NUMBER) with SMS as fallback. Call twilio.messages.create({ from, to: decryptedPhone, body: message_text }). Write notification_log row: { participant_id, channel, twilio_sid, status: 'queued', sent_at: NOW() }. The notification_log INSERT triggers a Supabase Realtime broadcast to channel 'event-settlement:[eventId]'. After all sends: UPDATE events SET ai_stage='complete'. Return { sent: count, failed: count, skipped_opt_out: count }. (2) POST /api/v1/webhooks/twilio/opt-out: Twilio posts here when a recipient replies STOP. Verify the X-Twilio-Signature header using twilio.validateRequest(authToken, url, params, signature) — return 403 immediately if invalid. Extract the From phone number from the Twilio payload, compute phone_hash, INSERT into sms_opt_outs. Return 200 with TwiML response <Response/>. (3) POST /api/v1/webhooks/twilio/delivery: verify Twilio signature (same method). Parse MessageStatus and MessageSid from body. UPDATE notification_log SET status=MessageStatus, delivered_at=NOW() WHERE twilio_sid=MessageSid. Return 200."*

**Files created:**
- `backend/src/modules/messages/send.service.ts`
- `backend/src/modules/webhooks/twilio.controller.ts`
- `backend/src/modules/webhooks/twilio.routes.ts`
- `backend/src/__tests__/unit/messages/send.service.test.ts`
- `backend/src/__tests__/unit/webhooks/twilio.webhook.test.ts`

**Acceptance Criteria:**
1. POST /messages/send → Twilio mock is called once per participant, messages visible in Twilio test console
2. notification_log table has exactly one row per participant after send completes
3. POST /webhooks/twilio/opt-out with an invalid or missing X-Twilio-Signature header → 403 response, no database write
4. POST /webhooks/twilio/opt-out with a valid Twilio-signed payload → row inserted in sms_opt_outs
5. A subsequent OTP request for the opted-out phone number → returns OTP_UNAVAILABLE error (from E03 flow)

**Tests required:**
```
backend/src/__tests__/unit/messages/send.service.test.ts
  - calls Twilio for each participant
  - skips opted-out participants
  - writes notification_log for each sent message
  - uses SMS for US numbers, WhatsApp for international
  - updates ai_stage to 'complete'

backend/src/__tests__/unit/webhooks/twilio.webhook.test.ts
  - rejects requests with invalid Twilio signature
  - inserts sms_opt_outs on STOP message
  - updates notification_log on delivery callback
```

---

### E08-S03 — Split Image Generator

**Description:** The personalised split image is sent with every payment request message — it is the core visual differentiator of LetsSplyt. Each participant receives an image with their name highlighted and their specific items shown. Generated server-side using @napi-rs/canvas (Node.js canvas implementation).

**Prompt:**
*"Build the split image generator as specified in docs/08-Mobile-App-Specification.md Section 10. Create backend/src/modules/messages/split-image.generator.ts. Install @napi-rs/canvas (the Node.js canvas implementation that works without native dependencies). The generator function: generateSplitImage(params: SplitImageParams): Promise<Buffer> where SplitImageParams = { eventName: string, payerDisplayName: string, participants: ParticipantSplitRow[], highlightedParticipantId: string, currency: string, locale: string }. Layout (from docs/08-Mobile-App-Specification.md Section 10): 600×400px canvas, dark background (#1a1a2e), event name at top in white bold font, horizontal divider, table of participants (name | items | amount), highlighted participant row uses accent color (#6366F1), all others use subtle row alternation. Font registration: use canvas.registerFont() with a system font — on Railway use '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf' as fallback. Return the canvas as a PNG Buffer. In send.service.ts: after A3 generates message text for each participant, call generateSplitImage({ ...event, highlightedParticipantId: participant.id }), upload the PNG to Supabase Storage as receipts/[eventId]/split-[participantId].png, get a signed URL, pass the URL to Twilio as mediaUrl parameter in messages.create(). Handle image generation failure gracefully: if generateSplitImage throws, log the error and send the message without the image (never block message delivery for image failure)."*

**Files created:**
- `backend/src/modules/messages/split-image.generator.ts`
- Updates to `backend/src/modules/messages/send.service.ts` (add mediaUrl to Twilio call)

**Acceptance Criteria:**
1. After sending messages, Supabase Storage shows PNG files at `receipts/[eventId]/split-[participantId].png`
2. The highlighted participant's row is visually distinct (different background colour) in the image
3. Twilio message includes a `mediaUrl` pointing to the image (check Twilio console → Message logs → Media)
4. If canvas generation throws an error, message is still sent (graceful degradation — no blocked delivery)
5. Image dimensions are 600×400px and file size is under 200KB (check Supabase Storage metadata)

**Tests required:**
```
backend/src/__tests__/unit/messages/split-image.generator.test.ts
  - returns a non-empty Buffer
  - highlighted participant row exists in generated image (check pixel colours at expected row position)
  - handles missing font gracefully (falls back to system default)
  - generates correct filename: split-[participantId].png
  - formatCurrency used for amounts (not hardcoded $)
  - getCurrencyMinorUnits used for amount conversion

backend/src/__tests__/unit/messages/send.service.test.ts (extend)
  - mediaUrl is passed to Twilio messages.create()
  - if generateSplitImage throws: message still sent, error logged
  - upload to Supabase Storage called before Twilio
```

---

### E08-S04 — Message Preview Screen

**What this builds:** The carousel screen showing each participant's personalised message and split image before sending.

**Prompt:**
Read docs/08-Mobile-App-Specification.md for the MessagePreview screen spec. Read `prototype/send-messages.html` for the visual design. Build `mobile/src/screens/messages/MessagePreviewScreen.tsx`:

1. Horizontal scroll carousel — one card per participant
2. Each card shows: participant name, their share amount (formatted with `formatCurrency`), payment links (Venmo/PayPal/etc.), and their personalised split image (fetched from Supabase Storage signed URL)
3. "Edit" button on each card navigates back to split entry for adjustments
4. Sticky "Send to All" button at bottom — disabled until all cards have been previewed (track scroll position or card visibility)
5. Split image displayed as an `<Image>` component — show placeholder while loading
6. Use `eventStore` to get participants and their calculated shares

Match the design in `prototype/send-messages.html` exactly.

**Files created:**
- `mobile/src/screens/messages/MessagePreviewScreen.tsx`

**Acceptance criteria:**
- [ ] Carousel renders one card per participant
- [ ] Split image loads from signed URL with placeholder fallback
- [ ] "Send to All" button disabled until all cards previewed
- [ ] Share amount formatted correctly per currency
- [ ] "Edit" navigates back to split entry

**Tests to run:**
```bash
cd mobile && npm test src/screens/messages/MessagePreviewScreen.test.tsx
```

**Expected output:** Component renders with mocked participants and images, Send button behaviour tested.

---

### E08-S05 — Send + Realtime Delivery Tracking

**What this builds:** The send action and live delivery status screen — triggers Twilio SMS and tracks delivery in real time via Supabase Realtime.

**Prompt:**
Read docs/08-Mobile-App-Specification.md for the delivery tracking screen spec. Build:

1. Wire the "Send to All" button in MessagePreviewScreen to call `POST /events/:id/messages/send`
2. On success, navigate to `DeliveryTrackingScreen`
3. `mobile/src/screens/messages/DeliveryTrackingScreen.tsx`:
   - Shows list of all participants with per-row delivery status badges: QUEUED → SENT → DELIVERED / FAILED
   - Subscribe to Supabase Realtime on `participants` table filtered by `event_id` on mount
   - Update status badges in real time as `message_status` column changes
   - Unsubscribe on unmount (call `supabaseClient.removeChannel(channel)`)
   - "Done" button navigates to Settlement tab when all statuses are terminal (not QUEUED)
   - Failed entries show a "Retry" button that calls `POST /events/:id/messages/retry/:participantId`

**Files created:**
- `mobile/src/screens/messages/DeliveryTrackingScreen.tsx`
- Updates to `mobile/src/screens/messages/MessagePreviewScreen.tsx` (wire send button)

**Acceptance criteria:**
- [ ] Send button calls the messages API and navigates to tracking screen
- [ ] Realtime subscription updates status badges without page refresh
- [ ] Channel unsubscribed on unmount — no memory leak
- [ ] "Done" only enabled when all statuses are terminal
- [ ] Failed status shows Retry button

**Tests to run:**
```bash
cd mobile && npm test src/screens/messages/DeliveryTrackingScreen.test.tsx
```

**Expected output:** Realtime subscription mocked, status transitions tested.

---

### E08-S06 — Twilio STOP Webhook Handler

**What:** Handle STOP/UNSUBSCRIBE SMS replies from participants. When Twilio receives a STOP reply, it forwards a webhook to our server. We must: verify the webhook signature, update all relevant DB tables, and respond with TwiML.

**Acceptance Criteria:**
- `POST /webhooks/twilio/stop` endpoint registered in backend (not under `/api/v1/`).
- Twilio signature verified using `twilio.validateRequest()` before ANY DB operations. Returns 403 if signature invalid.
- On valid STOP: hash the `From` phone number → update `participants.payment_status = 'opted_out'` and `opted_out_at = NOW()` for all this participant's pending/self_reported rows → upsert `sms_opt_outs` → update `users.is_opted_out = TRUE` → write `settlement_log` entry with `changed_by = 'twilio_stop'`.
- Response is valid TwiML XML: `<Response><Message>You have been unsubscribed...</Message></Response>`.
- The `opted_out_at TIMESTAMPTZ` column added to `participants` table via migration.
- Before any A3 send, check `sms_opt_outs` table for the recipient's `phone_hash` — skip sending if opted out.
- Test: POST to `/webhooks/twilio/stop` with valid Twilio signature and `From=+12125551234` — verify participant record updated.
- Test: POST with invalid signature — verify 403 response with no DB changes.

**Prompt:**
Read CLAUDE.md, BUILD-PROGRESS.md, and this story. Read `docs/06-Integration-Contracts.md` (STOP webhook section) and `docs/04-Data-Architecture.md` (participants table, sms_opt_outs table). Then implement:

1. New migration: add `opted_out_at TIMESTAMPTZ` to `participants` in a new file `supabase/migrations/20240101000010_add_opted_out_at.sql`.
2. Implement `POST /webhooks/twilio/stop` with full signature verification and all 6 DB update steps.
3. Update A3 send loop to check `sms_opt_outs` before sending to each participant.
4. Write tests for both valid and invalid signature cases.

**Files created:**
- `supabase/migrations/20240101000010_add_opted_out_at.sql`
- Updates to `backend/src/modules/webhooks/twilio.controller.ts` (add `/stop` handler)
- Updates to `backend/src/modules/messages/send.service.ts` (pre-send opt-out check)
- `backend/src/__tests__/unit/webhooks/twilio-stop.test.ts`

---

### E08-S07 — Post-Send Split Edit (P20a — MVP Feature)

**What:** After splits are sent, the Creator discovers a mistake (wrong item assignment, missed participant). Allow the Creator to re-open the split editor, make corrections, and selectively re-send ONLY to affected participants.

**Acceptance Criteria:**
- `PATCH /api/v1/events/:eventId/splits` endpoint: allows updating individual participant share amounts AFTER messaging is complete (`ai_stage = 'complete'`).
- Request body: `{ corrections: [{ participant_id: uuid, new_amount_minor_units: number }] }`. Sum of all participant amounts (including uncorrected) must still equal the event total ± 1 minor unit.
- After split update: marks affected participants' `payment_status` back to `pending`. Does NOT touch already-confirmed participants.
- `POST /api/v1/events/:eventId/splits/resend` endpoint: re-sends messages ONLY to participants whose `payment_status` is `pending` AND who were affected by the correction. Does NOT resend to already-confirmed participants.
- The re-sent message includes the updated amount and a note: "Your share has been updated."
- Creator app: after the event is in `ai_stage = 'complete'`, the SettlementScreen shows an "Edit split" button. Tapping opens a modal allowing amount corrections per participant.
- Test: update one participant's amount, verify sum invariant holds, verify only affected participant receives new SMS.
- Test: attempt to over-correct (amounts don't sum to total) — returns 422.

**Prompt:**
Read CLAUDE.md, BUILD-PROGRESS.md, and this story. Read `docs/05-API-Specification.md` (splits section), `docs/07-AI-Agent-Specification.md` (largestRemainderRound, splitCalculator), and `docs/08-Mobile-App-Specification.md` (SettlementScreen). Then implement:

1. `PATCH /events/:eventId/splits` with sum validation using `splitCalculator.ts`.
2. `POST /events/:eventId/splits/resend` — builds new messages and sends via Twilio to affected participants only.
3. Update SettlementScreen in mobile: add "Edit split" button (visible only to Creator when `ai_stage = 'complete'`).

**Files created:**
- Updates to `backend/src/modules/splits/splits.router.ts` (add PATCH and resend endpoints)
- Updates to `mobile/src/screens/settlement/SettlementScreen.tsx` (add "Edit split" button)

---

## EPIC 9 — Settlement Tracking
**Depends on:** E08 complete (messages sent, participants have amounts)
**Delivers:** Full payment lifecycle — self-report, confirm, dispute, nudge, cash payments, per-event and cross-event ledger views

### E09-S01 — Settlement API (Self-Report, Confirm, Dispute, Nudge)

**Description:** Build the four settlement action endpoints that drive the payment state machine. All transitions are atomic database updates with settlement_log audit entries written for every change.

**Prompt:**
*"Build backend/src/modules/settlement/settlement.service.ts and settlement.controller.ts with four endpoints, all requiring authenticate middleware. Payment state machine (from docs/04-Data-Architecture.md): PENDING → SELF_REPORTED (participant reports), SELF_REPORTED → CONFIRMED (creator confirms) or DISPUTED (creator disputes), DISPUTED → PENDING (participant must re-pay). The `eventId` in every route path is used for authorization — verify the authenticated user is the payer of that event before executing the action. (1) POST /api/v1/events/:eventId/settlement/:participantId/self-report: called by participant (verifies req.user.id matches participant.user_id). Validates current payment_status is 'pending'. Uses supabaseAdmin to UPDATE participants SET payment_status='self_reported' WHERE id=participantId AND payment_status='pending' — must be atomic (use RETURNING to verify update happened). Writes settlement_log row { event_id, participant_id, action:'self_reported', actor_id:req.user.id, amount_at_time:participant.amount_owed }. Returns { updated: true, new_status: 'self_reported' }. (2) POST /api/v1/events/:eventId/settlement/:participantId/confirm: called by event creator (verifies event.payer_id=req.user.id). Validates current status is 'self_reported'. Atomic UPDATE SET payment_status='confirmed'. Writes settlement_log action:'confirmed'. Checks if ALL participants for this event are now confirmed or opted_out — if yes, UPDATE events SET status='settled'. Returns { updated: true, event_settled: boolean }. (3) POST /api/v1/events/:eventId/settlement/:participantId/dispute: creator only. Validates status is 'self_reported'. Atomic UPDATE SET payment_status='pending' (resets to pending, NOT self_reported). Writes settlement_log action:'disputed'. (4) POST /api/v1/events/:eventId/messages/nudge/:participantId: creator only. Checks last_nudged_at — if set and NOW() < last_nudged_at + 48 hours, return 429 { error: 'NUDGE_COOLDOWN', retry_after: ISO timestamp }. Otherwise: UPDATE participants SET last_nudged_at=NOW(). Send Twilio SMS via twilio.messages.create with nudge message. Write notification_log. Return { sent: true, next_nudge_after: ISO timestamp }."*

**Files created:**
- `backend/src/modules/settlement/settlement.service.ts`
- `backend/src/modules/settlement/settlement.controller.ts`
- `backend/src/modules/settlement/settlement.routes.ts`

**Acceptance Criteria:**
1. POST self-report → `SELECT payment_status FROM participants WHERE id=...` returns `self_reported`
2. POST confirm → `SELECT payment_status` returns `confirmed`; when last participant confirmed, `SELECT status FROM events` returns `settled`
3. POST dispute → payment_status resets to `pending` (not `self_reported`)
4. POST nudge twice within 48 hours → second call returns 429 with `retry_after` timestamp (rate limit: 1 per participant per 48 hours)
5. Participant cannot call confirm on their own payment (403 — only creator can confirm)

> **Note:** Push notification to creator on self-report is added in E10-S02 (after push infrastructure is built). Do NOT wire push.service.ts in this story.

**Tests required:**
```
backend/src/__tests__/unit/settlement/settlement.service.test.ts
  - self-report: atomic UPDATE rejects if status is not 'pending'
  - self-report: writes settlement_log with correct action
  - confirm: sets event status='settled' when last participant confirms
  - dispute: resets to 'pending' (not 'self_reported')
  - nudge: rejects within 48h cooldown with retry_after timestamp
  - nudge: calls Twilio after cooldown expires

backend/src/__tests__/integration/settlement/settlement.test.ts
  - full lifecycle: pending → self_reported → confirmed
  - full lifecycle: pending → self_reported → disputed → pending
  - event settles when all participants confirmed or opted_out
  - 429 on second nudge within 48h
  - Participant cannot confirm own payment (403)
```

---

### E09-S02 — Settlement Ledger API (Owed-to-Me, I-Owe, Summary)

**Description:** Build the cross-event ledger endpoints that aggregate payment state across all events. These power the SettlementTab bottom navigation screen.

**Prompt:**
*"Build settlement ledger endpoints in settlement.service.ts. (1) GET /api/v1/settlement/owed-to-me: returns all participants across events where req.user.id is payer_id, with payment_status IN ('pending','self_reported'), grouped by event. Response: { events: [{ event_id, event_name, participants: [{ participant_id, display_name, amount_owed, payment_status, last_nudged_at }] }] }. (2) GET /api/v1/settlement/i-owe: returns all participant rows where req.user.id matches participant.user_id and payment_status IN ('pending','self_reported'), with event name and payer display_name. Response: { events: [{ event_id, event_name, payer_display_name, payer_payment_handles: [decrypted], my_amount: number, my_status: string }] }. IMPORTANT: decrypt payer handles before returning — participant must know how to pay. (3) GET /api/v1/settlement/summary: returns { net_balance: number } — sum of owed-to-me amounts minus i-owe amounts. Positive means others owe you, negative means you owe. (4) GET /api/v1/settlement/person/:userId: returns all shared events between req.user.id and userId, with amounts and statuses. Used for the PersonDetailScreen."*

**Files created:**
- Updates to `backend/src/modules/settlement/settlement.service.ts` and `settlement.controller.ts`
- `shared/types/settlement.types.ts`

**Acceptance Criteria:**
1. GET /settlement/owed-to-me returns only events where the authenticated user is the creator
2. GET /settlement/i-owe returns payer's decrypted payment handles so participant can pay
3. GET /settlement/summary returns positive number when others owe you, negative when you owe
4. GET /settlement/i-owe returns empty array for a user with no outstanding debts
5. Payer payment handles in i-owe response are decrypted (showing `@venmo-handle` not encrypted blob)
6. `GET /api/v1/users/me/balance` endpoint returns `{ net_balance_minor_units, currency, owed_to_you, you_owe }` where:
   - `owed_to_you` = sum of `amount_owed` for all pending/self_reported participants in events where user is creator
   - `you_owe` = sum of `amount_owed` for all events where user is a participant (not creator) with status not confirmed/settled
   - `net_balance_minor_units` = owed_to_you - you_owe
   - `currency` = the currency of the user's most recently created event (or 'USD' if no events)

**Tests required:**
```
backend/src/__tests__/unit/settlement/ledger.service.test.ts
  - owed-to-me: only returns events where user is payer
  - owed-to-me: excludes confirmed and opted_out participants
  - i-owe: decrypts payer payment handles
  - summary: net_balance = owed_to_me_total - i_owe_total
  - person detail: only returns shared events

backend/src/__tests__/integration/settlement/ledger.test.ts
  - owed-to-me correctly filters by payer_id
  - i-owe shows decrypted handles
  - summary positive when owed, negative when owing
```

---

### E09-S03 — Settlement Mobile Screens

**Description:** Build the SettlementTab with four sub-views (Owed to me, I owe, History, Person detail) and PayNowScreen. This is a bottom tab, not inside EventsStack.

**Prompt:**
*"Build the SettlementTab screens. Refer to prototype/ledger.html IDs 'settlement', 'owed_to_me', 'i_owe', 'pay_now'. SettlementScreen is a bottom tab navigator screen — NOT nested inside EventsStack. It contains four tab-switched views (segmented control at top, NOT bottom tabs): (1) 'Owed to me' tab: FlatList grouped by event, each participant row shows display_name, amount_owed, payment_status chip (amber 'Waiting' for pending, blue 'Reported' for self_reported), two action buttons: Confirm (POST /events/:eventId/settlement/:id/confirm, only visible on self_reported) and Nudge (POST /events/:eventId/messages/nudge/:id, visible on both pending and self_reported, shows 'Nudged Xh ago' and is disabled within 48 hours). (2) 'I owe' tab: FlatList of events where user owes money. Each row shows event name, creator name, amount as large number, 'Pay now' button → PayNowScreen. (3) 'History' tab: settled events list. (4) PersonDetailScreen pushed as a stack screen when tapping a participant in 'Owed to me' — shows all transactions with that person. PayNowScreen: payment handle cards (tappable — use Linking.openURL() for deep links), 'I paid cash' button → POST /events/:eventId/settlement/:id/self-report. EventDetailScreen (settlement phase): add per-event settlement view reusing the same Confirm/Dispute/Nudge buttons, summary bar at top (total/collected/outstanding), segmented progress bar (green confirmed, amber self_reported, grey pending). Store all settlement data in Zustand settlementStore. Use absolute API URLs from process.env.EXPO_PUBLIC_API_URL."*

**Files created:**
- `mobile/src/screens/settlement/SettlementScreen.tsx`
- `mobile/src/screens/settlement/PayNowScreen.tsx`
- `mobile/src/screens/settlement/PersonDetailScreen.tsx`
- `mobile/src/store/settlementStore.ts`
- `mobile/src/services/settlement.service.ts`
- Updates to `mobile/src/screens/events/EventDetailScreen.tsx` (settlement phase)

**Acceptance Criteria:**
1. SettlementTab shows as 💳 icon in bottom navigation
2. "Owed to me" tab shows all pending/self_reported participants across all creator's events
3. Nudge button shows "Nudged 2h ago" and is disabled after being tapped
4. "I owe" tab shows PayNow button → PayNowScreen with Venmo/PayPal/etc deep link buttons
5. Tapping a Venmo deep link opens the Venmo app (or App Store if not installed)

**Tests required:**
```
mobile/src/__tests__/unit/store/settlementStore.test.ts
  - loadOwedToMe populates owed list
  - loadIOwe populates owe list
  - confirmPayment removes participant from owed list

mobile/src/__tests__/components/settlement/SettlementScreen.test.tsx
  - renders four tab views
  - Nudge button disabled within 48h cooldown
  - Confirm button only visible on self_reported participants

mobile/src/__tests__/components/settlement/PayNowScreen.test.tsx
  - renders payment handle cards
  - tapping Venmo card calls Linking.openURL with venmo:// scheme
  - 'I paid cash' calls self-report service
```

---

## EPIC 10 — Background Jobs & Push Notifications
**Depends on:** E09 complete
**Delivers:** Automated nudge reminders, guest PII cleanup, analytics partition maintenance, push notifications for settlement events

### E10-S01 — QStash Job Handlers

**Description:** Three background job handlers as Express endpoints. QStash calls them on schedule via webhook. All must verify the QStash signature before processing, making them safe against spoofed requests.

**Prompt:**
*"Build backend/src/modules/jobs/ with three QStash job handlers, each as a POST Express endpoint. All must verify QStash signature using @upstash/qstash Receiver.verify() with QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY from process.env. (1) POST /api/v1/jobs/nudge-check: find participants WHERE payment_status IN ('pending','self_reported') AND events.created_at < NOW() - INTERVAL '48 hours' AND (last_nudged_at IS NULL OR last_nudged_at < NOW() - INTERVAL '48 hours'). For each: decrypt phone, send Twilio nudge SMS to participant, write notification_log row, update last_nudged_at. Batch in groups of 10 (Twilio rate limit awareness). Return { processed: count }. (2) POST /api/v1/jobs/purge-guest-pii: find guest_pii WHERE purge_after IS NOT NULL AND purge_after < NOW(). For each: delete receipt images from Supabase Storage (bucket 'receipts', prefix=[event_id]/), DELETE the guest_pii row (CASCADE deletes participant row via FK). Return { purged: count }. (3) POST /api/v1/jobs/create-analytics-partition: call supabaseAdmin.rpc('create_analytics_partition', { partition_name: 'analytics_events_YYYY_MM', start_date: first day of next month, end_date: first day of month after next }). Return { partition_created: name }. Create backend/src/modules/jobs/jobs.routes.ts registering all three. No authenticate middleware on these routes — QStash signature IS the authentication."*

**Files created:**
- `backend/src/modules/jobs/nudge.job.ts`
- `backend/src/modules/jobs/purge-pii.job.ts`
- `backend/src/modules/jobs/partition.job.ts`
- `backend/src/modules/jobs/jobs.routes.ts`

**Acceptance Criteria:**
1. POST /jobs/nudge-check with invalid QStash signature → 401 (signature verification works)
2. POST /jobs/nudge-check with valid signature → processes eligible participants, returns `{ processed: N }`
3. POST /jobs/purge-guest-pii → `SELECT count(*) FROM guest_pii WHERE purge_after < NOW()` returns 0 after job runs
4. POST /jobs/create-analytics-partition → `SELECT tablename FROM pg_tables WHERE tablename LIKE 'analytics_events_%'` shows the new partition
5. Nudge job does NOT process participants nudged less than 48 hours ago
6. Import `resolveParticipantPhone` from `backend/src/infrastructure/security/sanitize.ts`. Call it to decrypt the participant's phone before calling Twilio. The decrypted phone MUST NOT be logged or stored in any intermediate variable that could escape the function scope.

**Tests required:**
```
backend/src/__tests__/unit/jobs/nudge.job.test.ts
  - rejects requests with invalid QStash signature
  - sends Twilio message for each eligible participant
  - skips participants nudged within 48h
  - updates last_nudged_at after nudge
  - batches in groups of 10

backend/src/__tests__/unit/jobs/purge-pii.job.test.ts
  - rejects invalid signature
  - deletes Supabase Storage objects for event
  - deletes guest_pii rows with purge_after < NOW()
  - does not delete guest_pii without purge_after set

backend/src/__tests__/unit/jobs/partition.job.test.ts
  - rejects invalid signature
  - calls create_analytics_partition RPC with correct next month dates
```

---

### E10-S02 — Push Notifications

**Description:** Full push notification pipeline — token registration, sending from backend, and handling on mobile in all three app states (foreground, background, killed/cold start).

**Prompt:**
*"Implement Expo push notifications end-to-end. (1) Backend push service in backend/src/infrastructure/push.service.ts: sendPush(userId: string, title: string, body: string, data: Record<string,string>): Promise<void>. Looks up expo_push_token from device_sessions WHERE user_id=userId ORDER BY last_active_at DESC LIMIT 1. If no token found, silently returns (user has not granted permission). Calls Expo Push API: POST https://exp.host/--/api/v2/push/send with { to: token, title, body, data, sound: 'default' }. Handles ExpoPushTicket errors (DeviceNotRegistered → deletes stale token from device_sessions). (2) Trigger push in settlement.service.ts: when creator confirms a self-report → call sendPush(participant.user_id, 'Payment confirmed', 'Your payment for [event] has been confirmed by [creator]', { type: 'payment_confirmed', event_id }). When nudge sent via nudge.job.ts → call sendPush(participant.user_id, 'Payment reminder', 'You still owe [amount] for [event]', { type: 'nudge', event_id, amount }). (3) Mobile: on app launch after auth, call Notifications.requestPermissionsAsync(). If granted: Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId }). Call PATCH /users/me with { expo_push_token: token }. (4) Mobile notification handlers: Notifications.addNotificationReceivedListener for foreground → show in-app toast using a custom Toast component (fixed position at top of screen, auto-dismiss after 4 seconds). Notifications.addNotificationResponseReceivedListener for background/killed → navigate to EventDetailScreen using notification.request.content.data.event_id. Both listeners registered in App root, cleaned up on unmount."*

**Files created:**
- `backend/src/infrastructure/push.service.ts`
- `mobile/src/components/Toast.tsx`
- `mobile/src/hooks/usePushNotifications.ts`
- Updates to `mobile/src/navigation/RootNavigator.tsx` (register listeners)
- Updates to `backend/src/modules/settlement/settlement.service.ts` (trigger push on confirm)

**Acceptance Criteria:**
1. After granting push permission on device, `SELECT expo_push_token FROM device_sessions` shows a valid `ExponentPushToken[xxx]` value
2. Creator confirms a self-report → participant's phone shows a push notification within 10 seconds
3. Tap the push notification with app closed → app opens directly to EventDetailScreen for that event
4. Receive push notification while app is open (foreground) → in-app toast appears at top of screen
5. Device with no push permission → backend silently skips (no error thrown)
6. Wire push notifications to the following triggers (add these to settlement.service.ts in this story):
   a. Participant self-reports payment → push to event creator: '{Name} says they've paid {amount}. Tap to confirm.' (deep-links to event settlement screen)
   b. Creator confirms participant payment → push to participant: 'Your payment for {event} has been confirmed!'
   c. Event settles fully (all participants confirmed or opted out) → push to creator: '{event} is fully settled!'

**Tests required:**
```
backend/src/__tests__/unit/infrastructure/push.service.test.ts
  - looks up push token from device_sessions
  - calls Expo Push API with correct payload
  - silently skips when no push token found
  - removes stale token on DeviceNotRegistered error
  - sends correct data payload for payment_confirmed type
  - sends correct data payload for nudge type

mobile/src/__tests__/hooks/usePushNotifications.test.ts
  - requests permission on mount
  - calls PATCH /users/me with token when permission granted
  - does not register token when permission denied
  - registers foreground listener on mount
  - unregisters listener on unmount (no memory leak)
```

---

## EPIC 11 — Account Management
**Depends on:** E03 complete (auth must work before account management)
**Delivers:** Biometric auth, settings screen, full delete account flow with data anonymisation

### E11-S01 — Biometric Authentication

**Description:** After first OTP login, offer biometric auth enrollment. On subsequent launches, authenticate with Face ID/fingerprint before restoring the session. Handle the edge case where biometrics are removed from device settings.

**Prompt:**
*"Implement biometric authentication in mobile/src/hooks/useBiometricAuth.ts. (1) After successful OTP login (in OTPVerifyScreen, after tokens saved to SecureStore): call expo-local-authentication isEnrolledAsync(). If true: show BiometricOptInScreen modal (prototype/dusk-auth.html ID 'biometric') — 'Use Face ID / fingerprint next time?' with Enable and Skip buttons. On Enable: store 'biometric_enabled=true' in SecureStore. (2) BiometricOptInScreen.tsx: simple modal with fingerprint/face icon, description 'Sign in faster next time without typing a code', Enable button (calls isEnrolledAsync() again to confirm still enrolled — shows settings instruction if not), Skip button. (3) In authStore.restoreSession(): if 'biometric_enabled=true' in SecureStore AND tokens exist: call authenticateAsync({ promptMessage: 'Sign in to LetsSplyt' }). If success: restore session normally. If failure (user cancels or 3 failed attempts): clear biometric_enabled flag, clear tokens, navigate to PhoneEntryScreen (force OTP). CRITICAL EDGE CASE: if isEnrolledAsync() returns false after 'biometric_enabled=true' was set (user removed biometrics from device settings): silently clear the flag, clear tokens, navigate to PhoneEntryScreen — do NOT show any error about biometrics, do NOT crash. Log this case for debugging only."*

**Files created:**
- `mobile/src/hooks/useBiometricAuth.ts`
- `mobile/src/screens/auth/BiometricOptInScreen.tsx`
- Updates to `mobile/src/store/authStore.ts` (restoreSession with biometric check)
- Updates to `mobile/src/screens/auth/OTPVerifyScreen.tsx` (show biometric opt-in after login)

**Acceptance Criteria:**
1. After first OTP login → BiometricOptInScreen appears with enable/skip options
2. Tap Enable → next app launch → Face ID/fingerprint prompt appears instead of phone entry
3. Failed biometric (3 attempts or cancel) → app navigates to PhoneEntryScreen
4. Remove fingerprints from device Settings, reopen app → goes to PhoneEntryScreen silently (no crash, no biometric error message)
5. Tap Skip on BiometricOptInScreen → future launches go directly to phone OTP

**Tests required:**
```
mobile/src/__tests__/hooks/useBiometricAuth.test.ts
  - shows opt-in screen after successful OTP login
  - stores biometric_enabled flag on enable
  - restoreSession: calls authenticateAsync when biometric_enabled is true
  - restoreSession: clears tokens on biometric failure
  - restoreSession: silently falls back to OTP when isEnrolledAsync returns false
  - restoreSession: does not call authenticateAsync when biometric_enabled is false

mobile/src/__tests__/components/auth/BiometricOptInScreen.test.tsx
  - renders enable and skip buttons
  - enable button calls isEnrolledAsync before enabling
  - skip button does not store flag
```

---

### E11-S02 — Settings Screen + Delete Account

**Description:** Settings screen with preferences and the three-screen account deletion flow. Account deletion must immediately wipe PII and anonymise all records per GDPR/DPDP requirements.

**Prompt:**
*"Build SettingsScreen and the delete account flow. (1) SettingsScreen (mobile/src/screens/profile/SettingsScreen.tsx): notification preferences toggle (stores preference in Zustand, calls PATCH /users/me), biometric auth toggle (calls useBiometricAuth hook to enable/disable, shows instruction if biometrics not enrolled on device), app version (from Constants.expoConfig.version), Privacy Policy link (Linking.openURL to your domain/privacy), Terms of Service link, Logout button (POST /api/v1/auth/logout → clear SecureStore → navigate to WelcomeScreen), Delete account link (destructive red text → navigate to DeleteWarnScreen). (2) DeleteWarnScreen: shows what gets deleted (your account, payment handles, personal data). Two buttons: Cancel (safe, goes back) and Continue → (destructive red, navigates to DeleteConfirmScreen). (3) DeleteConfirmScreen: instruction to type 'DELETE', TextInput, Delete button disabled until field === 'DELETE' exactly, on tap: DELETE /api/v1/users/me (authenticated) → navigates to DeletedScreen. (4) DeletedScreen: 'Account deleted.' text, 'Thank you for using LetsSplyt.' subtitle, navigate to WelcomeScreen after 3 seconds using setTimeout. (5) Backend DELETE /api/v1/users/me: uses supabaseAdmin to: (a) DELETE FROM user_payment_handles WHERE user_id=req.user.id, (b) UPDATE users SET phone_encrypted=NULL, phone_hash='DELETED-'+gen_random_uuid()::text, display_name='Deleted User', deleted_at=NOW() WHERE id=req.user.id, (c) DELETE FROM device_sessions WHERE user_id=req.user.id, (d) Call supabase.auth.admin.deleteUser(req.user.id). Return { deleted: true }."*

**Files created:**
- `mobile/src/screens/profile/SettingsScreen.tsx`
- `mobile/src/screens/profile/DeleteWarnScreen.tsx`
- `mobile/src/screens/profile/DeleteConfirmScreen.tsx`
- `mobile/src/screens/profile/DeletedScreen.tsx`
- `backend/src/modules/auth/auth.service.ts` (updated with delete endpoint)

**Acceptance Criteria:**
1. Settings screen shows app version number
2. Delete account → DeleteWarnScreen → type "DELETE" exactly → button enables → tap → account deleted
3. After deletion: `SELECT * FROM users WHERE id=...` shows `display_name='Deleted User'`, `phone_encrypted=NULL`, `deleted_at` is set
4. After deletion: `SELECT * FROM user_payment_handles WHERE user_id=...` returns 0 rows
5. Trying to log in with the deleted user's phone after deletion → new account created (deleted user is gone)

**Tests required:**
```
backend/src/__tests__/unit/auth/delete.service.test.ts
  - deletes all payment handles
  - wipes phone_encrypted (sets to NULL)
  - sets phone_hash to DELETED-{uuid} (tombstone)
  - sets display_name to 'Deleted User'
  - sets deleted_at timestamp
  - deletes device_sessions
  - calls supabase admin deleteUser

mobile/src/__tests__/components/profile/DeleteConfirmScreen.test.tsx
  - delete button disabled initially
  - delete button disabled when text is not exactly 'DELETE'
  - delete button enabled when text is 'DELETE'
  - calls delete service on tap
  - navigates to DeletedScreen on success

mobile/src/__tests__/components/profile/DeletedScreen.test.tsx
  - navigates to WelcomeScreen after 3 seconds
```

---

## EPIC 12 — Analytics, Monitoring & Launch Readiness
**Depends on:** All epics complete
**Delivers:** Production observability, error monitoring, test coverage reporting, CI/CD fully operational, EAS builds configured

### E12-S01 — Analytics Event Ingestion + Health Check

**Description:** Build the analytics endpoint that receives events from the mobile app, and a comprehensive health check endpoint that verifies all external services are reachable.

**Prompt:**
*"Build analytics and health endpoints. (1) POST /api/v1/analytics/events (authenticated): body { events: [{ name: string, properties: object, timestamp: number }] }. Validates event names against an allowed enum (to prevent injection): defined in backend/src/modules/analytics/events.enum.ts — include all events from docs/10-Engineering-Operations.md Section 5 (receipt_parsed_success, receipt_parsed_failed, split_calculated, messages_sent, payment_self_reported, payment_confirmed, event_created, event_locked, etc.). Hashes user ID with ANALYTICS_SALT before writing to analytics_events (never store raw user_id). Writes batch with supabaseAdmin to analytics_events partition. Returns { recorded: count }. (2) GET /api/v1/health: checks each dependency and returns their status. Checks: database (SELECT 1 from Supabase), storage (list bucket 'receipts'), redis (PING to Upstash), ai_gemini (if APP_ENV !== 'production': call Gemini with empty prompt, check 200 response), twilio (check Twilio account status API). Returns { status: 'ok'|'degraded'|'error', checks: { database: 'ok'|'error', storage: 'ok'|'error', redis: 'ok'|'error', ai: 'ok'|'error', twilio: 'ok'|'error' }, version: package.json version, environment: APP_ENV }. Overall status is 'degraded' if any check fails, 'ok' if all pass. Health endpoint requires NO authentication."*

**Files created:**
- `backend/src/modules/analytics/analytics.controller.ts`
- `backend/src/modules/analytics/analytics.routes.ts`
- `backend/src/modules/analytics/events.enum.ts`
- `backend/src/modules/health/health.controller.ts`
- `backend/src/modules/health/health.routes.ts`

**Acceptance Criteria:**
1. `curl localhost:3000/api/v1/health` returns JSON with `status: 'ok'` and all checks showing `'ok'`
2. With Supabase stopped: health returns `{ status: 'degraded', checks: { database: 'error', ... } }` (not a 500 crash)
3. POST /analytics/events with valid event name → `SELECT count(*) FROM analytics_events` increases
4. POST /analytics/events with unknown event name → 400 validation error
5. User ID in analytics_events is the salted hash, not the raw UUID

**Tests required:**
```
backend/src/__tests__/unit/analytics/analytics.service.test.ts
  - hashes user_id with ANALYTICS_SALT before writing
  - rejects unknown event names
  - writes to correct analytics partition
  - batches multiple events in single insert

backend/src/__tests__/unit/health/health.test.ts (supertest)
  - GET /api/v1/health returns 200 with all checks ok
  - returns 'degraded' when database check fails
  - never throws 500 even when all services down
  - does not require authentication
```

---

### E12-S02 — Sentry Error Monitoring + Structured Logging

**Description:** Wire Sentry to both backend and mobile for automatic error capture. Configure structured logging on the backend so errors are searchable in production.

**Prompt:**
*"Integrate Sentry error monitoring. (1) Backend: npm install @sentry/node. In backend/src/server.ts, before any other code: Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.APP_ENV, release: package.json version, tracesSampleRate: 0.1 }). Add Sentry.setupExpressErrorHandler(app) after all routes in app.ts. Any unhandled error caught by Express error handler: log with logger.error({ err, requestId: req.id }), forward to Sentry. (2) Mobile: npm install @sentry/react-native. In App.tsx: Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, environment: process.env.APP_ENV }). Wrap root component with Sentry.wrap. (3) Update logger.ts to use pino with these fields on every log: { timestamp, level, requestId (from req.id set by uuid middleware), userId (from req.user?.id), environment: APP_ENV }. PII scrubber: before logging, replace any string matching E.164 phone pattern with '[PHONE]', replace any string matching 'sb_secret_' with '[SECRET]'. (4) Add SENTRY_DSN to Doppler development environment (can be the same DSN for all envs with environment tag distinguishing them)."*

**Files created:**
- Updates to `backend/src/server.ts`, `backend/src/app.ts`, `backend/src/infrastructure/logger.ts`
- Updates to `mobile/App.tsx`
- Note: `backend/src/middleware/requestId.ts` was created in E01-S02 — this story only needs to update `logger.ts` to read from `req.requestId`.

**Acceptance Criteria:**
1. Throw a deliberate error in a test route → error appears in Sentry dashboard within 30 seconds
2. Log line containing a phone number pattern → log shows `[PHONE]` not the actual number
3. Every log line contains `requestId`, `userId` (or null), and `environment` fields
4. Mobile crash → Sentry captures stack trace with React Native component tree
5. `SENTRY_DSN` in Doppler → `doppler secrets get SENTRY_DSN --plain` returns a value

**Tests required:**
```
backend/src/__tests__/unit/infrastructure/logger.test.ts
  - scrubs E.164 phone patterns from log messages
  - scrubs 'sb_secret_' strings from logs
  - includes requestId field on every log
  - includes APP_ENV on every log
  - does not scrub non-PII strings
```

---

### E12-S03 — EAS Build Configuration + CI/CD Completion

**Description:** Configure EAS build profiles for development, staging, and production. Complete the GitHub Actions CI pipeline with mobile type-checking, build triggers, and coverage upload.

**Prompt:**
*"Complete the build and CI configuration. (1) mobile/eas.json: three build profiles. development: { distribution: 'internal', android: { buildType: 'apk' }, ios: { simulator: true } }. staging: { distribution: 'internal', android: { buildType: 'apk', gradleCommand: ':app:bundleRelease' }, ios: { distribution: 'internal' }, env: { APP_ENV: 'staging' } }. production: { distribution: 'store', android: { buildType: 'app-bundle' }, ios: { autoIncrement: true }, credentialsSource: 'remote', env: { APP_ENV: 'production' } }. Add autoIncrement: true to buildNumber for production iOS. (2) mobile/app.config.js: dynamic config using process.env. APP_ENV determines: app name (LetsSplyt Dev / LetsSplyt Staging / LetsSplyt), bundle identifier (com.letssplyt.dev / .staging / production), icon tint (use different icon or overlay for dev/staging). No expo-router in plugins array. (3) Complete .github/workflows/ci.yml: add jobs — mobile-typecheck (tsc --noEmit in mobile/), backend-typecheck (tsc --noEmit in backend/), backend-tests-with-db (supabase start, run migrations, run tests, supabase stop), mobile-tests (jest), coverage-report (upload backend and mobile lcov to Codecov). Add workflow: on push to 'staging' branch → trigger EAS staging build via eas-cli action. (4) Root package.json: add scripts: build:staging ('eas build --profile staging --platform android --non-interactive'), build:production ('eas build --profile production --platform all --non-interactive'), typecheck ('npm run typecheck --workspaces'), test ('npm run test --workspaces')."*

**Files created:**
- `mobile/eas.json`
- Updates to `mobile/app.config.js`
- Updates to `.github/workflows/ci.yml`
- Updates to root `package.json`

**Acceptance Criteria:**
1. `npm run typecheck` from root runs `tsc --noEmit` in all three packages and exits 0
2. `npm run test` from root runs Jest in both backend and mobile
3. `eas build --profile staging --platform android --non-interactive` triggers without interactive prompts
4. Push to `staging` branch → GitHub Actions shows EAS build job triggered
5. `npm run test:coverage` in backend generates `coverage/lcov.info` file

**Tests required:**
```
# Verify CI passes end-to-end:
# 1. Push a branch with a deliberate TypeScript error
# 2. CI should fail on typecheck job
# 3. Fix the error, push again
# 4. All jobs pass, coverage uploaded to Codecov

# Meta-test: run the full test suite
# backend: npm run test:coverage → check coverage meets thresholds
# mobile: npm run test:coverage → check coverage meets thresholds
# Fail the build if coverage drops below configured minimums
```

---

### E12-S04 — End-to-End Test Suite (Maestro)

**Description:** Automated end-to-end tests using Maestro that run the critical user journeys on a real device or emulator, verifying the entire app works together.

**Prompt:**
*"Create Maestro end-to-end test flows in .maestro/ directory. Install Maestro: curl -Ls 'https://get.maestro.mobile.dev' | bash. (1) .maestro/01-auth-login.yaml: launch app, wait for WelcomeScreen, tap 'Get Started', enter test phone +15005550001 in country code + number fields, tap Continue, wait for OTPVerifyScreen, enter 000000 digit by digit, wait for HomeScreen to appear. Assert: HomeScreen title or balance card is visible. (2) .maestro/02-create-event.yaml: assumes logged in (run after 01). Tap FAB on HomeScreen, wait for CreateEventModal, enter 'Friday Dinner' in name field, tap Create, wait for QRDisplayModal, assert QR code component is visible, tap X to dismiss. (3) .maestro/03-profile-handles.yaml: navigate to ProfileTab, tap '+ Add payment method', select 'Venmo' provider, enter '@testuser' in handle input, tap Save, assert '@testuser' appears in handle list. (4) .maestro/04-full-journey.yaml: runs all three flows in sequence as a smoke test. (5) Add to package.json: 'test:e2e': 'maestro test .maestro/' and document that this requires a running Expo Go app or EAS development build connected. Add Maestro test run to CI on staging branch only (not on every PR — too slow)."*

**Files created:**
- `.maestro/01-auth-login.yaml`
- `.maestro/02-create-event.yaml`
- `.maestro/03-profile-handles.yaml`
- `.maestro/04-full-journey.yaml`
- Updates to root `package.json` (test:e2e script)
- Updates to `.github/workflows/ci.yml` (staging-only E2E job)

**Acceptance Criteria:**
1. `maestro test .maestro/01-auth-login.yaml` passes on Android emulator or physical device running the dev build
2. `maestro test .maestro/02-create-event.yaml` passes — event created, QR visible
3. `maestro test .maestro/03-profile-handles.yaml` passes — handle saved and visible in list
4. `maestro test .maestro/04-full-journey.yaml` passes all three flows in sequence
5. Push to staging branch → GitHub Actions shows E2E job runs Maestro tests

**Tests required:**
```
# Maestro IS the test — the .yaml files are the test specs
# Run locally: maestro test .maestro/04-full-journey.yaml
# Run in CI: triggered automatically on staging branch push
# Expected output: all flows PASSED
# On failure: Maestro captures screenshots at each step — check the CI artifact
```

---

## Build Sequence Summary

**Total stories: 46 stories across 12 epics**

| Epic | Stories | Duration estimate |
|---|---|---|
| E01: Infra & Security | 6 | 3-4 days |
| E02: Database | 4 | 2-3 days |
| E03: Authentication | 4 | 2-3 days |
| E04: Profile & Handles | 2 | 1-2 days |
| E05: Events & QR | 3 | 3-4 days |
| E06: Join Flows | 3 | 2-3 days |
| E07: AI Receipt Pipeline | 6 | 5-6 days |
| E08: Message System | 7 | 5-6 days |
| E09: Settlement | 3 | 3-4 days |
| E10: Background Jobs & Push | 2 | 2-3 days |
| E11: Account Management | 2 | 2-3 days |
| E12: Launch Readiness | 4 | 3-4 days |
| **Total** | **46** | **~38-50 Cursor sessions** |

---

## Testing Coverage Targets

| Layer | Target | Minimum to ship |
|---|---|---|
| Backend lines | 80% | 75% |
| Backend branches | 70% | 65% |
| Mobile lines | 70% | 65% |
| Mobile branches | 60% | 55% |
| splitCalculator.ts | 100% | 100% — no exceptions |
| Security utilities (crypto, sanitize) | 100% | 100% — no exceptions |
| RLS policies | Every table covered | Every table covered |

**Non-negotiable 100% coverage modules:**
- `shared/utils/splitCalculator.ts` — financial arithmetic
- `backend/src/infrastructure/security/crypto.ts` — encryption/decryption
- `backend/src/infrastructure/security/sanitize.ts` — AI prompt safety

---

## Definition of Done (per story)

A story is DONE when ALL of the following are true:
- [ ] All Acceptance Criteria verified manually (on phone via Expo Go or in Terminal)
- [ ] All specified tests written and passing
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run test:coverage` meets minimum thresholds
- [ ] No console.log statements left in committed code (use logger.ts)
- [ ] No TODO comments — if something is deferred, create a new story for it
- [ ] No hardcoded secrets, phone numbers, or credentials in committed code

**Never start the next story until the current story's Definition of Done is complete.**
