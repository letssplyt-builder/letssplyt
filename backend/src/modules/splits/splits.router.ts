import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { postSplitCalculateHandler, postSplitsAssignHandler } from './splits.controller';

const splitsRouter = Router();

splitsRouter.use(authenticate);

splitsRouter.post('/:id/split/calculate', (req, res, next) => {
  void postSplitCalculateHandler(req, res, next).catch(next);
});

splitsRouter.post('/:id/splits/assign', (req, res, next) => {
  void postSplitsAssignHandler(req, res, next).catch(next);
});

export default splitsRouter;
