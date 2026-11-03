/**
 * Helpers for turning arbitrary step payloads into searchable text.
 *
 * Agent frameworks pass provider-shaped objects: `{ text }`, `{ content: [...] }`,
 * `{ message: { content } }`, and so on. These helpers walk such structures
 * defensively — no throwing, bounded depth, cycle-safe.
 */

const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 100_000;

/**
 * Flatten a payload into a single lowercase-searchable string.
 *
 * Only strings and numbers contribute text. Keys are included so that
 * structured payloads such as `{ instruction: "..." }` are still matched.
 */
export function extractText(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return '';
  if (depth > MAX_DEPTH) return '';

  switch (typeof value) {
    case 'string':
      return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
    case 'number':
    case 'boolean':
      return String(value);
    case 'bigint':
      return value.toString();
    case 'function':
    case 'symbol':
      return '';
    default:
      break;
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractText(item, depth + 1)).join('\n');
  }

  if (value instanceof Map) {
    const parts: string[] = [];
    for (const [key, item] of value) {
      parts.push(`${String(key)} ${extractText(item, depth + 1)}`);
    }
    return parts.join('\n');
  }

  if (value instanceof Set) {
    const parts: string[] = [];
    for (const item of value) parts.push(extractText(item, depth + 1));
    return parts.join('\n');
  }

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record)) {
    const child = record[key];
    if (typeof child === 'function') continue;
    parts.push(`${key} ${extractText(child, depth + 1)}`);
  }
  return parts.join('\n');
}

/**
 * Invisible formatting characters commonly used to hide injected text.
 */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/**
 * Remove invisible formatting characters.
 *
 * Zero-width spaces, bidi overrides and similar characters are used to hide
 * injected instructions from naive substring matching.
 */
export function stripInvisible(text: string): string {
  return text.replace(INVISIBLE, '');
}

/**
 * Fold a text into its canonical comparable form.
 *
 * - Unicode NFKC maps full-width and compatibility characters onto ASCII, so
 *   `Ｉｇｎｏｒｅ` becomes `ignore`.
 * - Invisible characters are replaced with a space, so a hidden character
 *   inside a word ("Ignore[ZWSP]all") does not silently fuse two words.
 * - Runs of whitespace collapse to a single space.
 * - The result is lowercased.
 */
export function normalizeForMatching(text: string): string {
  return text
    .normalize('NFKC')
    .replace(INVISIBLE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Produce the alternative normalised forms of a text.
 *
 * Two variants are returned because they defeat different obfuscations:
 *
 *  1. Invisible characters replaced by a space — catches `Ignore[ZWSP]all`.
 *  2. Invisible characters removed entirely — catches `ig[ZWSP]nore`.
 *
 * A pattern that matches neither variant is treated as no match.
 */
export function normalizeVariants(text: string): string[] {
  const withSpaces = normalizeForMatching(text);
  const removed = text
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return removed === withSpaces ? [withSpaces] : [withSpaces, removed];
}

/**
 * Count the number of occurrences of `needle` inside `haystack`.
 *
 * Overlapping matches are counted separately.
 */
export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}
