import { Router } from 'express';
import {
  handleCreateAnalyticsPartition,
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

export default jobsRouter;
