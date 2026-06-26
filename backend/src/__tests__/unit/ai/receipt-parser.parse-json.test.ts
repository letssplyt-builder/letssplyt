import { describe, expect, it } from '@jest/globals';
import {
  extractJsonPayload,
  parseReceiptModelJson,
  previewModelOutput,
  repairCommonJsonIssues,
  stripMarkdownJsonFence,
} from '../../../modules/ai/receipt-parser/receipt-parser.parse-json';

describe('receipt-parser.parse-json', () => {
  it('stripMarkdownJsonFence removes code fences', () => {
    expect(stripMarkdownJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('extractJsonPayload takes outer object from prose wrapper', () => {
    const raw = 'Here is the JSON:\n{"items":[],"total":1}\nThanks';
    expect(extractJsonPayload(raw)).toBe('{"items":[],"total":1}');
  });

  it('repairCommonJsonIssues removes trailing commas', () => {
    expect(repairCommonJsonIssues('{"a":1,}')).toBe('{"a":1}');
    expect(repairCommonJsonIssues('{"items":[1,],}')).toBe('{"items":[1]}');
  });

  it('parseReceiptModelJson parses fenced JSON with trailing commas', () => {
    const raw = '```json\n{"items":[{"name":"Burger","unit_price":10,}],}\n```';
    const parsed = parseReceiptModelJson(raw) as { items: unknown[] };
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  it('parseReceiptModelJson throws on non-JSON', () => {
    expect(() => parseReceiptModelJson('not json at all')).toThrow();
  });

  it('previewModelOutput truncates to max length', () => {
    expect(previewModelOutput('x'.repeat(600), 500)).toHaveLength(500);
  });
});
