import { describe, expect, it } from 'vitest';
import { parsePrefill } from '../src/input/prefill.ts';

const codes = (fragment: string) => {
  const r = parsePrefill(fragment);
  return r.ok ? [] : r.errors.map((e) => e.code);
};

describe('pre-fill link v1', () => {
  it('reads the example of the concept', () => {
    expect(parsePrefill('#v=1&f=engerl-bengerl&n=Anna,Bernd;Clara,David;Eva&b=20&d=2026-12-20')).toEqual({
      ok: true,
      value: { template: 'engerl-bengerl', households: [['Anna', 'Bernd'], ['Clara', 'David'], ['Eva']], budget: 20, date: '2026-12-20' },
    });
  });

  it('decodes percent-encoded names and ignores unknown keys and empty entries', () => {
    expect(parsePrefill('v=1&f=schrottwichteln&n=M%C3%BCller%2C%20Hans,Ida;;Jo%3B&utm=x')).toEqual({
      ok: true,
      value: { template: 'schrottwichteln', households: [['Müller, Hans', 'Ida'], ['Jo;']] },
    });
  });

  it('cleans names: NFC, no control or bidi characters', () => {
    const r = parsePrefill('v=1&f=engerl-bengerl&n=Ann%E2%80%AEa,Rene%CC%81');
    expect(r.ok && r.value.households).toEqual([['Anna', 'René']]);
  });

  it('rejects wrong versions, unknown templates and broken encoding', () => {
    expect(codes('')).toEqual(['prefill.empty']);
    expect(codes('#v=2&f=engerl-bengerl&n=A,B')).toEqual(['prefill.version']);
    expect(codes('v=1&f=pyramid&n=A,B')).toEqual(['template.unknown']);
    expect(codes('v=1&f=engerl-bengerl&n=A%E0%A4%A,B')).toEqual(['prefill.invalid']);
  });

  it('rejects bad names, budgets and dates', () => {
    expect(codes('v=1&f=engerl-bengerl')).toEqual(['prefill.noNames']);
    expect(codes('v=1&f=engerl-bengerl&n=Anna,anna')).toEqual(['name.duplicate']);
    expect(codes(`v=1&f=engerl-bengerl&n=${'x'.repeat(41)},B`)).toEqual(['name.tooLong']);
    expect(codes(`v=1&f=engerl-bengerl&n=${Array.from({ length: 51 }, (_, i) => `P${i}`).join(',')}`)).toEqual(['people.tooMany']);
    expect(codes('v=1&f=engerl-bengerl&n=A,B&b=10000&d=2026-02-30')).toEqual(['amount.invalid', 'date.invalid']);
  });
});
