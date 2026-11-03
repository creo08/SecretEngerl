/** IndexedDB storage of rounds and of last year's rounds. Names start with "secretengerl-" because the origin is shared. */
import { validateConfig } from '../config/validate.ts';
import { validateYear } from '../files/year.ts';
import type { RoundStore, StoredRound, YearStore } from './types.ts';
import { MAX_TITLE_CHARS } from './rounds.ts';

const DB_NAME = 'secretengerl-rounds';
const ROUNDS = 'rounds';
const YEARS = 'years';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Version 2 adds last year's rounds; existing rounds stay untouched.
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      for (const name of [ROUNDS, YEARS]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const request = action(tx.objectStore(storeName));
      // Resolve only after the transaction committed, so a write is durable when the promise resolves.
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Checks a record read from storage. Another site on the same origin could
 * write here, so records are validated like any other input; bad ones are skipped.
 * Every link must be a draw link of this app (`base`), so "Senden" never shares a foreign URL.
 */
export function isStoredRound(raw: unknown, base: string): raw is StoredRound {
  const drawLink = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#1\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{379}$`);
  if (raw === null || typeof raw !== 'object') return false;
  const r = raw as Partial<StoredRound>;
  return (
    typeof r.id === 'string' &&
    (r.title === undefined || (typeof r.title === 'string' && r.title.length <= MAX_TITLE_CHARS * 2)) &&
    Number.isSafeInteger(r.drawNumber) &&
    Number.isSafeInteger(r.expiresAt) &&
    Array.isArray(r.links) &&
    r.links.every((l) => typeof l?.name === 'string' && typeof l.link === 'string' && drawLink.test(l.link) && typeof l.sent === 'boolean') &&
    Array.isArray(r.views) &&
    r.views.every((v) => typeof v?.name === 'string' && typeof v.at === 'number') &&
    (r.pin === null || (typeof r.pin?.salt === 'string' && typeof r.pin.hash === 'string' && Number.isSafeInteger(r.pin.iterations))) &&
    validateConfig(r.config).ok
  );
}

const appBase = () => new URL(import.meta.env.BASE_URL, location.origin).href;

/** Round storage in IndexedDB. */
export const indexedDbStore: RoundStore = {
  async get(id) {
    const raw: unknown = await run(ROUNDS, 'readonly', (s) => s.get(id));
    return isStoredRound(raw, appBase()) ? raw : undefined;
  },
  async put(round) {
    await run(ROUNDS, 'readwrite', (s) => s.put(round));
  },
  async delete(id) {
    await run(ROUNDS, 'readwrite', (s) => s.delete(id));
  },
  async list() {
    const all: unknown[] = await run(ROUNDS, 'readonly', (s) => s.getAll());
    const base = appBase();
    return all.filter((r): r is StoredRound => isStoredRound(r, base));
  },
};

/** Last year's rounds in IndexedDB, validated on every read like any other input. */
export const indexedDbYears: YearStore = {
  async list() {
    const all: unknown[] = await run(YEARS, 'readonly', (s) => s.getAll());
    return all.flatMap((r) => {
      const id = (r as { id?: unknown } | null)?.id;
      const data = validateYear((r as { data?: unknown } | null)?.data);
      return typeof id === 'string' && data.ok ? [{ id, data: data.value }] : [];
    });
  },
  async put(id, data) {
    await run(YEARS, 'readwrite', (s) => s.put({ id, data }));
  },
  async delete(id) {
    await run(YEARS, 'readwrite', (s) => s.delete(id));
  },
};

/** Asks the browser not to evict the app's storage. Returns whether it agreed. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
