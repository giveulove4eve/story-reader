// 简单的 Service Worker 满足 PWA 安装需求
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 保持网络优先
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
