import { Router } from 'express';
import { getNudgeSummaryPage } from './nudge-page.controller';

const router = Router();

router.get('/:token', getNudgeSummaryPage);

export default router;
