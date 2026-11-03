/** Changes to a configuration after the draw. */
import type { RoundConfig } from './types.ts';
import { nameKey } from '../input/validate.ts';

/** The configuration without `name`: removed from its household, from every rule and from the hints. */
export function withoutPerson(config: RoundConfig, name: string): RoundConfig {
  const gone = nameKey(name);
  const keep = (n: string) => nameKey(n) !== gone;
  const next = structuredClone(config);
  next.participants.households = next.participants.households.map((h) => h.filter(keep)).filter((h) => h.length > 0);
  next.rules.exclusions = next.rules.exclusions.filter((e) => keep(e.from) && keep(e.to));
  next.rules.lastYear = next.rules.lastYear.filter((p) => keep(p.giver) && keep(p.receiver));
  next.rules.must = next.rules.must
    .filter((m) => keep(m.giver))
    .map((m) => ({ ...m, choices: m.choices.filter(keep) }))
    .filter((m) => m.choices.length > 0);
  next.gifts.hints = Object.fromEntries(Object.entries(next.gifts.hints).filter(([n]) => keep(n)));
  next.addresses = Object.fromEntries(Object.entries(next.addresses).filter(([n]) => keep(n)));
  return next;
}
