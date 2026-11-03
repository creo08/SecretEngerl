/**
 * Order of the stage reveal: it follows the chain. Whoever was just given a
 * gift is next, until a circle closes; then the next open person starts.
 */
import { randInt, type Rng } from '../random/rng.ts';

/** Pairs giver → receiver in reveal order. The first giver of each circle is chosen at random. */
export function revealOrder(assignment: ReadonlyMap<string, string>, rng: Rng): [string, string][] {
  const open = [...assignment.keys()];
  const order: [string, string][] = [];
  while (open.length) {
    let giver = open[randInt(rng, open.length)]!;
    while (open.includes(giver)) {
      open.splice(open.indexOf(giver), 1);
      const receiver = assignment.get(giver)!;
      order.push([giver, receiver]);
      giver = receiver;
    }
  }
  return order;
}
