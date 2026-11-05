/** Würfelwichteln on one device at the table: setup, die, rule table, direction and timer. */
import { checkTime, DEFAULT_MINUTES, isWuerfelState, MAX_MINUTES, MAX_RULE_CHARS, nextPlayer, parseRule, passTurn, reverse, roll, startWuerfel, timeLeft, toggleTimer, type DrinkRule, type WuerfelState } from '../games/wuerfel.ts';
import { t } from '../i18n/i18n.ts';
import { createCryptoRng } from '../random/rng.ts';
import { loadGame } from '../store/games.ts';
import { byId, checkbox, disclosure, errorBox, field, fill, h, showErrors, showView } from './dom.ts';
import { orderField, parsePlayers, runGame, type GameScreen } from './game.ts';

const FACES = [1, 2, 3, 4, 5, 6] as const;

/** The stored game, if one is running on this device. */
export function loadWuerfel(): Promise<WuerfelState | undefined> {
  return loadGame('wuerfelwichteln', isWuerfelState);
}

/** Shows the setup: names, order, timer, sound, the rule table and the optional drinking rule. */
export function showWuerfelSetup(): void {
  const names = h('textarea', { rows: '8', autocomplete: 'off', spellcheck: 'false' });
  const order = orderField();
  const minutes = h('input', { type: 'number', min: '1', max: String(MAX_MINUTES), step: '1', inputmode: 'numeric', value: String(DEFAULT_MINUTES) });
  const rules = FACES.map((f) => h('input', { type: 'text', autocomplete: 'off', maxlength: String(MAX_RULE_CHARS), value: t(`wuerfel.rule.${f}`) }));
  const drinkFace = h('select', {}, ...FACES.map((f) => h('option', { value: String(f) }, String(f))));
  const drinkText = h('input', { type: 'text', autocomplete: 'off', maxlength: String(MAX_RULE_CHARS), value: t('wuerfel.drinkDefault') });
  const drinkFields = h('div', { class: 'stack', hidden: true }, field(t('wuerfel.drinkFace'), drinkFace), field(t('wuerfel.drinkText'), drinkText));
  let sound = true;
  let drink = false;
  const errors = errorBox();
  const start = h('button', { type: 'submit', class: 'btn btn--ink' }, t('game.start'));
  const back = h('button', { type: 'button', class: 'btn btn--card' }, t('wizard.back'));
  back.addEventListener('click', () => showView('home'));
  const table = h('div', { class: 'stack' }, h('p', { class: 'help' }, t('wuerfel.rulesHelp')), ...rules.map((input, i) => field(t('wuerfel.ruleFor', { face: i + 1 }), input)));
  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    field(t('wizard.who.names'), names, t('game.namesHelp')),
    order.element,
    field(t('wuerfel.minutes'), minutes, t('wuerfel.minutesHelp')),
    checkbox(t('wuerfel.sound'), t('wuerfel.soundHelp'), true, (v) => (sound = v)),
    disclosure(t('wuerfel.rules'), t('wuerfel.rulesHint'), table),
    checkbox(t('wuerfel.drink'), t('wuerfel.drinkHelp'), false, (v) => {
      drink = v;
      drinkFields.hidden = !v;
    }),
    drinkFields,
    errors,
    h('div', { class: 'actions' }, start, back),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const players = parsePlayers(names.value);
    if (!players.ok) return showErrors(errors, players.messages);
    const mins = Number(minutes.value);
    if (!Number.isInteger(mins) || mins < 1 || mins > MAX_MINUTES) return showErrors(errors, [t('wuerfel.minutesInvalid', { max: MAX_MINUTES })]);
    const lines = rules.map((r) => parseRule(r.value));
    const drinkLine = drink ? parseRule(drinkText.value) : '';
    if (lines.some((l) => l === null) || drinkLine === null) return showErrors(errors, [t('wuerfel.ruleInvalid', { max: MAX_RULE_CHARS })]);
    const drinkRule: DrinkRule | null = drink ? { face: Number(drinkFace.value), text: drinkLine } : null;
    // Sound may only start after a tap, so the audio is prepared here.
    if (sound) prepareAudio();
    play(startWuerfel({ players: players.players, random: order.random(), rules: lines as string[], drink: drinkRule, minutes: mins, sound }, createCryptoRng(), Date.now()));
  });
  fill(byId('game'), h('div', { class: 'container narrow stack' }, h('h1', { class: 'step-title' }, t('wuerfel.title')), h('p', { class: 'lead' }, t('wuerfel.intro')), form));
  showView('game');
}

