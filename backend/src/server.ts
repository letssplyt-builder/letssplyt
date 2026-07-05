import './infrastructure/sentry.instrument';
import { isSentryEnabled } from './infrastructure/sentry.instrument';
import app from './app';
import logger from './infrastructure/logger';
import { loadConfig } from './infrastructure/config';
import { isMessagingDevBypassEnabled } from './infrastructure/notification/messaging-dev-bypass';
import { isOtpDevBypassEnabled } from './modules/auth/auth.service';

const PORT = Number(process.env.PORT ?? 3000);

try {
  loadConfig();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Invalid startup environment';
  logger.fatal({ msg: message });
  process.exit(1);
}

const otpBypassActive = isOtpDevBypassEnabled();
if (otpBypassActive && process.env.APP_ENV !== 'development' && process.env.APP_ENV !== 'test') {
  logger.fatal({
    msg: 'OTP dev bypass is active outside development/test — refusing to start',
    appEnv: process.env.APP_ENV,
  });
  process.exit(1);
}

app.listen(PORT, '0.0.0.0', () => {
  logger.info({
    msg: 'LetsSplyt backend running',
    port: PORT,
    host: '0.0.0.0',
    appEnv: process.env.APP_ENV,
    sentryEnabled: isSentryEnabled(),
    otpMode: otpBypassActive ? 'dev-bypass' : 'custom-otp',
    messagingMode: isMessagingDevBypassEnabled() ? 'dev-bypass' : process.env.SMS_PROVIDER ?? 'twilio',
  });

  if (otpBypassActive) {
    logger.warn({
      msg: 'OTP dev bypass is ACTIVE — any 6-digit code will verify (development/test only)',
      appEnv: process.env.APP_ENV,
    });
  }
});
