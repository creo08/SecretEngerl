/** Entry point. The draw is taken out of the address bar before anything else runs. */
import './styles/app.css';
import { takeFragment } from './link/link.ts';

// The pre-fill page /neu/ carries names after the #; they leave the address bar at once, too.
const isPrefill = /\/neu\/?$/.test(location.pathname);
// Draw links start with the format version, a digit; "#main" from the skip link is an in-page anchor.
const isAnchor = !isPrefill && /^#[A-Za-z]/.test(location.hash);
const hadHash = !isAnchor && location.href.includes('#');
const fragment = hadHash ? takeFragment() : '';
if (hadHash && !fragment) history.replaceState(null, '', location.pathname + location.search);

const { t } = await import('./i18n/i18n.ts');
console.info(t('console.egg'));

if (isPrefill) {
  const { showPrefill } = await import('./ui/prefill.ts');
  showPrefill(fragment);
} else if (hadHash) {
  const { showReceiver } = await import('./ui/receive.ts');
  showReceiver(fragment || '#');
} else {
  const { startApp } = await import('./ui/home.ts');
  await startApp();
}
const { registerServiceWorker } = await import('./ui/update.ts');
void registerServiceWorker();
