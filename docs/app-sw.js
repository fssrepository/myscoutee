const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-9eeee6f11624-20260819224339";
const BUILD_ID = "9eeee6f11624-20260819224339";
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
  "./chunk-26EL4JEQ.js",
  "./chunk-2IPUX2BS.js",
  "./chunk-2KZTGLV5.js",
  "./chunk-2Q7DDSVY.js",
  "./chunk-2XBWRRWC.js",
  "./chunk-32H2D6D7.js",
  "./chunk-3W4ZW7T6.js",
  "./chunk-3YXLBHNP.js",
  "./chunk-4IDANUMS.js",
  "./chunk-4IVN77YH.js",
  "./chunk-4L5ZM6QP.js",
  "./chunk-53YDAY56.js",
  "./chunk-5GV73WVS.js",
  "./chunk-5PKDDZM3.js",
  "./chunk-5SZ7F5Y7.js",
  "./chunk-5U7DJKSX.js",
  "./chunk-5WZBHJNI.js",
  "./chunk-5ZHSDY5T.js",
  "./chunk-62MXEUPX.js",
  "./chunk-6AZFD5QD.js",
  "./chunk-6YMW57I2.js",
  "./chunk-72XDKNNL.js",
  "./chunk-72ZIJDEJ.js",
  "./chunk-746YTYOT.js",
  "./chunk-7EN4BVE4.js",
  "./chunk-7J7Y3CTM.js",
  "./chunk-7QJNGZP6.js",
  "./chunk-A4AK6ILB.js",
  "./chunk-ALJZUPTY.js",
  "./chunk-APDNCZQS.js",
  "./chunk-AYNOERNZ.js",
  "./chunk-B2HTI7WW.js",
  "./chunk-B4WUO4GR.js",
  "./chunk-B7HOOEHU.js",
  "./chunk-BAG7JCVF.js",
  "./chunk-BDDGEPQE.js",
  "./chunk-BIRYZJWK.js",
  "./chunk-BSBHLSWZ.js",
  "./chunk-BWOKJA3P.js",
  "./chunk-C3B4KU2Q.js",
  "./chunk-CQ2Z4MO3.js",
  "./chunk-CRLX2ORT.js",
  "./chunk-CVH46Z3K.js",
  "./chunk-D6JRSPTU.js",
  "./chunk-EB2YWZEN.js",
  "./chunk-EHCKORS4.js",
  "./chunk-F3GDDUKO.js",
  "./chunk-F7RZS5XP.js",
  "./chunk-FKVDV5QQ.js",
  "./chunk-FM6CZXYE.js",
  "./chunk-FMQPLN2O.js",
  "./chunk-GNHVHXCO.js",
  "./chunk-H32ZKTYK.js",
  "./chunk-HIFURMD7.js",
  "./chunk-HUJ7UCJN.js",
  "./chunk-I66NCZCE.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-J7B2TJGM.js",
  "./chunk-JEY5CG4L.js",
  "./chunk-KB33S2EZ.js",
  "./chunk-KCWALPJL.js",
  "./chunk-KIYVTLNQ.js",
  "./chunk-KJIKC2GV.js",
  "./chunk-KN24DX6Y.js",
  "./chunk-KPIVL6PV.js",
  "./chunk-LFXRJIX3.js",
  "./chunk-LIM75XAW.js",
  "./chunk-LOIX6EHC.js",
  "./chunk-LZTZHHKJ.js",
  "./chunk-M2NWYJJ6.js",
  "./chunk-M4FEGBMD.js",
  "./chunk-MJOZOU6Z.js",
  "./chunk-MTROJOKB.js",
  "./chunk-MUICJ6XX.js",
  "./chunk-MY3T7RRD.js",
  "./chunk-N7T2Z6HO.js",
  "./chunk-NNYQZPQK.js",
  "./chunk-NWNF7SWQ.js",
  "./chunk-OCZEYJZR.js",
  "./chunk-ODH2J66K.js",
  "./chunk-OM7SEA4H.js",
  "./chunk-OMOC3OSM.js",
  "./chunk-OW3BSUM7.js",
  "./chunk-P3QYYHEL.js",
  "./chunk-PJT6PTH3.js",
  "./chunk-PPEYCIMO.js",
  "./chunk-PQRTINW2.js",
  "./chunk-PYJ4BJSQ.js",
  "./chunk-Q4DQZVRN.js",
  "./chunk-Q4FX7L2P.js",
  "./chunk-Q7LFJQIY.js",
  "./chunk-QF3L5BGG.js",
  "./chunk-QUBBM3XM.js",
  "./chunk-R4SMXPTR.js",
  "./chunk-RDY2EGXL.js",
  "./chunk-RHC3MWM6.js",
  "./chunk-RLIRFMFZ.js",
  "./chunk-S24YZLS5.js",
  "./chunk-SA2ICF6R.js",
  "./chunk-SK7ZAIE4.js",
  "./chunk-SYDWONJE.js",
  "./chunk-TR236R7B.js",
  "./chunk-U744LSFM.js",
  "./chunk-UASXBRNA.js",
  "./chunk-UGZ2MUGH.js",
  "./chunk-UIP27ZX7.js",
  "./chunk-UQS5S3IO.js",
  "./chunk-URQMBXJM.js",
  "./chunk-V2TKIVZE.js",
  "./chunk-VNUDXFXN.js",
  "./chunk-VWSZVECS.js",
  "./chunk-W4HTRNN7.js",
  "./chunk-WESEFT3B.js",
  "./chunk-WGB7Y4UI.js",
  "./chunk-WGTYHQKZ.js",
  "./chunk-XUQ63IBG.js",
  "./chunk-XURDOF6L.js",
  "./chunk-XXV2AMCQ.js",
  "./chunk-Y7RPZZ7J.js",
  "./chunk-YHTXTUUN.js",
  "./chunk-YJ2KT32Q.js",
  "./chunk-YPYKNHD4.js",
  "./chunk-YRGEUOR2.js",
  "./chunk-ZLZEA5RI.js",
  "./chunk-ZPKITENB.js",
  "./chunk-ZRHBFZYE.js",
  "./chunk-ZXGA5WNN.js",
  "./main-R4MRDJMV.js",
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
