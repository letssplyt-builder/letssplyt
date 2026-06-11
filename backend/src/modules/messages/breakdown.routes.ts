import { Router } from 'express';
import { getSplitBreakdownPage } from './breakdown.controller';

const router = Router();

router.get('/:token', getSplitBreakdownPage);

export default router;
