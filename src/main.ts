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

const { isLanguage, setLanguage, t } = await import('./i18n/i18n.ts');
const { browserLanguage, relabelPage, storeLanguage, storedLanguage } = await import('./ui/language.ts');
const { PAGE_PATHS } = await import('./site/pages.ts');

// A language picked in the footer arrives as ?sprache=…; it is remembered and leaves the address.
const query = new URLSearchParams(location.search);
const picked = query.get('sprache');
if (isLanguage(picked)) storeLanguage(picked);
if (query.has('sprache')) {
  query.delete('sprache');
  history.replaceState(null, '', location.pathname + (query.size ? `?${query}` : ''));
}
const pageLanguage = isLanguage(document.documentElement.lang) ? document.documentElement.lang : 'de';
const wanted = storedLanguage() ?? browserLanguage();
const atGermanRoot = pageLanguage === 'de' && location.pathname === import.meta.env.BASE_URL;
if (atGermanRoot && !hadHash && !isLanguage(picked) && wanted && wanted !== 'de') {
  // The first visit without a draw moves to the browser's language; the draw page never moves, so no draw is lost.
  location.replace(import.meta.env.BASE_URL + PAGE_PATHS.home[wanted] + location.search);
  await new Promise(() => {});
}
if ((hadHash || isPrefill) && wanted && wanted !== pageLanguage) await relabelPage(wanted);
else await setLanguage(pageLanguage);
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
