import { describe, expect, it } from 'vitest';
import { TEMPLATES, configFromTemplate } from '../src/config/templates.ts';
import { validateConfig, validateTemplate } from '../src/config/validate.ts';
import { TEMPLATE_IDS } from '../src/config/types.ts';

const households = [['Anna', 'Bernd'], ['Clara']];

describe('configuration model', () => {
  it('has a valid template for every template id', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
  });

  it('makes "no mutual pairs" the default in every template', () => {
    for (const t of TEMPLATES) expect(t.defaults.structure.noMutual).toBe(true);
  });

  it('Schrottwichteln has no budget and the rule "buy nothing"', () => {
    const t = TEMPLATES.find((x) => x.id === 'schrottwichteln')!;
    expect(t.defaults.gifts.budget).toBeNull();
    expect(t.defaults.gifts.kind).toBe('own-only');
    expect(t.fields.budget).toBe(false);
  });

  it('Familien-Wichteln shows last year and hints', () => {
    const t = TEMPLATES.find((x) => x.id === 'familien-wichteln')!;
    expect(t.fields.lastYear && t.fields.hints).toBe(true);
  });

  it('accepts a configuration built from each template', () => {
    for (const id of TEMPLATE_IDS) {
      const result = validateConfig(configFromTemplate(id, households, '2026-12-20'));
      expect(result.ok, JSON.stringify(result)).toBe(true);
    }
  });

  it('writes hint names the way the participant is spelled', () => {
    const raw = configFromTemplate('engerl-bengerl', households, '2026-12-20');
    raw.gifts.hints = { anna: 'keine Nüsse' };
    const result = validateConfig(raw);
    expect(result.ok && result.value.gifts.hints).toEqual({ Anna: 'keine Nüsse' });
  });

  it('ignores unknown keys', () => {
    const raw = { ...configFromTemplate('engerl-bengerl', households, '2026-12-20'), evil: '<script>' };
    const result = validateConfig(raw);
    expect(result.ok && 'evil' in result.value).toBe(false);
  });

  it('rejects unknown templates, bad dates and rules about unknown people', () => {
    const base = configFromTemplate('engerl-bengerl', households, '2026-12-20');
    const codes = (raw: unknown) => {
      const r = validateConfig(raw);
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(codes({ ...base, template: 'pyramid' })).toContain('template.unknown');
    expect(codes({ ...base, occasion: { exchangeDate: '2026-02-30' } })).toContain('date.invalid');
    expect(codes({ ...base, rules: { ...base.rules, exclusions: [{ from: 'Anna', to: 'Zoe', bothWays: false }] } })).toContain('rule.unknownName');
    expect(codes({ ...base, participants: { households: [['Anna']] } })).toContain('people.tooFew');
    expect(codes(null)).toContain('config.invalid');
  });

  it('rejects a broken template', () => {
    expect(validateTemplate({ id: 'engerl-bengerl', family: 'drawn', defaults: {}, fields: {} }).ok).toBe(false);
  });
});
