import { describe, expect, it } from 'vitest';
import { compileRound, draw } from '../src/losfee/index.ts';
import { drawFailure, errorMessages, householdLabel, ruleLabel } from '../src/ui/text.ts';
import { formatBudget, formatDate } from '../src/i18n/format.ts';
import { round } from './helpers/round.ts';
import { seededRng } from './helpers/seeded-rng.ts';

describe('UI texts', () => {
  it('names households after their members', () => {
    expect(householdLabel(['Anna'])).toBe('Anna');
    expect(householdLabel(['Anna', 'Bernd'])).toBe('Haushalt Anna und Bernd');
    expect(householdLabel(['Anna', 'Bernd', 'Clara'])).toBe('Haushalt Anna, Bernd und 1 weitere Person');
    expect(householdLabel(['Anna', 'Bernd', 'Clara', 'David'])).toBe('Haushalt Anna, Bernd und 2 weitere');
  });

  it('explains a group with too few people to give to, as in the concept', () => {
    const config = round([['Anna', 'Bernd', 'Clara'], ['David', 'Eva']]);
    const { names, problem } = compileRound(config);
    const result = draw(problem, seededRng(1));
    if (result.ok) throw new Error('expected a failure');
    expect(drawFailure(config, names, result)).toBe('Anna, Bernd und Clara dürfen zusammen nur zwei Personen beschenken.');
  });

  it('explains impossible rules and names the rule to loosen', () => {
    const config = round([['A'], ['B']], { exclusions: [{ from: 'A', to: 'B', bothWays: false }] });
    expect(drawFailure(config, ['A', 'B'], { ok: false, reason: 'impossible', chain: true })).toBe('Mit diesen Regeln gibt es keine große Kette.');
    expect(ruleLabel(config, { kind: 'exclusion', index: 0 })).toBe('der Ausschluss A → B');
    expect(drawFailure(config, ['A', 'B'], { ok: false, reason: 'tooStrict', rule: { kind: 'noMutual' }, attempts: 1 })).toContain('„Keine Gegenseitigkeit“');
  });

  it('turns validation errors into friendly sentences', () => {
    expect(errorMessages([{ code: 'name.duplicate', path: 'x', params: { name: 'Anna' } }, { code: 'weird', path: 'y' }])).toEqual([
      'Anna steht doppelt in der Liste.',
      'Da ist etwas schiefgegangen. Lade die Seite neu und versuch es noch einmal.',
    ]);
  });

  it('formats budget and date the Austrian way', () => {
    expect(formatBudget(20)).toBe('20 €');
    expect(formatBudget(12.5)).toBe('12,50 €');
    expect(formatDate('2026-12-20')).toBe('20. Dezember 2026');
  });
});
