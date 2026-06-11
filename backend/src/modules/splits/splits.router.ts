import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  getSplitAssignmentsHandler,
  postSplitCalculateHandler,
  postSplitConfirmHandler,
  postSplitsAssignHandler,
} from './splits.controller';

const splitsRouter = Router();

splitsRouter.use(authenticate);

splitsRouter.get('/:id/split/assignments', (req, res, next) => {
  void getSplitAssignmentsHandler(req, res, next).catch(next);
});

splitsRouter.post('/:id/split/calculate', (req, res, next) => {
  void postSplitCalculateHandler(req, res, next).catch(next);
});

splitsRouter.post('/:id/split/confirm', (req, res, next) => {
  void postSplitConfirmHandler(req, res, next).catch(next);
});

splitsRouter.post('/:id/splits/assign', (req, res, next) => {
  void postSplitsAssignHandler(req, res, next).catch(next);
});

export default splitsRouter;
