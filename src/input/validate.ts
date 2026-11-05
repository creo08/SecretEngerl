/**
 * Validation of untrusted input from URL, file and form.
 * Every function returns a value or an error code; texts live in the language files.
 */

/** A validation problem. `code` is a key in the language files. */
export interface ValidationError {
  code: string;
  path: string;
  params?: Record<string, string | number>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export const MAX_PEOPLE = 50;
export const MAX_NAME_CHARS = 40;
export const MAX_BUDGET = 9999;

const CONTROL_AND_FORMAT = /[\p{Cc}\p{Cf}]/gu;
const encoder = new TextEncoder();

/** Length of a string in UTF-8 bytes. */
export function utf8Length(s: string): number {
  return encoder.encode(s).length;
}

/** NFC-normalises, removes control and bidi/format characters (Cc, Cf) and trims. */
export function cleanText(raw: string): string {
  return raw.normalize('NFC').replace(CONTROL_AND_FORMAT, '').trim();
}

/** Cleans free text such as a hint or theme and limits it to `maxBytes` UTF-8 bytes. */
export function parseFreeText(raw: unknown, path: string, maxBytes: number): Result<string> {
  if (typeof raw !== 'string') return fail('text.invalid', path);
  // Line breaks are the only control characters a hint may keep.
  const value = raw.normalize('NFC').split('\n').map(cleanText).join('\n').trim();
  const bytes = utf8Length(value);
  if (bytes > maxBytes) return fail('text.tooLong', path, { max: maxBytes, bytes });
  return { ok: true, value };
}

/** Validates one name: 1 to 40 characters after cleaning. */
export function parseName(raw: unknown, path: string): Result<string> {
  if (typeof raw !== 'string') return fail('name.invalid', path);
  const value = cleanText(raw);
  const chars = [...value].length;
  if (chars === 0) return fail('name.empty', path);
  if (chars > MAX_NAME_CHARS) return fail('name.tooLong', path, { max: MAX_NAME_CHARS });
  return { ok: true, value };
}

/** Key under which two names count as the same person. */
export function nameKey(name: string): string {
  return name.toLocaleLowerCase('de');
}

/**
 * Validates households of names: every name valid, no duplicates (ignoring case),
 * at most 50 people. Empty households are dropped.
 */
export function parseHouseholds(raw: unknown, path: string): Result<string[][]> {
  if (!Array.isArray(raw)) return fail('households.invalid', path);
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  const households: string[][] = [];
  let count = 0;
  raw.forEach((group: unknown, h) => {
    if (!Array.isArray(group)) {
      errors.push({ code: 'households.invalid', path: `${path}[${h}]` });
      return;
    }
    const members: string[] = [];
    group.forEach((n: unknown, i) => {
      const name = parseName(n, `${path}[${h}][${i}]`);
      if (!name.ok) return errors.push(...name.errors);
      if (seen.has(nameKey(name.value))) {
        return errors.push({ code: 'name.duplicate', path: `${path}[${h}][${i}]`, params: { name: name.value } });
      }
      seen.add(nameKey(name.value));
      members.push(name.value);
      count++;
    });
    if (members.length) households.push(members);
  });
  if (count > MAX_PEOPLE) errors.push({ code: 'people.tooMany', path, params: { max: MAX_PEOPLE } });
  return errors.length ? { ok: false, errors } : { ok: true, value: households };
}

/**
 * A single group of everyone would forbid every draw. A list without any
 * separator therefore means that everyone plays on their own.
 */
export function withoutSingleGroup(groups: string[][]): string[][] {
  const filled = groups.filter((g) => g.length > 0);
  return filled.length === 1 ? filled[0]!.map((name) => [name]) : groups;
}

/**
 * Parses the name list as typed by the organizer: one name per line, a blank
 * line separates groups. Without any blank line, everyone plays on their own.
 */
export function parseNameList(text: string): Result<string[][]> {
  const groups: string[][] = [[]];
  for (const line of text.split(/\r?\n/)) {
    // A line that is empty after cleaning (also invisible spaces) separates groups.
    if (cleanText(line) === '') groups.push([]);
    else groups[groups.length - 1]!.push(line);
  }
  return parseHouseholds(withoutSingleGroup(groups), 'names');
}

/** Parses an amount: a decimal number from 0 to 9999 with at most two decimals, "," or ".". */
export function parseAmount(raw: unknown, path: string): Result<number> {
  const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(s)) return fail('amount.invalid', path, { max: MAX_BUDGET });
  return { ok: true, value: Number(s.replace(',', '.')) };
}

/** Parses a calendar date in ISO form YYYY-MM-DD and rejects impossible dates. */
export function parseIsoDate(raw: unknown, path: string): Result<string> {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fail('date.invalid', path);
  const [y, m, d] = raw.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  const valid = t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  return valid ? { ok: true, value: raw } : fail('date.invalid', path);
}

/** Builds a failed result with one error. */
export function fail<T>(code: string, path: string, params?: Record<string, string | number>): Result<T> {
  return { ok: false, errors: [params ? { code, path, params } : { code, path }] };
}
