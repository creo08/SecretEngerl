/** Räuberwichteln on one device at the table: setup, turns, final swap and the end. */
import { canSteal, DEFAULT_LOCK_AFTER, finalSwap, isRaeuberState, MAX_LABEL_CHARS, parseLabel, startRaeuber, steal, unwrap, wrappedCount, type RaeuberState } from '../games/raeuber.ts';
import { t } from '../i18n/i18n.ts';
import { parseNameList } from '../input/validate.ts';
import { createCryptoRng } from '../random/rng.ts';
import { deleteGame, loadGame, saveGame } from '../store/games.ts';
import { byId, checkbox, confirmDialog, errorBox, field, fill, h, showErrors, showView, uid } from './dom.ts';
import { errorMessages } from './text.ts';

const KIND = 'raeuberwichteln';

/** The stored game, if one is running on this device. */
export function loadRaeuber(): Promise<RaeuberState | undefined> {
  return loadGame(KIND, isRaeuberState);
}

/** Shows the setup: names, turn order, lock and final swap. */
export function showRaeuberSetup(): void {
  const names = h('textarea', { rows: '8', autocomplete: 'off', spellcheck: 'false' });
  const lock = h('input', { type: 'number', min: '1', max: '9', step: '1', inputmode: 'numeric', value: String(DEFAULT_LOCK_AFTER) });
  const order = uid('order');
  const radio = (value: string, label: string, checked: boolean) => {
    const input = h('input', { type: 'radio', name: order, value, id: uid('r'), checked });
    return h('div', { class: 'check' }, input, h('label', { for: input.id }, label));
  };
  let swapAtEnd = false;
  const errors = errorBox();
  const start = h('button', { type: 'submit', class: 'btn btn--ink' }, t('game.start'));
  const back = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.back'));
  back.addEventListener('click', () => showView('home'));
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    field(t('wizard.who.names'), names, t('game.namesHelp')),
    h('fieldset', { class: 'stack' }, h('legend', {}, t('game.order')), radio('random', t('game.orderRandom'), true), radio('typed', t('game.orderTyped'), false)),
    field(t('raeuber.lockAfter'), lock, t('raeuber.lockAfterHelp')),
    checkbox(t('raeuber.finalSwap'), t('raeuber.finalSwapHelp'), false, (v) => (swapAtEnd = v)),
    errors,
    h('div', { class: 'actions' }, start, back),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const parsed = parseNameList(names.value);
    if (!parsed.ok) return showErrors(errors, errorMessages(parsed.errors));
    const players = parsed.value.flat();
    if (players.length < 2) return showErrors(errors, [t('error.people.tooFew')]);
    const lockAfter = Number(lock.value);
    if (!Number.isInteger(lockAfter) || lockAfter < 1 || lockAfter > 9) return showErrors(errors, [t('raeuber.lockInvalid')]);
    const random = form.querySelector<HTMLInputElement>(`input[name="${order}"]:checked`)?.value !== 'typed';
    void play(startRaeuber({ players, random, lockAfter, finalSwap: swapAtEnd }, createCryptoRng(), Date.now()));
  });
  fill(byId('game'), h('div', { class: 'container narrow stack' }, h('h1', { class: 'step-title' }, t('raeuber.title')), h('p', { class: 'lead' }, t('raeuber.intro')), form));
  showView('game');
}

