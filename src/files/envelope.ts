/**
 * File envelope shared by the backup file and the yearly file.
 * Plain: `{"format":…,"version":1,…}`. With a password:
 * `{"header":{"format":…,"version":1,"salt":…,"iterations":600000},"iv":…,"data":…}`,
 * PBKDF2-HMAC-SHA256 derives an AES-256-GCM key, and the UTF-8 bytes of the
 * header (keys in exactly this order) are the additional authenticated data.
 */
import { fromBase64Url, toBase64Url } from '../link/base64url.ts';

export type FileFormat = 'secretengerl-backup' | 'secretengerl-year';
export const FILE_VERSION = 1;
export const FILE_ITERATIONS = 600_000;
/** Files are small; anything bigger is not ours. */
export const MAX_FILE_BYTES = 1_000_000;
// A file from elsewhere could ask for billions of iterations and freeze the page.
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 5_000_000;

export type OpenedFile =
  | { status: 'ok'; format: FileFormat; content: Record<string, unknown> }
  | { status: 'password' }
  | { status: 'wrongPassword' }
  | { status: 'invalid' };

const encoder = new TextEncoder();

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: KeyUsage): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

function headerBytes(format: FileFormat, salt: string, iterations: number): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify({ format, version: FILE_VERSION, salt, iterations }));
}

/** Writes `content` as a file of `format`; with a password the whole content is encrypted. */
export async function sealFile(format: FileFormat, content: Record<string, unknown>, password = '', iterations = FILE_ITERATIONS): Promise<string> {
  const plain = JSON.stringify({ format, version: FILE_VERSION, ...content });
  if (!password) return plain;
  const salt = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, fromBase64Url(salt)!, iterations, 'encrypt');
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: headerBytes(format, salt, iterations) }, key, encoder.encode(plain));
  return JSON.stringify({ header: { format, version: FILE_VERSION, salt, iterations }, iv: toBase64Url(iv), data: toBase64Url(new Uint8Array(data)) });
}

const isFormat = (v: unknown): v is FileFormat => v === 'secretengerl-backup' || v === 'secretengerl-year';

function plainContent(raw: unknown, expected?: FileFormat): OpenedFile {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { status: 'invalid' };
  const { format, version, ...content } = raw as Record<string, unknown>;
  if (!isFormat(format) || version !== FILE_VERSION || (expected && format !== expected)) return { status: 'invalid' };
  return { status: 'ok', format, content };
}

/** Reads a file. An encrypted file without `password` answers `password`; a wrong one `wrongPassword`. */
export async function openFile(text: string, password = ''): Promise<OpenedFile> {
  if (encoder.encode(text).length > MAX_FILE_BYTES) return { status: 'invalid' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { status: 'invalid' };
  }
  if (raw === null || typeof raw !== 'object' || !('header' in raw)) return plainContent(raw);
  const { header, iv, data } = raw as { header?: Record<string, unknown>; iv?: unknown; data?: unknown };
  const { format, version, salt, iterations } = header ?? {};
  if (!isFormat(format) || version !== FILE_VERSION || typeof salt !== 'string' || typeof iv !== 'string' || typeof data !== 'string') return { status: 'invalid' };
  if (!Number.isSafeInteger(iterations) || (iterations as number) < MIN_ITERATIONS || (iterations as number) > MAX_ITERATIONS) return { status: 'invalid' };
  const saltBytes = fromBase64Url(salt);
  const ivBytes = fromBase64Url(iv);
  const dataBytes = fromBase64Url(data);
  if (saltBytes?.length !== 16 || ivBytes?.length !== 12 || !dataBytes) return { status: 'invalid' };
  if (!password) return { status: 'password' };
  let plain: ArrayBuffer;
  try {
    const key = await deriveKey(password, saltBytes, iterations as number, 'decrypt');
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes, additionalData: headerBytes(format, salt, iterations as number) }, key, dataBytes);
  } catch {
    return { status: 'wrongPassword' };
  }
  try {
    return plainContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain)), format);
  } catch {
    return { status: 'invalid' };
  }
}
