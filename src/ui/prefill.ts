/**
 * Confirmation page for a pre-fill link. Nothing is drawn here: the organizer
 * checks the details and continues into the wizard, where everything stays editable.
 */
import { formatBudget, formatDate } from '../i18n/format.ts';
import { t } from '../i18n/i18n.ts';
import { parsePrefill } from '../input/prefill.ts';
import { getTemplate } from '../config/templates.ts';
import { byId, fill, h, showView } from './dom.ts';
import { errorMessages, householdLabel } from './text.ts';
import { startWizard } from './wizard.ts';
import { wireTemplateLinks } from './home.ts';

/** Shows what a pre-fill fragment would set up, or why it cannot be used. */
export function showPrefill(fragment: string): void {
  const result = parsePrefill(fragment);
  const home = h('a', { href: import.meta.env.BASE_URL, class: 'link' }, t('prefill.home'));
  const content = h('div', { class: 'container narrow stack' }, h('h1', {}, t('prefill.title')));
  if (!result.ok) {
    content.append(h('p', { class: 'lead' }, t('prefill.failed')), h('ul', { class: 'errors' }, ...errorMessages(result.errors).map((m) => h('li', {}, m))), h('p', {}, home));
  } else {
    const p = result.value;
    const withBudget = getTemplate(p.template).fields.budget && p.budget !== undefined;
    const rows: [string, Node | string][] = [
      [t('prefill.template'), t(`template.${p.template}`)],
      [t('prefill.people'), h('ul', { class: 'households' }, ...p.households.map((g) => h('li', {}, householdLabel(g))))],
    ];
    if (withBudget) rows.push([t('prefill.budget'), formatBudget(p.budget!)]);
    if (p.date) rows.push([t('prefill.date'), formatDate(p.date)]);
    const accept = h('button', { type: 'button', class: 'btn btn--ink' }, t('prefill.accept'));
    accept.addEventListener('click', () => {
      // From here on this is the app at its own address: a reload shows the start page, not this link.
      history.replaceState(null, '', import.meta.env.BASE_URL);
      wireTemplateLinks();
      startWizard(p.template, {
        namesText: p.households.map((g) => g.join('\n')).join('\n\n'),
        ...(withBudget ? { budget: String(p.budget) } : {}),
        ...(p.date ? { date: p.date } : {}),
      });
    });
    const discard = h('a', { href: import.meta.env.BASE_URL, class: 'btn btn--card' }, t('prefill.discard'));
    content.append(
      h('p', { class: 'lead' }, t('prefill.intro')),
      h('dl', { class: 'facts' }, ...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
      h('div', { class: 'actions' }, accept, discard),
    );
  }
  fill(byId('wizard'), content);
  showView('wizard');
}
