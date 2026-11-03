/**
 * Setting up a round: template, then at most three steps (who, rules, distribute).
 * Everything beyond the essentials sits under "Mehr Optionen".
 */
import { configFromTemplate, getTemplate } from '../config/templates.ts';
import type { Exclusion, MustRule, Pairing, RoundConfig, TemplateId } from '../config/types.ts';
import type { YearData } from '../files/year.ts';
import { isPeekPhrase } from '../store/emergency.ts';
import { validateConfig } from '../config/validate.ts';
import { t } from '../i18n/i18n.ts';
import { cleanText, nameKey, parseAmount, parseNameList, type Result } from '../input/validate.ts';
import { freeHintBytes, oversizedDraws } from '../link/payload.ts';
import { indexedDbStore, indexedDbYears, requestPersistence } from '../store/db.ts';
import { MAX_TITLE_CHARS, saveDraw } from '../store/rounds.ts';
import { askWorker } from '../worker/client.ts';
import { byId, disclosure, fill, h, showView, uid } from './dom.ts';
import { showRound } from './round.ts';
import { drawFailure, errorMessages, householdLabel } from './text.ts';

interface WizardState {
  title: string;
  template: TemplateId;
  namesText: string;
  date: string;
  budget: string;
  theme: string;
  hints: Record<string, string>;
  lastYear: Record<string, string>;
  exclusions: Exclusion[];
  must: MustRule[];
  noMutual: boolean;
  oneChain: boolean;
  /** Last year's round this one starts from; its pairings are excluded but never shown without "Ich spicke". */
  previous?: { year: number; names: string[]; pairings: Pairing[]; yearId?: string };
  /** Last year's names that are spelled differently now: old name → new name. */
  renames: Record<string, string>;
  mapped: boolean;
}

/** Today's date on this device as YYYY-MM-DD. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The suggested round name, e.g. "Familien-Wichteln 2026". */
function defaultTitle(template: TemplateId, year: number): string {
  return t('wizard.who.defaultTitle', { template: t(`template.${template}`), year });
}

/** The app's own URL, the base of every link. */
export function appBase(): string {
  return new URL(import.meta.env.BASE_URL, location.origin).href;
}

/** Starts the wizard with a template, optionally pre-filled (from a pre-fill link). */
export function startWizard(
  template: TemplateId,
  initial: Partial<Pick<WizardState, 'namesText' | 'budget' | 'date' | 'hints' | 'previous'>> = {},
): void {
  const t0 = getTemplate(template);
  const state: WizardState = {
    template,
    title: defaultTitle(template, new Date().getFullYear()),
    namesText: '',
    date: '',
    budget: t0.defaults.gifts.budget ? String(t0.defaults.gifts.budget.amount) : '',
    theme: '',
    hints: {},
    lastYear: {},
    exclusions: [],
    must: [],
    noMutual: t0.defaults.structure.noMutual,
    oneChain: t0.defaults.structure.oneChain,
    renames: {},
    mapped: false,
    ...initial,
  };
  stepWho(state);
  showView('wizard');
}

/** Starts a new round from last year's round: names, groups, budget and hints filled in, pairings excluded. */
export function startWizardFromYear(data: YearData, yearId?: string): void {
  const withBudget = getTemplate(data.template).fields.budget && data.budget !== null;
  startWizard(data.template, {
    namesText: data.households.map((g) => g.join('\n')).join('\n\n'),
    ...(withBudget ? { budget: String(data.budget) } : {}),
    hints: { ...data.hints },
    previous: { year: data.year, names: data.households.flat(), pairings: data.pairings, ...(yearId ? { yearId } : {}) },
  });
}

/** Last year's pairings among this year's people, after renames; spelled as this year. */
function previousPairings(state: WizardState, people: readonly string[]): Pairing[] {
  if (!state.previous) return [];
  const spelling = new Map(people.map((n) => [nameKey(n), n]));
  const now = (old: string) => spelling.get(nameKey(state.renames[old] ?? old));
  return state.previous.pairings.flatMap((p) => {
    const giver = now(p.giver);
    const receiver = now(p.receiver);
    return giver && receiver && giver !== receiver ? [{ giver, receiver }] : [];
  });
}

