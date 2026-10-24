const CACHE_NAME = 'gift-v13';
const ASSETS = ['./', './index.html', './xlsx.js', './manifest.json', './icon-192.png', './icon-512.png'];
// 온라인이면 항상 서버의 최신 파일을 받고(HTTP 캐시 우회), 오프라인이거나 응답이 느리면 캐시를 쓴다.
const NET_TIMEOUT_MS = 2500;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith('gift-') && k !== CACHE_NAME).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(networkFirst(e.request));
});
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req, { ignoreSearch: true });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cached ? NET_TIMEOUT_MS : 15000);
  try {
    const res = await fetch(req.url, { cache: 'no-cache', signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    clearTimeout(timer);
    return cached || cache.match('./index.html');
  }
}
self.addEventListener('message', e => {
  if (e.data === 'version' && e.ports[0]) e.ports[0].postMessage(CACHE_NAME.replace('gift-', ''));
});
