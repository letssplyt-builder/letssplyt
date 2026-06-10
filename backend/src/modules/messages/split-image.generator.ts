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
  eventDate: string | null;
  payerDisplayName: string;
  participants: ParticipantSplitRow[];
  highlightedParticipantId: string;
  currency: string;
  locale: string;
  taxAndTip: number;
  total: number;
}

const W = 640;
const HEADER_H = 68;
const COL_HEADER_H = 40;
const ROW_H = 52;
const TAX_ROW_H = 44;
const TOTAL_ROW_H = 48;
const FOOTER_H = 36;
const COL_NAME_W = Math.floor(W * 0.3);
const COL_ITEMS_W = Math.floor(W * 0.45);

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
  if (names.length === 0) return 'Even split';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
}

function formatAmount(
  amountMajor: number,
  currency: string,
  locale: string,
): string {
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

function drawDivider(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  y: number,
  width: number,
): void {
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
}

function drawRow(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  y: number,
  row: DrawRow,
  currency: string,
  locale: string,
): void {
  if (row.isRecipient) {
    ctx.fillStyle = '#EEF2FF';
    ctx.fillRect(0, y, W, ROW_H);
    ctx.fillStyle = '#6366F1';
    ctx.fillRect(0, y, 4, ROW_H);
    ctx.fillStyle = '#3730A3';
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, W, ROW_H);
    ctx.fillStyle = '#1E293B';
  }

  drawDivider(ctx, y, W);

  const family = fontFamily();
  ctx.font = row.isRecipient ? `bold 14px ${family}` : `500 14px ${family}`;
  ctx.fillText(truncate(row.displayName, 16), 16, y + 32);

  ctx.font = `12px ${family}`;
  const itemText = formatItems(row.itemNames);
  ctx.fillText(truncate(itemText, 30), COL_NAME_W + 12, y + 32);

  ctx.textAlign = 'right';
  ctx.font = row.isRecipient
    ? `bold 14px ${family}`
    : `600 14px ${family}`;
  ctx.fillText(formatAmount(row.amountOwed, currency, locale), W - 12, y + 32);
  ctx.textAlign = 'left';
}

export async function generateSplitImage(params: SplitImageParams): Promise<Buffer> {
  registerFonts();
  const family = fontFamily();

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

  const visibleRows = rows.slice(0, 12);
  const extraCount = rows.length > 12 ? rows.length - 12 : 0;

  const H =
    HEADER_H +
    COL_HEADER_H +
    visibleRows.length * ROW_H +
    (extraCount > 0 ? ROW_H : 0) +
    TAX_ROW_H +
    TOTAL_ROW_H +
    FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#6366F1';
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 18px ${family}`;
  ctx.fillText(truncate(params.eventName, 35), 16, 26);
  ctx.font = `13px ${family}`;
  const dateStr = params.eventDate ? ` • ${params.eventDate}` : '';
  ctx.fillText(`Paid by ${params.payerDisplayName}${dateStr}`, 16, 50);

  let y = HEADER_H;
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, y, W, COL_HEADER_H);
  ctx.fillStyle = '#64748B';
  ctx.font = `bold 12px ${family}`;
  ctx.fillText('NAME', 16, y + 26);
  ctx.fillText('ITEMS', COL_NAME_W + 12, y + 26);
  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT', W - 12, y + 26);
  ctx.textAlign = 'left';

  y += COL_HEADER_H;
  for (const row of visibleRows) {
    drawRow(ctx, y, row, params.currency, params.locale);
    y += ROW_H;
  }

  if (extraCount > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, y, W, ROW_H);
    drawDivider(ctx, y, W);
    ctx.fillStyle = '#94A3B8';
    ctx.font = `13px ${family}`;
    ctx.fillText(`＋${extraCount} more participants`, 16, y + 30);
    y += ROW_H;
  }

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, y, W, TAX_ROW_H);
  drawDivider(ctx, y, W);
  ctx.fillStyle = '#64748B';
  ctx.font = `13px ${family}`;
  ctx.fillText('Tax + Tip', COL_NAME_W + 12, y + 28);
  ctx.textAlign = 'right';
  ctx.fillText(
    formatAmount(params.taxAndTip, params.currency, params.locale),
    W - 12,
    y + 28,
  );
  ctx.textAlign = 'left';
  y += TAX_ROW_H;

  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, y, W, TOTAL_ROW_H);
  drawDivider(ctx, y, W);
  ctx.fillStyle = '#0F172A';
  ctx.font = `bold 14px ${family}`;
  ctx.fillText('TOTAL', COL_NAME_W + 12, y + 30);
  ctx.textAlign = 'right';
  ctx.font = `bold 16px ${family}`;
  ctx.fillText(formatAmount(params.total, params.currency, params.locale), W - 12, y + 30);
  ctx.textAlign = 'left';
  y += TOTAL_ROW_H;

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, y, W, FOOTER_H);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `11px ${family}`;
  ctx.fillText('LetsSplyt • letssplyt.app', 16, y + 23);

  return canvas.toBuffer('image/png');
}
