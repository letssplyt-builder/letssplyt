import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { handleGetGuestDetail, handleGetMemberDetail } from './settlement.controller';

const router = Router();

router.use(authenticate);

router.get('/member/:userId', handleGetMemberDetail);
router.get('/guest/:phoneHash', handleGetGuestDetail);

export default router;
