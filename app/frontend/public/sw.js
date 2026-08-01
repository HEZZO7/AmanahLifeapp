// Service Worker for Push Notifications & PWA Offline - AmanahLife
const CACHE_NAME = 'amanah-v2';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  'https://mgx-backend-cdn.metadl.com/generate/images/1249149/2026-07-03/rxr6bgiaaisq/amanah-logo_variant_2.png',
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch(() => {
        // Some URLs may fail, continue anyway
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API/function calls
  if (request.url.includes('/functions/v1/') || request.url.includes('supabase.co')) return;

  // Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Serve from cache when offline
          return caches.match(request).then((cached) => {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts)
  if (request.url.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ttf|ico)(\?.*)?$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Return cache, update in background
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  let data = {
    title: 'AmanahLife',
    body: 'You have a new notification',
    icon: 'https://mgx-backend-cdn.metadl.com/generate/images/1249149/2026-07-03/rxr7hzqaaisa/amanah-logo_variant_3.png',
    url: '/',
    notification_type: 'general_activity',
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    try {
      if (event.data) {
        data.body = event.data.text();
      }
    } catch (e2) {
      // Use defaults
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'https://mgx-backend-cdn.metadl.com/generate/images/1249149/2026-07-03/rxsakwaaaita/amanah-logo_variant_4.png',
    badge: 'https://mgx-backend-cdn.metadl.com/generate/images/1249149/2026-07-03/rxsbl5yaaira/amanah-logo_variant_5.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      notification_type: data.notification_type,
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: data.notification_type || 'general',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Analytics or cleanup if needed
});