/** Räuberwichteln on one device at the table: setup, turns, final swap and the end. */
import { canSteal, DEFAULT_LOCK_AFTER, finalSwap, isRaeuberState, MAX_LABEL_CHARS, parseLabel, startRaeuber, steal, unwrap, wrappedCount, type RaeuberState } from '../games/raeuber.ts';
import { t } from '../i18n/i18n.ts';
import { createCryptoRng } from '../random/rng.ts';
import { loadGame } from '../store/games.ts';
import { byId, checkbox, errorBox, field, fill, h, showErrors, showView } from './dom.ts';
import { orderField, parsePlayers, runGame, type GameScreen } from './game.ts';

/** The stored game, if one is running on this device. */
export function loadRaeuber(): Promise<RaeuberState | undefined> {
  return loadGame('raeuberwichteln', isRaeuberState);
}

/** Shows the setup: names, turn order, lock and final swap. */
export function showRaeuberSetup(): void {
  const names = h('textarea', { rows: '8', autocomplete: 'off', spellcheck: 'false' });
  const lock = h('input', { type: 'number', min: '1', max: '9', step: '1', inputmode: 'numeric', value: String(DEFAULT_LOCK_AFTER) });
  const order = orderField();
  let swapAtEnd = false;
  const errors = errorBox();
  const start = h('button', { type: 'submit', class: 'btn btn--ink' }, t('game.start'));
  const back = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.back'));
  back.addEventListener('click', () => showView('home'));
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    field(t('wizard.who.names'), names, t('game.namesHelp')),
    order.element,
    field(t('raeuber.lockAfter'), lock, t('raeuber.lockAfterHelp')),
    checkbox(t('raeuber.finalSwap'), t('raeuber.finalSwapHelp'), false, (v) => (swapAtEnd = v)),
    errors,
    h('div', { class: 'actions' }, start, back),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const players = parsePlayers(names.value);
    if (!players.ok) return showErrors(errors, players.messages);
    const lockAfter = Number(lock.value);
    if (!Number.isInteger(lockAfter) || lockAfter < 1 || lockAfter > 9) return showErrors(errors, [t('raeuber.lockInvalid')]);
    play(startRaeuber({ players: players.players, random: order.random(), lockAfter, finalSwap: swapAtEnd }, createCryptoRng(), Date.now()));
  });
  fill(byId('game'), h('div', { class: 'container narrow stack' }, h('h1', { class: 'step-title' }, t('raeuber.title')), h('p', { class: 'lead' }, t('raeuber.intro')), form));
  showView('game');
}

/** Plays from `state` on. */
export function play(state: RaeuberState): void {
  runGame(state, view);
}

function giftLine(gift: RaeuberState['gifts'][number]): string {
  return gift.label ? t('raeuber.giftLabelled', { n: gift.number, label: gift.label }) : t('raeuber.gift', { n: gift.number });
}

function giftList(state: RaeuberState, action: string, onPick: (n: number) => void): HTMLElement {
  return h(
    'ul',
    { class: 'round-list' },
    ...state.gifts.map((gift) => {
      const status = gift.steals >= state.lockAfter ? t('raeuber.locked') : t('raeuber.steals', { n: gift.steals, max: state.lockAfter });
      const button = canSteal(state, gift) ? h('button', { type: 'button', class: 'btn btn--card' }, action) : null;
      button?.addEventListener('click', () => onPick(gift.number));
      return h('li', {}, h('span', { class: 'round-item' }, h('span', {}, giftLine(gift)), h('span', { class: 'muted small' }, `${t('raeuber.holder', { name: state.players[gift.holder]! })}, ${status}`)), button);
    }),
  );
}

function view(state: RaeuberState, go: (next: RaeuberState) => void): GameScreen {
  if (state.phase === 'play') {
    const name = state.players[state.current!]!;
    const label = h('input', { type: 'text', autocomplete: 'off', maxlength: String(MAX_LABEL_CHARS) });
    const errors = errorBox();
    const open = h('button', { type: 'submit', class: 'btn btn--ink' }, t('raeuber.unwrap'));
    const form = h('form', { class: 'stack', novalidate: true }, field(t('raeuber.label'), label, t('raeuber.labelHelp')), errors, h('div', { class: 'actions' }, open));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = parseLabel(label.value);
      if (value === null) return showErrors(errors, [t('raeuber.labelTooLong', { max: MAX_LABEL_CHARS })]);
      go(unwrap(state, value));
    });
    return {
      title: t('game.turn', { name }),
      over: false,
      body: [
        h('p', { class: 'muted fig' }, t('raeuber.wrapped', { count: wrappedCount(state) })),
        state.blocked !== null ? h('p', { class: 'notice' }, t('raeuber.robbed', { name, n: state.blocked })) : null,
        h('p', {}, t('raeuber.choice')),
        form,
        state.gifts.length ? h('h2', { class: 'panel-title' }, t('raeuber.unwrapped')) : null,
        state.gifts.length ? giftList(state, t('raeuber.steal'), (n) => go(steal(state, n))) : null,
        state.nextTurn < state.players.length ? h('p', { class: 'muted small' }, t('raeuber.next', { name: state.players[state.nextTurn]! })) : null,
      ],
    };
  }
  if (state.phase === 'finalSwap') {
    const keep = h('button', { type: 'button', class: 'btn btn--ink' }, t('raeuber.keep'));
    keep.addEventListener('click', () => go(finalSwap(state, null)));
    return {
      title: t('raeuber.finalTurn', { name: state.players[0]! }),
      over: false,
      body: [h('p', {}, t('raeuber.finalHelp')), giftList(state, t('raeuber.swap'), (n) => go(finalSwap(state, n))), h('div', { class: 'actions' }, keep)],
    };
  }
  const byPlayer = state.players.map((name, i) => {
    const gift = state.gifts.find((g) => g.holder === i)!;
    return h('li', {}, h('span', { class: 'round-item' }, h('span', {}, name), h('span', { class: 'muted small' }, giftLine(gift))));
  });
  return { title: t('raeuber.done'), over: true, body: [h('ul', { class: 'round-list' }, ...byPlayer)] };
}
