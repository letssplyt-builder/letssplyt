import { Router } from 'express';
import { handleTwilioDelivery, handleTwilioOptOut } from './twilio.controller';

const twilioWebhookRouter = Router();

twilioWebhookRouter.post('/opt-out', (req, res, next) => {
  void handleTwilioOptOut(req, res, next).catch(next);
});

twilioWebhookRouter.post('/stop', (req, res, next) => {
  void handleTwilioOptOut(req, res, next).catch(next);
});

twilioWebhookRouter.post('/delivery', (req, res, next) => {
  void handleTwilioDelivery(req, res, next).catch(next);
});

export default twilioWebhookRouter;