function households(state: WizardState): string[][] {
  const parsed = parseNameList(state.namesText);
  return parsed.ok ? parsed.value : [];
}

/** Builds and validates the configuration from the wizard state. */
function buildConfig(state: WizardState): Result<RoundConfig> {
  const template = getTemplate(state.template);
  const names = parseNameList(state.namesText);
  if (!names.ok) return names;
  const config = configFromTemplate(state.template, names.value, state.date);
  if (template.fields.budget) {
    const amount = parseAmount(state.budget, 'budget');
    if (!amount.ok) return amount;
    config.gifts.budget = { amount: amount.value, currency: 'EUR' };
  }
  config.gifts.theme = state.theme;
  const people = new Set(names.value.flat());
  // Hints of people removed in step 1 stay in the state; only current people count.
  config.gifts.hints = Object.fromEntries(Object.entries(state.hints).filter(([n, v]) => people.has(n) && v.trim() !== ''));
  config.structure = { ...config.structure, noMutual: state.noMutual, oneChain: state.oneChain };
  config.rules = {
    exclusions: state.exclusions.filter((e) => people.has(e.from) && people.has(e.to)),
    must: state.must.filter((m) => people.has(m.giver)).map((m) => ({ ...m, choices: m.choices.filter((c) => people.has(c)) })).filter((m) => m.choices.length),
    lastYear: [
      ...Object.entries(state.lastYear).filter(([g, r]) => people.has(g) && people.has(r)).map(([giver, receiver]) => ({ giver, receiver })),
      ...previousPairings(state, [...people]).filter((p) => state.lastYear[p.giver] !== p.receiver),
    ],
  };
  return validateConfig(config);
}

function frame(step: number, title: string, ...content: (Node | false)[]): HTMLElement {
  return h(
    'div',
    { class: 'container narrow' },
    h('p', { class: 'step muted' }, t('wizard.step', { step })),
    h('h1', { class: 'step-title' }, title),
    ...content.filter((c): c is Node => Boolean(c)),
  );
}

function field(label: string, control: HTMLElement, help?: string): HTMLElement {
  const id = control.id || uid('f');
  control.id = id;
  const helpId = help ? `${id}-help` : undefined;
  if (helpId) control.setAttribute('aria-describedby', helpId);
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, help ? h('p', { id: helpId, class: 'help' }, help) : null);
}

function errorBox(): HTMLElement {
  return h('div', { class: 'errors', role: 'alert' });
}

function showErrors(box: HTMLElement, messages: string[]): void {
  fill(box, ...(messages.length ? [h('ul', {}, ...messages.map((m) => h('li', {}, m)))] : []));
}

function stepWho(state: WizardState): void {
  const template = getTemplate(state.template);
  const names = h('textarea', { name: 'names', rows: '8', autocomplete: 'off', spellcheck: 'false', required: true });
  names.value = state.namesText;
  const title = h('input', { type: 'text', name: 'title', autocomplete: 'off', maxlength: String(MAX_TITLE_CHARS) });
  title.value = state.title;
  const date = h('input', { type: 'date', name: 'date', required: true });
  date.value = state.date;
  const budget = h('input', { type: 'text', name: 'budget', inputmode: 'decimal', autocomplete: 'off' });
  budget.value = state.budget;
  const preview = h('ul', { class: 'households' });
  const errors = errorBox();
  const updatePreview = () => {
    state.namesText = names.value;
    const hh = households(state);
    fill(preview, ...hh.map((members) => h('li', {}, householdLabel(members))));
  };
  names.addEventListener('input', updatePreview);
  updatePreview();
  const back = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.back'));
  back.addEventListener('click', () => showView('home'));
  const next = h('button', { type: 'submit', class: 'btn btn--ink' }, t('wizard.next'));
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    field(t('wizard.who.roundTitle'), title, t('wizard.who.roundTitleHelp')),
    field(t('wizard.who.names'), names, t('wizard.who.namesHelp')),
    preview,
    field(t('wizard.who.date'), date),
    template.fields.budget ? field(t('wizard.who.budget'), budget) : null,
    errors,
    h('div', { class: 'actions' }, next, back),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.namesText = names.value;
    state.date = date.value;
    state.title = cleanText(title.value);
    // An unchanged suggestion follows the year of the exchange, e.g. a round in early January.
    if (state.title === defaultTitle(state.template, new Date().getFullYear()) && /^\d{4}-/.test(state.date)) {
      state.title = defaultTitle(state.template, Number(state.date.slice(0, 4)));
    }
    if ([...state.title].length > MAX_TITLE_CHARS) return showErrors(errors, [t('error.title.tooLong', { max: MAX_TITLE_CHARS })]);
    state.budget = budget.value;
    // A past exchange date would make every link expire at once.
    if (state.date && state.date < todayIso()) return showErrors(errors, [t('error.date.past')]);
    const result = buildConfig(state);
    if (!result.ok) {
      showErrors(errors, errorMessages(result.errors));
      return;
    }
    if (state.previous && !state.mapped && showMapping(state, result.value.participants.households.flat(), errors)) return;
    // A renamed person keeps last year's hint under the new name.
    for (const [old, now] of Object.entries(state.renames)) {
      if (state.hints[old] !== undefined && !state.hints[now]) state.hints[now] = state.hints[old];
    }
    stepRules(state);
  });
  fill(byId('wizard'), frame(1, t('wizard.who.title'), h('p', { class: 'template-name' }, t(`template.${state.template}`)), form));
  showView('wizard');
}

