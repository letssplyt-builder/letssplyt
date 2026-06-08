import { Router } from 'express';
import {
  getJoinPage,
  getJoinSuccessPage,
  postJoinOtpRequest,
  postJoinOtpVerify,
} from './join-web.controller';

const joinWebRoutes = Router();

joinWebRoutes.get('/:token', (req, res, next) => {
  void getJoinPage(req, res).catch(next);
});

joinWebRoutes.get('/:token/joined', (req, res, next) => {
  void getJoinSuccessPage(req, res).catch(next);
});

// Story + API aliases for the phone submission step
joinWebRoutes.post('/:token', (req, res, next) => {
  void postJoinOtpRequest(req, res).catch(next);
});
joinWebRoutes.post('/:token/otp/request', (req, res, next) => {
  void postJoinOtpRequest(req, res).catch(next);
});

// Story + API aliases for OTP verification
joinWebRoutes.post('/:token/verify-otp', (req, res, next) => {
  void postJoinOtpVerify(req, res).catch(next);
});
joinWebRoutes.post('/:token/otp/verify', (req, res, next) => {
  void postJoinOtpVerify(req, res).catch(next);
});

export default joinWebRoutes;
