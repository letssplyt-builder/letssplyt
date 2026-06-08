import { jest, beforeEach } from '@jest/globals';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';
process.env.SUPABASE_SECRET_KEY = 'test-service-role-key';
process.env.PHONE_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.PII_HMAC_SALT =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
process.env.HANDLE_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
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
process.env.APP_ENV = 'test';
process.env.PORT = '3001';
process.env.GEMINI_API_KEY = 'test-gemini-key';

jest.mock('twilio', () => require('./mocks/twilio.mock').twilioMockFactory());

jest.mock('@supabase/supabase-js', () => require('./mocks/supabase.mock'));

jest.mock('../infrastructure/llm/factory', () => require('./mocks/llm.mock'));

beforeEach(() => {
  jest.clearAllMocks();
});