/**
 * Asks who is who when last year's names are missing from this year's list
 * but new names appeared. Returns true while the question is on screen.
 */
function showMapping(state: WizardState, people: string[], before: HTMLElement): boolean {
  const old = state.previous!;
  const oldKeys = new Set(old.names.map(nameKey));
  const nowKeys = new Set(people.map(nameKey));
  const missing = old.names.filter((n) => !nowKeys.has(nameKey(n)));
  const fresh = people.filter((n) => !oldKeys.has(nameKey(n)));
  state.mapped = true;
  if (!missing.length || !fresh.length) return false;
  const block = h('fieldset', { class: 'stack' }, h('legend', {}, t('wizard.map.title')), h('p', { class: 'help' }, t('wizard.map.help', { year: old.year })));
  for (const name of missing) {
    const select = personSelect(fresh, '', t('wizard.map.gone'));
    select.addEventListener('change', () => {
      if (select.value) state.renames[name] = select.value;
      else delete state.renames[name];
    });
    block.append(field(t('wizard.map.for', { name, year: old.year }), select));
  }
  before.before(block);
  block.querySelector('select')?.focus();
  return true;
}

/** "10 pairings from 2026 are excluded", and the pairings only after "Ich spicke". */
function previousBlock(year: number, pairs: Pairing[]): HTMLElement {
  const phrase = h('input', { type: 'text', id: uid('f'), autocomplete: 'off', spellcheck: 'false' });
  const list = h('ul', { class: 'log' });
  const show = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.year.show'));
  show.addEventListener('click', () => {
    if (!isPeekPhrase(phrase.value)) return fill(list, h('li', {}, t('emergency.wrongPhrase')));
    fill(list, ...pairs.map((p) => h('li', {}, t('wizard.year.pair', { giver: p.giver, receiver: p.receiver }))));
  });
  return h(
    'div',
    { class: 'notice stack' },
    h('p', {}, t('wizard.year.excluded', { count: pairs.length, year })),
    disclosure(t('wizard.year.view'), t('wizard.year.viewHint'), h('div', { class: 'stack' }, field(t('emergency.phraseLabel'), phrase), h('div', { class: 'actions' }, show), list), 'more more--inner'),
  );
}

function checkbox(label: string, help: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', id: uid('c') });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  const helpId = `${input.id}-help`;
  input.setAttribute('aria-describedby', helpId);
  return h('div', { class: 'check' }, input, h('label', { for: input.id }, label), h('p', { id: helpId, class: 'help' }, help));
}

function personSelect(people: string[], value: string, empty?: string): HTMLSelectElement {
  const select = h('select', {}, ...(empty !== undefined ? [h('option', { value: '' }, empty)] : []), ...people.map((p) => h('option', { value: p }, p)));
  select.value = value;
  return select;
}

