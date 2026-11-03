/** The start view: templates and the rounds kept on this device. */
import { isTemplateId } from '../config/validate.ts';
import { formatDate } from '../i18n/format.ts';
import { t } from '../i18n/i18n.ts';
import { indexedDbStore as store, indexedDbYears } from '../store/db.ts';
import { yearFromRound } from '../files/year.ts';
import { showFileOpener } from './files.ts';
import { purgeExpired } from '../store/rounds.ts';
import { byId, confirmDialog, fill, h, showView } from './dom.ts';
import { showRound } from './round.ts';
import { startWizard, startWizardFromYear } from './wizard.ts';

/** Shows the start view with the stored rounds and an optional status message. */
export async function showHome(message = ''): Promise<void> {
  byId('home-status').textContent = message;
  showView('home');
  const rounds = await store.list().catch(() => []);
  const box = byId('rounds');
  box.hidden = rounds.length === 0;
  const list = h('ul', { class: 'round-list' });
  for (const round of rounds.sort((a, b) => a.expiresAt - b.expiresAt)) {
    const open = h('button', { type: 'button', class: 'btn btn--card' }, t('rounds.open'));
    open.addEventListener('click', () => void showRound(round.id));
    const people = t('people.summary', { count: round.links.length });
    const date = formatDate(round.config.occasion.exchangeDate);
    const name = round.title ? t('rounds.itemTitled', { title: round.title, date, people }) : t('rounds.item', { template: t(`template.${round.config.template}`), date, people });
    const sent = t('rounds.sent', { sent: round.links.filter((l) => l.sent).length, count: round.links.length });
    list.append(h('li', {}, h('span', { class: 'round-item' }, h('span', {}, name), h('span', { class: 'muted small' }, sent)), open));
  }
  fill(box, h('h2', {}, t('rounds.title')), list);
  await showYears();
  const files = byId('files');
  files.hidden = false;
  showFileOpener(files);
}

/** Last year's rounds kept on this device, with "start from it" and "forget". */
async function showYears(): Promise<void> {
  const years = await indexedDbYears.list().catch(() => []);
  const box = byId('years');
  box.hidden = years.length === 0;
  const list = h('ul', { class: 'round-list' });
  for (const { id, data } of years.sort((a, b) => b.data.year - a.data.year)) {
    const name = data.title ?? t(`template.${data.template}`);
    const start = h('button', { type: 'button', class: 'btn btn--card' }, t('years.start'));
    start.addEventListener('click', () => startWizardFromYear(data, id));
    const forget = h('button', { type: 'button', class: 'btn btn--text' }, t('years.forget'));
    forget.addEventListener('click', async () => {
      if (!(await confirmDialog(t('years.forgetWarning', { year: data.year }), t('years.forget'), t('round.cancel')))) return;
      await indexedDbYears.delete(id);
      await showHome(t('years.forgotten'));
    });
    list.append(h('li', {}, h('span', { class: 'round-item' }, h('span', {}, `${name}, ${data.year}`), h('span', { class: 'muted small' }, t('years.pairings', { count: data.pairings.length }))), h('span', { class: 'actions' }, start, forget)));
  }
  fill(box, h('h2', {}, t('years.title')), list);
}

/** With JavaScript, the template cards start the wizard instead of opening their help page. */
export function wireTemplateLinks(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-template]')) {
    const id = link.dataset.template;
    if (!isTemplateId(id) || link.dataset.wired) continue;
    link.dataset.wired = '1';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      startWizard(id);
    });
  }
}

/** Starts the app on the start page: template cards, expiry clean-up, a requested template or the overview. */
export async function startApp(): Promise<void> {
  wireTemplateLinks();
  // An ended round is kept as last year's round before it deletes itself.
  await purgeExpired(store, Date.now(), async (round) => indexedDbYears.put(round.id, await yearFromRound(round))).catch(() => undefined);
  const requested = new URLSearchParams(location.search).get('vorlage');
  if (isTemplateId(requested)) {
    history.replaceState(null, '', location.pathname);
    startWizard(requested);
    return;
  }
  await showHome();
}
