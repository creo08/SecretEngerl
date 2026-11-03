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
  const view = byId('round');
  const render = (i: number) => {
    const [giver, receiver] = order[i]!;
    const last = i === order.length - 1;
    const next = h('button', { type: 'button', class: 'btn btn--ink' }, t(last ? 'stage.done' : 'stage.next'));
    next.addEventListener('click', () => (last ? back() : render(i + 1)));
    const end = h('button', { type: 'button', class: 'btn btn--card' }, t('stage.end'));
    end.addEventListener('click', back);
    const heading = h('h1', { class: 'stage-pair', tabindex: '-1' }, h('span', { class: 'stage-name' }, giver), h('span', { class: 'stage-verb' }, t('stage.gives')), h('span', { class: 'stage-name' }, receiver));
    fill(view, h('div', { class: 'container narrow stage' }, h('p', { class: 'muted fig' }, t('stage.counter', { n: i + 1, count: order.length })), heading, h('div', { class: 'actions stage-actions' }, next, end)));
    heading.focus();
  };
  showView('round');
  render(0);
}
