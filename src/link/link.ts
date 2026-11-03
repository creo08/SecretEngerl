/**
 * Link format v1: `<base>#1.<key>.<ciphertext>`.
 * key: 128 random bits, base64url. ciphertext: IV (12 random bytes) ‖ AES-GCM
 * ciphertext ‖ tag (16 bytes), base64url. The version "1" is the additional
 * authenticated data. Every link has its own key, so an IV is never reused.
 */
import { fromBase64Url, toBase64Url } from './base64url.ts';
import { decodePayload, encodePayload, PAYLOAD_BYTES, type Payload } from './payload.ts';

export const LINK_VERSION = '1';
const AAD = new TextEncoder().encode(LINK_VERSION);
const KEY_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEALED_BYTES = IV_BYTES + PAYLOAD_BYTES + TAG_BYTES;

/** Result of reading a fragment. Only `ok` carries the draw; an expired draw is never returned. */
export type LinkReading = { status: 'empty' } | { status: 'invalid' } | { status: 'expired' } | { status: 'ok'; payload: Payload };

function importKey(raw: Uint8Array<ArrayBuffer>, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [usage]);
}

/** Encrypts 256 plaintext bytes under a fresh key; returns the fragment without "#". */
export async function sealFragment(plaintext: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD, tagLength: TAG_BYTES * 8 },
    await importKey(key, 'encrypt'),
    plaintext,
  );
  const body = new Uint8Array(IV_BYTES + sealed.byteLength);
  body.set(iv);
  body.set(new Uint8Array(sealed), IV_BYTES);
  return `${LINK_VERSION}.${toBase64Url(key)}.${toBase64Url(body)}`;
}

/** Builds the full link for one draw. `base` is the app URL, e.g. https://creo08.github.io/SecretEngerl/. */
export async function buildLink(base: string, payload: Payload): Promise<string> {
  return `${base}#${await sealFragment(encodePayload(payload))}`;
}

/**
 * Reads a fragment (with or without "#"): decrypts, validates and checks the
 * expiry against `now` (milliseconds). Tampered or malformed links are invalid.
 */
export async function readFragment(fragment: string, now: number): Promise<LinkReading> {
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (text === '') return { status: 'empty' };
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== LINK_VERSION) return { status: 'invalid' };
  const key = fromBase64Url(parts[1]!);
  const body = fromBase64Url(parts[2]!);
  if (key?.length !== KEY_BYTES || body?.length !== SEALED_BYTES) return { status: 'invalid' };
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: body.subarray(0, IV_BYTES), additionalData: AAD, tagLength: TAG_BYTES * 8 },
      await importKey(key, 'decrypt'),
      body.subarray(IV_BYTES),
    );
  } catch {
    return { status: 'invalid' };
  }
  const payload = decodePayload(new Uint8Array(plaintext));
  if (!payload) return { status: 'invalid' };
  if (now > payload.x * 1000) return { status: 'expired' };
  return { status: 'ok', payload };
}

/**
 * Takes the fragment out of the address bar at once and returns it.
 * Call this first thing when the page opens; decrypt only after the tap.
 */
export function takeFragment(loc: Pick<Location, 'hash' | 'pathname' | 'search'> = location, hist: Pick<History, 'replaceState'> = history): string {
  const fragment = loc.hash;
  if (fragment) hist.replaceState(null, '', loc.pathname + loc.search);
  return fragment;
}
