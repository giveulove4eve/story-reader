// Service Worker - 满足 PWA 安装需求并确保永远自动清除旧缓存
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 保持网络直连
  event.respondWith(fetch(event.request));
});
