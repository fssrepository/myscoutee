const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-4e46d271f61a-20260819222030";
const BUILD_ID = "4e46d271f61a-20260819222030";
const APP_CACHE = `${CACHE_PREFIX}-app-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const MEDIA_CACHE = `${CACHE_PREFIX}-media-${CACHE_VERSION}`;
const ACTIVE_CACHES = [APP_CACHE, API_CACHE, MEDIA_CACHE];
const APP_CACHE_PREFIX = `${CACHE_PREFIX}-app-`;
const PREVIOUS_APP_CACHE_LIMIT = 1;
const DEPLOYMENT_CONFIGURATION_URL = './api/deployment/configuration';
const DEPLOYMENT_BRANDING_CACHE_KEY = './__deployment-branding__';
const DEFAULT_DEPLOYMENT_BRANDING = Object.freeze({
  productName: 'MyScoutee',
  homeLabel: 'Your preferences come first',
  logoUrl: './assets/logo/heart.webp'
});
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
  "./chunk-2Q7DDSVY.js",
  "./chunk-2XBWRRWC.js",
  "./chunk-3H2YJ2WB.js",
  "./chunk-3VTV3T3A.js",
  "./chunk-3X43S5XM.js",
  "./chunk-3ZVSJOSM.js",
  "./chunk-4IDANUMS.js",
  "./chunk-4IVN77YH.js",
  "./chunk-4L5ZM6QP.js",
  "./chunk-4PB6SG6N.js",
  "./chunk-4XDUNXUZ.js",
  "./chunk-52LKCXKD.js",
  "./chunk-53BE7ZO3.js",
  "./chunk-5AWQOT6S.js",
  "./chunk-5HOR5BU3.js",
  "./chunk-5T7YLFCX.js",
  "./chunk-5VYM6P7K.js",
  "./chunk-5WTJFVWD.js",
  "./chunk-5YNQN7RY.js",
  "./chunk-62MXEUPX.js",
  "./chunk-6BOLR2T5.js",
  "./chunk-6TF5KAAL.js",
  "./chunk-6YMW57I2.js",
  "./chunk-7HXYXUQR.js",
  "./chunk-7OTZ5DJG.js",
  "./chunk-AMN2227A.js",
  "./chunk-APDNCZQS.js",
  "./chunk-APPWX5HR.js",
  "./chunk-ATNGWUH3.js",
  "./chunk-AYNOERNZ.js",
  "./chunk-AZWE2JGH.js",
  "./chunk-B7HOOEHU.js",
  "./chunk-BDMFLDTU.js",
  "./chunk-BKJ3CIZF.js",
  "./chunk-BPYKLAD6.js",
  "./chunk-BWOKJA3P.js",
  "./chunk-C2G5PLQ5.js",
  "./chunk-CVH46Z3K.js",
  "./chunk-D6JRSPTU.js",
  "./chunk-DU2WVSBL.js",
  "./chunk-DYIW5W44.js",
  "./chunk-DZHHOA5I.js",
  "./chunk-E5L666SF.js",
  "./chunk-EB2YWZEN.js",
  "./chunk-EKZJOEZI.js",
  "./chunk-EX6J2PXI.js",
  "./chunk-EXZ44ASC.js",
  "./chunk-FAK3EEJD.js",
  "./chunk-GF2QV5EH.js",
  "./chunk-GIJ62DI6.js",
  "./chunk-GS4VSRMX.js",
  "./chunk-GYZO3RQD.js",
  "./chunk-HGZMRCMR.js",
  "./chunk-HZE66RAR.js",
  "./chunk-IIUJFQYP.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-IOWO74RO.js",
  "./chunk-JCXPIA2Q.js",
  "./chunk-JOFNWN5V.js",
  "./chunk-JPOCSIHK.js",
  "./chunk-K5SMHO3V.js",
  "./chunk-KB33S2EZ.js",
  "./chunk-KCWALPJL.js",
  "./chunk-KPIVL6PV.js",
  "./chunk-KTFJBLPA.js",
  "./chunk-LI3DQL5V.js",
  "./chunk-LIM75XAW.js",
  "./chunk-LOIX6EHC.js",
  "./chunk-LYQNOSGY.js",
  "./chunk-M44OYTD2.js",
  "./chunk-M5N4DC4U.js",
  "./chunk-MARL4VGF.js",
  "./chunk-MBLUW4MB.js",
  "./chunk-MBTZTXX7.js",
  "./chunk-MNMZPGTH.js",
  "./chunk-MPOMYYFF.js",
  "./chunk-N5G2OVVZ.js",
  "./chunk-NMWWKR5Q.js",
  "./chunk-NNYQZPQK.js",
  "./chunk-OKFYIUZH.js",
  "./chunk-OM7SEA4H.js",
  "./chunk-OQSJYTQ3.js",
  "./chunk-OWFF6WKX.js",
  "./chunk-OYFQWCHI.js",
  "./chunk-P7NTHJUM.js",
  "./chunk-PG7YLQUR.js",
  "./chunk-PJT6PTH3.js",
  "./chunk-PXNUBOXY.js",
  "./chunk-Q2BG6LC3.js",
  "./chunk-Q4FX7L2P.js",
  "./chunk-QX5JMSF7.js",
  "./chunk-R3UYKS2T.js",
  "./chunk-S24YZLS5.js",
  "./chunk-SFIPRG5N.js",
  "./chunk-TTYTYITO.js",
  "./chunk-TYDICAJR.js",
  "./chunk-UE5W7HGV.js",
  "./chunk-UIP27ZX7.js",
  "./chunk-UQS5S3IO.js",
  "./chunk-URQMBXJM.js",
  "./chunk-USU4PWSF.js",
  "./chunk-V2SGQZ7T.js",
  "./chunk-V2TKIVZE.js",
  "./chunk-V3DDQXVS.js",
  "./chunk-VDDNS34G.js",
  "./chunk-VNUDXFXN.js",
  "./chunk-W3T3DQA6.js",
  "./chunk-W4HTRNN7.js",
  "./chunk-WGTYHQKZ.js",
  "./chunk-WP4H23WV.js",
  "./chunk-WWXAI5YP.js",
  "./chunk-XCUPLAGS.js",
  "./chunk-XRE76BVP.js",
  "./chunk-XXV2AMCQ.js",
  "./chunk-Y3RPVSF7.js",
  "./chunk-Y5JU5UO2.js",
  "./chunk-YG34KF6D.js",
  "./chunk-YHP42WWO.js",
  "./chunk-YIHVIRUM.js",
  "./chunk-YK5HGBE3.js",
  "./chunk-YOASBKWZ.js",
  "./chunk-YV742YIS.js",
  "./chunk-Z4ZFOF77.js",
  "./chunk-Z6EKKZRO.js",
  "./chunk-ZG5U4EF3.js",
  "./chunk-ZLZEA5RI.js",
  "./chunk-ZPKITENB.js",
  "./main-LSNUGY53.js",
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
  "./styles-PVJO7VOP.css"
];
const PRECACHE_URLS = [...PRECACHE_CORE_URLS, ...PRECACHE_BUILD_URLS];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(
        PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' }))
      ))
      .catch(async error => {
        await caches.delete(APP_CACHE);
        throw error;
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const previousAppCaches = cacheNames
      .filter(name => name.startsWith(APP_CACHE_PREFIX) && name !== APP_CACHE)
      .slice(-PREVIOUS_APP_CACHE_LIMIT);
    const cachesToKeep = new Set([...ACTIVE_CACHES, ...previousAppCaches]);
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith(CACHE_PREFIX) && !cachesToKeep.has(name))
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'DEPLOYMENT_BRANDING') {
    event.waitUntil(
      storeDeploymentBranding(event.data.branding)
    );
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(serveAppShell(request));
    return;
  }

  if (isImageRequest(request)) {
    if (url.origin !== self.location.origin) {
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
      event.respondWith(networkFirstStaticAsset(request));
      return;
    }
  }
});

self.addEventListener('push', event => {
  const payload = parsePushPayload(event);
  if (!payload) {
    return;
  }
  event.waitUntil((async () => {
    const branding = await deploymentBranding();
    await self.registration.showNotification(
      payload.title || branding.productName,
      {
      body: payload.body,
      icon: payload.icon || branding.logoUrl,
      badge: payload.badge || branding.logoUrl,
      data: {
        url: payload.url || '/game'
      }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data && typeof event.notification.data.url === 'string'
    ? event.notification.data.url
    : '/game';
  event.waitUntil(openClient(targetUrl));
});

function isApiCacheable(url) {
  return url.pathname.startsWith('/api/auth/me');
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

async function serveAppShell(request) {
  const cache = await caches.open(APP_CACHE);
  const cachedIndex = await cache.match('./index.html') || await cache.match('./');
  if (cachedIndex) {
    return cachedIndex;
  }
  return networkFirst(request, APP_CACHE);
}

async function networkFirstStaticAsset(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
      return response;
    }
    return await matchAppBundleCache(request) || response;
  } catch {
    return await matchAppBundleCache(request) || unavailableResponse(request);
  }
}

async function matchAppBundleCache(request) {
  const currentResponse = await caches.match(request, { cacheName: APP_CACHE });
  if (currentResponse) {
    return currentResponse;
  }

  const cacheNames = await caches.keys();
  const previousAppCaches = cacheNames
    .filter(name => name.startsWith(APP_CACHE_PREFIX) && name !== APP_CACHE)
    .reverse();
  for (const cacheName of previousAppCaches) {
    const response = await caches.match(request, { cacheName });
    if (response) {
      return response;
    }
  }
  return null;
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

async function unavailableResponse(request) {
  if (request.mode === 'navigate') {
    const branding = await deploymentBranding();
    const productName = escapeHtml(branding.productName);
    return new Response(
      `<!doctype html><title>${productName}</title><body>${productName}</body>`,
      {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
      }
    );
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
      title: notification.title || data.title || '',
      body: notification.body || data.body || '',
      icon: notification.icon || data.icon || '',
      badge: notification.badge || data.badge || '',
      url: data.url || data.click_action || '/game'
    };
  } catch {
    return {
      title: '',
      body: event.data.text(),
      icon: '',
      badge: '',
      url: '/game'
    };
  }
}

async function deploymentBranding() {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(DEPLOYMENT_BRANDING_CACHE_KEY);
  if (cached) {
    try {
      return normalizeDeploymentBranding(await cached.json());
    } catch {
      await cache.delete(DEPLOYMENT_BRANDING_CACHE_KEY);
    }
  }
  try {
    const response = await fetch(DEPLOYMENT_CONFIGURATION_URL, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    if (response.ok) {
      const branding = normalizeDeploymentBranding(await response.json());
      await persistDeploymentBranding(cache, branding);
      return branding;
    }
  } catch {
    // Offline and cold-worker fallback uses the bundled product identity.
  }
  return { ...DEFAULT_DEPLOYMENT_BRANDING };
}

async function storeDeploymentBranding(value) {
  const cache = await caches.open(API_CACHE);
  await persistDeploymentBranding(
    cache,
    normalizeDeploymentBranding(value)
  );
}

async function persistDeploymentBranding(cache, branding) {
  await cache.put(
    DEPLOYMENT_BRANDING_CACHE_KEY,
    new Response(JSON.stringify(branding), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    })
  );
}

function normalizeDeploymentBranding(value) {
  const source = value && typeof value === 'object' ? value : {};
  const productName = normalizedText(source.productName, 80)
    || DEFAULT_DEPLOYMENT_BRANDING.productName;
  const homeLabel = normalizedText(source.homeLabel, 120);
  return {
    productName,
    homeLabel,
    logoUrl: normalizedLogoUrl(source.logoUrl)
  };
}

function normalizedLogoUrl(value) {
  if (typeof value !== 'string') {
    return DEFAULT_DEPLOYMENT_BRANDING.logoUrl;
  }
  const normalized = normalizedText(value, 4096);
  if (!normalized) {
    return '';
  }
  try {
    const url = new URL(normalized, self.location.origin);
    if (
      (url.protocol === 'https:' || url.origin === self.location.origin)
      && !url.username
      && !url.password
    ) {
      return url.toString();
    }
  } catch {
    // Fall through to the bundled logo.
  }
  return DEFAULT_DEPLOYMENT_BRANDING.logoUrl;
}

function normalizedText(value, maximumLength) {
  return typeof value === 'string'
    ? Array.from(value.trim()).slice(0, maximumLength).join('')
    : '';
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
