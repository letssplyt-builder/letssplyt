import pino from 'pino';

const isProduction = process.env.APP_ENV === 'production';

const logger = pino({
  level: isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'phone_e164',
      'phone_hash',
      'phone_encrypted',
      'phoneE164',
      'name_encrypted',
      'handle_encrypted',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
});

export default logger;
