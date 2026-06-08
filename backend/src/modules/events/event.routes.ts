import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  handleCreateEvent,
  handleGetEvent,
  handleListEvents,
  handleLockEvent,
  handleRegenerateJoinToken,
  handleReopenEvent,
} from './event.controller';

const router = Router();

router.use(authenticate);

router.get('/', handleListEvents);
router.post('/', handleCreateEvent);
router.get('/:id', handleGetEvent);
router.post('/:id/lock', handleLockEvent);
router.post('/:id/reopen', handleReopenEvent);
router.post('/:id/join-token/regenerate', handleRegenerateJoinToken);

export default router;
