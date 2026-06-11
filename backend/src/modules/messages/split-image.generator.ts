import { existsSync } from 'fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { getCurrencyMinorUnits } from '@letssplyt/shared/utils/splitCalculator';
import { formatCurrency } from '../../infrastructure/security';

export interface ParticipantSplitRow {
  participantId: string;
  displayName: string;
  itemNames: string[];
  amountOwed: number;
}

export interface SplitImageParams {
  eventName: string;
  payerDisplayName: string;
  participants: ParticipantSplitRow[];
  highlightedParticipantId: string;
  currency: string;
  locale: string;
  showItemsColumn: boolean;
}

const W = 640;
const TITLE_H = 36;
const COL_HEADER_H = 36;
const ROW_H = 44;

const FONT_PATHS = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
];

let fontsRegistered = false;

function registerFonts(): void {
  if (fontsRegistered) return;
  for (const path of FONT_PATHS) {
    if (existsSync(path)) {
      GlobalFonts.registerFromPath(path, 'SplitSans');
      break;
    }
  }
  fontsRegistered = true;
}

function fontFamily(): string {
  return GlobalFonts.has('SplitSans') ? 'SplitSans' : 'sans-serif';
}

export function splitImageStoragePath(eventId: string, participantId: string): string {
  return `${eventId}/split-${participantId}.png`;
}

export function roundAmountForCurrency(amountMajor: number, currency: string): number {
  const multiplier = Math.pow(10, getCurrencyMinorUnits(currency));
  return Math.round(amountMajor * multiplier) / multiplier;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function formatItems(names: string[]): string {
  if (names.length === 0) return '—';
  if (names.length <= 4) return names.join(', ');
  return `${names.slice(0, 4).join(', ')} +${names.length - 4}`;
}

function formatAmount(amountMajor: number, currency: string, locale: string): string {
  const rounded = roundAmountForCurrency(amountMajor, currency);
  return formatCurrency(rounded, currency, locale);
}

interface DrawRow {
  participantId: string;
  displayName: string;
  itemNames: string[];
  amountOwed: number;
  isRecipient: boolean;
}

interface ColumnLayout {
  nameX: number;
  itemsX: number;
  shareX: number;
  nameMaxChars: number;
  itemsMaxChars: number;
}

function columnLayout(showItemsColumn: boolean): ColumnLayout {
  if (showItemsColumn) {
    const nameW = Math.floor(W * 0.28);
    const itemsW = Math.floor(W * 0.42);
    return {
      nameX: 14,
      itemsX: nameW + 8,
      shareX: nameW + itemsW,
      nameMaxChars: 14,
      itemsMaxChars: 28,
    };
  }
  const nameW = Math.floor(W * 0.55);
  return {
    nameX: 14,
    itemsX: 0,
    shareX: nameW,
    nameMaxChars: 22,
    itemsMaxChars: 0,
  };
}

function drawDivider(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  y: number,
): void {
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}

function drawRow(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  y: number,
  row: DrawRow,
  currency: string,
  locale: string,
  layout: ColumnLayout,
  showItemsColumn: boolean,
): void {
  if (row.isRecipient) {
    ctx.fillStyle = '#EEF2FF';
    ctx.fillRect(0, y, W, ROW_H);
    ctx.fillStyle = '#6366F1';
    ctx.fillRect(0, y, 3, ROW_H);
    ctx.fillStyle = '#3730A3';
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, W, ROW_H);
    ctx.fillStyle = '#1E293B';
  }

  drawDivider(ctx, y);

  const family = fontFamily();
  ctx.textAlign = 'left';
  ctx.font = row.isRecipient ? `bold 14px ${family}` : `500 14px ${family}`;
  ctx.fillText(truncate(row.displayName, layout.nameMaxChars), layout.nameX, y + 28);

  if (showItemsColumn) {
    ctx.font = `13px ${family}`;
    ctx.fillStyle = row.isRecipient ? '#3730A3' : '#475569';
    ctx.fillText(
      truncate(formatItems(row.itemNames), layout.itemsMaxChars),
      layout.itemsX,
      y + 28,
    );
  }

  ctx.textAlign = 'right';
  ctx.font = row.isRecipient ? `bold 14px ${family}` : `600 14px ${family}`;
  ctx.fillStyle = row.isRecipient ? '#3730A3' : '#1E293B';
  ctx.fillText(formatAmount(row.amountOwed, currency, locale), W - 14, y + 28);
  ctx.textAlign = 'left';
}

export async function generateSplitImage(params: SplitImageParams): Promise<Buffer> {
  registerFonts();
  const family = fontFamily();
  const layout = columnLayout(params.showItemsColumn);

  const sortedParticipants = [...params.participants].sort(
    (a, b) => b.amountOwed - a.amountOwed,
  );
  const rows: DrawRow[] = sortedParticipants.map((row) => ({
    participantId: row.participantId,
    displayName: row.displayName,
    itemNames: row.itemNames,
    amountOwed: row.amountOwed,
    isRecipient: row.participantId === params.highlightedParticipantId,
  }));

  const visibleRows = rows.slice(0, 14);
  const extraCount = rows.length > 14 ? rows.length - 14 : 0;

  const H =
    TITLE_H +
    COL_HEADER_H +
    visibleRows.length * ROW_H +
    (extraCount > 0 ? ROW_H : 0);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 15px ${family}`;
  ctx.fillText(truncate(params.eventName, 40), 14, 24);

  let y = TITLE_H;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, y, W, COL_HEADER_H);
  drawDivider(ctx, y);
  ctx.fillStyle = '#64748B';
  ctx.font = `bold 11px ${family}`;
  ctx.fillText('NAME', layout.nameX, y + 24);
  if (params.showItemsColumn) {
    ctx.fillText('ITEM', layout.itemsX, y + 24);
  }
  ctx.textAlign = 'right';
  ctx.fillText('YOUR SHARE', W - 14, y + 24);
  ctx.textAlign = 'left';

  y += COL_HEADER_H;
  for (const row of visibleRows) {
    drawRow(ctx, y, row, params.currency, params.locale, layout, params.showItemsColumn);
    y += ROW_H;
  }

  if (extraCount > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, W, ROW_H);
    drawDivider(ctx, y);
    ctx.fillStyle = '#94A3B8';
    ctx.font = `13px ${family}`;
    ctx.fillText(`+${extraCount} more`, layout.nameX, y + 28);
    y += ROW_H;
  }

  return canvas.toBuffer('image/png');
}
