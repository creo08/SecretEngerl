/** A round as kept on the organizer's device. There is no plain-text assignment: it lives only in the links. */
import type { RoundConfig } from '../config/types.ts';
import type { YearData } from '../files/year.ts';

/** PIN for the emergency view, stored as a PBKDF2 hash. A hurdle in the app, not encryption. */
export interface PinHash {
  salt: string;
  iterations: number;
  hash: string;
}

export interface StoredRound {
  id: string;
  /** Optional title for the organizer's own overview; never part of a link. Missing in rounds from v0.1.0. */
  title?: string;
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

/** Last year's rounds kept on the device until a new round starts from them or they are forgotten. */
export interface YearStore {
  list(): Promise<{ id: string; data: YearData }[]>;
  put(id: string, data: YearData): Promise<void>;
  delete(id: string): Promise<void>;
}
