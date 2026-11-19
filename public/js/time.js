/**
 * Parse a WCA-style time input into milliseconds.
 * Mirrors time.js on the server; keep both in sync.
 */
export function parseTimeInput(input) {
  if (typeof input !== 'string') return null;

  const value = input
    .trim()
    .replace(/\s+/g, '')
    .replace(/s$/i, '')
    .replace(',', '.');

  if (!value) return null;

  const match = /^(?:(\d{1,3}):)?(\d{1,2}(?:\.\d{1,3})?)$/.exec(value);
  if (!match) return null;

  const minutes = match[1] ? Number.parseInt(match[1], 10) : 0;
  const hasMinutes = value.includes(':');
  const [wholeSeconds, fraction = ''] = match[2].split('.');
  const seconds = Number.parseInt(wholeSeconds, 10);

  if (hasMinutes && seconds >= 60) return null;

  const milliseconds = Number.parseInt(fraction.padEnd(3, '0').slice(0, 3), 10);
  const total = minutes * 60000 + seconds * 1000 + milliseconds;

  if (total < 1000 || total > 3600000) return null;
  return total;
}

export function formatTimeMs(input) {
  const total = Math.round(Number(input));
  if (!Number.isFinite(total) || total < 0) return '--.---';

  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const milliseconds = total % 1000;

  const secondsPart =
    minutes > 0
      ? `${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
      : `${seconds}.${String(milliseconds).padStart(3, '0')}`;

  return minutes > 0 ? `${minutes}:${secondsPart}` : secondsPart;
}
