import type { Request, Response } from 'express';
import { renderNudgeSummaryHtml } from './nudge-page.service';

export async function getNudgeSummaryPage(req: Request, res: Response): Promise<void> {
  const token = req.params.token ?? '';
  const { html, status } = await renderNudgeSummaryHtml(token);
  res
    .status(status)
    .type('html')
    .setHeader('Cache-Control', 'private, no-store')
    .send(html);
}
