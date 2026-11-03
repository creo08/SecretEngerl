import type { RoundConfig, Rules } from '../../src/config/types.ts';

/** Builds a round configuration for tests from households and optional rules. */
export function round(households: string[][], options: Partial<Rules> & { noMutual?: boolean; oneChain?: boolean } = {}): RoundConfig {
  return {
    version: 1,
    template: 'engerl-bengerl',
    family: 'drawn',
    occasion: { exchangeDate: '2026-12-20' },
    participants: { households },
    structure: { noMutual: options.noMutual ?? true, oneChain: options.oneChain ?? false, giftsPerPerson: 1 },
    rules: { exclusions: options.exclusions ?? [], must: options.must ?? [], lastYear: options.lastYear ?? [] },
    gifts: { budget: { amount: 20, currency: 'EUR' }, kind: 'bought', theme: '', hints: {} },
    exchange: 'in-person',
    communication: 'none',
    reveal: 'in-person',
    context: 'family',
    organizerPlays: true,
    place: '',
    addresses: {},
  };
}

/** The example of the concept: ten people, three couples and four single people. */
export const CONCEPT_EXAMPLE = [['Anna', 'Bernd'], ['Clara', 'David'], ['Eva', 'Felix'], ['Gina'], ['Hans'], ['Ida'], ['Jonas']];
