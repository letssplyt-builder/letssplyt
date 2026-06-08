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
