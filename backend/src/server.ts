import app from './app';
import logger from './infrastructure/logger';
import { isMessagingDevBypassEnabled } from './infrastructure/notification/messaging-dev-bypass';
import { isOtpDevBypassEnabled } from './modules/auth/auth.service';

const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, '0.0.0.0', () => {
  logger.info({
    msg: 'LetsSplyt backend running',
    port: PORT,
    host: '0.0.0.0',
    appEnv: process.env.APP_ENV ?? '(unset)',
    otpMode: isOtpDevBypassEnabled() ? 'dev-bypass' : 'custom-otp',
    messagingMode: isMessagingDevBypassEnabled() ? 'dev-bypass' : process.env.SMS_PROVIDER ?? 'twilio',
  });
});
