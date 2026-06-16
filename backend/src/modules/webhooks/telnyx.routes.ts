import { Router } from 'express';
import { telnyxIpGuard } from '../../middleware/telnyx-ip-guard';
import { handleTelnyxMessaging } from './telnyx.controller';

const telnyxWebhookRouter = Router();

telnyxWebhookRouter.use(telnyxIpGuard);

telnyxWebhookRouter.post('/messaging', (req, res, next) => {
  void handleTelnyxMessaging(req, res, next).catch(next);
});

export default telnyxWebhookRouter;
