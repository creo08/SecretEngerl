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
  await showRunningGame();
  await showYears();
  const files = byId('files');
  files.hidden = false;
  showFileOpener(files);
}

/** Party games still running on this device, each with "Weiterspielen". */
async function showRunningGame(): Promise<void> {
  const [raeuber, wuerfel] = await Promise.all([import('./raeuber.ts'), import('./wuerfel.ts')]);
  const items: HTMLElement[] = [];
  const add = (game: string, people: number, resume: () => void) => {
    const button = h('button', { type: 'button', class: 'btn btn--ink' }, t('game.resume'));
    button.addEventListener('click', resume);
    items.push(h('li', {}, h('span', { class: 'round-item' }, h('span', {}, t('game.runningItem', { game, people: t('people.summary', { count: people }) }))), button));
  };
  const r = await raeuber.loadRaeuber().catch(() => undefined);
  if (r) add(t('raeuber.title'), r.players.length, () => raeuber.play(r));
  const w = await wuerfel.loadWuerfel().catch(() => undefined);
  // The tap on "Weiterspielen" is what allows the sound at the end.
  if (w) add(t('wuerfel.title'), w.players.length, () => (wuerfel.prepareAudio(), wuerfel.play(w)));
  const box = byId('game-running');
  box.hidden = items.length === 0;
  fill(box, h('h2', {}, t('game.running')), h('ul', { class: 'round-list' }, ...items));
}

/** Starts the setup of a party game by its id; false if there is no such game. */
async function startGame(id: string | null | undefined): Promise<boolean> {
  if (id === 'raeuberwichteln') (await import('./raeuber.ts')).showRaeuberSetup();
  else if (id === 'wuerfelwichteln') (await import('./wuerfel.ts')).showWuerfelSetup();
  else return false;
  return true;
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

/** With JavaScript, the game cards start the game setup instead of opening their help page. */
function wireGameLinks(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-game]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      void startGame(link.dataset.game);
    });
  }
}

/** Starts the app on the start page: template cards, expiry clean-up, a requested template or the overview. */
export async function startApp(): Promise<void> {
  wireTemplateLinks();
  wireGameLinks();
  // An ended round is kept as last year's round before it deletes itself.
  await purgeExpired(store, Date.now(), async (round) => indexedDbYears.put(round.id, await yearFromRound(round))).catch(() => undefined);
  const requested = new URLSearchParams(location.search).get('vorlage');
  if (isTemplateId(requested)) {
    history.replaceState(null, '', location.pathname);
    startWizard(requested);
    return;
  }
  const game = new URLSearchParams(location.search).get('spiel');
  if (game) history.replaceState(null, '', location.pathname);
  if (await startGame(game)) return;
  await showHome();
}
