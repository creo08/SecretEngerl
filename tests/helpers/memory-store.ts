import type { RoundStore, StoredRound } from '../../src/store/types.ts';

/** In-memory RoundStore; copies on the way in and out like IndexedDB does. */
export function memoryStore(): RoundStore & { rounds: Map<string, StoredRound> } {
  const rounds = new Map<string, StoredRound>();
  return {
    rounds,
    get: async (id) => structuredClone(rounds.get(id)),
    put: async (round) => void rounds.set(round.id, structuredClone(round)),
    delete: async (id) => void rounds.delete(id),
    list: async () => [...rounds.values()].map((r) => structuredClone(r)),
  };
}
