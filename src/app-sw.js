const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = 'v1';
const APP_CACHE = `${CACHE_PREFIX}-app-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const MEDIA_CACHE = `${CACHE_PREFIX}-media-${CACHE_VERSION}`;
const ACTIVE_CACHES = [APP_CACHE, API_CACHE, MEDIA_CACHE];
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon/favicon.ico',
  './assets/icon/apple-touch-icon.png',
  './assets/icon/android-chrome-192x192.png',
  './assets/icon/android-chrome-512x512.png',
  './assets/logo/heart.png',
  './assets/logo/cards_no_edges.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(new Request(url, { cache: 'reload' })))
      ))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith(CACHE_PREFIX) && !ACTIVE_CACHES.includes(name))
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    if (isApiCacheable(url)) {
      event.respondWith(networkFirst(request, API_CACHE));
      return;
    }
    if (isStaticAsset(url, request)) {
      event.respondWith(networkFirst(request, APP_CACHE));
      return;
    }
  }

  if (url.hostname === 'api.qrserver.com') {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
  }
});

self.addEventListener('push', event => {
  const payload = parsePushPayload(event);
  if (!payload) {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || './assets/logo/heart.png',
      badge: payload.badge || './assets/logo/heart.png',
      data: {
        url: payload.url || '/game'
      }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data && typeof event.notification.data.url === 'string'
    ? event.notification.data.url
    : '/game';
  event.waitUntil(openClient(targetUrl));
});

function isApiCacheable(url) {
  return url.pathname.startsWith('/api/auth/me') || url.pathname.startsWith('/api/assets/tickets');
}

function isStaticAsset(url, request) {
  if (url.pathname.endsWith('/app-sw.js')) {
    return false;
  }
  if (request.destination === 'script'
    || request.destination === 'style'
    || request.destination === 'font'
    || request.destination === 'image'
    || request.destination === 'manifest'
    || request.destination === 'worker') {
    return true;
  }
  return url.pathname === '/' || url.pathname.endsWith('/index.html');
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) {
        return fallback;
      }
    }
    throw new Error('Network unavailable and no cached response.');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone());
  }
  return response;
}

function parsePushPayload(event) {
  if (!event.data) {
    return null;
  }
  try {
    const json = event.data.json();
    const notification = json.notification || {};
    const data = json.data || {};
    return {
      title: notification.title || data.title || 'MyScoutee',
      body: notification.body || data.body || '',
      icon: notification.icon || data.icon || '',
      badge: notification.badge || data.badge || '',
      url: data.url || data.click_action || '/game'
    };
  } catch {
    return {
      title: 'MyScoutee',
      body: event.data.text(),
      icon: '',
      badge: '',
      url: '/game'
    };
  }
}

async function openClient(targetUrl) {
  const absoluteUrl = new URL(targetUrl, self.location.origin).toString();
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clientList) {
    if ('focus' in client) {
      await client.focus();
      if ('navigate' in client) {
        return client.navigate(absoluteUrl);
      }
      return client;
    }
  }
  return self.clients.openWindow(absoluteUrl);
}
