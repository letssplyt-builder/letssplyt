import express from 'express';

/** Default JSON body limit — receipts upload via Storage signed URLs, not JSON. */
export const DEFAULT_JSON_BODY_LIMIT = '100kb';

export const DEFAULT_URLENCODED_BODY_LIMIT = '100kb';

export const jsonBodyParser = express.json({ limit: DEFAULT_JSON_BODY_LIMIT });

export const urlencodedBodyParser = express.urlencoded({
  extended: false,
  limit: DEFAULT_URLENCODED_BODY_LIMIT,
});

/** body-parser limit errors (express.json / express.urlencoded). */
export function isPayloadTooLargeError(err: unknown): err is Error & { type: string; status: number } {
  return (
    err instanceof Error &&
    'type' in err &&
    (err as { type: string }).type === 'entity.too.large' &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}
