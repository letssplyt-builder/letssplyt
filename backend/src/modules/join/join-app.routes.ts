import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { getJoinPreviewHandler, postAppJoinHandler } from './join-app.controller';

const joinAppRoutes = Router();

joinAppRoutes.get('/:token/preview', (req, res, next) => {
  void getJoinPreviewHandler(req, res, next).catch(next);
});

joinAppRoutes.post('/:token/app-join', authenticate, (req, res, next) => {
  void postAppJoinHandler(req, res, next).catch(next);
});

export default joinAppRoutes;
