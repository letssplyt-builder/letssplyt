import { Router } from 'express';
import {
  handleCreateAnalyticsPartition,
  handlePurgeExpiredOtps,
  handlePurgeGuestPii,
} from './jobs.controller';
import { verifyQStashMiddleware } from './qstash.receiver';

const jobsRouter = Router();

jobsRouter.post('/purge-guest-pii', verifyQStashMiddleware, (req, res, next) => {
  void handlePurgeGuestPii(req, res, next);
});

jobsRouter.post('/create-analytics-partition', verifyQStashMiddleware, (req, res, next) => {
  void handleCreateAnalyticsPartition(req, res, next);
});

jobsRouter.post('/purge-expired-otps', verifyQStashMiddleware, (req, res, next) => {
  void handlePurgeExpiredOtps(req, res, next);
});

export default jobsRouter;
