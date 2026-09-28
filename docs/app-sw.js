const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-a26735a73f23-20260928083538";
const BUILD_ID = "a26735a73f23-20260928083538";
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
  "./chunk-26ZCF4KU.js",
  "./chunk-2AMTND6R.js",
  "./chunk-2GQQE5H5.js",
  "./chunk-2IWW6LCE.js",
  "./chunk-2JVQHXKB.js",
  "./chunk-2MCYV4OT.js",
  "./chunk-2NCSPLNK.js",
  "./chunk-2NDLJOV4.js",
  "./chunk-2URHZKYW.js",
  "./chunk-3ASOATZ3.js",
  "./chunk-3LP7E4BH.js",
  "./chunk-3PM2L3VW.js",
  "./chunk-43U5V7OF.js",
  "./chunk-4AX6NEVX.js",
  "./chunk-4LDDAILY.js",
  "./chunk-4MATXNQ5.js",
  "./chunk-4QEQMBBR.js",
  "./chunk-552DFLTM.js",
  "./chunk-5ABFQKAJ.js",
  "./chunk-5AXVARFW.js",
  "./chunk-5IPQK35X.js",
  "./chunk-5J6ZH36F.js",
  "./chunk-5LRPZT3H.js",
  "./chunk-5TDV3ZBZ.js",
  "./chunk-5Z4OFJCJ.js",
  "./chunk-6A4G5AYO.js",
  "./chunk-6LJ67NJS.js",
  "./chunk-6PAXLWOY.js",
  "./chunk-6PNXRQ4X.js",
  "./chunk-6SAJLSH4.js",
  "./chunk-6UN3L4IJ.js",
  "./chunk-73HWO4TO.js",
  "./chunk-73PILIKR.js",
  "./chunk-75IALLCA.js",
  "./chunk-76T45DB2.js",
  "./chunk-7BGRRP6N.js",
  "./chunk-7GWPPI2E.js",
  "./chunk-7MHRTWAZ.js",
  "./chunk-7PRSDBJT.js",
  "./chunk-7QJK7X6P.js",
  "./chunk-7YWD4FQ5.js",
  "./chunk-A3O63NOH.js",
  "./chunk-AB4MHGJC.js",
  "./chunk-AEIXXNOU.js",
  "./chunk-AIKUVFKR.js",
  "./chunk-AJU4OILJ.js",
  "./chunk-AJX6PQL3.js",
  "./chunk-B4JAZDSE.js",
  "./chunk-B5NJYQ43.js",
  "./chunk-B5XYJRFY.js",
  "./chunk-BA3DHQPG.js",
  "./chunk-BD5YEJTV.js",
  "./chunk-BGAZQPHF.js",
  "./chunk-BQXIBZLH.js",
  "./chunk-BZFOWTO4.js",
  "./chunk-C2KW5LTA.js",
  "./chunk-CAZYZVHW.js",
  "./chunk-CEEAIJWW.js",
  "./chunk-CP2HOPAG.js",
  "./chunk-D7V5UGFE.js",
  "./chunk-DAF23PWA.js",
  "./chunk-DDLKZT4G.js",
  "./chunk-DJQ2OATW.js",
  "./chunk-DM53MZVW.js",
  "./chunk-DRSZ7TF3.js",
  "./chunk-DYBKUUDX.js",
  "./chunk-E4DF3ZUX.js",
  "./chunk-E6V33B2Z.js",
  "./chunk-EGCPG37T.js",
  "./chunk-EGXYN3VD.js",
  "./chunk-EHVE7SLR.js",
  "./chunk-EHY4UZLO.js",
  "./chunk-EJ7LU4TU.js",
  "./chunk-EONY7R6P.js",
  "./chunk-EQ4T7IT7.js",
  "./chunk-EW3ZM4Q4.js",
  "./chunk-FB5NWUH7.js",
  "./chunk-FHFRLGYW.js",
  "./chunk-FNPUPUQ5.js",
  "./chunk-FOU2OO5V.js",
  "./chunk-FP5I26E2.js",
  "./chunk-FRWA7UGJ.js",
  "./chunk-FTO6FHYC.js",
  "./chunk-G5FH5ZWC.js",
  "./chunk-GHBJAWOK.js",
  "./chunk-H33NKNZY.js",
  "./chunk-H3A4M5OL.js",
  "./chunk-H75FKRZG.js",
  "./chunk-HQCX62DT.js",
  "./chunk-HVJ4AHCZ.js",
  "./chunk-HZH4SO6W.js",
  "./chunk-I22YYLYO.js",
  "./chunk-I4QG4GBM.js",
  "./chunk-IC5JJ5EM.js",
  "./chunk-IKI7WSBU.js",
  "./chunk-IKRX7QIM.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-IP7HBCTM.js",
  "./chunk-IXV5R7M5.js",
  "./chunk-J2IDPHN4.js",
  "./chunk-J352PH7N.js",
  "./chunk-J6M5NJ7W.js",
  "./chunk-JA7ZT6ST.js",
  "./chunk-JKVIZG6Y.js",
  "./chunk-JM63RIBP.js",
  "./chunk-JMLDAL3E.js",
  "./chunk-JNXNC3D6.js",
  "./chunk-JQLBQC3W.js",
  "./chunk-JQOG2MXI.js",
  "./chunk-JRLGEWUR.js",
  "./chunk-JUXFY5K6.js",
  "./chunk-KCS7ZTGD.js",
  "./chunk-KEDUW5WA.js",
  "./chunk-KU4EMC62.js",
  "./chunk-L4RWB2ZN.js",
  "./chunk-L6E4TN53.js",
  "./chunk-L6R6BOVG.js",
  "./chunk-LFO73VIO.js",
  "./chunk-LQWM3WZH.js",
  "./chunk-LTL4WKNN.js",
  "./chunk-LWGBIXAG.js",
  "./chunk-M362O6WO.js",
  "./chunk-MGTTP2QU.js",
  "./chunk-MKJS4UOZ.js",
  "./chunk-MNMZE3XI.js",
  "./chunk-MTDHJ2SK.js",
  "./chunk-N4S2OBO4.js",
  "./chunk-N6I2DJYQ.js",
  "./chunk-NARV6YW5.js",
  "./chunk-O3PJR3ZI.js",
  "./chunk-O6PG2GNP.js",
  "./chunk-OAEOGRUZ.js",
  "./chunk-OAOTIHKC.js",
  "./chunk-ODY6AMAL.js",
  "./chunk-OH2BRHWD.js",
  "./chunk-OI3CHGYL.js",
  "./chunk-OMR35YGW.js",
  "./chunk-OOFK6SZF.js",
  "./chunk-ORYOYVWQ.js",
  "./chunk-OZPYU7VQ.js",
  "./chunk-PK6ZEJQE.js",
  "./chunk-PQMK7PM3.js",
  "./chunk-PRNYHVZO.js",
  "./chunk-PTAGU5NM.js",
  "./chunk-PY73AZIE.js",
  "./chunk-QAZJL3P4.js",
  "./chunk-QF5T5W4N.js",
  "./chunk-QMNSB4HF.js",
  "./chunk-RIZN7OWP.js",
  "./chunk-RNWSB4FU.js",
  "./chunk-RXDLYJHK.js",
  "./chunk-S24YZLS5.js",
  "./chunk-S4J4XJW2.js",
  "./chunk-SFAU5YQC.js",
  "./chunk-SKMEFZUR.js",
  "./chunk-SKZBXXKA.js",
  "./chunk-SSECHEOS.js",
  "./chunk-STW3O26U.js",
  "./chunk-T4GO5ZNR.js",
  "./chunk-T5KIRQFB.js",
  "./chunk-T7ZORFXI.js",
  "./chunk-TDU5LMO6.js",
  "./chunk-TG2SJCKB.js",
  "./chunk-TIZMXAZ4.js",
  "./chunk-TPKFC3AX.js",
  "./chunk-TPXY4SQJ.js",
  "./chunk-TXDLBP7E.js",
  "./chunk-TZJ7UJ5J.js",
  "./chunk-UBQY4G7J.js",
  "./chunk-V35GMI5F.js",
  "./chunk-V3BX6R5N.js",
  "./chunk-VE6SM7EP.js",
  "./chunk-VGAO73IH.js",
  "./chunk-VR7LYL4G.js",
  "./chunk-VSFASN37.js",
  "./chunk-W4GK7T66.js",
  "./chunk-W6OQB2MT.js",
  "./chunk-WBBV3LUA.js",
  "./chunk-WBEAI6LZ.js",
  "./chunk-WBZHYHNK.js",
  "./chunk-WL6JTY45.js",
  "./chunk-WPA3ERHI.js",
  "./chunk-WQCQ7ZFW.js",
  "./chunk-WXW7CUUL.js",
  "./chunk-X56DKQ4Q.js",
  "./chunk-XDA73VXP.js",
  "./chunk-XIOTUZM2.js",
  "./chunk-XKRXNQEQ.js",
  "./chunk-XLSPWOQM.js",
  "./chunk-XNTYLU5D.js",
  "./chunk-XT3C72Y2.js",
  "./chunk-XWVRSUZG.js",
  "./chunk-Y4KKIHA2.js",
  "./chunk-YFF6CWBY.js",
  "./chunk-YLSKAYU4.js",
  "./chunk-YZHMUGOP.js",
  "./chunk-YZKRGWPD.js",
  "./chunk-Z7BGPJKZ.js",
  "./chunk-ZA6THELS.js",
  "./chunk-ZCBZLJ5Q.js",
  "./chunk-ZCMRAU52.js",
  "./chunk-ZHMDEYIQ.js",
  "./chunk-ZJE6H7QK.js",
  "./chunk-ZLIMPB2S.js",
  "./chunk-ZNU4SBTG.js",
  "./chunk-ZP5T5GME.js",
  "./chunk-ZTYSKGEO.js",
  "./main-KTR63DTI.js",
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
