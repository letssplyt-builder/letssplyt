export function buildNudgeMessage(params: {
  participantDisplayName: string;
  payerDisplayName: string;
  amountFormatted: string;
  eventTitle: string;
}): string {
  const base = `Hi ${params.participantDisplayName}! ${params.payerDisplayName} is waiting for your ${params.amountFormatted} for ${params.eventTitle}.`;
  return base.length <= 160 ? base : base.slice(0, 157) + '...';
}

export function buildConsolidatedNudgeMessage(params: {
  participantDisplayName: string;
  payerDisplayName: string;
  totalFormatted: string;
  eventCount: number;
  detailsUrl: string;
}): string {
  const eventLabel = params.eventCount === 1 ? '1 event' : `${params.eventCount} events`;
  return `Hi ${params.participantDisplayName}! ${params.payerDisplayName} is waiting for your ${params.totalFormatted} across ${eventLabel}. See details & pay: ${params.detailsUrl}`;
}

