const CACHE_NAME = 'suraksha-v3';

const urlsToCache = [
  '/',
  '/index/',
  '/home/',
  '/static/script.js',
  '/static/manifest.json',
  '/static/icon-512x512.png',
'/static/icon-192x192.png',
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }

  if (
    requestUrl.pathname.includes('/login/') ||
    requestUrl.pathname.includes('/register/')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          `
          <html>
            <head><title>Offline</title></head>
            <body style="font-family: Arial; text-align:center; padding:40px;">
              <h1>Offline</h1>
              <p>Login or signup needs internet. Please reconnect and try again.</p>
            </body>
          </html>
          `,
          {
            headers: { 'Content-Type': 'text/html' }
          }
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(networkResponse => {
          if (
            event.request.url.startsWith(self.location.origin) &&
            networkResponse &&
            networkResponse.status === 200
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/index/');
          }
        });
    })
  );
});

// Push
self.addEventListener('push', event => {
  let data = {
    title: 'Suraksha Alert',
    body: 'Emergency notification!',
    url: '/home/'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/static/icon-192x192.png',
    badge: '/static/icon-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/home/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SOS Alert!', options)
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const targetUrl = event.notification.data.url || '/home/';

      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Optional message listener
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});