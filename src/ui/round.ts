/**
 * A stored round: send each link, send again, drop-out, new draw, emergency
 * view, seal and delete. Links are never shown as a list.
 */
import { withoutPerson } from '../config/edit.ts';
import type { RoundConfig } from '../config/types.ts';
import { formatDate, formatDateTime, formatNumber } from '../i18n/format.ts';
import { t } from '../i18n/i18n.ts';
import { MAX_PEOPLE_FOR_COUNT } from '../losfee/index.ts';
import { shareDraw, shareMessage } from '../share/share.ts';
import { indexedDbStore as store } from '../store/db.ts';
import { checkPin, isPeekPhrase, setPin, viewAssignment } from '../store/emergency.ts';
import { DrawTooLongError, loadRound, markSent, planDropout, saveDraw } from '../store/rounds.ts';
import type { StoredRound } from '../store/types.ts';
import { askWorker } from '../worker/client.ts';
import { byId, confirmDialog, fill, h, showView, uid } from './dom.ts';
import { icon } from './icons.ts';
import { drawFailure, errorMessages } from './text.ts';
import { appBase } from './wizard.ts';
import { showHome } from './home.ts';

const HINT_SEEN = 'secretengerl-hint-seen';
const HOLD_MS = 2000;

/** Runs an async handler and shows a friendly message if it fails, never a stack trace. */
function safely(handler: () => Promise<unknown>): () => void {
  return () =>
    void handler().catch(() => {
      const status = document.querySelector('#round .status');
      if (status) status.textContent = t('error.unexpected');
    });
}

/** True when the app runs inside a frame; a meta CSP cannot forbid framing. */
export function inFrame(): boolean {
  return window.top !== window.self;
}

/** Safari and every iOS browser may delete site data after seven days without a visit, unless installed. */
function needsSafariHint(): boolean {
  const ua = navigator.userAgent;
  const installed = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const webkitOnly = /iPhone|iPad|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua));
  return webkitOnly && !installed;
}

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_SEEN) === '1';
  } catch {
    return false;
  }
}

/** Opens a stored round. `fresh` after a new draw shows the count of possible draws for small rounds. */
export async function showRound(id: string, options: { fresh?: boolean; message?: string } = {}): Promise<void> {
  const round = await loadRound(store, id);
  const view = byId('round');
  const status = h('p', { class: 'status', role: 'status' }, options.message ?? '');
  const content = h('div', { class: 'container narrow stack' });
  content.append(
    h('h1', {}, t('round.title', { date: formatDate(round.config.occasion.exchangeDate) })),
    h('p', { class: 'muted fig' }, t('round.drawNumber', { n: round.drawNumber })),
  );
  const count = h('p', { class: 'muted small' });
  content.append(count);
  if (options.fresh && round.links.length <= MAX_PEOPLE_FOR_COUNT) {
    void askWorker('count', round.config).then((r) => {
      if (r.type === 'count' && r.count) count.textContent = t('draw.count', { count: formatNumber(r.count) });
    });
  }
  if (inFrame()) {
    content.append(h('p', { class: 'notice' }, t('round.framed')));
  } else {
    if (!hintSeen()) content.append(firstTimeHint());
    content.append(sendList(round, status), status);
    if (needsSafariHint()) content.append(h('p', { class: 'notice' }, t('round.safari')));
    content.append(sealSection(round), duringRound(round));
  }
  const back = h('button', { type: 'button', class: 'btn btn--text' }, t('round.back'));
  back.addEventListener('click', () => void showHome());
  content.append(h('div', { class: 'actions' }, back));
  fill(view, content);
  showView('round');
}

function firstTimeHint(): HTMLElement {
  const ok = h('button', { type: 'button', class: 'btn btn--card' }, t('round.hintOk'));
  const box = h('div', { class: 'notice stack' }, h('p', {}, t('round.hint')), h('div', { class: 'actions' }, ok));
  ok.addEventListener('click', () => {
    try {
      localStorage.setItem(HINT_SEEN, '1');
    } catch {
      // Without storage the hint just shows again next time.
    }
    box.remove();
  });
  return box;
}

