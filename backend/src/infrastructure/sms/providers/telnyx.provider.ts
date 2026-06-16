import type { SMSProvider } from '../types';

/**
 * Telnyx SMS provider — full implementation in E11-S05.
 * This stub exists so the module layout is stable before Telnyx is wired in.
 */
export class TelnyxSMSProvider implements SMSProvider {
  readonly name = 'telnyx' as const;

  async sendOutboundMessage(): Promise<never> {
    throw new Error('TelnyxSMSProvider is not configured until E11-S05');
  }
}
