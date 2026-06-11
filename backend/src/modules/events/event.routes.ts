import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import {
  handleCreateEvent,
  handleGetEvent,
  handleListEvents,
  handleLockEvent,
  handleRegenerateJoinToken,
  handleResetExpenses,
  handleReopenEvent,
} from './event.controller';
import {
  handleAddManualParticipant,
  handleDeleteParticipant,
} from './participant.controller';
import splitsRouter from '../splits/splits.router';
import {
  handlePreviewMessages,
  handleResendRevisionMessages,
  handleRetryMessage,
  handleSendMessages,
} from '../messages/messages.controller';
import {
  handleConfirmPayment,
  handleDisputePayment,
  handleMarkParticipantPaid,
  handleNudgeParticipant,
  handleSelfReportPayment,
} from '../settlement/settlement.controller';

const router = Router();

router.use(authenticate);

router.get('/', handleListEvents);
router.post('/', handleCreateEvent);
router.get('/:id', handleGetEvent);
router.post('/:id/participants/manual', handleAddManualParticipant);
router.delete('/:id/participants/:participantId', handleDeleteParticipant);
router.post('/:id/lock', handleLockEvent);
router.post('/:id/expenses/reset', handleResetExpenses);
router.post('/:id/reopen', handleReopenEvent);
router.post('/:id/join-token/regenerate', handleRegenerateJoinToken);
router.get('/:id/messages/preview', handlePreviewMessages);
router.post('/:id/messages/send', handleSendMessages);
router.post('/:id/messages/retry/:participantId', handleRetryMessage);
router.post('/:id/messages/nudge/:participantId', handleNudgeParticipant);
router.post('/:id/splits/resend', handleResendRevisionMessages);
router.post('/:id/settlement/:participantId/self-report', handleSelfReportPayment);
router.post('/:id/settlement/:participantId/confirm', handleConfirmPayment);
router.post('/:id/settlement/:participantId/dispute', handleDisputePayment);
router.post('/:id/settlement/cash/:participantId', handleMarkParticipantPaid);

router.use('/', splitsRouter);

export default router;
