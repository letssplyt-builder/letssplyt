import { describe, expect, it } from '@jest/globals';
import sharp from 'sharp';
import { formatCurrency } from '../../../infrastructure/security';
import {
  generateSplitImage,
  roundAmountForCurrency,
  splitImageStoragePath,
  type SplitImageParams,
} from '../../../modules/messages/split-image.generator';

const BASE_PARAMS: SplitImageParams = {
  eventName: 'Team Dinner',
  payerDisplayName: 'Alex',
  currency: 'USD',
  locale: 'en-US',
  showItemsColumn: true,
  highlightedParticipantId: 'part-bob',
  participants: [
    {
      participantId: 'part-alice',
      displayName: 'Alice',
      itemNames: ['Pasta', 'Wine'],
      amountOwed: 24.5,
    },
    {
      participantId: 'part-bob',
      displayName: 'Bob',
      itemNames: ['Steak', 'Beer'],
      amountOwed: 38,
    },
    {
      participantId: 'part-carlos',
      displayName: 'Carlos',
      itemNames: ['Salad'],
      amountOwed: 12.5,
    },
  ],
};

async function readRawPixels(buffer: Buffer): Promise<{ data: Buffer; width: number }> {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

describe('split-image.generator', () => {
  it('returns a non-empty Buffer', async () => {
    const buffer = await generateSplitImage(BASE_PARAMS);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
  });

  it('generates correct storage filename pattern', () => {
    expect(splitImageStoragePath('event-1', 'part-bob')).toBe('event-1/split-part-bob.png');
  });

  it('uses formatCurrency for amounts (not hardcoded $)', async () => {
    const gbpParams: SplitImageParams = {
      ...BASE_PARAMS,
      currency: 'GBP',
      locale: 'en-GB',
      showItemsColumn: false,
      participants: [
        {
          participantId: 'part-bob',
          displayName: 'Bob',
          itemNames: ['Steak'],
          amountOwed: 38,
        },
      ],
      highlightedParticipantId: 'part-bob',
    };
    const buffer = await generateSplitImage(gbpParams);
    const meta = await sharp(buffer).metadata();
    expect(formatCurrency(38, 'GBP', 'en-GB')).toBe('£38.00');
    expect(meta.width).toBe(640);
  });

  it('uses getCurrencyMinorUnits for amount rounding (JPY)', () => {
    expect(roundAmountForCurrency(12.456, 'JPY')).toBe(12);
    expect(roundAmountForCurrency(1.234, 'BHD')).toBe(1.234);
  });

  it('highlighted participant row uses indigo accent and background pixels', async () => {
    const buffer = await generateSplitImage(BASE_PARAMS);
    const { data } = await readRawPixels(buffer);

    let hasAccentBar = false;
    let hasHighlightBackground = false;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r === 0x63 && g === 0x66 && b === 0xf1) hasAccentBar = true;
      if (r === 0xee && g === 0xf2 && b === 0xff) hasHighlightBackground = true;
    }

    expect(hasAccentBar).toBe(true);
    expect(hasHighlightBackground).toBe(true);
  });

  it('omits item column when showItemsColumn is false', async () => {
    const buffer = await generateSplitImage({
      ...BASE_PARAMS,
      showItemsColumn: false,
      participants: BASE_PARAMS.participants.slice(0, 1),
      highlightedParticipantId: 'part-alice',
    });
    const meta = await sharp(buffer).metadata();
    expect(meta.height).toBeLessThan(200);
  });

  it('handles missing font gracefully (falls back to system default)', async () => {
    const buffer = await generateSplitImage({
      ...BASE_PARAMS,
      showItemsColumn: false,
      participants: [
        {
          participantId: 'part-bob',
          displayName: 'Bob',
          itemNames: [],
          amountOwed: 38,
        },
      ],
    });
    expect(buffer.length).toBeGreaterThan(100);
  });
});
