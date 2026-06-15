import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  handleCreateHandle,
  handleDeleteHandle,
  handleDeleteMe,
  handleGetBalance,
  handleGetHandles,
  handleGetMe,
  handlePatchMe,
  handlePostPushToken,
  handleReorderHandles,
  handleUpdateHandle,
} from './profile.controller';
import { handleGetCounterparties } from '../settlement/settlement.controller';
import {
  handleGetNotifications,
  handleGetUnreadCount,
  handleMarkNotificationRead,
} from '../notifications/notifications.controller';

const router = Router();

router.use(authenticate);

router.get('/me/notifications', handleGetNotifications);
router.get('/me/notifications/unread-count', handleGetUnreadCount);
router.patch('/me/notifications/:id/read', handleMarkNotificationRead);
router.get('/me', handleGetMe);
router.get('/me/balance', handleGetBalance);
router.get('/me/counterparties', handleGetCounterparties);
router.patch('/me', handlePatchMe);
router.delete('/me', handleDeleteMe);
router.post('/me/delete', handleDeleteMe);
router.post('/me/push-token', handlePostPushToken);
router.get('/me/handles', handleGetHandles);
router.post('/me/handles', handleCreateHandle);
router.patch('/me/handles/reorder', handleReorderHandles);
router.patch('/me/handles/:id', handleUpdateHandle);
router.delete('/me/handles/:id', handleDeleteHandle);

export default router;
