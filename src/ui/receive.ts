/**
 * The receiving side: the fragment is already out of the address bar; the
 * draw is decrypted only after a tap, shown as text and never stored.
 */
import { adventSundays, calendarFile } from '../ics/ics.ts';
import { formatDate } from '../i18n/format.ts';
import { hasText, t } from '../i18n/i18n.ts';
import { toBase64Url } from '../link/base64url.ts';
import { readFragment } from '../link/link.ts';
import type { Payload } from '../link/payload.ts';
import { byId, downloadFile, fill, h, showView } from './dom.ts';
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
  const weeks = p.t === 'advent-engerl' ? p.m.split('|') : [];
  if (weeks.length > 1) weeks.forEach((theme, i) => theme && rows.push([t('los.week', { n: i + 1 }), theme]));
  else if (p.m) rows.push([t('los.theme'), p.m]);
  if (hasText(`rule.${p.t}`)) rows.push([t('los.rule'), t(`rule.${p.t}`, { date: formatDate(p.d) })]);
  if (p.a) rows.push([t('los.address'), p.a]);
  if (p.h) rows.push([t('los.hint'), p.h]);
  const calendar = h('button', { type: 'button', class: 'btn btn--card' }, icon('calendarPlus'), t('los.calendar'));
  calendar.addEventListener('click', () => downloadEvents(p));
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

/** The exchange day, and for the Advent-Engerl one event per Advent week; never the Bengerl's name. */
function downloadEvents(p: Payload): void {
  const uid = toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const themes = p.t === 'advent-engerl' ? p.m.split('|') : [];
  const weeks = p.t === 'advent-engerl' ? adventSundays(p.d).map((date, i) => ({ date, summary: themes[i] ? t('ics.weekTheme', { n: i + 1, theme: themes[i]! }) : t('ics.week', { n: i + 1 }) })) : [];
  downloadFile(t('ics.fileName'), calendarFile([...weeks, { date: p.d, summary: t('ics.summary') }], uid, new Date()), 'text/calendar');
}
