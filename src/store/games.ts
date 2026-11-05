/**
 * The state of a party game in IndexedDB, so that a reload does not end it.
 * One game per kind; it deletes itself 24 hours after it started.
 */

const DB_NAME = 'secretengerl-games';
const GAMES = 'games';
export const GAME_TTL_MS = 24 * 60 * 60 * 1000;

/** What every stored game carries. */
export interface StoredGame {
  kind: string;
  startedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(GAMES, { keyPath: 'kind' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(GAMES, mode);
      const request = action(tx.objectStore(GAMES));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Whether a game started at `startedAt` is still kept at `now`. */
export function isFresh(startedAt: number, now: number): boolean {
  return now - startedAt < GAME_TTL_MS && startedAt <= now;
}

/** Loads the game of `kind` if it is valid and fresh; an old or broken one is deleted. */
export async function loadGame<T extends StoredGame>(kind: string, isValid: (raw: unknown) => raw is T, now = Date.now()): Promise<T | undefined> {
  const raw: unknown = await run('readonly', (s) => s.get(kind)).catch(() => undefined);
  if (raw === undefined) return undefined;
  if (isValid(raw) && raw.kind === kind && isFresh(raw.startedAt, now)) return raw;
  await deleteGame(kind);
  return undefined;
}

/** Stores the game, replacing the one of the same kind. */
export async function saveGame(game: StoredGame): Promise<void> {
  await run('readwrite', (s) => s.put(game));
}

/** Deletes the game of `kind`. */
export async function deleteGame(kind: string): Promise<void> {
  await run('readwrite', (s) => s.delete(kind)).catch(() => undefined);
}
