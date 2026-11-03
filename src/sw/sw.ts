/**
 * Service worker: a versioned precache of the app's own static files only.
 * It never sees a draw (browsers do not send the fragment) and never reads
 * location.hash. A new version waits until the page asks it to take over.
 */
/** Replaced at build time by the list of URLs to precache. */
declare const __PRECACHE__: string[];
/** Replaced at build time by a hash of everything precached. */
declare const __CACHE_VERSION__: string;

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `secretengerl-${__CACHE_VERSION__}`;

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(__PRECACHE__)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('secretengerl-') && k !== CACHE).map((k) => caches.delete(k)))),
  );
});

sw.addEventListener('message', (event) => {
  // Only on the user's explicit "Neu laden".
  if ((event.data as { type?: string } | null)?.type === 'activate') void sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== sw.location.origin) return;
  event.respondWith(caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((hit) => hit ?? fetch(request)));
});
