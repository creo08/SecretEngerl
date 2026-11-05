/**
 * Last year's round: names, groups, pairings, budget and hints, so that next
 * year nobody draws the same person again. Kept in a yearly file and on the device.
 */
import type { Pairing, TemplateId } from '../config/types.ts';
import { isTemplateId, MAX_HINT_BYTES } from '../config/validate.ts';
import { fail, nameKey, parseAmount, parseFreeText, parseHouseholds, parseName, type Result, type ValidationError } from '../input/validate.ts';
import { fromBase64Url, toBase64Url } from '../link/base64url.ts';
import { MAX_TITLE_CHARS, readAssignment } from '../store/rounds.ts';
import type { StoredRound } from '../store/types.ts';

export interface YearData {
  /** Year of the exchange. */
  year: number;
  template: TemplateId;
  title?: string;
  households: string[][];
  pairings: Pairing[];
  budget: number | null;
  hints: Record<string, string>;
}

/** Collects last year's data from a stored round; the pairings are read from its links. */
export async function yearFromRound(round: StoredRound): Promise<YearData> {
  const pairs = await readAssignment(round);
  return {
    year: Number(round.config.occasion.exchangeDate.slice(0, 4)),
    template: round.config.template,
    ...(round.title ? { title: round.title } : {}),
    households: round.config.participants.households,
    pairings: [...pairs].map(([giver, receiver]) => ({ giver, receiver })),
    budget: round.config.gifts.budget?.amount ?? null,
    hints: round.config.gifts.hints,
  };
}

/** The suggested file name, e.g. "engerl-2026.wichtel". */
export function yearFileName(year: number): string {
  return `engerl-${year}.wichtel`;
}

/** Validates last year's data from a file or from storage. Unknown keys are ignored. */
export function validateYear(raw: unknown): Result<YearData> {
  if (raw === null || typeof raw !== 'object') return fail('year.invalid', '');
  const o = raw as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const year = Number.isSafeInteger(o.year) && (o.year as number) >= 2000 && (o.year as number) <= 9999 ? (o.year as number) : 0;
  if (!year) errors.push({ code: 'year.invalid', path: 'year' });
  if (!isTemplateId(o.template)) errors.push({ code: 'template.unknown', path: 'template' });
  const households = parseHouseholds(o.households, 'households');
  if (!households.ok) errors.push(...households.errors);
  const people = new Map((households.ok ? households.value.flat() : []).map((n) => [nameKey(n), n]));
  const known = (raw: unknown, path: string): string => {
    const name = parseName(raw, path);
    const found = name.ok ? people.get(nameKey(name.value)) : undefined;
    if (!found) errors.push({ code: 'year.invalid', path });
    return found ?? '';
  };
  const pairings = (Array.isArray(o.pairings) ? o.pairings : []).map((p: unknown, i) => {
    const x = (p ?? {}) as Record<string, unknown>;
    return { giver: known(x.giver, `pairings[${i}]`), receiver: known(x.receiver, `pairings[${i}]`) };
  });
  if (!Array.isArray(o.pairings)) errors.push({ code: 'year.invalid', path: 'pairings' });
  let budget: number | null = null;
  if (o.budget !== null && o.budget !== undefined) {
    const amount = parseAmount(o.budget, 'budget');
    if (amount.ok) budget = amount.value;
    else errors.push(...amount.errors);
  }
  const hints: Record<string, string> = {};
  for (const [name, text] of Object.entries((o.hints ?? {}) as Record<string, unknown>)) {
    const value = parseFreeText(text, 'hints', MAX_HINT_BYTES);
    const who = known(name, 'hints');
    if (value.ok && who && value.value) hints[who] = value.value;
  }
  const title = typeof o.title === 'string' ? parseFreeText(o.title, 'title', MAX_TITLE_CHARS * 4) : undefined;
  if (errors.length || !households.ok || !isTemplateId(o.template)) return { ok: false, errors };
  return {
    ok: true,
    value: { year, template: o.template, ...(title?.ok && title.value ? { title: title.value } : {}), households: households.value, pairings, budget, hints },
  };
}

const PAIRINGS_AAD = new TextEncoder().encode('secretengerl-year');

/**
 * Seals the pairings like a draw link: AES-GCM under a random 128-bit key that
 * sits right next to the ciphertext, as `<key>.<iv ‖ ciphertext ‖ tag>`.
 * Nobody reads them in passing; whoever takes the file apart on purpose can.
 */
export async function sealPairings(pairings: readonly Pairing[]): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: PAIRINGS_AAD }, key, new TextEncoder().encode(JSON.stringify(pairings))));
  const body = new Uint8Array(iv.length + sealed.length);
  body.set(iv);
  body.set(sealed, iv.length);
  return `${toBase64Url(raw)}.${toBase64Url(body)}`;
}

/** Opens sealed pairings; null if they are malformed or were changed. */
export async function openPairings(sealed: string): Promise<unknown> {
  const [rawKey, rawBody, extra] = sealed.split('.');
  const key = fromBase64Url(rawKey ?? '');
  const body = fromBase64Url(rawBody ?? '');
  if (extra !== undefined || key?.length !== 16 || !body || body.length < 12 + 16) return null;
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: body.subarray(0, 12), additionalData: PAIRINGS_AAD }, cryptoKey, body.subarray(12));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain));
  } catch {
    return null;
  }
}

/** The content of a yearly file: last year's data with the pairings sealed. */
export async function yearFileContent(data: YearData): Promise<Record<string, unknown>> {
  const { pairings, ...rest } = data;
  return { ...rest, sealedPairings: await sealPairings(pairings) };
}

/** Reads a yearly file's content, sealed or (from earlier versions) with plain pairings. */
export async function yearFromFileContent(content: Record<string, unknown>): Promise<Result<YearData>> {
  if (typeof content.sealedPairings !== 'string') return validateYear(content);
  const pairings = await openPairings(content.sealedPairings);
  if (pairings === null) return fail('year.invalid', 'sealedPairings');
  return validateYear({ ...content, pairings });
}