function sendList(round: StoredRound, status: HTMLElement): HTMLElement {
  const list = h('ul', { class: 'send-list' });
  for (const entry of round.links) {
    const mark = h('span', { class: 'sent-mark' }, icon('check'), t('round.sent'));
    mark.hidden = !entry.sent;
    const button = h('button', { type: 'button', class: 'btn btn--card', 'aria-label': t('round.sendTo', { name: entry.name }) }, icon('send'), t('round.send'));
    button.addEventListener('click', safely(async () => {
      // Read the link fresh: a drop-out or new draw may have changed it.
      const current = (await loadRound(store, round.id)).links.find((l) => l.name === entry.name);
      if (!current) return;
      const outcome = await shareDraw(shareMessage(current.link));
      if (outcome === 'cancelled') return;
      if (outcome === 'failed') {
        status.textContent = t('round.shareFailed');
        return;
      }
      const next = await markSent(store, round.id, entry.name);
      mark.hidden = false;
      status.textContent = outcome === 'copied' ? t('round.copied', { name: entry.name }) : next.links.every((l) => l.sent) ? t('round.allSent') : '';
    }));
    list.append(h('li', {}, h('span', { class: 'send-name' }, entry.name), mark, button));
  }
  return list;
}

function section(title: string, ...children: (Node | null)[]): HTMLElement {
  const id = uid('s');
  return h('section', { class: 'panel stack', 'aria-labelledby': id }, h('h2', { id, class: 'panel-title' }, title), ...children);
}

function duringRound(round: StoredRound): HTMLElement {
  return h(
    'details',
    { class: 'more' },
    h('summary', {}, t('round.during')),
    h('div', { class: 'stack' }, removeSection(round), redrawSection(round), emergencySection(round), deleteSection(round)),
  );
}

/** Draws again with `config` and stores it as the next draw of the round. */
async function redraw(round: StoredRound, config: RoundConfig, errors: HTMLElement): Promise<void> {
  const response = await askWorker('draw', config);
  if (response.type === 'invalid') return void (errors.textContent = errorMessages(response.errors).join(' '));
  if (response.type !== 'draw') return;
  if (!response.result.ok) return void (errors.textContent = drawFailure(config, response.names, response.result));
  try {
    const next = await saveDraw(store, { config, names: response.names, assignment: response.result.assignment, base: appBase(), previousId: round.id });
    await showRound(next.id, { fresh: true, message: t('round.redrawn') });
  } catch (error) {
    errors.textContent = error instanceof DrawTooLongError ? t('draw.tooLong', { names: error.people.map((p) => p.name).join(', '), count: Math.max(...error.people.map((p) => p.overBy)) }) : t('draw.failed');
  }
}

function removeSection(round: StoredRound): HTMLElement {
  const select = h('select', { id: uid('f') }, ...round.links.map((l) => h('option', { value: l.name }, l.name)));
  const check = h('button', { type: 'button', class: 'btn btn--card' }, t('round.removeCheck'));
  const result = h('div', { class: 'stack', 'aria-live': 'polite' });
  check.addEventListener('click', safely(async () => {
    const name = select.value;
    if (round.links.length <= 2) return fill(result, h('p', {}, t('round.tooFewLeft')));
    const plan = await planDropout(store, round.id, name, appBase());
    const errors = h('p', { class: 'error', role: 'alert' });
    const redrawButton = h('button', { type: 'button', class: 'btn btn--ink' }, t('round.redraw'));
    redrawButton.addEventListener('click', safely(() => redraw(round, withoutPerson(round.config, name), errors)));
    if (plan.kind === 'selfDraw') return fill(result, h('p', {}, t('round.removeSelf', { engerl: plan.engerl })), h('div', { class: 'actions' }, redrawButton), errors);
    const apply = h('button', { type: 'button', class: plan.rulesBroken ? 'btn btn--card' : 'btn btn--ink' }, t(plan.rulesBroken ? 'round.removeAnyway' : 'round.removeApply'));
    apply.addEventListener('click', async () => {
      try {
        await plan.apply();
        await showRound(round.id, { message: t('round.removed', { name, engerl: plan.engerl }) });
      } catch {
        errors.textContent = t('round.changed');
      }
    });
    fill(
      result,
      h('p', {}, t('round.removeOk', { engerl: plan.engerl })),
      plan.rulesBroken ? h('p', { class: 'notice' }, t('round.removeBroken')) : null,
      h('div', { class: 'actions' }, ...(plan.rulesBroken ? [redrawButton, apply] : [apply])),
      errors,
    );
  }));
  return section(t('round.remove'), h('div', { class: 'field' }, h('label', { for: select.id }, t('round.removeWho')), select), h('div', { class: 'actions' }, check), result);
}

function redrawSection(round: StoredRound): HTMLElement {
  const button = h('button', { type: 'button', class: 'btn btn--card' }, t('round.redraw'));
  const errors = h('p', { class: 'error', role: 'alert' });
  button.addEventListener('click', safely(async () => {
    if (await confirmDialog(t('round.redrawWarning', { n: round.drawNumber + 1 }), t('round.redrawConfirm'), t('round.cancel'))) await redraw(round, round.config, errors);
  }));
  return section(t('round.redraw'), h('div', { class: 'actions' }, button), errors);
}

