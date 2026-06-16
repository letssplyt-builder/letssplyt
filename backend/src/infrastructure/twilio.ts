import twilio from 'twilio';

/** Twilio REST client for Programmable Messaging (SMS/WhatsApp). */
export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);
