import { notifyUserInboxAndPush } from '../../infrastructure/inbox-notify';

export function notifyMemberShareReady(
  memberUserId: string,
  eventTitle: string,
  eventId: string,
): void {
  const title = 'Your share is ready';
  const body = `Your share for ${eventTitle} is ready to view.`;
  notifyUserInboxAndPush(memberUserId, 'share_ready', title, body, {
    type: 'share_ready',
    event_id: eventId,
    event_title: eventTitle,
  }, eventId);
}

export function notifyMemberShareEdited(
  memberUserId: string,
  eventTitle: string,
  eventId: string,
): void {
  const title = 'Share updated';
  const body = `Your share for ${eventTitle} has been updated.`;
  notifyUserInboxAndPush(memberUserId, 'share_edited', title, body, {
    type: 'share_edited',
    event_id: eventId,
    event_title: eventTitle,
  }, eventId);
}
