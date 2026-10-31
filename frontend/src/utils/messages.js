// Message ordering and time display.
//
// The server is the single source of truth for message identity and time: it
// stamps every message (UTC, ISO-8601) with an id and a monotonically
// increasing `seq`. The client only shows provisional bubbles while a request
// is in flight; those carry no timestamp, so a client clock can never put a
// message out of order or show a made-up time.

/** Creation order: server-sequenced messages by `seq`, provisional (not yet confirmed) ones last in the order they were added. */
export function sortMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const seen = new Set();
  const unique = list.filter((m) => {
    if (!m?.id) return true;
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  const sequenced = unique.filter((m) => Number.isInteger(m.seq));
  const provisional = unique.filter((m) => !Number.isInteger(m.seq));
  // Legacy history (no seq at all) keeps its stored order.
  if (sequenced.length === 0) return provisional;
  return [...sequenced.map((m, i) => [m, i]).sort(([a, i], [b, j]) => a.seq - b.seq || i - j).map(([m]) => m), ...provisional];
}

/** Stable React/speech key that survives a provisional bubble being confirmed by the server. */
export function messageKey(message, index) {
  return message.clientId || message.id || `idx-${index}`;
}

/**
 * Swap the provisional user bubble and loading placeholder for the server's
 * authoritative messages, keeping their position and React key.
 */
export function reconcileTurn(messages, { userClientId, botClientId, userMessage, assistantMessage }) {
  const next = messages.map((m) => {
    if (userClientId && m.clientId === userClientId && userMessage) return { ...userMessage, clientId: userClientId, ...(m.isVoice && { isVoice: true }) };
    if (botClientId && m.clientId === botClientId && assistantMessage) return { ...assistantMessage, clientId: botClientId };
    return m;
  });
  return sortMessages(next);
}

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'object') {
    const secs = value.seconds ?? value._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000);
    return null;
  }
  let s = String(value);
  // A timestamp with no zone designator is UTC (that is what the server stores);
  // without this the browser would read it as local time and shift it.
  if (/^\d{4}-\d\d-\d\dT[\d:.]+$/.test(s)) s += 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "03:07 pm" in the viewer's own timezone; '' if there is no valid time. */
export function formatMessageTime(value, locale) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
}

/** Full local date and time, for the tooltip. */
export function formatMessageDateTime(value, locale) {
  const d = toDate(value);
  return d ? d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'medium' }) : '';
}
