/** What every party game screen shares: names and order in the setup, and undo, saving and ending while playing. */
import { t } from '../i18n/i18n.ts';
import { parseNameList } from '../input/validate.ts';
import { deleteGame, saveGame, type StoredGame } from '../store/games.ts';
import { byId, confirmDialog, fill, h, showView, uid } from './dom.ts';
import { errorMessages } from './text.ts';

/** The turn order choice: random or as typed. */
export function orderField(): { element: HTMLElement; random: () => boolean } {
  const name = uid('order');
  const radio = (value: string, label: string, checked: boolean) => {
    const input = h('input', { type: 'radio', name, value, id: uid('r'), checked });
    return h('div', { class: 'check' }, input, h('label', { for: input.id }, label));
  };
  const element = h('fieldset', { class: 'stack' }, h('legend', {}, t('game.order')), radio('random', t('game.orderRandom'), true), radio('typed', t('game.orderTyped'), false));
  return { element, random: () => element.querySelector<HTMLInputElement>('input:checked')?.value !== 'typed' };
}

/** Players from the name list, blank lines ignored; error messages if the list is not usable. */
export function parsePlayers(text: string): { ok: true; players: string[] } | { ok: false; messages: string[] } {
  const parsed = parseNameList(text);
  if (!parsed.ok) return { ok: false, messages: errorMessages(parsed.errors) };
  const players = parsed.value.flat();
  return players.length < 2 ? { ok: false, messages: [t('error.people.tooFew')] } : { ok: true, players };
}

/** One screen of a game: its heading text, its content, and whether the game is over. */
export interface GameScreen {
  title: string;
  body: (Node | null)[];
  over: boolean;
}

/**
 * Runs a game from `initial` on: `view` draws a state, `go` moves to the next one.
 * Every move is saved in order, so a reload does not end the game; undo works until a reload.
 * Returns `go`, so outside events such as a timer can move the game too.
 */
export function runGame<S extends StoredGame>(initial: S, view: (state: S, go: (next: S) => void) => GameScreen, onRender?: (state: S) => void): (next: S) => void {
  let state = initial;
  const history: S[] = [];
  // Saves run one after another, so an older state never overwrites a newer one.
  let saving = Promise.resolve();
  const persist = () => {
    const snapshot = state;
    saving = saving.then(() => saveGame(snapshot)).catch(() => undefined);
  };
  const undo = h('button', { type: 'button', class: 'btn btn--card' }, t('game.undo'));
  const end = h('button', { type: 'button', class: 'btn btn--text' }, t('game.end'));
  let over = false;

  const render = () => {
    const screen = view(state, go);
    over = screen.over;
    undo.disabled = history.length === 0;
    end.className = over ? 'btn btn--ink' : 'btn btn--text';
    const heading = h('h1', { class: 'step-title game-turn', tabindex: '-1' }, screen.title);
    // A double tap at the table must not play the next person's turn too: the new screen takes taps a moment later.
    const box = h('div', { class: 'container narrow stack settling' }, heading, ...screen.body, h('div', { class: 'actions game-actions' }, over ? null : undo, end));
    fill(byId('game'), box);
    setTimeout(() => box.classList.remove('settling'), 400);
    heading.focus();
    onRender?.(state);
  };
  function go(next: S): void {
    if (next === state) return;
    history.push(state);
    state = next;
    render();
    persist();
  }
  undo.addEventListener('click', () => {
    const previous = history.pop();
    if (!previous) return;
    state = previous;
    render();
    persist();
  });
  end.addEventListener('click', async () => {
    if (!over && !(await confirmDialog(t('game.endWarning'), t('game.end'), t('round.cancel')))) return;
    await saving;
    await deleteGame(state.kind);
    const { showHome } = await import('./home.ts');
    await showHome(t('game.ended'));
  });
  persist();
  showView('game');
  render();
  return go;
}
