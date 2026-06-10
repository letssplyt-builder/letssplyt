import path from 'path';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
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
import { errorHandler } from './modules/auth/auth.controller';

const app = express();

const publicDir = path.resolve(__dirname, '..', 'public');

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(requestIdMiddleware);
app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ requestId: req.requestId }),
  }),
);
app.use(globalRateLimiter);
app.use(piiScrubberMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/join', joinWebRoutes);

app.use('/api/v1/join', joinAppRoutes);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', profileRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/receipts', receiptsRoutes);

app.use(errorHandler);

export default app;
