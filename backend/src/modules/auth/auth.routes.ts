import { Router } from 'express';
import { handleOtpRequest, handleOtpVerify } from './auth.controller';
import { authRateLimiter } from '../../middleware/rateLimiter';

const router = Router();

router.post('/otp/request', authRateLimiter, handleOtpRequest);
router.post('/otp/verify', authRateLimiter, handleOtpVerify);

export default router;
