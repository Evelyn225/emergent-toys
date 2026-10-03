// ASCII City's service worker (scoped to /ascii-city*, not the rest of the site): what lets it install as an app and
// open with no signal. The game itself (page and bundle) is fetched fresh whenever there's a network and the cached
// copy is only the fallback, so an update is never stuck behind an old version; sounds, fonts and images don't
// change, so those come from the cache once they're in it.
const CACHE = 'ascii-city-v1';
const SHELL = ['ascii-city.html', 'ascii-city.bundle.js', 'ascii-city.webmanifest', 'images/ascii-city-192.png', 'images/ascii-city-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ascii-city-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== location.origin || r.headers.has('range')) return; // (an <audio> streams in ranges: leave it be)
  const lasting = /\.(mp3|woff2?|ttf|otf|png|webp)$/.test(url.pathname);
  const save = res => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; };
  e.respondWith(lasting
    ? caches.match(r).then(hit => hit || fetch(r).then(save))
    : fetch(r).then(save).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || (r.mode === 'navigate' ? caches.match('ascii-city.html') : Response.error()))));
});
