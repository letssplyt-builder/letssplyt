import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { postParseHandler, postUploadUrlHandler } from './receipts.controller';

const receiptsRoutes = Router();

receiptsRoutes.post('/upload-url', authenticate, (req, res, next) => {
  void postUploadUrlHandler(req, res, next).catch(next);
});

receiptsRoutes.post('/parse', authenticate, (req, res, next) => {
  void postParseHandler(req, res, next).catch(next);
});

export default receiptsRoutes;