function hintsBlock(state: WizardState, people: string[]): HTMLElement {
  const block = h('fieldset', { class: 'stack' }, h('legend', {}, t('wizard.rules.hints')), h('p', { class: 'help' }, t('wizard.rules.hintNote')));
  for (const name of people) {
    const area = h('textarea', { rows: '2', autocomplete: 'off' });
    area.value = state.hints[name] ?? '';
    const counter = h('p', { class: 'help', 'aria-live': 'polite' });
    const update = () => {
      state.hints[name] = area.value;
      const built = buildConfig(state);
      if (!built.ok) return fill(counter);
      const free = freeHintBytes(built.value, name, 1);
      counter.classList.toggle('over', free < 0);
      // Shown as characters; each byte is one character for plain letters.
      counter.textContent = free >= 0 ? t('wizard.rules.free', { count: free }) : t('wizard.rules.over', { count: -free });
    };
    area.addEventListener('input', update);
    block.append(field(t('wizard.rules.hintFor', { name }), area), counter);
    update();
  }
  return block;
}

function lastYearBlock(state: WizardState, people: string[]): HTMLElement {
  const block = h('fieldset', { class: 'stack' }, h('legend', {}, t('wizard.rules.lastYear')), h('p', { class: 'help' }, t('wizard.rules.lastYearHelp')));
  for (const name of people) {
    const select = personSelect(people.filter((p) => p !== name), state.lastYear[name] ?? '', t('wizard.rules.nobody'));
    select.addEventListener('change', () => {
      if (select.value) state.lastYear[name] = select.value;
      else delete state.lastYear[name];
    });
    block.append(field(t('wizard.rules.lastYearFor', { name }), select));
  }
  return block;
}

function exclusionsBlock(state: WizardState, people: string[]): HTMLElement {
  const list = h('ul', { class: 'rule-list' });
  const render = () =>
    fill(
      list,
      ...state.exclusions.map((e, i) => {
        const remove = h('button', { type: 'button', class: 'btn btn--text' }, t('wizard.rules.remove'));
        remove.addEventListener('click', () => {
          state.exclusions.splice(i, 1);
          render();
        });
        return h('li', {}, h('span', {}, t(e.bothWays ? 'wizard.rules.exclusionTextBoth' : 'wizard.rules.exclusionText', { from: e.from, to: e.to })), remove);
      }),
    );
  const from = personSelect(people, people[0] ?? '');
  const to = personSelect(people, people[1] ?? '');
  const both = h('input', { type: 'checkbox', id: uid('c') });
  const add = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.rules.add'));
  add.addEventListener('click', () => {
    if (from.value === to.value) return;
    state.exclusions.push({ from: from.value, to: to.value, bothWays: both.checked });
    render();
  });
  render();
  return h(
    'fieldset',
    { class: 'stack' },
    h('legend', {}, t('wizard.rules.exclusions')),
    h('p', { class: 'help' }, t('wizard.rules.exclusionsHelp')),
    list,
    h('div', { class: 'row' }, field(t('wizard.rules.exclusionFrom'), from), field(t('wizard.rules.exclusionTo'), to)),
    h('div', { class: 'check' }, both, h('label', { for: both.id }, t('wizard.rules.bothWays'))),
    h('div', { class: 'actions' }, add),
  );
}

function mustBlock(state: WizardState, people: string[]): HTMLElement {
  const list = h('ul', { class: 'rule-list' });
  const render = () =>
    fill(
      list,
      ...state.must.map((m, i) => {
        const remove = h('button', { type: 'button', class: 'btn btn--text' }, t('wizard.rules.remove'));
        remove.addEventListener('click', () => {
          state.must.splice(i, 1);
          render();
        });
        const choices = m.choices.join(` ${t('wizard.rules.or')} `);
        return h('li', {}, h('span', {}, t('wizard.rules.mustText', { giver: m.giver, choices })), remove);
      }),
    );
  const giver = personSelect(people, people[0] ?? '');
  const boxes = people.map((p) => {
    const box = h('input', { type: 'checkbox', id: uid('c'), value: p });
    return { box, row: h('div', { class: 'check' }, box, h('label', { for: box.id }, p)) };
  });
  const add = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.rules.add'));
  add.addEventListener('click', () => {
    const choices = boxes.filter((b) => b.box.checked && b.box.value !== giver.value).map((b) => b.box.value);
    if (!choices.length) return;
    state.must = state.must.filter((m) => m.giver !== giver.value);
    state.must.push({ giver: giver.value, choices });
    for (const b of boxes) b.box.checked = false;
    render();
  });
  render();
  return h(
    'fieldset',
    { class: 'stack' },
    h('legend', {}, t('wizard.rules.must')),
    h('p', { class: 'help' }, t('wizard.rules.mustHelp')),
    list,
    field(t('wizard.rules.mustGiver'), giver),
    h('fieldset', { class: 'choices' }, h('legend', {}, t('wizard.rules.mustChoices')), ...boxes.map((b) => b.row)),
    h('div', { class: 'actions' }, add),
  );
}

