import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  generateSplitImage,
  splitImageStoragePath,
} from '../../../modules/messages/split-image.generator';
import {
  createSplitImageSignedUrl,
  uploadSplitImage,
} from '../../../modules/messages/split-image.storage';
import { mockSupabase } from '../../mocks/supabase.mock';

const EVENT_ID = 'event-1111-1111-1111-111111111111';
const PARTICIPANT_ID = 'part-a-1111-1111-1111-111111111111';

describe('split image storage integration', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
  });

  it('uploadSplitImage writes PNG to receipts bucket at split-[participantId].png path', async () => {
    const buffer = await generateSplitImage({
      eventName: 'Smoke Dinner',
      eventDate: null,
      payerDisplayName: 'Alex',
      participants: [
        {
          participantId: PARTICIPANT_ID,
          displayName: 'Alex',
          itemNames: ['Pasta'],
          amountOwed: 42,
        },
      ],
      highlightedParticipantId: PARTICIPANT_ID,
      currency: 'USD',
      locale: 'en-US',
      taxAndTip: 8,
      total: 50,
    });

    const path = await uploadSplitImage(EVENT_ID, PARTICIPANT_ID, buffer);
    const expectedPath = splitImageStoragePath(EVENT_ID, PARTICIPANT_ID);

    expect(path).toBe(expectedPath);

    const bucket = mockSupabase.storage.from('receipts');
    expect(bucket.upload).toHaveBeenCalledWith(expectedPath, buffer, {
      contentType: 'image/png',
      upsert: true,
    });
  });

  it('createSplitImageSignedUrl returns a signed download URL', async () => {
    const url = await createSplitImageSignedUrl(EVENT_ID, PARTICIPANT_ID);

    expect(url).toContain('mock-download-token');

    const bucket = mockSupabase.storage.from('receipts');
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(
      splitImageStoragePath(EVENT_ID, PARTICIPANT_ID),
      86400,
    );
  });
});
