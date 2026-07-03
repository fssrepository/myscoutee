const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-3bfae8278456-20260703174752";
const BUILD_ID = "3bfae8278456-20260703174752";
const APP_CACHE = `${CACHE_PREFIX}-app-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const MEDIA_CACHE = `${CACHE_PREFIX}-media-${CACHE_VERSION}`;
const ACTIVE_CACHES = [APP_CACHE, API_CACHE, MEDIA_CACHE];
const PRECACHE_CORE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon/favicon.ico',
  './assets/icon/apple-touch-icon.png',
  './assets/icon/android-chrome-192x192.png',
  './assets/icon/android-chrome-512x512.png',
  './assets/logo/heart.png',
  './assets/logo/heart.webp',
  './assets/logo/cards_no_edges.png',
  './assets/idea/article-fallback.svg',
  './assets/i18n/en.json',
  './assets/i18n/hu.json'
];
const PRECACHE_BUILD_URLS = [
  "./chunk-27QA22WO.js",
  "./chunk-2ABAQZG2.js",
  "./chunk-2BESY73N.js",
  "./chunk-33UFY223.js",
  "./chunk-3FDNNBEZ.js",
  "./chunk-3L3YDNEV.js",
  "./chunk-3QTHD5HZ.js",
  "./chunk-44GVJW3V.js",
  "./chunk-5ICJ6GQ4.js",
  "./chunk-5IVVYIY2.js",
  "./chunk-5LBAO3YP.js",
  "./chunk-67QPQ4MY.js",
  "./chunk-6M6DLVTP.js",
  "./chunk-6P3M6OGL.js",
  "./chunk-73QF6BZX.js",
  "./chunk-7AGV376E.js",
  "./chunk-7UWZG7H7.js",
  "./chunk-7YBKQRU2.js",
  "./chunk-AN35XIVV.js",
  "./chunk-AQFHVSIM.js",
  "./chunk-AYREMVY4.js",
  "./chunk-BBQ3ERUP.js",
  "./chunk-BSVKR6IO.js",
  "./chunk-CHXLFKAC.js",
  "./chunk-CIXRHTGY.js",
  "./chunk-CONHHSWF.js",
  "./chunk-DH3WFMNM.js",
  "./chunk-DPZ25PFR.js",
  "./chunk-DR5CYYFK.js",
  "./chunk-E5XUJZ67.js",
  "./chunk-EANELDDQ.js",
  "./chunk-EKHF7K67.js",
  "./chunk-FIIKHHPR.js",
  "./chunk-FTLGWPSA.js",
  "./chunk-GITRTCYA.js",
  "./chunk-GJBI22QZ.js",
  "./chunk-GOYBCU7L.js",
  "./chunk-GZB2FHF5.js",
  "./chunk-HOTEXYZQ.js",
  "./chunk-HS6YXMXL.js",
  "./chunk-HXWY4ZYL.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-IX4R6EAJ.js",
  "./chunk-JFINKWUV.js",
  "./chunk-JJG3YZAJ.js",
  "./chunk-KJVTESX4.js",
  "./chunk-KZB3ERYF.js",
  "./chunk-L6BLWKTQ.js",
  "./chunk-LIIW42RF.js",
  "./chunk-LNUP2GA5.js",
  "./chunk-LOILFN22.js",
  "./chunk-LUAZFWRY.js",
  "./chunk-MB7O3V2T.js",
  "./chunk-MBYZTGPQ.js",
  "./chunk-ME7X6EF3.js",
  "./chunk-MGB7DAEO.js",
  "./chunk-NCVSMGMG.js",
  "./chunk-ND62XFHE.js",
  "./chunk-NF7TEIV4.js",
  "./chunk-NG3EC4GX.js",
  "./chunk-OJQDTPOV.js",
  "./chunk-ORVER2TE.js",
  "./chunk-Q73RRKBC.js",
  "./chunk-QEJANFD6.js",
  "./chunk-QGVWHSLJ.js",
  "./chunk-QMPWYCLX.js",
  "./chunk-QSOQN7TR.js",
  "./chunk-R5OT7CN6.js",
  "./chunk-RVL2DHAU.js",
  "./chunk-S24YZLS5.js",
  "./chunk-S3ICPMR2.js",
  "./chunk-SKD5QNT5.js",
  "./chunk-SLKPBFBT.js",
  "./chunk-SPDROUZE.js",
  "./chunk-T3PD3UQD.js",
  "./chunk-TIZYL4RA.js",
  "./chunk-TJYIY4N4.js",
  "./chunk-TUDUQ7V7.js",
  "./chunk-TZR247CS.js",
  "./chunk-UY2TUM7Y.js",
  "./chunk-VBLTCJFE.js",
  "./chunk-W5YHQBDF.js",
  "./chunk-WIAVC4ZH.js",
  "./chunk-XUFCQEEY.js",
  "./chunk-XXSWUIWM.js",
  "./chunk-Y3RB3QT7.js",
  "./chunk-Y4XXUALZ.js",
  "./chunk-YDIB4GPH.js",
  "./chunk-YE33E6OK.js",
  "./chunk-YNBY3QKP.js",
  "./chunk-YYKXCSHK.js",
  "./chunk-Z3LGPQKB.js",
  "./chunk-Z5RW76E5.js",
  "./chunk-Z6GAYD3T.js",
  "./chunk-ZFADBZXN.js",
  "./chunk-ZGQL6ROK.js",
  "./chunk-ZVYVVP26.js",
  "./main-AFNS5KWP.js",
  "./media/material-icons-JLIDJUWE.woff",
  "./media/material-icons-LEZCGFVT.woff2",
  "./media/material-icons-outlined-7BWLPMFK.woff2",
  "./media/material-icons-outlined-PCUTWIDZ.woff",
  "./media/material-icons-round-SLOHZIXU.woff",
  "./media/material-icons-round-WEHMTW23.woff2",
  "./media/material-icons-sharp-HCCYMPXE.woff2",
  "./media/material-icons-sharp-U4OLFP3G.woff",
  "./media/material-icons-two-tone-LCGWGE2N.woff",
  "./media/material-icons-two-tone-M5N5K6F5.woff2",
  "./media/roboto-cyrillic-300-normal-LEZQ3MKH.woff",
  "./media/roboto-cyrillic-300-normal-LQYCE6GI.woff2",
  "./media/roboto-cyrillic-400-normal-JZANGCVN.woff",
  "./media/roboto-cyrillic-400-normal-V3H5IIDP.woff2",
  "./media/roboto-cyrillic-500-normal-P7R5B5PS.woff",
  "./media/roboto-cyrillic-500-normal-RHUEYUET.woff2",
  "./media/roboto-cyrillic-ext-300-normal-7ILTRYFN.woff",
  "./media/roboto-cyrillic-ext-300-normal-D7ENCFLY.woff2",
  "./media/roboto-cyrillic-ext-400-normal-37DU6NPA.woff",
  "./media/roboto-cyrillic-ext-400-normal-J2JSVX6B.woff2",
  "./media/roboto-cyrillic-ext-500-normal-CDI2P3CX.woff2",
  "./media/roboto-cyrillic-ext-500-normal-LPNI233Q.woff",
  "./media/roboto-greek-300-normal-7NUG2XNM.woff2",
  "./media/roboto-greek-300-normal-XWVECM7G.woff",
  "./media/roboto-greek-400-normal-S2O6A3MB.woff",
  "./media/roboto-greek-400-normal-VPVGP5YU.woff2",
  "./media/roboto-greek-500-normal-2BKWU2PG.woff",
  "./media/roboto-greek-500-normal-XWJR77VV.woff2",
  "./media/roboto-greek-ext-300-normal-P3ERUMZ4.woff",
  "./media/roboto-greek-ext-300-normal-UB4UOTHV.woff2",
  "./media/roboto-greek-ext-400-normal-AFHRTL5D.woff",
  "./media/roboto-greek-ext-400-normal-IONFYYIZ.woff2",
  "./media/roboto-greek-ext-500-normal-EPUYIZBL.woff",
  "./media/roboto-greek-ext-500-normal-UMWLP6CJ.woff2",
  "./media/roboto-latin-300-normal-OEKYIRZ4.woff",
  "./media/roboto-latin-300-normal-ZNJYGCVX.woff2",
  "./media/roboto-latin-400-normal-LOX3CHMS.woff2",
  "./media/roboto-latin-400-normal-TWCS3G4O.woff",
  "./media/roboto-latin-500-normal-D6YDQ3CR.woff2",
  "./media/roboto-latin-500-normal-HOJMQAXQ.woff",
  "./media/roboto-latin-ext-300-normal-H24XD56Q.woff",
  "./media/roboto-latin-ext-300-normal-ROZM7SZ2.woff2",
  "./media/roboto-latin-ext-400-normal-DKWFTT22.woff",
  "./media/roboto-latin-ext-400-normal-JLTDD7L3.woff2",
  "./media/roboto-latin-ext-500-normal-JYCUQIKH.woff2",
  "./media/roboto-latin-ext-500-normal-QWBPCWM4.woff",
  "./media/roboto-math-300-normal-6WXYN4KX.woff2",
  "./media/roboto-math-300-normal-LOKQ5YA5.woff",
  "./media/roboto-math-400-normal-DRZ46ZLW.woff",
  "./media/roboto-math-400-normal-M62DA447.woff2",
  "./media/roboto-math-500-normal-NNN526L6.woff",
  "./media/roboto-math-500-normal-X2DSP56O.woff2",
  "./media/roboto-symbols-300-normal-EOLMKP7X.woff2",
  "./media/roboto-symbols-300-normal-GV2F4YAV.woff",
  "./media/roboto-symbols-400-normal-RS3SF2FB.woff2",
  "./media/roboto-symbols-400-normal-ZCAYNMUT.woff",
  "./media/roboto-symbols-500-normal-CCVW4T3A.woff",
  "./media/roboto-symbols-500-normal-USW6FYVZ.woff2",
  "./media/roboto-vietnamese-300-normal-FARA53FV.woff",
  "./media/roboto-vietnamese-300-normal-JVDCXID7.woff2",
  "./media/roboto-vietnamese-400-normal-KACKQ7ZL.woff2",
  "./media/roboto-vietnamese-400-normal-R3IJFZXV.woff",
  "./media/roboto-vietnamese-500-normal-SNWSONII.woff",
  "./media/roboto-vietnamese-500-normal-VJX2WMYG.woff2",
  "./styles-LXW2PNP6.css"
];
const PRECACHE_URLS = [...PRECACHE_CORE_URLS, ...PRECACHE_BUILD_URLS];

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

  if (isImageRequest(request)) {
    if (url.origin !== self.location.origin && url.hostname !== 'api.qrserver.com') {
      return;
    }
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    if (isLandingContentRequest(url)) {
      event.respondWith(staleWhileRevalidate(request, API_CACHE, matchAnyLandingContent, event));
      return;
    }
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

function isLandingContentRequest(url) {
  return url.pathname === '/api/landing/content';
}

function isStaticAsset(url, request) {
  if (url.pathname.endsWith('/app-sw.js')) {
    return false;
  }
  if (url.pathname.includes('/assets/i18n/')) {
    return true;
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

function isImageRequest(request) {
  return request.destination === 'image';
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
    return unavailableResponse(request);
  }
}

async function staleWhileRevalidate(request, cacheName, fallbackMatcher, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetchAndCache(request, cache).catch(() => null);
  event?.waitUntil(refresh.then(() => undefined));
  if (cached) {
    return cached;
  }
  const fallback = fallbackMatcher ? await fallbackMatcher(cache, request) : null;
  if (fallback) {
    return fallback;
  }
  return await refresh || unavailableResponse(request);
}

async function fetchAndCache(request, cache) {
  const response = await fetch(request, { cache: 'no-store' });
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone());
  }
  return response;
}

async function matchAnyLandingContent(cache, request) {
  const exact = await cache.match(request);
  if (exact) {
    return exact;
  }
  const keys = await cache.keys();
  for (const key of keys) {
    if (isLandingContentRequest(new URL(key.url))) {
      return cache.match(key);
    }
  }
  return null;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return unavailableResponse(request);
  }
}

function unavailableResponse(request) {
  if (request.mode === 'navigate') {
    return new Response('<!doctype html><title>MyScoutee</title><body>No network</body>', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  }
  return new Response('', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Cache-Control': 'no-store'
    }
  });
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
