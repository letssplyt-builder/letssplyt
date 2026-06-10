import { describe, expect, it } from '@jest/globals';
import {
  getEventSplitActionMode,
  resolveEventSplitActionMode,
} from '../../../utils/eventSplitFooter';

describe('getEventSplitActionMode', () => {
  it('returns initial when no receipt scan', () => {
    expect(getEventSplitActionMode('none')).toBe('initial');
  });

  it('returns parsing while A1 is running', () => {
    expect(getEventSplitActionMode('parsing')).toBe('parsing');
  });

  it('returns review after parse before confirm', () => {
    expect(getEventSplitActionMode('parsed')).toBe('review');
  });

  it('returns edit after itemization', () => {
    expect(getEventSplitActionMode('parsed_confirmed')).toBe('edit');
    expect(getEventSplitActionMode('calculated')).toBe('edit');
    expect(getEventSplitActionMode('complete')).toBe('edit');
  });

  it('returns failed for retry scan path', () => {
    expect(getEventSplitActionMode('failed')).toBe('failed');
  });

  it('resolve falls back to review when receipt_review exists but stage is stale none', () => {
    expect(resolveEventSplitActionMode('none', true)).toBe('review');
  });

  it('resolve prefers stage when parsed', () => {
    expect(resolveEventSplitActionMode('parsed', true)).toBe('review');
  });

  it('resolve shows edit when confirmed with receipt data', () => {
    expect(resolveEventSplitActionMode('parsed_confirmed', true)).toBe('edit');
  });
});
