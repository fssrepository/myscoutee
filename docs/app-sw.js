const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-d4414ae8158c-20260930201018";
const BUILD_ID = "d4414ae8158c-20260930201018";
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
  "./chunk-24REZC4J.js",
  "./chunk-25CE4GV4.js",
  "./chunk-2E3UJKGU.js",
  "./chunk-2EWYB73S.js",
  "./chunk-2L3SQHNA.js",
  "./chunk-2QEMD55F.js",
  "./chunk-2SFPX622.js",
  "./chunk-375WLRTC.js",
  "./chunk-3BWY4NNW.js",
  "./chunk-3UAOCE27.js",
  "./chunk-3WOEGMVY.js",
  "./chunk-3YREPDVL.js",
  "./chunk-4DVJ4FF3.js",
  "./chunk-4G5RQFNS.js",
  "./chunk-4M6RDNYX.js",
  "./chunk-4OMZM6EP.js",
  "./chunk-4QEQMBBR.js",
  "./chunk-57HH3XWJ.js",
  "./chunk-5KDMV34E.js",
  "./chunk-5LRPZT3H.js",
  "./chunk-5OZAHHMM.js",
  "./chunk-5QYRCT3I.js",
  "./chunk-5SQ3K53Q.js",
  "./chunk-5VHAZXDW.js",
  "./chunk-5WEQJWFZ.js",
  "./chunk-6C5NVZNQ.js",
  "./chunk-6CHICEN3.js",
  "./chunk-6FX6VGVE.js",
  "./chunk-6MKZTYPF.js",
  "./chunk-6UN3L4IJ.js",
  "./chunk-6WORC5OS.js",
  "./chunk-6YJYSZM6.js",
  "./chunk-735LHCLH.js",
  "./chunk-7D3ZN4G6.js",
  "./chunk-7J73YI4Z.js",
  "./chunk-7K4CRZWJ.js",
  "./chunk-7QPKNKXB.js",
  "./chunk-7SJRP6AP.js",
  "./chunk-7Z6AUSOS.js",
  "./chunk-A534ONH7.js",
  "./chunk-AA4QIF3P.js",
  "./chunk-AEGOEEZG.js",
  "./chunk-AEIXXNOU.js",
  "./chunk-AIKUVFKR.js",
  "./chunk-AJCRKQCM.js",
  "./chunk-BA3DHQPG.js",
  "./chunk-BD3CLVWN.js",
  "./chunk-BDDTDYKA.js",
  "./chunk-BFJ5BG3G.js",
  "./chunk-BHL56ZM4.js",
  "./chunk-BK42564O.js",
  "./chunk-C4IJU3CA.js",
  "./chunk-C6A5LP2E.js",
  "./chunk-CPDOF5WH.js",
  "./chunk-D5EUR4UG.js",
  "./chunk-D5MTH7X3.js",
  "./chunk-D6YFZ6KG.js",
  "./chunk-DH2JZ5UI.js",
  "./chunk-DLLAEF7S.js",
  "./chunk-DWJGY4TK.js",
  "./chunk-E64NSQSI.js",
  "./chunk-EEWPFQXJ.js",
  "./chunk-EIXZ4KTL.js",
  "./chunk-EOXBOBRJ.js",
  "./chunk-EPLB4QPC.js",
  "./chunk-EWIMVU7R.js",
  "./chunk-EZCMNZGD.js",
  "./chunk-F6TE4HYX.js",
  "./chunk-FA2STMVX.js",
  "./chunk-FAP5Z4CL.js",
  "./chunk-FB23CPDK.js",
  "./chunk-FQNQFIVG.js",
  "./chunk-FV7DNP5I.js",
  "./chunk-FWCMBYEU.js",
  "./chunk-FYXNF3MD.js",
  "./chunk-G4P2WKKT.js",
  "./chunk-G6TDY6J5.js",
  "./chunk-GCF6ILUI.js",
  "./chunk-GKSVK635.js",
  "./chunk-GRY5CU2N.js",
  "./chunk-GTQCVALZ.js",
  "./chunk-GW2PHI3G.js",
  "./chunk-HDGKA4KW.js",
  "./chunk-HP3QLIU7.js",
  "./chunk-HPWNKHQY.js",
  "./chunk-HXMP6MW4.js",
  "./chunk-HZ6UTAGN.js",
  "./chunk-I6O2NQBN.js",
  "./chunk-IFSJOU4P.js",
  "./chunk-IJ6LKAKJ.js",
  "./chunk-IKI7WSBU.js",
  "./chunk-IKNBGTCW.js",
  "./chunk-ILETJRS4.js",
  "./chunk-ILIVVQWQ.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-ISOBSVI5.js",
  "./chunk-IWN5HOMR.js",
  "./chunk-IWUS6LHB.js",
  "./chunk-IXE2C7WL.js",
  "./chunk-J3NJD2LY.js",
  "./chunk-J6Z2NMZC.js",
  "./chunk-JIXRR4BG.js",
  "./chunk-JQLBQC3W.js",
  "./chunk-JSGLXBZM.js",
  "./chunk-JTCFC7SV.js",
  "./chunk-K3CKGJNV.js",
  "./chunk-KB4NNMXJ.js",
  "./chunk-KBGXNCL4.js",
  "./chunk-KD3PU7K5.js",
  "./chunk-KHVUNZEX.js",
  "./chunk-KK2LX2R6.js",
  "./chunk-KZU2SLZW.js",
  "./chunk-L5XWGHB4.js",
  "./chunk-LEOOXJAH.js",
  "./chunk-LFKJ7XN4.js",
  "./chunk-LHFV4KP4.js",
  "./chunk-LIA5L3EJ.js",
  "./chunk-LK5RBH2Y.js",
  "./chunk-LM6KRTR4.js",
  "./chunk-LS63HLTS.js",
  "./chunk-LVLUBH2T.js",
  "./chunk-M362O6WO.js",
  "./chunk-M3XNTJHE.js",
  "./chunk-M7A4BQ4A.js",
  "./chunk-MHRA2ABW.js",
  "./chunk-MIF3NSNH.js",
  "./chunk-MOQ4WCBF.js",
  "./chunk-MSDUVPR5.js",
  "./chunk-MZYW52KG.js",
  "./chunk-NB26SUBA.js",
  "./chunk-NBUUTFIO.js",
  "./chunk-NLPC6KFS.js",
  "./chunk-NOU7D2UZ.js",
  "./chunk-O37KUCTS.js",
  "./chunk-O3SIWNN2.js",
  "./chunk-O7JVR54Y.js",
  "./chunk-O7OICYGT.js",
  "./chunk-OANFJ4YN.js",
  "./chunk-OAOTIHKC.js",
  "./chunk-OGKWRMZB.js",
  "./chunk-OJZAHRGA.js",
  "./chunk-OMR35YGW.js",
  "./chunk-OV256C2C.js",
  "./chunk-OV73ETWE.js",
  "./chunk-OVU7VPHL.js",
  "./chunk-P6WGPBUJ.js",
  "./chunk-PMZKN4YO.js",
  "./chunk-PPHDHDGI.js",
  "./chunk-PQTTI2ON.js",
  "./chunk-PZQ7CPP6.js",
  "./chunk-Q5QD65A4.js",
  "./chunk-QCHWAAUP.js",
  "./chunk-QLYFWFJV.js",
  "./chunk-QQAPKIF5.js",
  "./chunk-QWDVT7MX.js",
  "./chunk-QXTAIIBJ.js",
  "./chunk-R25S43R7.js",
  "./chunk-R5QBJWK5.js",
  "./chunk-ROOAH3HN.js",
  "./chunk-RPNOUS4C.js",
  "./chunk-RWZRPUT6.js",
  "./chunk-RYDE4NQL.js",
  "./chunk-S24YZLS5.js",
  "./chunk-SDCHPCY4.js",
  "./chunk-SEE5SCY5.js",
  "./chunk-SOYR5XLC.js",
  "./chunk-SR25AODA.js",
  "./chunk-T5ZZY6IQ.js",
  "./chunk-TATYAPOY.js",
  "./chunk-TCXKNAME.js",
  "./chunk-TIG3NR6Y.js",
  "./chunk-TNOBGBFM.js",
  "./chunk-TPXY4SQJ.js",
  "./chunk-TR7IQKY5.js",
  "./chunk-UAMMQ32M.js",
  "./chunk-UFB5WLHA.js",
  "./chunk-UIDCJQHU.js",
  "./chunk-UIJ4I7WF.js",
  "./chunk-UJ6RMHBP.js",
  "./chunk-UKRKRYAK.js",
  "./chunk-UOLGKGZW.js",
  "./chunk-UV2LMH5B.js",
  "./chunk-VFCGOCUS.js",
  "./chunk-VQQVRDRN.js",
  "./chunk-VRV5AOV3.js",
  "./chunk-VTCFRWCQ.js",
  "./chunk-VZHTKDX5.js",
  "./chunk-W3WU6Z2B.js",
  "./chunk-W4V6CM32.js",
  "./chunk-WHAMMUN5.js",
  "./chunk-WKHFALI7.js",
  "./chunk-WRP3DKII.js",
  "./chunk-WRWMCNSP.js",
  "./chunk-X6BQ3O7W.js",
  "./chunk-Y5G3DJPG.js",
  "./chunk-Y5UBHAC5.js",
  "./chunk-YPFE4KJ6.js",
  "./chunk-YU3BK6EI.js",
  "./chunk-Z223M3FN.js",
  "./chunk-Z25VB63B.js",
  "./chunk-Z7HCRWA4.js",
  "./chunk-ZEQNRGAA.js",
  "./chunk-ZG7AVQ4S.js",
  "./chunk-ZLAPP774.js",
  "./chunk-ZP4XHPBG.js",
  "./chunk-ZUFRRYXV.js",
  "./chunk-ZVJ2OCMQ.js",
  "./chunk-ZWSQXHR5.js",
  "./chunk-ZY7AB6LJ.js",
  "./main-FO6MAEJH.js",
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
  "./styles-XPZOUS5X.css"
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
