import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  handleGetGuestDetail,
  handleGetIOwe,
  handleGetMemberDetail,
  handleGetOwedToMe,
  handleGuestConfirmAll,
  handleGuestDisputeAll,
  handleGuestMarkPaidAll,
  handleGuestNudgeOutstanding,
  handleMemberConfirmAll,
  handleMemberDisputeAll,
  handleMemberMarkPaidAll,
  handleMemberNudgeOutstanding,
  handleMemberSelfReportAll,
} from './settlement.controller';

const router = Router();

router.use(authenticate);

router.get('/owed-to-me', handleGetOwedToMe);
router.get('/i-owe', handleGetIOwe);
router.get('/person/:userId', handleGetMemberDetail);
router.get('/member/:userId', handleGetMemberDetail);
router.post('/member/:userId/self-report-all', handleMemberSelfReportAll);
router.post('/member/:userId/confirm-all', handleMemberConfirmAll);
router.post('/member/:userId/dispute-all', handleMemberDisputeAll);
router.post('/member/:userId/mark-paid-all', handleMemberMarkPaidAll);
router.post('/member/:userId/nudge', handleMemberNudgeOutstanding);
router.get('/guest/:phoneHash', handleGetGuestDetail);
router.post('/guest/:phoneHash/confirm-all', handleGuestConfirmAll);
router.post('/guest/:phoneHash/dispute-all', handleGuestDisputeAll);
router.post('/guest/:phoneHash/mark-paid-all', handleGuestMarkPaidAll);
router.post('/guest/:phoneHash/nudge', handleGuestNudgeOutstanding);

export default router;
