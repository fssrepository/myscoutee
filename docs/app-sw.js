const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-9b350bf02162-20260928235958";
const BUILD_ID = "9b350bf02162-20260928235958";
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
  "./chunk-24LVRX2C.js",
  "./chunk-27KYIFBT.js",
  "./chunk-2BMW7MK7.js",
  "./chunk-2HUUTZSL.js",
  "./chunk-2ICOTEES.js",
  "./chunk-2IWW6LCE.js",
  "./chunk-2O7ZBQRE.js",
  "./chunk-2OUVLIFR.js",
  "./chunk-2U7FFRYH.js",
  "./chunk-2UATPHJY.js",
  "./chunk-2XZU4ERI.js",
  "./chunk-2ZAAJT5G.js",
  "./chunk-32DBWYE6.js",
  "./chunk-3757DITU.js",
  "./chunk-3FIPCG2I.js",
  "./chunk-3HI74NH6.js",
  "./chunk-3RIGJL4M.js",
  "./chunk-3S3UUBHC.js",
  "./chunk-3W7C3FDY.js",
  "./chunk-4EUSYEXO.js",
  "./chunk-4QEQMBBR.js",
  "./chunk-5AXVARFW.js",
  "./chunk-5HXW4WF6.js",
  "./chunk-5LRPZT3H.js",
  "./chunk-5MBK46CD.js",
  "./chunk-5O4R5BKV.js",
  "./chunk-5RXJDHCK.js",
  "./chunk-5SGMSMWA.js",
  "./chunk-5Y5GYHGS.js",
  "./chunk-5Z4OFJCJ.js",
  "./chunk-62SR4MDP.js",
  "./chunk-6EQYV7BK.js",
  "./chunk-6JT64NQT.js",
  "./chunk-6LJ67NJS.js",
  "./chunk-6UN3L4IJ.js",
  "./chunk-73HWO4TO.js",
  "./chunk-75IALLCA.js",
  "./chunk-76T45DB2.js",
  "./chunk-7CFO6B2E.js",
  "./chunk-7OLIIF3O.js",
  "./chunk-7PRSDBJT.js",
  "./chunk-AEIXXNOU.js",
  "./chunk-AEMKAYJW.js",
  "./chunk-AIKUVFKR.js",
  "./chunk-AJJS3NIG.js",
  "./chunk-AV4A3FR5.js",
  "./chunk-AYEWZQZR.js",
  "./chunk-B2VMWOFQ.js",
  "./chunk-B5XYJRFY.js",
  "./chunk-B6ENHCBP.js",
  "./chunk-BA3DHQPG.js",
  "./chunk-BEYF3G5M.js",
  "./chunk-BG4OLXI2.js",
  "./chunk-BO5BEVGL.js",
  "./chunk-C27TCEWX.js",
  "./chunk-C2KW5LTA.js",
  "./chunk-C5R3CVQ2.js",
  "./chunk-CGWKV7TW.js",
  "./chunk-CUN6G6VG.js",
  "./chunk-D36QEFNL.js",
  "./chunk-D7V5UGFE.js",
  "./chunk-D7VRATPY.js",
  "./chunk-DF7LAULS.js",
  "./chunk-DIOFTQWC.js",
  "./chunk-DJX7MPZY.js",
  "./chunk-DM2GEZRC.js",
  "./chunk-DMDTH4V6.js",
  "./chunk-DUN4RBWB.js",
  "./chunk-DVIOIAXU.js",
  "./chunk-E63HDNBM.js",
  "./chunk-E6V33B2Z.js",
  "./chunk-EAL2TDJU.js",
  "./chunk-EEOHKSRN.js",
  "./chunk-EGXYN3VD.js",
  "./chunk-EHY4UZLO.js",
  "./chunk-EJ7LU4TU.js",
  "./chunk-EJPIWHE5.js",
  "./chunk-ETYCCUIK.js",
  "./chunk-EW3ZM4Q4.js",
  "./chunk-EWTM72IK.js",
  "./chunk-F5MUCFAG.js",
  "./chunk-FAWPJROO.js",
  "./chunk-FJP7B6TI.js",
  "./chunk-FKTN2RUD.js",
  "./chunk-FL4B5Q5J.js",
  "./chunk-FLSKCQ25.js",
  "./chunk-FM7ELAST.js",
  "./chunk-FPCS3YRU.js",
  "./chunk-G5LNDV24.js",
  "./chunk-G72MQCFZ.js",
  "./chunk-GHBJAWOK.js",
  "./chunk-GHPOAKDA.js",
  "./chunk-GIBS3VIU.js",
  "./chunk-GK32366U.js",
  "./chunk-GT2RCGPR.js",
  "./chunk-GTVELOBV.js",
  "./chunk-HBVTCJKB.js",
  "./chunk-HCPZFMHQ.js",
  "./chunk-HQCX62DT.js",
  "./chunk-HUM3AP3N.js",
  "./chunk-HVEPY64Q.js",
  "./chunk-HVJ4AHCZ.js",
  "./chunk-IDFOX5G4.js",
  "./chunk-IEMZFLE2.js",
  "./chunk-IKI7WSBU.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-IPGB5TSH.js",
  "./chunk-IQVN3FU6.js",
  "./chunk-J2WSYG5O.js",
  "./chunk-JKVIZG6Y.js",
  "./chunk-JM63RIBP.js",
  "./chunk-JQLBQC3W.js",
  "./chunk-JQOG2MXI.js",
  "./chunk-JTJK5MAL.js",
  "./chunk-JW57STQM.js",
  "./chunk-KCS7ZTGD.js",
  "./chunk-KE5P7RSU.js",
  "./chunk-KN7NHFMF.js",
  "./chunk-KP5UQTU7.js",
  "./chunk-KQ73B6VY.js",
  "./chunk-KSSEAFT7.js",
  "./chunk-L36YHUXT.js",
  "./chunk-L6PMPBJE.js",
  "./chunk-LAUKAQBC.js",
  "./chunk-LQGN6FPE.js",
  "./chunk-LTBZW3W6.js",
  "./chunk-M362O6WO.js",
  "./chunk-MDQKMA64.js",
  "./chunk-MMUSIE3U.js",
  "./chunk-MNMZE3XI.js",
  "./chunk-MPCX4YED.js",
  "./chunk-MREYFGBD.js",
  "./chunk-MROJFRZJ.js",
  "./chunk-MU6RYJBP.js",
  "./chunk-NNXGZTLS.js",
  "./chunk-NQVQBRQY.js",
  "./chunk-O7YAGOWE.js",
  "./chunk-OAOTIHKC.js",
  "./chunk-ODXTBR7D.js",
  "./chunk-OH2BRHWD.js",
  "./chunk-OK2NMY76.js",
  "./chunk-OKSA4LSG.js",
  "./chunk-OMR35YGW.js",
  "./chunk-OOFK6SZF.js",
  "./chunk-OQKE6YYG.js",
  "./chunk-OUIMUUCM.js",
  "./chunk-P3CK27QH.js",
  "./chunk-P7JASSJL.js",
  "./chunk-P7K5JRZO.js",
  "./chunk-PMMZVMJI.js",
  "./chunk-PQ3FOUL2.js",
  "./chunk-PW6V4IDD.js",
  "./chunk-Q2EDDRTJ.js",
  "./chunk-Q44NWW7E.js",
  "./chunk-Q45BTEG3.js",
  "./chunk-Q5NFGRYH.js",
  "./chunk-QHX24TRT.js",
  "./chunk-R7KIEC5O.js",
  "./chunk-RGCQE3UB.js",
  "./chunk-RNWSB4FU.js",
  "./chunk-RXEC43QV.js",
  "./chunk-S22OSHW5.js",
  "./chunk-S24YZLS5.js",
  "./chunk-SHSGQTLY.js",
  "./chunk-SSOXS3XB.js",
  "./chunk-SSQ62SJ4.js",
  "./chunk-SWRF2X4B.js",
  "./chunk-T3BBHOQV.js",
  "./chunk-T5KIRQFB.js",
  "./chunk-TDU5LMO6.js",
  "./chunk-THYNGFAB.js",
  "./chunk-TLLKNN64.js",
  "./chunk-TPKFC3AX.js",
  "./chunk-TPXY4SQJ.js",
  "./chunk-TS2JG7JE.js",
  "./chunk-UCLFDAP6.js",
  "./chunk-UF5INHFU.js",
  "./chunk-UMUZ7NZN.js",
  "./chunk-UNF4CCLT.js",
  "./chunk-UTIEY3G7.js",
  "./chunk-V5D2FEW4.js",
  "./chunk-VEKN7MDD.js",
  "./chunk-VG2XDWNW.js",
  "./chunk-VGAO73IH.js",
  "./chunk-WLISAOUV.js",
  "./chunk-WLJB5KKQ.js",
  "./chunk-WNVZLH3A.js",
  "./chunk-WWQDG7F4.js",
  "./chunk-WXJIWRQB.js",
  "./chunk-X4FKAAEV.js",
  "./chunk-X4KSVPE2.js",
  "./chunk-X56DKQ4Q.js",
  "./chunk-XD3I3PUE.js",
  "./chunk-XDA73VXP.js",
  "./chunk-XIOTUZM2.js",
  "./chunk-XJVZDNUW.js",
  "./chunk-XMGVHZFE.js",
  "./chunk-XP7QQFEP.js",
  "./chunk-XT3C72Y2.js",
  "./chunk-Y42UDJFU.js",
  "./chunk-YQ2GSBVB.js",
  "./chunk-YWJITUTK.js",
  "./chunk-Z7BGPJKZ.js",
  "./chunk-ZF77OAJ4.js",
  "./chunk-ZIVPPEEG.js",
  "./chunk-ZNU4SBTG.js",
  "./chunk-ZWNNDHFP.js",
  "./main-AYPR6OOX.js",
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
