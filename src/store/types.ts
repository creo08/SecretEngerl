/** A round as kept on the organizer's device. There is no plain-text assignment: it lives only in the links. */
import type { RoundConfig } from '../config/types.ts';

/** PIN for the emergency view, stored as a PBKDF2 hash. A hurdle in the app, not encryption. */
export interface PinHash {
  salt: string;
  iterations: number;
  hash: string;
}

export interface StoredRound {
  id: string;
  config: RoundConfig;
  drawNumber: number;
  /** End of the round, Unix seconds; the round deletes itself afterwards. */
  expiresAt: number;
  /** One link per giver, in participant order. `sent` means "a target was chosen". */
  links: { name: string; link: string; sent: boolean }[];
  /** Emergency views; the app offers no way to delete them before the round ends. */
  views: { name: string; at: number }[];
  pin: PinHash | null;
}

/** Where rounds are kept: IndexedDB in the app, memory in tests. */
export interface RoundStore {
  get(id: string): Promise<StoredRound | undefined>;
  put(round: StoredRound): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<StoredRound[]>;
}
