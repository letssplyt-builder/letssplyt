import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import logger from '../../../infrastructure/logger';
import { mockSupabase } from '../../mocks/supabase.mock';
import { deleteReceiptImagesForEvent } from '../../../modules/events/event-storage.cleanup';

const EVENT_ID = 'event-11111111-1111-1111-1111-111111111111';

describe('deleteReceiptImagesForEvent', () => {
  beforeEach(() => {
    mockSupabase.__resetMock();
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('logs a structured warning when storage remove fails', async () => {
    const bucket = mockSupabase.storage.from('receipts');
    jest.spyOn(bucket, 'list').mockResolvedValue({
      data: [{ name: 'scan.jpg' }],
      error: null,
    });
    jest.spyOn(bucket, 'remove').mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });

    await deleteReceiptImagesForEvent(EVENT_ID);

    expect(logger.warn).toHaveBeenCalledWith({
      msg: 'Could not delete receipt images for event',
      eventId: EVENT_ID,
      dbMessage: 'permission denied',
    });
  });

  it('logs a structured warning when storage cleanup throws', async () => {
    const err = new Error('network down');
    jest.spyOn(mockSupabase.storage, 'from').mockImplementation(() => {
      throw err;
    });

    await deleteReceiptImagesForEvent(EVENT_ID);

    expect(logger.warn).toHaveBeenCalledWith({
      msg: 'Storage cleanup skipped for event',
      eventId: EVENT_ID,
      err,
    });
  });
});
