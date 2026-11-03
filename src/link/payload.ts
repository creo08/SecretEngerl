/**
 * The plaintext of a draw: compact JSON in UTF-8, padded with 0x00 to exactly
 * 256 bytes so every link of every round has the same length.
 */
import type { RoundConfig, TemplateId } from '../config/types.ts';
import { isTemplateId } from '../config/validate.ts';
import { parseFreeText, parseIsoDate, parseName, utf8Length } from '../input/validate.ts';
import { formatBudget } from '../i18n/format.ts';

export const PAYLOAD_BYTES = 256;
const DAY_SECONDS = 86_400;

/** Fields of a draw. Keys are short on purpose; their order is the order in the JSON. */
export interface Payload {
  /** Bengerl, the person to give to. */
  r: string;
  /** Budget as shown, e.g. "20 €", or "" for none. */
  b: string;
  /** Theme. */
  m: string;
  /** Exchange date, ISO. */
  d: string;
  /** Hint for the Engerl. */
  h: string;
  /** Template. */
  t: TemplateId;
  /** Draw number, from 1. */
  n: number;
  /** Expiry, Unix seconds. */
  x: number;
}

/** End of the day 14 days after the exchange date, in UTC, as Unix seconds. */
export function expiryFor(exchangeDate: string): number {
  const [y, m, d] = exchangeDate.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d + 14) / 1000 + DAY_SECONDS - 1;
}

/** The draw a giver receives for `receiver` in this round. */
export function payloadFor(config: RoundConfig, receiver: string, drawNumber: number): Payload {
  const { gifts } = config;
  return {
    r: receiver,
    b: gifts.budget ? formatBudget(gifts.budget.amount) : '',
    m: gifts.theme,
    d: config.occasion.exchangeDate,
    h: gifts.hints[receiver] ?? '',
    t: config.template,
    n: drawNumber,
    x: expiryFor(config.occasion.exchangeDate),
  };
}

/** Size of a payload in bytes before padding. */
export function payloadBytes(payload: Payload): number {
  return utf8Length(JSON.stringify(payload));
}

/**
 * People whose draw would not fit into 256 bytes, with how many bytes their
 * hint must lose. Checked before the draw, for everyone as a possible Bengerl.
 */
export function oversizedDraws(config: RoundConfig, drawNumber: number): { name: string; overBy: number }[] {
  return config.participants.households
    .flat()
    .map((name) => ({ name, overBy: payloadBytes(payloadFor(config, name, drawNumber)) - PAYLOAD_BYTES }))
    .filter((e) => e.overBy > 0);
}

/** Bytes still free for the hint of `receiver`; negative means too long. */
export function freeHintBytes(config: RoundConfig, receiver: string, drawNumber: number): number {
  return PAYLOAD_BYTES - payloadBytes(payloadFor(config, receiver, drawNumber));
}

/** Encodes and pads a payload; throws if it does not fit (callers check oversizedDraws first). */
export function encodePayload(payload: Payload): Uint8Array<ArrayBuffer> {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  if (json.length > PAYLOAD_BYTES) throw new RangeError(`draw is ${json.length - PAYLOAD_BYTES} bytes too long`);
  const out = new Uint8Array(PAYLOAD_BYTES);
  out.set(json);
  return out;
}

/** Removes the padding, parses and validates a payload; null if anything is off. Unknown keys are ignored. */
export function decodePayload(bytes: Uint8Array): Payload | null {
  if (bytes.length !== PAYLOAD_BYTES) return null;
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  const json = bytes.subarray(0, end);
  if (json.includes(0)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json));
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const r = parseName(o.r, 'r');
  const d = parseIsoDate(o.d, 'd');
  const texts = [o.b, o.m, o.h].map((v) => parseFreeText(v, 'text', PAYLOAD_BYTES));
  if (!r.ok || !d.ok || texts.some((t) => !t.ok) || !isTemplateId(o.t)) return null;
  if (!Number.isSafeInteger(o.n) || (o.n as number) < 1 || !Number.isSafeInteger(o.x)) return null;
  const [b, m, h] = texts.map((t) => (t.ok ? t.value : ''));
  return { r: r.value, b: b!, m: m!, d: d.value, h: h!, t: o.t, n: o.n as number, x: o.x as number };
}
