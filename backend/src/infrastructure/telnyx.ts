import Telnyx from 'telnyx';

/** Telnyx API V2 client for Programmable Messaging. */
export const telnyxClient = new Telnyx({
  apiKey: process.env.TELNYX_API_KEY ?? '',
});
