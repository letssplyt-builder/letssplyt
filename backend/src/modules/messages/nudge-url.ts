import { getConfig } from '../../infrastructure/config';
import { generateBreakdownTokenValue } from './breakdown-url';

export function generateNudgeLinkToken(): string {
  return generateBreakdownTokenValue();
}

export function buildNudgeSummaryUrl(token: string): string {
  return `${getConfig().appBaseUrl}/nudge/${token}`;
}
