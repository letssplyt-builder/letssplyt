import twilio from 'twilio';

export function validateTwilioWebhook(
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) {
    return false;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return false;
  }

  return twilio.validateRequest(authToken, signature, url, params);
}
