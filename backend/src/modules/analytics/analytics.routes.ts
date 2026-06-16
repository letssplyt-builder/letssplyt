import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { handleRecordAnalyticsEvents } from './analytics.controller';

const analyticsRouter = Router();

analyticsRouter.post('/events', authenticate, (req, res, next) => {
  void handleRecordAnalyticsEvents(req, res, next).catch(next);
});

export default analyticsRouter;
