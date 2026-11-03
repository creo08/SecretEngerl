/** Entry point. The draw is taken out of the address bar before anything else runs. */
import './styles/app.css';
import { takeFragment } from './link/link.ts';

// Draw links start with the format version, a digit; "#main" from the skip link is an in-page anchor.
const isAnchor = /^#[A-Za-z]/.test(location.hash);
const hadHash = !isAnchor && location.href.includes('#');
const fragment = hadHash ? takeFragment() : '';
if (hadHash && !fragment) history.replaceState(null, '', location.pathname + location.search);

const { t } = await import('./i18n/i18n.ts');
console.info(t('console.egg'));

if (hadHash) {
  const { showReceiver } = await import('./ui/receive.ts');
  showReceiver(fragment || '#');
} else {
  const { startApp } = await import('./ui/home.ts');
  await startApp();
}
const { registerServiceWorker } = await import('./ui/update.ts');
void registerServiceWorker();
