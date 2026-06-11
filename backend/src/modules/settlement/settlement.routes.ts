import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  handleGetGuestDetail,
  handleGetMemberDetail,
  handleGuestConfirmAll,
  handleGuestDisputeAll,
  handleGuestMarkPaidAll,
  handleMemberConfirmAll,
  handleMemberDisputeAll,
  handleMemberMarkPaidAll,
  handleMemberSelfReportAll,
} from './settlement.controller';

const router = Router();

router.use(authenticate);

router.get('/member/:userId', handleGetMemberDetail);
router.post('/member/:userId/self-report-all', handleMemberSelfReportAll);
router.post('/member/:userId/confirm-all', handleMemberConfirmAll);
router.post('/member/:userId/dispute-all', handleMemberDisputeAll);
router.post('/member/:userId/mark-paid-all', handleMemberMarkPaidAll);
router.get('/guest/:phoneHash', handleGetGuestDetail);
router.post('/guest/:phoneHash/confirm-all', handleGuestConfirmAll);
router.post('/guest/:phoneHash/dispute-all', handleGuestDisputeAll);
router.post('/guest/:phoneHash/mark-paid-all', handleGuestMarkPaidAll);

export default router;