/** Plays from `state` on; every move is stored so a reload does not end the game. */
export function play(state: RaeuberState): void {
  const history: RaeuberState[] = [];
  // Saves run one after another, so an older state never overwrites a newer one.
  let saving = Promise.resolve();
  const persist = () => {
    const snapshot = state;
    saving = saving.then(() => saveGame(snapshot)).catch(() => undefined);
  };
  const go = (next: RaeuberState) => {
    if (next === state) return;
    history.push(state);
    state = next;
    render();
    persist();
  };
  const undo = h('button', { type: 'button', class: 'btn btn--card' }, t('game.undo'));
  undo.addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    state = previous;
    render();
    persist();
  });
  const end = h('button', { type: 'button', class: 'btn btn--text' }, t('game.end'));
  end.addEventListener('click', async () => {
    if (state.phase !== 'done' && !(await confirmDialog(t('game.endWarning'), t('game.end'), t('round.cancel')))) return;
    await saving;
    await deleteGame(KIND);
    const { showHome } = await import('./home.ts');
    await showHome(t('game.ended'));
  });

  const giftLine = (gift: RaeuberState['gifts'][number]) => (gift.label ? t('raeuber.giftLabelled', { n: gift.number, label: gift.label }) : t('raeuber.gift', { n: gift.number }));
  const giftList = (action: string, onPick: (n: number) => void) =>
    h(
      'ul',
      { class: 'round-list' },
      ...state.gifts.map((gift) => {
        const locked = gift.steals >= state.lockAfter;
        const status = locked ? t('raeuber.locked') : t('raeuber.steals', { n: gift.steals, max: state.lockAfter });
        const button = canSteal(state, gift) ? h('button', { type: 'button', class: 'btn btn--card' }, action) : null;
        button?.addEventListener('click', () => onPick(gift.number));
        return h('li', {}, h('span', { class: 'round-item' }, h('span', {}, giftLine(gift)), h('span', { class: 'muted small' }, `${t('raeuber.holder', { name: state.players[gift.holder]! })}, ${status}`)), button);
      }),
    );

  const render = () => {
    undo.disabled = history.length === 0;
    end.className = state.phase === 'done' ? 'btn btn--ink' : 'btn btn--text';
    const heading = h('h1', { class: 'step-title game-turn', tabindex: '-1' });
    const body: (Node | null)[] = [];
    if (state.phase === 'play') {
      const name = state.players[state.current!]!;
      heading.textContent = t('raeuber.turn', { name });
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
      body.push(
        h('p', { class: 'muted fig' }, t('raeuber.wrapped', { count: wrappedCount(state) })),
        state.blocked !== null ? h('p', { class: 'notice' }, t('raeuber.robbed', { name, n: state.blocked })) : null,
        h('p', {}, t('raeuber.choice')),
        form,
        state.gifts.length ? h('h2', { class: 'panel-title' }, t('raeuber.unwrapped')) : null,
        state.gifts.length ? giftList(t('raeuber.steal'), (n) => go(steal(state, n))) : null,
        state.nextTurn < state.players.length ? h('p', { class: 'muted small' }, t('raeuber.next', { name: state.players[state.nextTurn]! })) : null,
      );
    } else if (state.phase === 'finalSwap') {
      heading.textContent = t('raeuber.finalTurn', { name: state.players[0]! });
      const keep = h('button', { type: 'button', class: 'btn btn--ink' }, t('raeuber.keep'));
      keep.addEventListener('click', () => go(finalSwap(state, null)));
      body.push(h('p', {}, t('raeuber.finalHelp')), giftList(t('raeuber.swap'), (n) => go(finalSwap(state, n))), h('div', { class: 'actions' }, keep));
    } else {
      heading.textContent = t('raeuber.done');
      const byPlayer = state.players.map((name, i) => {
        const gift = state.gifts.find((g) => g.holder === i)!;
        return h('li', {}, h('span', { class: 'round-item' }, h('span', {}, name), h('span', { class: 'muted small' }, giftLine(gift))));
      });
      body.push(h('ul', { class: 'round-list' }, ...byPlayer));
    }
    // A double tap at the table must not play the next person's turn too: the new screen takes taps a moment later.
    const screen = h('div', { class: 'container narrow stack settling' }, heading, ...body, h('div', { class: 'actions game-actions' }, state.phase === 'done' ? null : undo, end));
    fill(byId('game'), screen);
    setTimeout(() => screen.classList.remove('settling'), 400);
    heading.focus();
  };
  persist();
  showView('game');
  render();
}
