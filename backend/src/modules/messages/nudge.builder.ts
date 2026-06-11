export function buildNudgeMessage(params: {
  participantDisplayName: string;
  payerDisplayName: string;
  amountFormatted: string;
  eventTitle: string;
}): string {
  const base = `Hi ${params.participantDisplayName}! ${params.payerDisplayName} is waiting for your ${params.amountFormatted} for ${params.eventTitle}.`;
  return base.length <= 160 ? base : base.slice(0, 157) + '...';
}
