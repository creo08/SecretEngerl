/**
 * Räuberwichteln (White Elephant): turn order, unwrapping, stealing, lock and
 * the optional final swap. Pure state transitions, no DOM; the caller stores the state.
 */
import { cleanText, MAX_PEOPLE, parseName } from '../input/validate.ts';
import { shuffled, type Rng } from '../random/rng.ts';

export const MAX_LABEL_CHARS = 30;
export const DEFAULT_LOCK_AFTER = 3;

/** An unwrapped gift: its number in unwrapping order, a short word, who holds it and how often it was stolen. */
export interface Gift {
  number: number;
  label: string;
  holder: number;
  steals: number;
}

/** The whole game. Players are indices into `players`, which is the turn order. */
export interface RaeuberState {
  kind: 'raeuberwichteln';
  players: string[];
  lockAfter: number;
  finalSwap: boolean;
  gifts: Gift[];
  /** The next player in turn order whose regular turn has not come yet. */
  nextTurn: number;
  /** Who acts now; null once the game is over. */
  current: number | null;
  /** The gift the current player just lost and may not steal back. */
  blocked: number | null;
  phase: 'play' | 'finalSwap' | 'done';
  startedAt: number;
}

/** Settings chosen before the game. */
export interface RaeuberSetup {
  players: string[];
  random: boolean;
  lockAfter: number;
  finalSwap: boolean;
}

/** Starts a game; with `random`, the turn order is shuffled with Fisher-Yates from `rng`. */
export function startRaeuber(setup: RaeuberSetup, rng: Rng, now: number): RaeuberState {
  const players = setup.random ? shuffled(setup.players, rng) : [...setup.players];
  return { kind: 'raeuberwichteln', players, lockAfter: setup.lockAfter, finalSwap: setup.finalSwap, gifts: [], nextTurn: 1, current: 0, blocked: null, phase: 'play', startedAt: now };
}

/** Whether `gift` may be taken now: not locked, not the one just lost, not the taker's own. */
export function canSteal(state: RaeuberState, gift: Gift): boolean {
  return state.current !== null && gift.steals < state.lockAfter && gift.number !== state.blocked && gift.holder !== state.current;
}

/** Gifts still wrapped: one per player minus those unwrapped. */
export function wrappedCount(state: RaeuberState): number {
  return state.players.length - state.gifts.length;
}

/** The current player unwraps a new gift; the regular turn passes on. */
export function unwrap(state: RaeuberState, label: string): RaeuberState {
  if (state.phase !== 'play' || state.current === null || wrappedCount(state) === 0) return state;
  const gifts = [...state.gifts, { number: state.gifts.length + 1, label, holder: state.current, steals: 0 }];
  const next = { ...state, gifts, blocked: null };
  if (gifts.length < state.players.length) return { ...next, current: state.nextTurn, nextTurn: state.nextTurn + 1 };
  return state.finalSwap ? { ...next, current: 0, phase: 'finalSwap' } : { ...next, current: null, phase: 'done' };
}

/** The current player steals `number`; the robbed player acts next and may not take it back. */
export function steal(state: RaeuberState, number: number): RaeuberState {
  const gift = state.gifts.find((g) => g.number === number);
  if (state.phase !== 'play' || !gift || !canSteal(state, gift)) return state;
  const robbed = gift.holder;
  const gifts = state.gifts.map((g) => (g === gift ? { ...g, holder: state.current!, steals: g.steals + 1 } : g));
  return { ...state, gifts, current: robbed, blocked: number };
}

/** In the final swap, the first player swaps their gift for `number`, or keeps it with null. */
export function finalSwap(state: RaeuberState, number: number | null): RaeuberState {
  if (state.phase !== 'finalSwap') return state;
  const done = { ...state, current: null, blocked: null, phase: 'done' as const };
  if (number === null) return done;
  const target = state.gifts.find((g) => g.number === number);
  const own = state.gifts.find((g) => g.holder === 0);
  if (!target || !own || !canSteal(state, target)) return state;
  const gifts = state.gifts.map((g) => (g === target ? { ...g, holder: 0, steals: g.steals + 1 } : g === own ? { ...g, holder: target.holder } : g));
  return { ...done, gifts };
}

/** Cleans the optional word for a gift; null if it is too long. */
export function parseLabel(raw: string): string | null {
  const value = cleanText(raw);
  return [...value].length <= MAX_LABEL_CHARS ? value : null;
}

/** Checks a game read from storage. Another site on the origin could write there. */
export function isRaeuberState(raw: unknown): raw is RaeuberState {
  if (raw === null || typeof raw !== 'object') return false;
  const s = raw as Partial<RaeuberState>;
  const n = Array.isArray(s.players) ? s.players.length : 0;
  const index = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) < n;
  const names = Array.isArray(s.players) && s.players.every((p) => parseName(p, '').ok && p === cleanText(p as string));
  const gifts =
    Array.isArray(s.gifts) &&
    s.gifts.length <= n &&
    s.gifts.every((g, i) => g?.number === i + 1 && typeof g.label === 'string' && parseLabel(g.label) === g.label && index(g.holder) && Number.isSafeInteger(g.steals) && g.steals >= 0);
  return (
    s.kind === 'raeuberwichteln' &&
    names &&
    n >= 2 &&
    n <= MAX_PEOPLE &&
    Number.isSafeInteger(s.lockAfter) &&
    s.lockAfter! >= 1 &&
    s.lockAfter! <= 9 &&
    typeof s.finalSwap === 'boolean' &&
    gifts &&
    Number.isSafeInteger(s.nextTurn) &&
    s.nextTurn! >= 1 &&
    s.nextTurn! <= n &&
    (s.current === null || index(s.current)) &&
    (s.blocked === null || (Number.isSafeInteger(s.blocked) && s.blocked! >= 1 && s.blocked! <= s.gifts!.length)) &&
    (s.phase === 'play' || s.phase === 'finalSwap' || s.phase === 'done') &&
    typeof s.startedAt === 'number' &&
    // The parts must fit together: one gift per holder, a player on turn while playing, everyone served at the end.
    new Set(s.gifts!.map((g) => g.holder)).size === s.gifts!.length &&
    (s.phase === 'done' ? s.current === null && s.gifts!.length === n : s.current !== null) &&
    (s.phase !== 'finalSwap' || s.gifts!.length === n)
  );
}