function stepRules(state: WizardState): void {
  const template = getTemplate(state.template);
  const people = households(state).flat();
  const theme = h('input', { type: 'text', name: 'theme', autocomplete: 'off', maxlength: '60' });
  theme.value = state.theme;
  theme.addEventListener('input', () => (state.theme = theme.value));
  const main: HTMLElement[] = [
    checkbox(t('wizard.rules.noMutual'), t('wizard.rules.noMutualHelp'), state.noMutual, (v) => (state.noMutual = v)),
    checkbox(t('wizard.rules.oneChain'), t('wizard.rules.oneChainHelp'), state.oneChain, (v) => (state.oneChain = v)),
  ];
  const more: HTMLElement[] = [exclusionsBlock(state, people), mustBlock(state, people)];
  const themeField = field(t('wizard.rules.theme'), theme);
  (template.fields.theme ? main : more).push(themeField);
  (template.fields.hints ? main : more).push(hintsBlock(state, people));
  (template.fields.lastYear ? main : more).push(lastYearBlock(state, people));
  const excluded = previousPairings(state, people);
  if (state.previous && excluded.length) main.unshift(previousBlock(state.previous.year, excluded));

  const errors = errorBox();
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  const back = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.back'));
  back.addEventListener('click', () => stepWho(state));
  const drawButton = h('button', { type: 'submit', class: 'btn btn--ink' }, t('wizard.draw'));
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    h('p', { class: 'lead' }, t('wizard.rules.intro')),
    ...main,
    disclosure(t('wizard.rules.more'), t('wizard.rules.moreHint'), h('div', { class: 'stack' }, ...more)),
    errors,
    status,
    h('div', { class: 'actions' }, drawButton, back),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const built = buildConfig(state);
    if (!built.ok) return showErrors(errors, errorMessages(built.errors));
    const config = built.value;
    const tooLong = oversizedDraws(config, 1);
    if (tooLong.length) {
      const count = Math.max(...tooLong.map((x) => x.overBy));
      return showErrors(errors, [t('draw.tooLong', { names: tooLong.map((x) => x.name).join(', '), count })]);
    }
    showErrors(errors, []);
    drawButton.disabled = true;
    status.textContent = t('wizard.drawing');
    try {
      const response = await askWorker('draw', config);
      if (response.type === 'invalid') return showErrors(errors, errorMessages(response.errors));
      if (response.type !== 'draw') throw new Error('unexpected worker response');
      if (!response.result.ok) return showErrors(errors, [drawFailure(config, response.names, response.result)]);
      const round = await saveDraw(indexedDbStore, { config, names: response.names, assignment: response.result.assignment, base: appBase(), ...(state.title ? { title: state.title } : {}) });
      // A round started from last year's round on this device uses it up, but only once the new round is safely stored.
      if (state.previous?.yearId) await indexedDbYears.delete(state.previous.yearId).catch(() => undefined);
      void requestPersistence();
      await showRound(round.id, { fresh: true });
    } catch {
      showErrors(errors, [t('draw.failed')]);
    } finally {
      drawButton.disabled = false;
      status.textContent = '';
    }
  });
  fill(byId('wizard'), frame(2, t('wizard.rules.title'), h('p', { class: 'template-name' }, t(`template.${state.template}`)), form));
  showView('wizard');
}
