/**
 * Extracts and parses the first JSON value from a raw LLM response.
 *
 * The agent prompts all instruct "respond with ONLY valid JSON", but models
 * sometimes still add a sentence before or after the JSON block (especially
 * under load). Previously this caused the raw JSON — including internal
 * field names — to leak into the chat as the visible assistant message, or
 * caused extraction/mapping calls to silently drop the turn's data. This
 * recovers the embedded JSON instead of giving up immediately.
 *
 * Returns null if nothing parseable is found — callers must still fall back
 * to a safe default; this never fabricates data, it only recovers what the
 * model actually produced.
 */
export function extractJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Fast path — the whole cleaned string is already valid JSON.
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // fall through to the balanced-brace scan below
  }

  // Slow path — find the first balanced {...} or [...] block anywhere in
  // the text and parse just that, tolerating stray prose around it.
  const objStart = cleaned.indexOf('{');
  const arrStart = cleaned.indexOf('[');
  const candidates = [objStart, arrStart].filter((i) => i >= 0);
  if (candidates.length === 0) return null;

  const start = Math.min(...candidates);
  const openChar = cleaned[start];
  const closeChar = openChar === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch (_) {
          return null;
        }
      }
    }
  }

  return null;
}
