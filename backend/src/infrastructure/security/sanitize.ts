/**
 * Defense-in-depth prompt scrubbing for LLM inputs — not a substitute for
 * parameterized prompts or keeping arithmetic out of model output.
 */
export function sanitizePromptInput(input: string, maxLength = 200): string {
  if (input == null) return '';
  return input
    .replace(/[\n\r]/g, ' ')
    .replace(/[|`]/g, '')
    .replace(/-{3,}/g, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}
