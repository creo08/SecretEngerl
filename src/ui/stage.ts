/** The stage reveal: one pair at a time on the organizer's device, following the chain. */
import { t } from '../i18n/i18n.ts';
import { revealOrder } from '../losfee/reveal.ts';
import { createCryptoRng } from '../random/rng.ts';
import { indexedDbStore as store } from '../store/db.ts';
import { loadRound, readAssignment } from '../store/rounds.ts';
import { byId, fill, h, showView } from './dom.ts';

/** Shows the pairs of a round one by one; "Beenden" goes back to the round. `back` reopens the round view. */
export async function showStage(roundId: string, back: () => void): Promise<void> {
  const order = revealOrder(await readAssignment(await loadRound(store, roundId)), createCryptoRng());
  showPairs('round', order, t('stage.done'), back, back);
}

/**
 * Shows `order` one pair at a time in the view `viewId`. The last button reads `lastLabel`
 * and calls `done`; "Beenden" calls `end` at any time.
 */
export function showPairs(viewId: string, order: [string, string][], lastLabel: string, done: () => void, end: () => void): void {
  const view = byId(viewId);
  const render = (i: number) => {
    const [giver, receiver] = order[i]!;
    const last = i === order.length - 1;
    const next = h('button', { type: 'button', class: 'btn btn--ink' }, last ? lastLabel : t('stage.next'));
    next.addEventListener('click', () => (last ? done() : render(i + 1)));
    const stop = h('button', { type: 'button', class: 'btn btn--card' }, t('stage.end'));
    stop.addEventListener('click', end);
    const heading = h('h1', { class: 'stage-pair', tabindex: '-1' }, h('span', { class: 'stage-name' }, giver), h('span', { class: 'stage-verb' }, t('stage.gives')), h('span', { class: 'stage-name' }, receiver));
    fill(view, h('div', { class: 'container narrow stage' }, h('p', { class: 'muted fig' }, t('stage.counter', { n: i + 1, count: order.length })), heading, h('div', { class: 'actions stage-actions' }, next, stop)));
    heading.focus();
  };
  showView(viewId);
  render(0);
}
