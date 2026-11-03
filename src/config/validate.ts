/**
 * Schema validation for round configurations and templates.
 * Unknown keys are ignored: the result contains only known fields.
 */
import {
  TEMPLATE_IDS,
  type Context,
  type ExchangeMode,
  type Exclusion,
  type GiftKind,
  type Gifts,
  type MustRule,
  type Pairing,
  type Reveal,
  type RoundConfig,
  type Rules,
  type Structure,
  type Template,
  type TemplateFields,
  type TemplateId,
} from './types.ts';
import {
  fail,
  nameKey,
  parseAmount,
  parseFreeText,
  parseHouseholds,
  parseIsoDate,
  parseName,
  type Result,
  type ValidationError,
} from '../input/validate.ts';

/** Byte limits for free-text fields; the link payload limit is checked separately. */
export const MAX_THEME_BYTES = 80;
export const MAX_HINT_BYTES = 200;
export const MAX_PLACE_BYTES = 80;

const EXCHANGE: readonly ExchangeMode[] = ['in-person', 'hidden', 'post', 'digital'];
const REVEAL: readonly Reveal[] = ['in-person', 'guessing', 'chain', 'stage', 'never'];
const CONTEXT: readonly Context[] = ['family', 'friends', 'office', 'club', 'school', 'online', 'charity'];
const KINDS: readonly GiftKind[] = ['bought', 'own-only'];

type Obj = Record<string, unknown>;

/** Collects errors while reading fields of an untrusted object. */
class Reader {
  readonly errors: ValidationError[] = [];

  take<T>(r: Result<T>, fallback: T): T {
    if (r.ok) return r.value;
    this.errors.push(...r.errors);
    return fallback;
  }

  obj(raw: unknown, path: string): Obj {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) return raw as Obj;
    this.errors.push({ code: 'config.invalid', path });
    return {};
  }

  bool(raw: unknown, path: string): boolean {
    if (typeof raw === 'boolean') return raw;
    this.errors.push({ code: 'config.invalid', path });
    return false;
  }

  oneOf<T extends string>(raw: unknown, allowed: readonly T[], path: string): T {
    if (allowed.includes(raw as T)) return raw as T;
    this.errors.push({ code: 'config.invalid', path });
    return allowed[0]!;
  }

  list(raw: unknown, path: string): unknown[] {
    if (Array.isArray(raw)) return raw;
    this.errors.push({ code: 'config.invalid', path });
    return [];
  }
}

/** Checks that a template id is in the fixed list. */
export function isTemplateId(raw: unknown): raw is TemplateId {
  return TEMPLATE_IDS.includes(raw as TemplateId);
}

function readStructure(r: Reader, raw: unknown, path: string): Structure {
  const o = r.obj(raw, path);
  if (o.giftsPerPerson !== 1) r.errors.push({ code: 'config.invalid', path: `${path}.giftsPerPerson` });
  return { noMutual: r.bool(o.noMutual, `${path}.noMutual`), oneChain: r.bool(o.oneChain, `${path}.oneChain`), giftsPerPerson: 1 };
}

function readGifts(r: Reader, raw: unknown, path: string): Gifts {
  const o = r.obj(raw, path);
  let budget: Gifts['budget'] = null;
  if (o.budget !== null) {
    const b = r.obj(o.budget, `${path}.budget`);
    if (b.currency !== 'EUR') r.errors.push({ code: 'config.invalid', path: `${path}.budget.currency` });
    budget = { amount: r.take(parseAmount(b.amount, `${path}.budget.amount`), 0), currency: 'EUR' };
  }
  const hintsRaw = r.obj(o.hints, `${path}.hints`);
  const hints: Record<string, string> = {};
  for (const [name, text] of Object.entries(hintsRaw)) {
    const key = r.take(parseName(name, `${path}.hints`), '');
    const value = r.take(parseFreeText(text, `${path}.hints.${key}`, MAX_HINT_BYTES), '');
    if (key && value) hints[key] = value;
  }
  return {
    budget,
    kind: r.oneOf(o.kind, KINDS, `${path}.kind`),
    theme: r.take(parseFreeText(o.theme, `${path}.theme`, MAX_THEME_BYTES), ''),
    hints,
  };
}

function readRules(r: Reader, raw: unknown, path: string): Rules {
  const o = r.obj(raw, path);
  const name = (v: unknown, p: string) => r.take(parseName(v, p), '');
  const exclusions: Exclusion[] = r.list(o.exclusions, `${path}.exclusions`).map((e, i) => {
    const x = r.obj(e, `${path}.exclusions[${i}]`);
    const p = `${path}.exclusions[${i}]`;
    return { from: name(x.from, `${p}.from`), to: name(x.to, `${p}.to`), bothWays: r.bool(x.bothWays, `${p}.bothWays`) };
  });
  const must: MustRule[] = r.list(o.must, `${path}.must`).map((e, i) => {
    const x = r.obj(e, `${path}.must[${i}]`);
    const p = `${path}.must[${i}]`;
    const choices = r.list(x.choices, `${p}.choices`).map((c, j) => name(c, `${p}.choices[${j}]`));
    if (!choices.length) r.errors.push({ code: 'rule.mustEmpty', path: `${p}.choices` });
    return { giver: name(x.giver, `${p}.giver`), choices };
  });
  const lastYear: Pairing[] = r.list(o.lastYear, `${path}.lastYear`).map((e, i) => {
    const x = r.obj(e, `${path}.lastYear[${i}]`);
    const p = `${path}.lastYear[${i}]`;
    return { giver: name(x.giver, `${p}.giver`), receiver: name(x.receiver, `${p}.receiver`) };
  });
  return { exclusions, must, lastYear };
}

