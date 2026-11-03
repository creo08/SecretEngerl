/**
 * The receiving side: the fragment is already out of the address bar; the
 * draw is decrypted only after a tap, shown as text and never stored.
 */
import { exchangeEvent } from '../ics/ics.ts';
import { formatDate } from '../i18n/format.ts';
import { t } from '../i18n/i18n.ts';
import { toBase64Url } from '../link/base64url.ts';
import { readFragment } from '../link/link.ts';
import type { Payload } from '../link/payload.ts';
import { byId, fill, h, showView } from './dom.ts';
import { icon } from './icons.ts';

/** Shows the receiving view for a fragment taken from the address bar. */
export function showReceiver(fragment: string): void {
  const view = byId('los');
  const home = h('a', { href: import.meta.env.BASE_URL, class: 'link' }, t('los.home'));
  const reveal = h('button', { type: 'button', class: 'btn btn--ink slip-reveal' }, t('los.reveal'));
  fill(view, h('div', { class: 'container narrow' }, h('h1', { class: 'visually-hidden' }, t('los.title')), h('div', { class: 'slip stock slip--folded' }, reveal), h('p', { class: 'muted' }, home)));
  showView('los');
  reveal.focus();
  reveal.addEventListener('click', async () => {
    const reading = await readFragment(fragment, Date.now());
    const body = h('div', { class: 'container narrow' });
    if (reading.status === 'ok') body.append(revealed(reading.payload));
    else body.append(h('h1', {}, t(reading.status === 'expired' ? 'los.expired' : reading.status === 'empty' ? 'los.empty' : 'los.invalid')));
    if (reading.status === 'invalid') body.append(h('p', { class: 'lead' }, t('los.invalidHelp')));
    body.append(h('p', { class: 'muted' }, home));
    fill(view, body);
    view.querySelector<HTMLElement>('h1')?.setAttribute('tabindex', '-1');
    view.querySelector<HTMLElement>('h1')?.focus();
  });
}

function revealed(p: Payload): HTMLElement {
  const rows: [string, string][] = [
    [t('los.budget'), p.b || t('los.noBudget')],
    [t('los.date'), formatDate(p.d)],
  ];
  if (p.m) rows.push([t('los.theme'), p.m]);
  if (p.t === 'schrottwichteln') rows.push([t('los.rule'), t('rule.schrottwichteln')]);
  if (p.h) rows.push([t('los.hint'), p.h]);
  const calendar = h('button', { type: 'button', class: 'btn btn--card' }, icon('calendarPlus'), t('los.calendar'));
  calendar.addEventListener('click', () => downloadEvent(p.d));
  return h(
    'article',
    { class: 'slip stock' },
    h('p', { class: 'slip-label' }, t('los.youAre')),
    h('h1', { class: 'slip-name' }, p.r),
    h('dl', { class: 'facts' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', { class: 'prewrap' }, v)])),
    h('p', { class: 'slip-number fig' }, t('los.drawNumber', { n: p.n })),
    h('div', { class: 'actions' }, calendar),
    h('p', { class: 'muted small' }, t('los.note')),
  );
}

function downloadEvent(date: string): void {
  const uid = toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const url = URL.createObjectURL(new Blob([exchangeEvent(date, uid, new Date())], { type: 'text/calendar' }));
  const a = h('a', { href: url, download: t('ics.fileName') });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
