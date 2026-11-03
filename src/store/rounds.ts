/**
 * Life of a stored round: save a draw, send again, drop-out repair, expiry.
 * The assignment is read back from the links only in memory and never stored in plain text.
 */
import type { RoundConfig } from '../config/types.ts';
import { withoutPerson } from '../config/edit.ts';
import { toBase64Url } from '../link/base64url.ts';
import { buildLink, readFragment } from '../link/link.ts';
import { expiryFor, oversizedDraws, payloadFor } from '../link/payload.ts';
import { compileRound, repairDropout } from '../losfee/index.ts';
import type { RoundStore, StoredRound } from './types.ts';

/** Loads the latest stored version of a round, so a change never overwrites a newer save. */
export async function loadRound(store: RoundStore, id: string): Promise<StoredRound> {
  const round = await store.get(id);
  if (!round) throw new Error('round not found');
  return round;
}

/** Longest round title in characters. */
export const MAX_TITLE_CHARS = 60;

/** Some draws would not fit into 256 bytes; their hints must get shorter. */
export class DrawTooLongError extends Error {
  readonly people: { name: string; overBy: number }[];

  constructor(people: { name: string; overBy: number }[]) {
    super(`draw too long for ${people.map((p) => p.name).join(', ')}`);
    this.people = people;
  }
}

/** A new random round id. */
export function newRoundId(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

async function linksFor(config: RoundConfig, names: string[], assignment: readonly number[], drawNumber: number, base: string) {
  return Promise.all(
    names.map(async (name, g) => ({ name, link: await buildLink(base, payloadFor(config, names[assignment[g]!]!, drawNumber)), sent: false })),
  );
}

/**
 * Encrypts one link per giver and stores the round. With `previousId`, this is
 * a new draw of that round: the draw number goes up, title, log and PIN stay.
 * Callers check oversizedDraws first; a draw that does not fit throws a
 * DrawTooLongError naming the people, and nothing is stored.
 */
export async function saveDraw(
  store: RoundStore,
  draw: { config: RoundConfig; names: string[]; assignment: readonly number[]; base: string; previousId?: string; title?: string },
): Promise<StoredRound> {
  const { config, names, assignment, base, previousId } = draw;
  const previous = previousId === undefined ? undefined : await loadRound(store, previousId);
  const drawNumber = previous ? previous.drawNumber + 1 : 1;
  const title = draw.title ?? previous?.title;
  // A higher draw number can be one digit longer than the one checked before.
  const tooLong = oversizedDraws(config, drawNumber);
  if (tooLong.length) throw new DrawTooLongError(tooLong);
  const round: StoredRound = {
    id: previous?.id ?? newRoundId(),
    ...(title ? { title } : {}),
    config,
    drawNumber,
    expiresAt: expiryFor(config.occasion.exchangeDate),
    links: await linksFor(config, names, assignment, drawNumber, base),
    views: previous?.views ?? [],
    pin: previous?.pin ?? null,
  };
  await store.put(round);
  return round;
}

/** Records that a target was chosen for this person's link. */
export async function markSent(store: RoundStore, id: string, name: string): Promise<StoredRound> {
  const round = await loadRound(store, id);
  const next = { ...round, links: round.links.map((l) => (l.name === name ? { ...l, sent: true } : l)) };
  await store.put(next);
  return next;
}

/** Reads the receiver of every giver back from the links, in memory only. */
export async function readAssignment(round: StoredRound): Promise<Map<string, string>> {
  const pairs = new Map<string, string>();
  for (const { name, link } of round.links) {
    // The round is deleted at its expiry, so the expiry check is not needed here.
    const reading = await readFragment(link.slice(link.indexOf('#')), 0);
    if (reading.status !== 'ok') throw new Error('stored link cannot be read');
    pairs.set(name, reading.payload.r);
  }
  return pairs;
}

/**
 * What happens if `name` drops out. The organizer learns who gets a new link,
 * never for whom, and not which rule breaks, since that could give the pair away.
 */
export type DropoutPlan =
  | { kind: 'selfDraw'; engerl: string }
  | { kind: 'repair'; engerl: string; rulesBroken: boolean; apply: () => Promise<StoredRound> };

/** Plans the drop-out repair; `apply` stores it ("Keep it anyway" or no warning needed). */
export async function planDropout(store: RoundStore, id: string, name: string, base: string): Promise<DropoutPlan> {
  const round = await loadRound(store, id);
  const { names, problem } = compileRound(round.config);
  const pairs = await readAssignment(round);
  const assignment = names.map((giver) => names.indexOf(pairs.get(giver)!));
  const repair = repairDropout(problem, assignment, names.indexOf(name));
  const engerl = names[repair.engerl]!;
  if (repair.kind === 'selfDraw') return { kind: 'selfDraw', engerl };
  const receiver = names[repair.receiver]!;
  return {
    kind: 'repair',
    engerl,
    rulesBroken: repair.broken.length > 0,
    apply: async () => {
      const current = await loadRound(store, id);
      const linkOf = (r: StoredRound, n: string) => r.links.find((l) => l.name === n)?.link;
      if (current.drawNumber !== round.drawNumber || linkOf(current, engerl) !== linkOf(round, engerl) || !linkOf(current, name)) {
        throw new Error('round changed since the drop-out was planned');
      }
      const config = withoutPerson(current.config, name);
      const link = await buildLink(base, payloadFor(config, receiver, current.drawNumber));
      const next: StoredRound = {
        ...current,
        config,
        links: current.links.filter((l) => l.name !== name).map((l) => (l.name === engerl ? { name: engerl, link, sent: false } : l)),
      };
      await store.put(next);
      return next;
    },
  };
}

/**
 * Deletes every round whose end has passed. `now` in milliseconds. With
 * `remember`, each round is first handed over to be kept as last year's round;
 * if that fails, the round is still deleted, because its end has passed.
 */
export async function purgeExpired(store: RoundStore, now: number, remember?: (round: StoredRound) => Promise<void>): Promise<void> {
  for (const round of await store.list()) {
    if (now <= round.expiresAt * 1000) continue;
    await remember?.(round).catch(() => undefined);
    await store.delete(round.id);
  }
}
