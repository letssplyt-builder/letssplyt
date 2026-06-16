import type { Request, Response, NextFunction } from 'express';
import packageJson from '../../../package.json';
import { runHealthChecks } from './health.service';

export async function handleHealthCheck(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await runHealthChecks(packageJson.version);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