/** Reads the fields a template may set as defaults. */
function readDefaults(r: Reader, o: Obj, path: string): Template['defaults'] {
  return {
    structure: readStructure(r, o.structure, `${path}.structure`),
    rules: readRules(r, o.rules, `${path}.rules`),
    gifts: readGifts(r, o.gifts, `${path}.gifts`),
    exchange: r.oneOf(o.exchange, EXCHANGE, `${path}.exchange`),
    communication: r.oneOf(o.communication, ['none'] as const, `${path}.communication`),
    reveal: r.oneOf(o.reveal, REVEAL, `${path}.reveal`),
    context: r.oneOf(o.context, CONTEXT, `${path}.context`),
    organizerPlays: r.bool(o.organizerPlays, `${path}.organizerPlays`),
    place: r.take(parseFreeText(o.place, `${path}.place`, MAX_PLACE_BYTES), ''),
  };
}

/** Checks that every name a rule mentions is a participant, and that rules do not refer to oneself. */
function checkRuleNames(config: RoundConfig, errors: ValidationError[]): void {
  const people = new Set(config.participants.households.flat().map(nameKey));
  const known = (n: string, path: string) => {
    if (n && !people.has(nameKey(n))) errors.push({ code: 'rule.unknownName', path, params: { name: n } });
  };
  const { exclusions, must, lastYear } = config.rules;
  exclusions.forEach((e, i) => [e.from, e.to].forEach((n) => known(n, `rules.exclusions[${i}]`)));
  must.forEach((m, i) => [m.giver, ...m.choices].forEach((n) => known(n, `rules.must[${i}]`)));
  lastYear.forEach((p, i) => [p.giver, p.receiver].forEach((n) => known(n, `rules.lastYear[${i}]`)));
  Object.keys(config.gifts.hints).forEach((n) => known(n, 'gifts.hints'));
  const givers = new Set<string>();
  must.forEach((m, i) => {
    if (givers.has(nameKey(m.giver))) errors.push({ code: 'rule.mustTwice', path: `rules.must[${i}]`, params: { name: m.giver } });
    givers.add(nameKey(m.giver));
  });
}

/** Validates an untrusted round configuration, e.g. from a file or the wizard. */
export function validateConfig(raw: unknown): Result<RoundConfig> {
  const r = new Reader();
  const o = r.obj(raw, '');
  if (o.version !== 1) r.errors.push({ code: 'config.version', path: 'version' });
  if (!isTemplateId(o.template)) r.errors.push({ code: 'template.unknown', path: 'template' });
  if (o.family !== 'drawn') r.errors.push({ code: 'config.invalid', path: 'family' });
  const occasion = r.obj(o.occasion, 'occasion');
  const households = r.take(parseHouseholds(r.obj(o.participants, 'participants').households, 'participants.households'), []);
  const config: RoundConfig = {
    version: 1,
    template: isTemplateId(o.template) ? o.template : TEMPLATE_IDS[0],
    family: 'drawn',
    occasion: { exchangeDate: r.take(parseIsoDate(occasion.exchangeDate, 'occasion.exchangeDate'), '') },
    participants: { households },
    ...readDefaults(r, o, ''),
  };
  if (occasion.revealDate !== undefined) {
    config.occasion.revealDate = r.take(parseIsoDate(occasion.revealDate, 'occasion.revealDate'), '');
  }
  if (households.flat().length < 2) r.errors.push({ code: 'people.tooFew', path: 'participants.households' });
  checkRuleNames(config, r.errors);
  return r.errors.length ? { ok: false, errors: r.errors } : { ok: true, value: config };
}

/** Validates a template file. */
export function validateTemplate(raw: unknown): Result<Template> {
  const r = new Reader();
  const o = r.obj(raw, '');
  if (!isTemplateId(o.id)) return fail('template.unknown', 'id');
  const f = r.obj(o.fields, 'fields');
  const fields: TemplateFields = {
    budget: r.bool(f.budget, 'fields.budget'),
    theme: r.bool(f.theme, 'fields.theme'),
    hints: r.bool(f.hints, 'fields.hints'),
    lastYear: r.bool(f.lastYear, 'fields.lastYear'),
  };
  const template: Template = {
    id: o.id,
    family: r.oneOf(o.family, ['drawn', 'party'] as const, 'family'),
    defaults: readDefaults(r, r.obj(o.defaults, 'defaults'), 'defaults'),
    fields,
  };
  return r.errors.length ? { ok: false, errors: r.errors } : { ok: true, value: template };
}
