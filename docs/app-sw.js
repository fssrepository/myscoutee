const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-99b0f50e0e1a-20260709195826";
const BUILD_ID = "99b0f50e0e1a-20260709195826";
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
  "./chunk-224SR4BF.js",
  "./chunk-27BDK2KR.js",
  "./chunk-2GFDNYTY.js",
  "./chunk-2VO4J7VO.js",
  "./chunk-367BQDJC.js",
  "./chunk-3C7FPGRK.js",
  "./chunk-3I7VPHQX.js",
  "./chunk-3MFNXVNZ.js",
  "./chunk-3WJSZUQA.js",
  "./chunk-4PA2B5H2.js",
  "./chunk-5GHSCAXU.js",
  "./chunk-5N6IDSZL.js",
  "./chunk-6JSO5EOJ.js",
  "./chunk-6QBIU5L4.js",
  "./chunk-6XMTNTPK.js",
  "./chunk-A3IRVH3U.js",
  "./chunk-AFIXHKB6.js",
  "./chunk-AMEIFOMV.js",
  "./chunk-ANU4BW6C.js",
  "./chunk-AWJHA6AL.js",
  "./chunk-AYVIMEWH.js",
  "./chunk-B3JLADOF.js",
  "./chunk-B6C5JI6K.js",
  "./chunk-BAZ24WY5.js",
  "./chunk-BH6DAITR.js",
  "./chunk-BQGZBHS5.js",
  "./chunk-BU64WNFR.js",
  "./chunk-BVCZ4MBG.js",
  "./chunk-CFKWFORE.js",
  "./chunk-CTI2VZRI.js",
  "./chunk-DBA7HP7H.js",
  "./chunk-E4BW4P6N.js",
  "./chunk-EG6W37QJ.js",
  "./chunk-FFBIUTLD.js",
  "./chunk-FFTFEMHG.js",
  "./chunk-FGI2LOUM.js",
  "./chunk-G67GWGVX.js",
  "./chunk-GBEE6NIO.js",
  "./chunk-GPZDLOYZ.js",
  "./chunk-HA7SP7DU.js",
  "./chunk-HIMQ3AVK.js",
  "./chunk-HIRYQUWI.js",
  "./chunk-HRQAO4M4.js",
  "./chunk-HUOBA6C5.js",
  "./chunk-IBU3ATHX.js",
  "./chunk-ICD6U64D.js",
  "./chunk-IZKEPIPR.js",
  "./chunk-JDWWV4JQ.js",
  "./chunk-JHEEYKIL.js",
  "./chunk-JYSIGHZK.js",
  "./chunk-K2JR22HL.js",
  "./chunk-KOXB6RDH.js",
  "./chunk-LAZO45YR.js",
  "./chunk-MED2ETQU.js",
  "./chunk-MNHMH7XS.js",
  "./chunk-MVFNZ5VT.js",
  "./chunk-MVXPI2MF.js",
  "./chunk-NHB2PT7L.js",
  "./chunk-NMSQTN3X.js",
  "./chunk-ODGPROBY.js",
  "./chunk-OEGYKCRP.js",
  "./chunk-OK34S7P2.js",
  "./chunk-OQQUTB3M.js",
  "./chunk-OULNM7S3.js",
  "./chunk-OXAUKTRF.js",
  "./chunk-P7N5AXPR.js",
  "./chunk-PABD74MU.js",
  "./chunk-QAU66TSG.js",
  "./chunk-QDSLBUM7.js",
  "./chunk-QJCF5SNJ.js",
  "./chunk-R6STSBOG.js",
  "./chunk-RLLUKLGA.js",
  "./chunk-RNEJOON3.js",
  "./chunk-S24YZLS5.js",
  "./chunk-SLXDWI32.js",
  "./chunk-SZ44YT7B.js",
  "./chunk-TBZGWN5Z.js",
  "./chunk-TNQPQM4Y.js",
  "./chunk-TPPHOXDM.js",
  "./chunk-U5DCSHGV.js",
  "./chunk-UN4DMFB4.js",
  "./chunk-V6KFXBDD.js",
  "./chunk-VVF2OJMS.js",
  "./chunk-W5AYNHGJ.js",
  "./chunk-WK6IMCBS.js",
  "./chunk-X5MN37SY.js",
  "./chunk-XDCFMPEW.js",
  "./chunk-XF55YDIH.js",
  "./chunk-XKUNIV4Q.js",
  "./chunk-XXEVPEYW.js",
  "./chunk-XY4VDXNZ.js",
  "./chunk-YGGIUCFZ.js",
  "./chunk-YRCT4COX.js",
  "./chunk-Z22NANGF.js",
  "./chunk-Z6M2YHF2.js",
  "./chunk-Z6WHGOKU.js",
  "./chunk-ZAOCYHHG.js",
  "./chunk-ZFYJ7YZG.js",
  "./chunk-ZNGFT3IF.js",
  "./chunk-ZQAO2RRD.js",
  "./main-UY5SIKBQ.js",
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
