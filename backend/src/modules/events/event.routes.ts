import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireEventAccess } from '../../middleware/eventAccess';
import {
  handleCreateEvent,
  handleGetEvent,
  handleListEvents,
  handleLockEvent,
  handleRegenerateJoinToken,
  handleResetExpenses,
  handleDeleteEvent,
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
const requireOwner = requireEventAccess('owner');
const requireMember = requireEventAccess('member');

router.use(authenticate);

router.get('/', handleListEvents);
router.post('/', handleCreateEvent);
router.get('/:id', requireMember, handleGetEvent);
router.delete('/:id', requireOwner, handleDeleteEvent);
router.post('/:id/participants/manual', requireOwner, handleAddManualParticipant);
router.delete('/:id/participants/:participantId', requireOwner, handleDeleteParticipant);
router.post('/:id/lock', requireOwner, handleLockEvent);
router.post('/:id/expenses/reset', requireOwner, handleResetExpenses);
router.post('/:id/reopen', requireOwner, handleReopenEvent);
router.post('/:id/join-token/regenerate', requireOwner, handleRegenerateJoinToken);
router.get('/:id/messages/preview', requireOwner, handlePreviewMessages);
router.post('/:id/messages/send', requireOwner, handleSendMessages);
router.post('/:id/messages/retry/:participantId', requireOwner, handleRetryMessage);
router.post('/:id/messages/nudge/:participantId', requireOwner, handleNudgeParticipant);
router.post('/:id/splits/resend', requireOwner, handleResendRevisionMessages);
router.post('/:id/settlement/:participantId/self-report', requireMember, handleSelfReportPayment);
router.post('/:id/settlement/:participantId/confirm', requireOwner, handleConfirmPayment);
router.post('/:id/settlement/:participantId/dispute', requireOwner, handleDisputePayment);
router.post('/:id/settlement/cash/:participantId', requireOwner, handleMarkParticipantPaid);

router.use('/', splitsRouter);

export default router;
