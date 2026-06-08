import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  handleCreateHandle,
  handleDeleteHandle,
  handleGetHandles,
  handleGetMe,
  handlePatchMe,
} from './profile.controller';

const router = Router();

router.use(authenticate);

router.get('/me', handleGetMe);
router.patch('/me', handlePatchMe);
router.get('/me/handles', handleGetHandles);
router.post('/me/handles', handleCreateHandle);
router.delete('/me/handles/:id', handleDeleteHandle);

export default router;
