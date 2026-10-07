/** A problem in a flow, config or target that the person running tests can fix. */
export class TestSphereError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TestSphereError';
  }
}

export function slugify(text) {
  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'flow';
}

export function timestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** "500", "500ms", "2s", "1.5m" or a number of milliseconds. */
export function parseDuration(value, what = 'duration') {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m)?\s*$/.exec(String(value ?? ''));
  if (!match) throw new TestSphereError(`${what} "${value}" isn't a duration. Use milliseconds or a unit, like 500ms, 10s or 2m.`);
  const n = Number(match[1]);
  return Math.round(match[2] === 'm' ? n * 60_000 : match[2] === 's' ? n * 1000 : n);
}

export function parseBoolean(value, what) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const text = String(value).toLowerCase();
  if (['true', 'yes', 'on'].includes(text)) return true;
  if (['false', 'no', 'off'].includes(text)) return false;
  throw new TestSphereError(`${what} should be true or false, not "${value}".`);
}

export function asList(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/** The candidate closest to `word`, if it is close enough to be a likely typo. */
export function closest(word, candidates) {
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const d = distance(word.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return bestDistance <= Math.max(2, Math.floor(word.length / 4)) ? best : null;
}

export function didYouMean(word, candidates) {
  const match = closest(word, candidates);
  return match ? ` Did you mean "${match}"?` : '';
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
