import { Router } from 'express';
import { handleHealthCheck } from './health.controller';

const healthRouter = Router();

healthRouter.get('/', (req, res, next) => {
  void handleHealthCheck(req, res, next).catch(next);
});

export default healthRouter;
