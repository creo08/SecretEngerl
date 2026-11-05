/**
 * Zufallswichteln: everyone brings a gift for someone not known yet; at the party
 * one device draws who gets whose gift and shows the pairs one by one. Nothing is stored.
 */
import { configFromTemplate } from '../config/templates.ts';
import { t } from '../i18n/i18n.ts';
import { parseNameList } from '../input/validate.ts';
import { revealOrder } from '../losfee/reveal.ts';
import { createCryptoRng } from '../random/rng.ts';
import { askWorker } from '../worker/client.ts';
import { byId, checkbox, errorBox, field, fill, h, showErrors, showView } from './dom.ts';
import { drawFailure, errorMessages, householdLabel } from './text.ts';
import { todayIso } from './wizard.ts';

/** Shows the setup: names with optional groups and "no mutual pairs". */
export function showZufallSetup(): void {
  const names = h('textarea', { rows: '8', autocomplete: 'off', spellcheck: 'false' });
  const preview = h('ul', { class: 'households' });
  names.addEventListener('input', () => {
    const parsed = parseNameList(names.value);
    fill(preview, ...(parsed.ok ? parsed.value.map((members) => h('li', {}, householdLabel(members))) : []));
  });
  let noMutual = true;
  const errors = errorBox();
  const status = h('p', { class: 'status', role: 'status' });
  const start = h('button', { type: 'submit', class: 'btn btn--ink' }, t('zufall.draw'));
  const back = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.back'));
  back.addEventListener('click', () => showView('home'));
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    field(t('wizard.who.names'), names, t('wizard.who.namesHelp')),
    preview,
    checkbox(t('wizard.rules.noMutual'), t('wizard.rules.noMutualHelp'), true, (v) => (noMutual = v)),
    h('p', { class: 'help' }, t('zufall.nothingStored')),
    errors,
    status,
    h('div', { class: 'actions' }, start, back),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const parsed = parseNameList(names.value);
    if (!parsed.ok) return showErrors(errors, errorMessages(parsed.errors));
    // The engine of the drawn forms: nobody gets their own gift, groups stay apart.
    const config = configFromTemplate('engerl-bengerl', parsed.value, todayIso());
    config.structure = { ...config.structure, noMutual };
    start.disabled = true;
    status.textContent = t('wizard.drawing');
    try {
      const response = await askWorker('draw', config);
      if (response.type === 'invalid') return showErrors(errors, errorMessages(response.errors));
      if (response.type !== 'draw') throw new Error('unexpected worker response');
      if (!response.result.ok) return showErrors(errors, [drawFailure(config, response.names, response.result)]);
      const assignment = response.result.assignment;
      const pairs = new Map(response.names.map((giver, g) => [giver, response.names[assignment[g]!]!]));
      reveal(revealOrder(pairs, createCryptoRng()));
    } catch {
      showErrors(errors, [t('draw.failed')]);
    } finally {
      start.disabled = false;
      status.textContent = '';
    }
  });
  fill(byId('game'), h('div', { class: 'container narrow stack' }, h('h1', { class: 'step-title' }, t('zufall.title')), h('p', { class: 'lead' }, t('zufall.intro')), form));
  showView('game');
}

/** Shows the pairs one at a time, then all of them; leaving forgets them. */
function reveal(order: [string, string][]): void {
  const view = byId('game');
  const home = async () => (await import('./home.ts')).showHome();
  const render = (i: number) => {
    if (i === order.length) {
      const done = h('button', { type: 'button', class: 'btn btn--ink' }, t('stage.done'));
      done.addEventListener('click', () => void home());
      const list = h('ul', { class: 'round-list' }, ...order.map(([giver, receiver]) => h('li', {}, h('span', {}, t('zufall.pair', { giver, receiver })))));
      const heading = h('h1', { class: 'step-title', tabindex: '-1' }, t('zufall.all'));
      fill(view, h('div', { class: 'container narrow stack' }, heading, list, h('p', { class: 'help' }, t('zufall.forgotten')), h('div', { class: 'actions' }, done)));
      heading.focus();
      return;
    }
    const [giver, receiver] = order[i]!;
    const next = h('button', { type: 'button', class: 'btn btn--ink' }, t(i === order.length - 1 ? 'zufall.showAll' : 'stage.next'));
    next.addEventListener('click', () => render(i + 1));
    const end = h('button', { type: 'button', class: 'btn btn--card' }, t('stage.end'));
    end.addEventListener('click', () => void home());
    const heading = h('h1', { class: 'stage-pair', tabindex: '-1' }, h('span', { class: 'stage-name' }, giver), h('span', { class: 'stage-verb' }, t('stage.gives')), h('span', { class: 'stage-name' }, receiver));
    fill(view, h('div', { class: 'container narrow stage' }, h('p', { class: 'muted fig' }, t('stage.counter', { n: i + 1, count: order.length })), heading, h('div', { class: 'actions stage-actions' }, next, end)));
    heading.focus();
  };
  showView('game');
  render(0);
}
