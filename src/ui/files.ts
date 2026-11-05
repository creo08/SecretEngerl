/** Opening files on the start page. Files are untrusted input and are checked like any other. */
import { MAX_FILE_BYTES, openFile } from '../files/envelope.ts';
import { yearFromFileContent } from '../files/year.ts';
import { mergeForRestore, roundFromBackup } from '../files/backup.ts';
import { indexedDbStore as store } from '../store/db.ts';
import { showRound } from './round.ts';
import { t } from '../i18n/i18n.ts';
import { confirmDialog, disclosure, fill, h, uid } from './dom.ts';
import { appBase, startWizardFromYear } from './wizard.ts';

/** "Datei öffnen": picks a .wichtel file (yearly file or backup), asks for its password if needed, and continues with its content. */
export function fileOpener(): HTMLElement {
  const file = h('input', { type: 'file', id: uid('f'), accept: '.wichtel,application/json' });
  const password = h('input', { type: 'password', id: uid('f'), autocomplete: 'current-password' });
  const passwordField = h('div', { class: 'field' }, h('label', { for: password.id }, t('file.password')), password);
  passwordField.hidden = true;
  const status = h('p', { class: 'status', role: 'status' });
  const open = h('button', { type: 'button', class: 'btn btn--card' }, t('file.open'));
  open.addEventListener('click', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return void (status.textContent = t('file.choose'));
    if (chosen.size > MAX_FILE_BYTES) return void (status.textContent = t('file.invalid'));
    const opened = await openFile(await chosen.text(), password.value);
    if (opened.status === 'password' || opened.status === 'wrongPassword') {
      passwordField.hidden = false;
      password.focus();
      return void (status.textContent = t(opened.status === 'password' ? 'file.needsPassword' : 'file.wrongPassword'));
    }
    if (opened.status === 'invalid') return void (status.textContent = t('file.invalid'));
    if (opened.format === 'secretengerl-year') {
      const year = await yearFromFileContent(opened.content);
      if (!year.ok) return void (status.textContent = t('file.invalid'));
      return startWizardFromYear(year.value);
    }
    const round = roundFromBackup(opened.content, appBase());
    if (!round) return void (status.textContent = t('file.invalid'));
    if (Date.now() > round.expiresAt * 1000) return void (status.textContent = t('backup.expired'));
    const existing = await store.get(round.id).catch(() => undefined);
    if (existing && !(await confirmDialog(t('backup.replace', { here: existing.drawNumber, file: round.drawNumber }), t('backup.replaceConfirm'), t('round.cancel')))) return;
    await store.put(mergeForRestore(round, existing));
    await showRound(round.id, { message: t('backup.restored') });
  });
  return disclosure(
    t('file.title'),
    t('file.titleHint'),
    h('div', { class: 'stack' }, h('div', { class: 'field' }, h('label', { for: file.id }, t('file.label')), file), passwordField, h('div', { class: 'actions' }, open), status),
  );
}

/** Replaces the children of `el` with the opener, keeping one instance. */
export function showFileOpener(el: HTMLElement): void {
  fill(el, fileOpener());
}
