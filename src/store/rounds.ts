/**
 * Life of a stored round: save a draw, send again, drop-out repair, expiry.
 * The assignment is read back from the links only in memory and never stored in plain text.
 */
import type { RoundConfig } from '../config/types.ts';
import { withoutPerson } from '../config/edit.ts';
import { toBase64Url } from '../link/base64url.ts';
import { buildLink, readFragment } from '../link/link.ts';
import { expiryFor, payloadFor } from '../link/payload.ts';
import { compileRound, repairDropout } from '../losfee/index.ts';
import type { RoundStore, StoredRound } from './types.ts';

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
 * Encrypts one link per giver and stores the round. With `previous`, this is
 * a new draw of that round: the draw number goes up, log and PIN stay.
 * Callers check oversizedDraws first; a draw that does not fit throws.
 */
export async function saveDraw(
  store: RoundStore,
  draw: { config: RoundConfig; names: string[]; assignment: readonly number[]; base: string; previous?: StoredRound },
): Promise<StoredRound> {
  const { config, names, assignment, base, previous } = draw;
  const drawNumber = previous ? previous.drawNumber + 1 : 1;
  const round: StoredRound = {
    id: previous?.id ?? newRoundId(),
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
export async function markSent(store: RoundStore, round: StoredRound, name: string): Promise<StoredRound> {
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
export async function planDropout(store: RoundStore, round: StoredRound, name: string, base: string): Promise<DropoutPlan> {
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
      const config = withoutPerson(round.config, name);
      const link = await buildLink(base, payloadFor(config, receiver, round.drawNumber));
      const next: StoredRound = {
        ...round,
        config,
        links: round.links.filter((l) => l.name !== name).map((l) => (l.name === engerl ? { name: engerl, link, sent: false } : l)),
      };
      await store.put(next);
      return next;
    },
  };
}

/** Deletes every round whose end has passed. `now` in milliseconds. */
export async function purgeExpired(store: RoundStore, now: number): Promise<void> {
  for (const round of await store.list()) if (now > round.expiresAt * 1000) await store.delete(round.id);
}
