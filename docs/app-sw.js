const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-38cd448359ee-20260919231618";
const BUILD_ID = "38cd448359ee-20260919231618";
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
  './assets/idea/article-fallback.svg',
  './assets/i18n/en.json',
  './assets/i18n/hu.json'
];
const PRECACHE_BUILD_URLS = [
  "./chunk-22B4TD2I.js",
  "./chunk-26IWFVVI.js",
  "./chunk-2DETRMY2.js",
  "./chunk-2OUX3KOP.js",
  "./chunk-2PIXAD7O.js",
  "./chunk-2RVOLHOQ.js",
  "./chunk-2UYBVHAT.js",
  "./chunk-2XWNLLDN.js",
  "./chunk-2Y7RVVYM.js",
  "./chunk-2YH4XSGG.js",
  "./chunk-326BUWLT.js",
  "./chunk-35PONSXN.js",
  "./chunk-37QRRAB4.js",
  "./chunk-3LXYKJ74.js",
  "./chunk-4G4T43ZB.js",
  "./chunk-4J7HDCSC.js",
  "./chunk-4QEQMBBR.js",
  "./chunk-5JVVO4RG.js",
  "./chunk-5LRPZT3H.js",
  "./chunk-5NS3WXRV.js",
  "./chunk-5O4K52QU.js",
  "./chunk-5XOUBM5J.js",
  "./chunk-5Y5WSATS.js",
  "./chunk-5ZXXVFSY.js",
  "./chunk-62PJ6MHD.js",
  "./chunk-674DYZYY.js",
  "./chunk-67R332RA.js",
  "./chunk-6APGJ3T2.js",
  "./chunk-6PDC3YQA.js",
  "./chunk-6YPWQMB4.js",
  "./chunk-744OZNZI.js",
  "./chunk-76GSKEQJ.js",
  "./chunk-7SADZZGY.js",
  "./chunk-A3MNUQ3M.js",
  "./chunk-A4WQOAF3.js",
  "./chunk-A5H4WUS5.js",
  "./chunk-ADLL3NAR.js",
  "./chunk-ADPTSFTT.js",
  "./chunk-AGQDMGHK.js",
  "./chunk-AN7WIX4K.js",
  "./chunk-APRSKZEX.js",
  "./chunk-AUXZEOWF.js",
  "./chunk-BA3DHQPG.js",
  "./chunk-BATZDWSZ.js",
  "./chunk-BBSR2CU4.js",
  "./chunk-BKXE5UOP.js",
  "./chunk-BS2E5ZJB.js",
  "./chunk-BYIWLRJA.js",
  "./chunk-C5RRRVTW.js",
  "./chunk-C7CZUB5J.js",
  "./chunk-CAO5LEZM.js",
  "./chunk-CDGYZVLN.js",
  "./chunk-CUKCHLR2.js",
  "./chunk-CWT2XNUW.js",
  "./chunk-D32QR6HZ.js",
  "./chunk-DD2XJZF3.js",
  "./chunk-DDENSBM4.js",
  "./chunk-DTFMWX35.js",
  "./chunk-DVUYSTD4.js",
  "./chunk-E6DIGPD3.js",
  "./chunk-EEP6OZF2.js",
  "./chunk-EES7PQ3H.js",
  "./chunk-EIHRY7YZ.js",
  "./chunk-ENE5XMCN.js",
  "./chunk-EOSPLY27.js",
  "./chunk-F7EP4YEE.js",
  "./chunk-F7ZQCI4R.js",
  "./chunk-FDXELSNT.js",
  "./chunk-FLSHMOHT.js",
  "./chunk-FYB355NV.js",
  "./chunk-FZ6FB3W7.js",
  "./chunk-G2NGSQ3G.js",
  "./chunk-G3CXSXJ2.js",
  "./chunk-GDCRBMNT.js",
  "./chunk-GDLJASNT.js",
  "./chunk-GHT2G3I5.js",
  "./chunk-GIZE7VD3.js",
  "./chunk-GQEXEQZ5.js",
  "./chunk-GYQDMESL.js",
  "./chunk-HSHE2XE7.js",
  "./chunk-HUMNNKRS.js",
  "./chunk-I3FHEAI2.js",
  "./chunk-I4IS7SUS.js",
  "./chunk-IGDNI62Z.js",
  "./chunk-IHRTLGU3.js",
  "./chunk-IILX2ELL.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-IZEPV2KO.js",
  "./chunk-J3YZFTGE.js",
  "./chunk-JCOND7OE.js",
  "./chunk-JD2COPHK.js",
  "./chunk-JLFBQSGP.js",
  "./chunk-K52YIAW6.js",
  "./chunk-K5HEPBGJ.js",
  "./chunk-KFJN5RFR.js",
  "./chunk-KIV4W566.js",
  "./chunk-KU7WIID2.js",
  "./chunk-KUEUSGDA.js",
  "./chunk-KZYEXMU7.js",
  "./chunk-L37SH2JI.js",
  "./chunk-L73HRELW.js",
  "./chunk-LCLOWF2O.js",
  "./chunk-LH4NWDMX.js",
  "./chunk-LIKMQAAR.js",
  "./chunk-M362O6WO.js",
  "./chunk-MB3547T3.js",
  "./chunk-MELXXMYZ.js",
  "./chunk-MHGCBI53.js",
  "./chunk-MVRCCI53.js",
  "./chunk-MZFHG6GT.js",
  "./chunk-N4ZRBTD5.js",
  "./chunk-N5NL36MB.js",
  "./chunk-ND5XBPBL.js",
  "./chunk-NQR3BOWK.js",
  "./chunk-O2DDG2OF.js",
  "./chunk-O3AX62TV.js",
  "./chunk-O4W24K73.js",
  "./chunk-OIJTVJIJ.js",
  "./chunk-OKAE4WPT.js",
  "./chunk-OMR35YGW.js",
  "./chunk-PEOHYTNA.js",
  "./chunk-PFALLHXR.js",
  "./chunk-PNZNZMDR.js",
  "./chunk-PUD4OG3U.js",
  "./chunk-Q6HHVOF7.js",
  "./chunk-QENWEKY5.js",
  "./chunk-QGNZIHUE.js",
  "./chunk-QXPWGCHM.js",
  "./chunk-R56PX2HN.js",
  "./chunk-RE5656NV.js",
  "./chunk-RJCMK7GU.js",
  "./chunk-RM7FYGDX.js",
  "./chunk-S24YZLS5.js",
  "./chunk-S7HBX6B5.js",
  "./chunk-SADW6AFL.js",
  "./chunk-SDDC5RBB.js",
  "./chunk-SIWQCIQA.js",
  "./chunk-SKWUS4NU.js",
  "./chunk-SUEHY32N.js",
  "./chunk-T3INJHFH.js",
  "./chunk-TF3LSB2F.js",
  "./chunk-TP3JM5EJ.js",
  "./chunk-TPXY4SQJ.js",
  "./chunk-TS5I54HI.js",
  "./chunk-TZNFIEZ5.js",
  "./chunk-UIRV52AT.js",
  "./chunk-UPRYHXUV.js",
  "./chunk-UWCKOYRQ.js",
  "./chunk-UWWVUBB5.js",
  "./chunk-V5GCLQLA.js",
  "./chunk-V5YS2TZS.js",
  "./chunk-VJQTALU2.js",
  "./chunk-W6SXM3MA.js",
  "./chunk-WW6NH3M2.js",
  "./chunk-WW7BTZ4V.js",
  "./chunk-WYACKFS5.js",
  "./chunk-WYDYX33K.js",
  "./chunk-X63CJMHH.js",
  "./chunk-X6L4GJ4X.js",
  "./chunk-XG7YS5YE.js",
  "./chunk-XOOM4XOK.js",
  "./chunk-XWLT7WG6.js",
  "./chunk-Y7NML6YT.js",
  "./chunk-YF4GV6AS.js",
  "./chunk-YG4CVVRX.js",
  "./chunk-YGP2YQDX.js",
  "./chunk-YKUR62M5.js",
  "./chunk-YNWLOII4.js",
  "./chunk-Z7EZXDUX.js",
  "./chunk-ZBB7EPDS.js",
  "./chunk-ZDHC5ARM.js",
  "./chunk-ZR557M5U.js",
  "./chunk-ZTNM63T7.js",
  "./chunk-ZTWCIAML.js",
  "./chunk-ZVMJUAJI.js",
  "./main-62E2KMLR.js",
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

function isPublicMediaUrl(url) {
  if (!['/media/public', '/api/media/public'].includes(url.pathname)) return false;
  const key = url.searchParams.get('key') || '';
  return key.length <= 2048 && !key.includes('\\') && !/[\x00-\x1f\x7f]/.test(key)
    && key.split('/').every(part => part !== '' && part !== '.' && part !== '..')
    && ['public/demo/', 'public/branding/', 'images/demo-profiles/', 'images/demo-assets/',
      'images/demo-events/', 'images/system/', 'payment-cards/'].some(prefix => key.startsWith(prefix));
}

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
    for (const name of [API_CACHE, MEDIA_CACHE]) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      await Promise.all(requests.filter(request => {
        const path = new URL(request.url).pathname;
        return path.startsWith('/api/auth/me')
          || (name === MEDIA_CACHE && !path.startsWith('/assets/') && !isPublicMediaUrl(new URL(request.url)));
      }).map(request => cache.delete(request)));
    }
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
    const isAssetPage = url.origin === self.location.origin
      && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.html');
    event.respondWith(isAssetPage ? networkFirstStaticAsset(request) : serveAppShell(request));
    return;
  }

  if (isImageRequest(request)) {
    if (url.origin !== self.location.origin || !(url.pathname.startsWith('/assets/') || isPublicMediaUrl(url))) {
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
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.some(client => client.visibilityState === 'visible'
      && client.url.startsWith(self.registration.scope))) {
      return;
    }
    const branding = await deploymentBranding();
    await self.registration.showNotification(
      payload.title || branding.productName,
      {
      body: payload.body,
      icon: payload.icon || branding.logoUrl,
      badge: payload.badge || branding.logoUrl,
      tag: payload.tag,
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
  // Angular content-hashed bundles are immutable, including lazy chunks.
  // Reuse the current/retained build cache before contacting the network.
  if (/\/[\w.-]+-[A-Z0-9]{8}\.(?:js|css)$/.test(new URL(request.url).pathname)) {
    const cached = await matchAppBundleCache(request);
    if (cached) {
      return cached;
    }
  }
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
      tag: notification.tag || data.tag || '',
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