let audio: AudioContext | null = null;
/** Creates the audio context during a tap; browsers block sound that starts without one. */
export function prepareAudio(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = null;
  }
}

/** Three short beeps made with Web Audio, and a vibration where the device has one. */
function alarm(withSound: boolean): void {
  navigator.vibrate?.([400, 150, 400, 150, 400]);
  if (!withSound || !audio) return;
  for (let i = 0; i < 3; i++) {
    const at = audio.currentTime + i * 0.35;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
    tone.connect(gain).connect(audio.destination);
    tone.start(at);
    tone.stop(at + 0.3);
  }
}

function clock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

let stopTicking = () => {};

/** Plays from `state` on, with a ticking timer and the screen kept on while it runs. */
export function play(state: WuerfelState): void {
  stopTicking();
  let current = state;
  let lock: WakeLockSentinel | null = null;
  const keepAwake = async (on: boolean) => {
    try {
      if (on && !lock && document.visibilityState === 'visible') {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
        // The browser drops the lock when the tab is hidden; forget it so it is asked for again on return.
        lock?.addEventListener('release', () => (lock = null));
      }
      if (!on && lock) {
        await lock.release();
        lock = null;
      }
    } catch {
      lock = null;
    }
  };
  const onVisible = () => void keepAwake(current.endsAt !== null && !current.over && document.getElementById('game-clock') !== null);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => {
    // The game view is gone (back on the start page): stop ticking and let the screen sleep.
    if (byId('game').hidden) return stopTicking();
    const shown = document.getElementById('game-clock');
    const next = checkTime(current, Date.now());
    if (next !== current) {
      alarm(current.sound);
      go(next);
    } else if (shown && current.endsAt !== null) shown.textContent = t('wuerfel.timeLeft', { time: clock(timeLeft(current, Date.now())) });
  }, 500);
  stopTicking = () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    void keepAwake(false);
  };
  const go = runGame(checkTime(state, Date.now()), view, (s) => {
    current = s;
    void keepAwake(s.endsAt !== null && !s.over);
  });
}

function view(state: WuerfelState, go: (next: WuerfelState) => void): GameScreen {
  const table = h('ol', { class: 'die-rules' }, ...state.rules.map((r) => h('li', {}, r)));
  const rulesBox = disclosure(t('wuerfel.rules'), t('wuerfel.rulesShown'), h('div', { class: 'stack' }, table, state.drink ? h('p', {}, t('wuerfel.drinkLine', { face: state.drink.face, text: state.drink.text })) : null));
  if (state.over) return { title: t('wuerfel.over'), over: true, body: [h('p', { class: 'lead' }, t('wuerfel.overHelp'))] };

  const name = state.players[state.current]!;
  const running = state.endsAt !== null;
  const pause = h('button', { type: 'button', class: 'btn btn--card' }, t(running ? 'wuerfel.pause' : 'wuerfel.resume'));
  pause.addEventListener('click', () => go(toggleTimer(state, Date.now())));
  const time = h('p', { id: 'game-clock', class: 'fig game-clock', role: 'timer' }, t(running ? 'wuerfel.timeLeft' : 'wuerfel.paused', { time: clock(timeLeft(state, Date.now())) }));
  const direction = h('button', { type: 'button', class: 'btn btn--card' }, t('wuerfel.reverse'));
  direction.addEventListener('click', () => go(reverse(state)));
  const directionLine = h('p', { class: 'muted small' }, t(state.clockwise ? 'wuerfel.clockwise' : 'wuerfel.counterclockwise'));

  let turn: (Node | null)[];
  if (state.rolled === null) {
    const button = h('button', { type: 'button', class: 'btn btn--ink btn--big' }, t('wuerfel.roll'));
    button.addEventListener('click', () => go(roll(state, createCryptoRng())));
    turn = [h('div', { class: 'actions' }, button)];
  } else {
    const face = state.rolled;
    const next = h('button', { type: 'button', class: 'btn btn--ink' }, t('wuerfel.next', { name: state.players[nextPlayer(state)]! }));
    next.addEventListener('click', () => go(passTurn(state)));
    turn = [
      h('p', { class: 'die-face fig', 'aria-label': t('wuerfel.rolledLabel', { face }) }, String(face)),
      h('p', { class: 'lead die-rule' }, state.rules[face - 1]!),
      state.drink?.face === face ? h('p', { class: 'notice' }, state.drink.text) : null,
      h('div', { class: 'actions' }, next),
    ];
  }
  return {
    title: t('game.turn', { name }),
    over: false,
    body: [h('div', { class: 'actions' }, time, pause), ...turn, directionLine, h('div', { class: 'actions' }, direction), rulesBox],
  };
}
