import { describe, it, expect } from '@jest/globals';
import { sanitizePromptInput } from '../../../infrastructure/security/sanitize';

describe('sanitizePromptInput', () => {
  it('strips newline characters (\\n and \\r)', () => {
    expect(sanitizePromptInput('line1\nline2\rline3')).not.toMatch(/[\n\r]/);
  });

  it('strips pipe characters', () => {
    expect(sanitizePromptInput('a|b|c')).not.toContain('|');
  });

  it('strips backtick characters', () => {
    expect(sanitizePromptInput('`code`')).not.toContain('`');
  });

  it('strips triple-dash sequences', () => {
    expect(sanitizePromptInput('item --- note')).not.toContain('---');
  });

  it('strips XML-like tags', () => {
    const result = sanitizePromptInput('<script>alert(1)</script>safe');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
    expect(result).toContain('safe');
  });

  it('truncates to maxLength', () => {
    expect(sanitizePromptInput('abcdefghij', 5)).toBe('abcde');
  });

  it('returns empty string for null input', () => {
    expect(sanitizePromptInput(null as unknown as string)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(sanitizePromptInput(undefined as unknown as string)).toBe('');
  });

  it('removes injected characters from adversarial prompt input', () => {
    const result = sanitizePromptInput('item\n| DROP TABLE users; --\n<script>');
    expect(result).not.toMatch(/[\n\r|`<]/);
    expect(result).not.toContain('<script>');
  });
});
