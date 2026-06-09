import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  handleCreateHandle,
  handleDeleteHandle,
  handleGetBalance,
  handleGetHandles,
  handleGetMe,
  handlePatchMe,
  handlePostPushToken,
  handleReorderHandles,
  handleUpdateHandle,
} from './profile.controller';

const router = Router();

router.use(authenticate);

router.get('/me', handleGetMe);
router.get('/me/balance', handleGetBalance);
router.patch('/me', handlePatchMe);
router.post('/me/push-token', handlePostPushToken);
router.get('/me/handles', handleGetHandles);
router.post('/me/handles', handleCreateHandle);
router.patch('/me/handles/reorder', handleReorderHandles);
router.patch('/me/handles/:id', handleUpdateHandle);
router.delete('/me/handles/:id', handleDeleteHandle);

export default router;
