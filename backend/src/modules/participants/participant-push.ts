import { notifyUserInboxAndPush } from '../../infrastructure/inbox-notify';

export function notifyMemberAddedToEvent(
  memberUserId: string,
  eventTitle: string,
  eventId: string,
): void {
  const title = "You're in!";
  const body = `You've been added to ${eventTitle}.`;
  notifyUserInboxAndPush(memberUserId, 'added_to_event', title, body, {
    type: 'added_to_event',
    event_id: eventId,
    event_title: eventTitle,
  }, eventId);
}
