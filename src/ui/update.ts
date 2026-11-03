/**
 * Service worker registration. A new version waits until the user taps
 * "Neu laden" or closes every tab; it is never activated silently.
 */
import { t } from '../i18n/i18n.ts';
import { h } from './dom.ts';

let reloadRequested = false;

function offerReload(worker: ServiceWorker): void {
  if (document.getElementById('update')) return;
  const button = h('button', { type: 'button', class: 'btn btn--ink' }, t('update.reload'));
  button.addEventListener('click', () => {
    reloadRequested = true;
    worker.postMessage({ type: 'activate' });
  });
  document.body.append(h('div', { id: 'update', class: 'update stock', role: 'status' }, h('span', {}, t('update.available')), button));
}

/** Registers the service worker in production builds. */
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => undefined);
  if (!registration) return;
  // Reload only after the user asked for the new version; never on a first install.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) location.reload();
  });
  if (registration.waiting && navigator.serviceWorker.controller) offerReload(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) offerReload(installing);
    });
  });
}
