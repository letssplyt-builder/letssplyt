import type { SMSProvider } from './types';
import { TwilioSMSProvider } from './providers/twilio.provider';

let instance: SMSProvider | null = null;

/**
 * Returns a singleton SMSProvider based on SMS_PROVIDER (default: twilio).
 * Mirrors createLLMProvider() — never instantiate providers outside this factory.
 */
export function createSMSProvider(): SMSProvider {
  if (instance) return instance;

  const provider = process.env.SMS_PROVIDER ?? 'twilio';

  switch (provider) {
    case 'twilio':
      instance = new TwilioSMSProvider();
      break;
    case 'telnyx':
      throw new Error(
        'SMS_PROVIDER=telnyx is not available until E11-S05 (Telnyx provider migration)',
      );
    default:
      throw new Error(
        `Unknown SMS_PROVIDER: "${provider}". Supported values: "twilio", "telnyx"`,
      );
  }

  return instance;
}

/** Reset singleton — for tests only */
export function resetSMSProvider(): void {
  instance = null;
}
