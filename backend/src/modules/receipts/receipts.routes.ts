import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireEventAccessFromBody } from '../../middleware/eventAccess';
import {
  postConfirmHandler,
  postParseHandler,
  postUploadUrlHandler,
} from './receipts.controller';

const receiptsRoutes = Router();
const requireOwner = requireEventAccessFromBody('owner');

receiptsRoutes.post('/upload-url', authenticate, requireOwner, (req, res, next) => {
  void postUploadUrlHandler(req, res, next).catch(next);
});

receiptsRoutes.post('/parse', authenticate, requireOwner, (req, res, next) => {
  void postParseHandler(req, res, next).catch(next);
});

receiptsRoutes.post('/confirm', authenticate, requireOwner, (req, res, next) => {
  void postConfirmHandler(req, res, next).catch(next);
});

export default receiptsRoutes;
