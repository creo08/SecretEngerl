/**
 * Emergency view: one person at a time, after a deliberate hurdle. PIN and log
 * are barriers in the app, not encryption: anyone with the device and the
 * developer tools can read the links.
 */
import { t } from '../i18n/i18n.ts';
import { fromBase64Url, toBase64Url } from '../link/base64url.ts';
import { readAssignment } from './rounds.ts';
import type { PinHash, RoundStore, StoredRound } from './types.ts';

export const PIN_ITERATIONS = 600_000;

/** True if the typed text is the confirmation phrase ("Ich spicke"), ignoring case and outer spaces. */
export function isPeekPhrase(input: string): boolean {
  return input.trim().toLocaleLowerCase('de') === t('emergency.phrase').toLocaleLowerCase('de');
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toBase64Url(new Uint8Array(bits));
}

/** Sets or replaces the PIN of a round. */
export async function setPin(store: RoundStore, round: StoredRound, pin: string, iterations = PIN_ITERATIONS): Promise<StoredRound> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash: PinHash = { salt: toBase64Url(salt), iterations, hash: await derive(pin, salt, iterations) };
  const next = { ...round, pin: hash };
  await store.put(next);
  return next;
}

/** Checks a PIN; a round without PIN accepts any input. */
export async function checkPin(round: StoredRound, pin: string): Promise<boolean> {
  if (!round.pin) return true;
  const salt = fromBase64Url(round.pin.salt);
  return salt !== null && (await derive(pin, salt, round.pin.iterations)) === round.pin.hash;
}

/**
 * Shows whom `giver` gives to. The view is logged and stored before the name
 * is returned, so a view never goes unrecorded.
 */
export async function viewAssignment(store: RoundStore, round: StoredRound, giver: string, now: number): Promise<{ round: StoredRound; receiver: string }> {
  const next = { ...round, views: [...round.views, { name: giver, at: now }] };
  await store.put(next);
  const receiver = (await readAssignment(round)).get(giver);
  if (receiver === undefined) throw new Error('unknown giver');
  return { round: next, receiver };
}
