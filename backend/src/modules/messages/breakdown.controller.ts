import type { Request, Response } from 'express';
import { renderSplitBreakdownHtml } from './breakdown-page.service';

export async function getSplitBreakdownPage(req: Request, res: Response): Promise<void> {
  const token = req.params.token ?? '';
  const { html, status } = await renderSplitBreakdownHtml(token);
  res
    .status(status)
    .type('html')
    .setHeader('Cache-Control', 'private, no-store')
    .send(html);
}
