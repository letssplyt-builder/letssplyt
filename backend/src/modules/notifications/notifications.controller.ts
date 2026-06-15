import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../infrastructure/errors';
import {
  getUnreadCount,
  getVisibleNotifications,
  markNotificationRead,
} from './inbox-notification.service';

export async function handleGetNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { notifications, unreadCount } = await getVisibleNotifications(userId);

    res.json({
      notifications: notifications.map((row) => ({
        ...row,
        is_read: row.read_at !== null,
      })),
      unread_count: unreadCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleGetUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const unreadCount = await getUnreadCount(req.user!.id);
    res.json({ unread_count: unreadCount });
  } catch (err) {
    next(err);
  }
}

export async function handleMarkNotificationRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const notificationId = req.params.id;
    if (!notificationId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Notification id is required' },
      });
      return;
    }

    try {
      await markNotificationRead(req.user!.id, notificationId);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOTIFICATION_NOT_FOUND') {
        throw new AppError('NOT_FOUND', 'Notification not found', 404);
      }
      if (err instanceof Error && err.message.startsWith('INBOX_READ_FAILED')) {
        throw new AppError('DB_WRITE_FAILED', 'Could not mark notification read', 500);
      }
      throw err;
    }

    const unreadCount = await getUnreadCount(req.user!.id);
    res.json({ ok: true, unread_count: unreadCount });
  } catch (err) {
    next(err);
  }
}
