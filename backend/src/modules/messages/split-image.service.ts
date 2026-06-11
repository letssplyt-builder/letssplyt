import logger from '../../infrastructure/logger';
import type { EventRowWithReceiptFields } from '../events/event.service';
import type { ParticipantSplitRow, SplitImageParams } from './split-image.generator';
import { generateSplitImage } from './split-image.generator';
import {
  createSplitImageSignedUrl,
  uploadSplitImage,
} from './split-image.storage';

type ParticipantRow = {
  id: string;
  display_name: string;
  amount_owed: number | null;
};

export function buildSplitImageParams(
  eventRow: EventRowWithReceiptFields,
  payerDisplayName: string,
  participantRows: ParticipantRow[],
  itemNamesByParticipant: Map<string, string[]>,
  highlightedParticipantId: string,
): SplitImageParams {
  const currency = eventRow.currency ?? 'USD';
  const locale = eventRow.locale ?? 'en-US';
  const showItemsColumn =
    eventRow.split_mode === 'itemised' ||
    [...itemNamesByParticipant.values()].some((names) => names.length > 0);

  const participants: ParticipantSplitRow[] = participantRows.map((row) => ({
    participantId: row.id,
    displayName: row.display_name,
    itemNames: itemNamesByParticipant.get(row.id) ?? [],
    amountOwed: Number(row.amount_owed ?? 0),
  }));

  return {
    eventName: eventRow.title,
    payerDisplayName,
    participants,
    highlightedParticipantId,
    currency,
    locale,
    showItemsColumn,
  };
}

export async function prepareSplitImageMediaUrl(
  eventRow: EventRowWithReceiptFields,
  payerDisplayName: string,
  participantRows: ParticipantRow[],
  itemNamesByParticipant: Map<string, string[]>,
  highlightedParticipantId: string,
): Promise<string | undefined> {
  try {
    const params = buildSplitImageParams(
      eventRow,
      payerDisplayName,
      participantRows,
      itemNamesByParticipant,
      highlightedParticipantId,
    );
    const buffer = await generateSplitImage(params);
    await uploadSplitImage(eventRow.id, highlightedParticipantId, buffer);
    return await createSplitImageSignedUrl(eventRow.id, highlightedParticipantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({
      msg: 'split image generation failed — continuing without image',
      eventId: eventRow.id,
      participantId: highlightedParticipantId,
      error: message,
    });
    return undefined;
  }
}
