import { Router } from 'express';
import { requireEventAccess } from '../../middleware/eventAccess';
import {
  getSplitAssignmentsHandler,
  postSplitCalculateHandler,
  postSplitConfirmHandler,
  postSplitsAssignHandler,
} from './splits.controller';

const splitsRouter = Router();
const requireOwner = requireEventAccess('owner');

splitsRouter.get('/:id/split/assignments', requireOwner, (req, res, next) => {
  void getSplitAssignmentsHandler(req, res, next).catch(next);
});

splitsRouter.post('/:id/split/calculate', requireOwner, (req, res, next) => {
  void postSplitCalculateHandler(req, res, next).catch(next);
});

splitsRouter.post('/:id/split/confirm', requireOwner, (req, res, next) => {
  void postSplitConfirmHandler(req, res, next).catch(next);
});

splitsRouter.post('/:id/splits/assign', requireOwner, (req, res, next) => {
  void postSplitsAssignHandler(req, res, next).catch(next);
});

export default splitsRouter;
