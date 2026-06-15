import logger from './logger';

/** Fire-and-forget push delivery — logs failures, never throws to callers. */
export function firePush(task: () => Promise<void>): void {
  void task().catch((err) => {
    logger.warn({
      msg: 'Push notification failed',
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
