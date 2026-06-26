const JSON_FENCE_START = /^```(?:json)?\s*\n?/i;
const JSON_FENCE_END = /\n?```\s*$/i;

/** Strip markdown code fences from model output. */
export function stripMarkdownJsonFence(text: string): string {
  return text.trim().replace(JSON_FENCE_START, '').replace(JSON_FENCE_END, '').trim();
}

/** Extract the outermost JSON object or array substring. */
export function extractJsonPayload(text: string): string {
  const trimmed = stripMarkdownJsonFence(text);
  const start = trimmed.search(/[{[]/);
  if (start === -1) {
    return trimmed;
  }

  const open = trimmed[start];
  const close = open === '{' ? '}' : ']';
  const end = trimmed.lastIndexOf(close);
  if (end <= start) {
    return trimmed.slice(start);
  }

  return trimmed.slice(start, end + 1);
}

/** Fix common LLM JSON mistakes without changing valid JSON semantics. */
export function repairCommonJsonIssues(text: string): string {
  return text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

/**
 * Parse A1 model JSON with light salvage (fences, trailing commas, smart quotes).
 * Throws the last JSON.parse error if all candidates fail.
 */
export function parseReceiptModelJson(rawText: string): unknown {
  const trimmed = rawText.trim();
  const stripped = stripMarkdownJsonFence(rawText);
  const extracted = extractJsonPayload(rawText);
  const candidates = [
    trimmed,
    stripped,
    repairCommonJsonIssues(stripped),
    repairCommonJsonIssues(extracted),
  ];

  const seen = new Set<string>();
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);

    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error('Invalid JSON from model');
}

/** Truncate raw model output for audit logs (no PII scrub — receipt names only). */
export function previewModelOutput(rawText: string, maxLen = 500): string {
  return rawText.trim().slice(0, maxLen);
}
