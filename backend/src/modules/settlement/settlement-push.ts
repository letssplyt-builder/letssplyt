import { formatCurrency } from '../../infrastructure/security';
import { notifyUserInboxAndPush } from '../../infrastructure/inbox-notify';

export function notifyCreatorMemberPaid(
  payerId: string,
  participantName: string,
  amountMinor: number,
  currency: string,
  locale: string,
  eventTitle: string,
  eventId: string,
): void {
  const amountFormatted = formatCurrency(amountMinor, currency, locale);
  const title = 'Payment received';
  const body = `${participantName} has paid ${amountFormatted} for ${eventTitle}.`;
  notifyUserInboxAndPush(payerId, 'member_paid', title, body, {
    type: 'member_paid',
    event_id: eventId,
    event_title: eventTitle,
  }, eventId);
}

export function notifyCreatorEventFullySettled(
  payerId: string,
  eventTitle: string,
  eventId: string,
): void {
  const title = 'All settled';
  const body = `${eventTitle} is fully settled!`;
  notifyUserInboxAndPush(payerId, 'event_fully_settled', title, body, {
    type: 'event_fully_settled',
    event_id: eventId,
    event_title: eventTitle,
  }, eventId);
}

export function notifyCreatorMemberPaidAll(
  payerId: string,
  participantName: string,
  totalAmountMinor: number,
  currency: string,
  locale: string,
): void {
  const amountFormatted = formatCurrency(totalAmountMinor, currency, locale);
  const title = 'All paid';
  const body = `${participantName} has paid ${amountFormatted} for all their outstanding events.`;
  notifyUserInboxAndPush(payerId, 'member_paid_all', title, body, {
    type: 'member_paid_all',
  });
}

export function notifyMemberNudge(
  participantUserId: string,
  amountMinor: number,
  currency: string,
  locale: string,
  eventTitle: string,
  eventId: string,
): void {
  const amountFormatted = formatCurrency(amountMinor, currency, locale);
  const title = 'Friendly reminder';
  const body = `When you get a chance, your share for ${eventTitle} is ${amountFormatted}.`;
  notifyUserInboxAndPush(participantUserId, 'nudge', title, body, {
    type: 'nudge',
    event_id: eventId,
    event_title: eventTitle,
  }, eventId);
}
