import path from 'path';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import logger from './infrastructure/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { globalRateLimiter } from './middleware/rateLimiter';
import { piiScrubberMiddleware } from './middleware/piiScrubber';
import authRoutes from './modules/auth/auth.routes';
import profileRoutes from './modules/profile/profile.routes';
import eventRoutes from './modules/events/event.routes';
import joinAppRoutes from './modules/join/join-app.routes';
import joinWebRoutes from './modules/join/join-web.routes';
import receiptsRoutes from './modules/receipts/receipts.routes';
import settlementRoutes from './modules/settlement/settlement.routes';
import twilioWebhookRouter from './modules/webhooks/twilio.routes';
import telnyxWebhookRouter from './modules/webhooks/telnyx.routes';
import breakdownRoutes from './modules/messages/breakdown.routes';
import jobsRoutes from './modules/jobs/jobs.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import healthRoutes from './modules/health/health.routes';
import { handleHealthCheck } from './modules/health/health.controller';
import { errorHandler } from './modules/auth/auth.controller';

const app = express();

const publicDir = path.resolve(__dirname, '..', 'public');

app.get('/privacy', (_req, res) => res.redirect(301, '/privacy.html'));
app.get('/terms', (_req, res) => res.redirect(301, '/terms.html'));
app.get('/legal/privacy', (_req, res) => res.redirect(301, '/privacy.html'));
app.get('/legal/terms', (_req, res) => res.redirect(301, '/terms.html'));

app.use(
  express.static(publicDir, {
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith('apple-app-site-association') ||
        filePath.endsWith('assetlinks.json')
      ) {
        res.setHeader('Content-Type', 'application/json');
      }
    },
  }),
);

const allowedOrigins = (process.env.APP_DOMAIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// QStash job endpoints need the raw body for signature verification.
app.use('/api/v1/jobs', express.raw({ type: 'application/json' }), jobsRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.requestId ?? req.id,
    customProps: (req) => ({
      requestId: req.requestId ?? null,
      userId: req.user?.id ?? null,
    }),
  }),
);
app.use(globalRateLimiter);
app.use(piiScrubberMiddleware);

app.use('/api/v1/health', healthRoutes);
app.get('/health', (req, res, next) => {
  void handleHealthCheck(req, res, next).catch(next);
});

app.use('/api/v1/webhooks/twilio', twilioWebhookRouter);
app.use('/webhooks/twilio', twilioWebhookRouter);
app.use('/api/v1/webhooks/telnyx', telnyxWebhookRouter);
app.use('/webhooks/telnyx', telnyxWebhookRouter);

app.use('/join', joinWebRoutes);
app.use('/split', breakdownRoutes);

app.use('/api/v1/join', joinAppRoutes);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', profileRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/receipts', receiptsRoutes);
app.use('/api/v1/settlement', settlementRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

if (process.env.APP_ENV !== 'production') {
  app.get('/api/v1/debug/sentry-test', async (_req, res) => {
    const testError = new Error('Sentry deliberate test error (E12-S02)');
    const eventId = Sentry.captureException(testError);
    await Sentry.flush(5000);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Sentry deliberate test error (E12-S02)',
        details: { sentry_event_id: eventId ?? null },
      },
    });
  });
}

Sentry.setupExpressErrorHandler(app);
app.use(errorHandler);

export default app;