/** A button that fires after being held for two seconds, by pointer or keyboard. */
function holdButton(label: string, onDone: () => void): HTMLElement {
  const button = h('button', { type: 'button', class: 'btn btn--card hold' }, h('span', { class: 'hold-fill', 'aria-hidden': 'true' }), h('span', {}, label));
  let timer: number | undefined;
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    button.classList.remove('holding');
  };
  const start = () => {
    if (timer !== undefined) return;
    button.classList.add('holding');
    timer = window.setTimeout(() => {
      stop();
      onDone();
    }, HOLD_MS);
  };
  button.addEventListener('pointerdown', start);
  for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'blur']) button.addEventListener(type, stop);
  button.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault();
      start();
    }
  });
  button.addEventListener('keyup', stop);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  return button;
}

function emergencySection(round: StoredRound): HTMLElement {
  const who = h('select', { id: uid('f') }, ...round.links.map((l) => h('option', { value: l.name }, l.name)));
  const phrase = h('input', { type: 'text', id: uid('f'), autocomplete: 'off', spellcheck: 'false' });
  const pin = h('input', { type: 'password', id: uid('f'), inputmode: 'numeric', autocomplete: 'off' });
  const result = h('p', { class: 'result', 'aria-live': 'polite' });
  const log = h('ul', { class: 'log' });
  const renderLog = (views: StoredRound['views']) =>
    fill(log, ...(views.length ? views.map((v) => h('li', {}, t('emergency.logEntry', { name: v.name, date: formatDateTime(v.at) }))) : [h('li', {}, t('emergency.logEmpty'))]));
  renderLog(round.views);
  const reveal = async (confirmed: boolean) => {
    if (!confirmed) return void (result.textContent = t('emergency.wrongPhrase'));
    const current = await loadRound(store, round.id);
    if (!(await checkPin(current, pin.value))) return void (result.textContent = t('emergency.wrongPin'));
    const { round: next, receiver } = await viewAssignment(store, round.id, who.value, Date.now());
    result.textContent = t('emergency.result', { giver: who.value, receiver });
    renderLog(next.views);
  };
  const show = h('button', { type: 'button', class: 'btn btn--card' }, t('emergency.show'));
  show.addEventListener('click', safely(() => reveal(isPeekPhrase(phrase.value))));
  const newPin = h('input', { type: 'password', id: uid('f'), inputmode: 'numeric', autocomplete: 'new-password' });
  const savePin = h('button', { type: 'button', class: 'btn btn--card' }, t('emergency.setPin'));
  savePin.addEventListener('click', safely(async () => {
    if (!newPin.value) return;
    await setPin(store, round.id, newPin.value);
    // Redraw so the emergency view shows the PIN field from now on.
    await showRound(round.id, { message: t('emergency.pinSet') });
  }));
  const label = (input: HTMLElement, text: string) => h('div', { class: 'field' }, h('label', { for: input.id }, text), input);
  return section(
    t('emergency.title'),
    h('p', { class: 'help' }, t('emergency.intro')),
    label(who, t('emergency.who')),
    round.pin ? label(pin, t('emergency.pin')) : null,
    label(phrase, t('emergency.phraseLabel')),
    h('div', { class: 'actions' }, show, holdButton(t('emergency.hold'), safely(() => reveal(true)))),
    result,
    h('h3', {}, t('emergency.log')),
    log,
    h('details', {}, h('summary', {}, t('emergency.setPin')), h('div', { class: 'stack' }, label(newPin, t('emergency.newPin')), h('p', { class: 'help' }, t('emergency.pinNote')), h('div', { class: 'actions' }, savePin))),
  );
}

/** "Seal and forget": an explicit choice while distributing, with a warning first. */
function sealSection(round: StoredRound): HTMLElement {
  const seal = h('button', { type: 'button', class: 'btn btn--card' }, t('round.seal'));
  seal.addEventListener('click', safely(async () => {
    if (!(await confirmDialog(t('round.sealWarning'), t('round.sealConfirm'), t('round.cancel')))) return;
    await store.delete(round.id);
    await showHome(t('round.sealed'));
  }));
  return section(t('round.seal'), h('p', { class: 'help' }, t('round.sealWarning')), h('div', { class: 'actions' }, seal));
}

function deleteSection(round: StoredRound): HTMLElement {
  const remove = h('button', { type: 'button', class: 'btn btn--card' }, t('round.delete'));
  remove.addEventListener('click', safely(async () => {
    if (!(await confirmDialog(t('round.deleteWarning'), t('round.deleteConfirm'), t('round.cancel')))) return;
    await store.delete(round.id);
    await showHome(t('round.deleted'));
  }));
  return section(t('round.delete'), h('p', { class: 'help' }, t('round.deleteWarning')), h('div', { class: 'actions' }, remove));
}
