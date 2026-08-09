const CACHE_NAME = 'suraksha-v1';
const urlsToCache = [
  '/',
  '/index/',
  '/home/',
  '/static/style.css',
  '/static/script.js',
  '/static/manifest.json',
  '/static/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/login/') || event.request.url.includes('/register/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('<h1>Offline</h1><p>Login requires internet. Please connect and try again.</p>', {
          headers: { 'Content-Type': 'text/html' }
        });
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Suraksha Alert', body: 'Emergency notification!' };
  const options = {
    body: data.body,
    icon: '/static/icons/icon-512x512.png',
    badge: '/static/icons/icon-512x512.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/home/' }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'subscribe') {
    console.log('Push subscription:', event.data.subscription);
  }
});