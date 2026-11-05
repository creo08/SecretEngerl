/**
 * Würfelwichteln: whose turn it is, an unbiased digital die, the rule table,
 * the direction and the timer. Pure state transitions, no DOM; the caller stores the state.
 * Who holds which gift is not tracked; the table sees that.
 */
import { cleanText, MAX_PEOPLE, parseName } from '../input/validate.ts';
import { randInt, shuffled, type Rng } from '../random/rng.ts';

export const MAX_RULE_CHARS = 80;
export const DEFAULT_MINUTES = 15;
export const MAX_MINUTES = 120;

/** An optional drinking rule: what applies, and on which face. */
export interface DrinkRule {
  face: number;
  text: string;
}

/** The whole game. Players are indices into `players`, which is the turn order. */
export interface WuerfelState {
  kind: 'wuerfelwichteln';
  players: string[];
  /** The rule for faces 1 to 6. */
  rules: string[];
  drink: DrinkRule | null;
  clockwise: boolean;
  current: number;
  /** The face the current player rolled, until the turn passes on. */
  rolled: number | null;
  /** The timer: running until `endsAt`, or paused with `leftMs` to go. */
  endsAt: number | null;
  leftMs: number;
  sound: boolean;
  over: boolean;
  startedAt: number;
}

/** Settings chosen before the game. */
export interface WuerfelSetup {
  players: string[];
  random: boolean;
  rules: string[];
  drink: DrinkRule | null;
  minutes: number;
  sound: boolean;
}

/** Starts a game with the timer running; with `random`, the turn order is shuffled. */
export function startWuerfel(setup: WuerfelSetup, rng: Rng, now: number): WuerfelState {
  const players = setup.random ? shuffled(setup.players, rng) : [...setup.players];
  const ms = setup.minutes * 60_000;
  return { kind: 'wuerfelwichteln', players, rules: [...setup.rules], drink: setup.drink, clockwise: true, current: 0, rolled: null, endsAt: now + ms, leftMs: ms, sound: setup.sound, over: false, startedAt: now };
}

/** Time left at `now`, in milliseconds. */
export function timeLeft(state: WuerfelState, now: number): number {
  return state.endsAt === null ? state.leftMs : Math.max(0, state.endsAt - now);
}

/** Ends the game once the time is up; otherwise returns the state unchanged. */
export function checkTime(state: WuerfelState, now: number): WuerfelState {
  return !state.over && timeLeft(state, now) === 0 ? { ...state, over: true, endsAt: null, leftMs: 0 } : state;
}

/** The current player rolls; a face from 1 to 6, each equally likely. */
export function roll(state: WuerfelState, rng: Rng): WuerfelState {
  if (state.over || state.rolled !== null) return state;
  return { ...state, rolled: randInt(rng, 6) + 1 };
}

/** The player after `index` in the current direction. */
export function nextPlayer(state: WuerfelState, index = state.current): number {
  const n = state.players.length;
  return state.clockwise ? (index + 1) % n : (index - 1 + n) % n;
}

/** Passes the turn on after a roll. */
export function passTurn(state: WuerfelState): WuerfelState {
  if (state.over || state.rolled === null) return state;
  return { ...state, current: nextPlayer(state), rolled: null };
}

/** Reverses the direction of play. */
export function reverse(state: WuerfelState): WuerfelState {
  return state.over ? state : { ...state, clockwise: !state.clockwise };
}

/** Pauses or resumes the timer. */
export function toggleTimer(state: WuerfelState, now: number): WuerfelState {
  if (state.over) return state;
  return state.endsAt === null ? { ...state, endsAt: now + state.leftMs } : { ...state, endsAt: null, leftMs: timeLeft(state, now) };
}

/** Cleans a rule line; null if it is empty or too long. */
export function parseRule(raw: string): string | null {
  const value = cleanText(raw);
  return value && [...value].length <= MAX_RULE_CHARS ? value : null;
}

/** Checks a game read from storage. Another site on the origin could write there. */
export function isWuerfelState(raw: unknown): raw is WuerfelState {
  if (raw === null || typeof raw !== 'object') return false;
  const s = raw as Partial<WuerfelState>;
  const n = Array.isArray(s.players) ? s.players.length : 0;
  const face = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 1 && (v as number) <= 6;
  const time = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  return (
    s.kind === 'wuerfelwichteln' &&
    Array.isArray(s.players) &&
    s.players.every((p) => parseName(p, '').ok && p === cleanText(p as string)) &&
    n >= 2 &&
    n <= MAX_PEOPLE &&
    Array.isArray(s.rules) &&
    s.rules.length === 6 &&
    s.rules.every((r) => typeof r === 'string' && parseRule(r) === r) &&
    (s.drink === null || (typeof s.drink === 'object' && face(s.drink?.face) && typeof s.drink?.text === 'string' && parseRule(s.drink.text) === s.drink.text)) &&
    typeof s.clockwise === 'boolean' &&
    Number.isSafeInteger(s.current) &&
    s.current! >= 0 &&
    s.current! < n &&
    (s.rolled === null || face(s.rolled)) &&
    (s.endsAt === null || time(s.endsAt)) &&
    time(s.leftMs) &&
    s.leftMs! <= MAX_MINUTES * 60_000 &&
    typeof s.sound === 'boolean' &&
    typeof s.over === 'boolean' &&
    time(s.startedAt)
  );
}
