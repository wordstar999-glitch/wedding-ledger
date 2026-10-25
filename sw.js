const CACHE_NAME = 'gift-v102';
const ASSETS = ['./', './index.html', './xlsx.js', './manifest.json', './icon-192.png', './icon-512.png'];
// 저장된 파일을 즉시 보여주고(앱이 바로 열림), 새 파일은 뒤에서 받아 다음에 열 때 적용한다.
// 저장된 파일이 없을 때만 네트워크를 기다린다.

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith('gift-') && k !== CACHE_NAME).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.searchParams.has('chk')) return; // 새 버전 확인 요청은 저장된 파일 없이 서버로 보낸다
  e.respondWith(staleWhileRevalidate(e));
});
async function staleWhileRevalidate(e) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(e.request, { ignoreSearch: true });
  const net = fetch(e.request.url, { cache: 'no-cache' }).then(res => {
    if (res.ok) cache.put(e.request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) {
    e.waitUntil(net);
    return cached;
  }
  return (await net) || cache.match('./index.html');
}
self.addEventListener('message', e => {
  if (e.data === 'version' && e.ports[0]) e.ports[0].postMessage(CACHE_NAME.replace('gift-', ''));
});
