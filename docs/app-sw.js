const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-0bad56e43993-20261009025901";
const BUILD_ID = "0bad56e43993-20261009025901";
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
  "./chunk-2AC2G7KH.js",
  "./chunk-2BJDOCDB.js",
  "./chunk-2VLZFV5L.js",
  "./chunk-2WU4ZEUY.js",
  "./chunk-32RRUW2B.js",
  "./chunk-3AEMBKL6.js",
  "./chunk-3DQ4UUGR.js",
  "./chunk-3DXCK3VD.js",
  "./chunk-3IIM4SQ4.js",
  "./chunk-3MB4KHHS.js",
  "./chunk-3PYPUNY4.js",
  "./chunk-3YWNWQ46.js",
  "./chunk-42MER5EK.js",
  "./chunk-44KDZOGQ.js",
  "./chunk-47X2T52C.js",
  "./chunk-4FVTIKBN.js",
  "./chunk-4QEQMBBR.js",
  "./chunk-4WV5EWNS.js",
  "./chunk-52RYEKUF.js",
  "./chunk-52VO776T.js",
  "./chunk-537R5B6M.js",
  "./chunk-555WDEMD.js",
  "./chunk-5BM35WN7.js",
  "./chunk-5GDER6WZ.js",
  "./chunk-5ITE3FEZ.js",
  "./chunk-5LRPZT3H.js",
  "./chunk-5OKSAZYZ.js",
  "./chunk-67VEXNN7.js",
  "./chunk-6AXN5CDR.js",
  "./chunk-6EDBXEIH.js",
  "./chunk-6PDC3YQA.js",
  "./chunk-6UWS3LLN.js",
  "./chunk-72PGSBVL.js",
  "./chunk-76TYLXS6.js",
  "./chunk-7BTQTTVS.js",
  "./chunk-7FPECJDP.js",
  "./chunk-7IGRUVUA.js",
  "./chunk-7XO6H22D.js",
  "./chunk-AEIXXNOU.js",
  "./chunk-AELW2D62.js",
  "./chunk-AIKUVFKR.js",
  "./chunk-AJFMU27A.js",
  "./chunk-ALI5VE7N.js",
  "./chunk-ALM7TSIZ.js",
  "./chunk-AMRUDHNF.js",
  "./chunk-ANOSC5N4.js",
  "./chunk-AXYZIURG.js",
  "./chunk-B5Q4WLSW.js",
  "./chunk-BA3DHQPG.js",
  "./chunk-BD4XCMBK.js",
  "./chunk-BKH62SGS.js",
  "./chunk-BMYHHB4W.js",
  "./chunk-BWD3XYP6.js",
  "./chunk-C34SUBG6.js",
  "./chunk-CESIK64J.js",
  "./chunk-CFW4YKZG.js",
  "./chunk-CHESMOKX.js",
  "./chunk-CMGNVJRD.js",
  "./chunk-CV35JFC6.js",
  "./chunk-CZ6CSLZJ.js",
  "./chunk-DBGBZT2C.js",
  "./chunk-DDZCKWCR.js",
  "./chunk-DGLISXWP.js",
  "./chunk-DIFQ2PYF.js",
  "./chunk-DQLW33CS.js",
  "./chunk-DV4SE2YG.js",
  "./chunk-E4IAX5NQ.js",
  "./chunk-ED7AHH25.js",
  "./chunk-EJKFXCWZ.js",
  "./chunk-EMV3HFKW.js",
  "./chunk-F5WZWBTC.js",
  "./chunk-F6J6NTRU.js",
  "./chunk-F7SQQLJP.js",
  "./chunk-FGE4Q3HS.js",
  "./chunk-FIGX5NZK.js",
  "./chunk-FIREHWX5.js",
  "./chunk-FLDMR3WW.js",
  "./chunk-FUBOONHD.js",
  "./chunk-GCD2BOUU.js",
  "./chunk-GKWWJRKG.js",
  "./chunk-GLXTER4X.js",
  "./chunk-GNYYSXFS.js",
  "./chunk-GTWNOCBJ.js",
  "./chunk-GWQV5X2J.js",
  "./chunk-HIVAOSX5.js",
  "./chunk-HNHLPPV5.js",
  "./chunk-HOP4WUH5.js",
  "./chunk-HQVYDTPU.js",
  "./chunk-HTFREOAH.js",
  "./chunk-HUNEBYJ7.js",
  "./chunk-HYBWIQKT.js",
  "./chunk-HYLWPDHI.js",
  "./chunk-HZQP7H4T.js",
  "./chunk-I3IQBSIU.js",
  "./chunk-IAJIBXWT.js",
  "./chunk-IESVZVPA.js",
  "./chunk-IKI7WSBU.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-INJCK3SS.js",
  "./chunk-INOTJ2ST.js",
  "./chunk-IO4GQAZO.js",
  "./chunk-IRRPN4FW.js",
  "./chunk-ITKSAAL3.js",
  "./chunk-IUBB6EXD.js",
  "./chunk-IWGHAF6K.js",
  "./chunk-J5U7MPHA.js",
  "./chunk-JACFMFHQ.js",
  "./chunk-JEFJQF4Q.js",
  "./chunk-JQEDCNJL.js",
  "./chunk-JQLBQC3W.js",
  "./chunk-JSYCW6TN.js",
  "./chunk-JZQ64PKL.js",
  "./chunk-K2XBFXCP.js",
  "./chunk-K4AI5JDV.js",
  "./chunk-K5KERG4M.js",
  "./chunk-KFH3RROP.js",
  "./chunk-KP45MNS2.js",
  "./chunk-KQK6HPL5.js",
  "./chunk-L3FQLHTL.js",
  "./chunk-L4KHYHYT.js",
  "./chunk-L4WHVLA4.js",
  "./chunk-L5RFY23N.js",
  "./chunk-LDNWHJEC.js",
  "./chunk-LJKQAPHI.js",
  "./chunk-LKKNL6PW.js",
  "./chunk-LMHPB5TU.js",
  "./chunk-LT3CG3WO.js",
  "./chunk-M362O6WO.js",
  "./chunk-MASR5SXG.js",
  "./chunk-MDNQ5QAJ.js",
  "./chunk-MHDFKFKC.js",
  "./chunk-MIST464T.js",
  "./chunk-MJZMWILS.js",
  "./chunk-MMPT5GAH.js",
  "./chunk-N2BL3X7O.js",
  "./chunk-NCO67HT3.js",
  "./chunk-NESOFGRM.js",
  "./chunk-NF6Z7D5B.js",
  "./chunk-NLEHAA5N.js",
  "./chunk-NRND3AGZ.js",
  "./chunk-NSBN2TBF.js",
  "./chunk-NSRZNSBD.js",
  "./chunk-NWJYXIUI.js",
  "./chunk-O2NLTOWS.js",
  "./chunk-OAD5X2AG.js",
  "./chunk-OAOTIHKC.js",
  "./chunk-OB6DOI7R.js",
  "./chunk-OJCYBGML.js",
  "./chunk-OMOLGUMV.js",
  "./chunk-OMR35YGW.js",
  "./chunk-OV4ZZQUC.js",
  "./chunk-OVKPMEBZ.js",
  "./chunk-OYJNBV6P.js",
  "./chunk-OYUGG2AD.js",
  "./chunk-PAU26ZUY.js",
  "./chunk-PBDPSTNN.js",
  "./chunk-PBZA6IEK.js",
  "./chunk-PCLFVDFC.js",
  "./chunk-PDDCMT3P.js",
  "./chunk-PDONFZCG.js",
  "./chunk-PGP2BSLD.js",
  "./chunk-PLB7ILNY.js",
  "./chunk-PM36XNHD.js",
  "./chunk-PN4HUYWR.js",
  "./chunk-PO5MCGZ4.js",
  "./chunk-Q3VO7YTP.js",
  "./chunk-QAK3XX52.js",
  "./chunk-QEPP6Q3X.js",
  "./chunk-QHM3B6AC.js",
  "./chunk-QKSG5MY5.js",
  "./chunk-QQVTUYXC.js",
  "./chunk-QSSBTGXL.js",
  "./chunk-QZBNZMLG.js",
  "./chunk-QZKS5HRR.js",
  "./chunk-RA4ZP2CW.js",
  "./chunk-RBCUG4YQ.js",
  "./chunk-RBJAEC3R.js",
  "./chunk-RCLLBC3O.js",
  "./chunk-RNSCRVIO.js",
  "./chunk-ROM6SVJI.js",
  "./chunk-RTPKJVY6.js",
  "./chunk-RUNSFMNX.js",
  "./chunk-RVA3J4LB.js",
  "./chunk-RZUW4KGC.js",
  "./chunk-S24YZLS5.js",
  "./chunk-S54QZA72.js",
  "./chunk-SANHMUDO.js",
  "./chunk-SAVP47XY.js",
  "./chunk-SDUXB54B.js",
  "./chunk-SGPY7UZI.js",
  "./chunk-SHYJI7ET.js",
  "./chunk-SJW5YSJX.js",
  "./chunk-SJZI447C.js",
  "./chunk-SMBARNUT.js",
  "./chunk-SRDGWJA6.js",
  "./chunk-ST5WBYHY.js",
  "./chunk-SXE4FGID.js",
  "./chunk-TO2RE4KB.js",
  "./chunk-TP2J4PHL.js",
  "./chunk-TPXY4SQJ.js",
  "./chunk-TV73LWR7.js",
  "./chunk-TWQA42NE.js",
  "./chunk-UAGON5B5.js",
  "./chunk-UKEGQT6O.js",
  "./chunk-ULCKWT24.js",
  "./chunk-UPKDF4VN.js",
  "./chunk-UV57F7BQ.js",
  "./chunk-V7IMFPX2.js",
  "./chunk-VDQLBR3D.js",
  "./chunk-VEFJZBR6.js",
  "./chunk-VIUYV5I6.js",
  "./chunk-VLP52G5Y.js",
  "./chunk-VM7OLACY.js",
  "./chunk-VTPRE7G5.js",
  "./chunk-VWFSM443.js",
  "./chunk-VXZ2E5UV.js",
  "./chunk-WBKHBYFA.js",
  "./chunk-WE5GY3GM.js",
  "./chunk-WE7BQOKD.js",
  "./chunk-WED2SPQL.js",
  "./chunk-WVZQ5H7C.js",
  "./chunk-XDG6EN32.js",
  "./chunk-XE3LNLV6.js",
  "./chunk-XFCPJ7VI.js",
  "./chunk-XJR67B3G.js",
  "./chunk-XNRBXTVX.js",
  "./chunk-XO7YV3CJ.js",
  "./chunk-XSU6LGCI.js",
  "./chunk-XV6A4PAS.js",
  "./chunk-XY5SCCHK.js",
  "./chunk-Y76IIR4U.js",
  "./chunk-YEFGAPYG.js",
  "./chunk-YF5SMAQB.js",
  "./chunk-YFQCQKOS.js",
  "./chunk-YFWQLRDP.js",
  "./chunk-YM3767A2.js",
  "./chunk-YPJNHZB4.js",
  "./chunk-YQ2RXCJ3.js",
  "./chunk-YQ4HOQUF.js",
  "./chunk-YSJBCP6H.js",
  "./chunk-YVFJLHHH.js",
  "./chunk-ZCKUZOVQ.js",
  "./chunk-ZEQNRGAA.js",
  "./chunk-ZFXVIM3S.js",
  "./chunk-ZMQZJ3UP.js",
  "./chunk-ZRMNR7MV.js",
  "./main-SLGOXVCM.js",
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
  "./styles-BOT27C4F.css"
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
      event.respondWith(staleWhileRevalidate(request, API_CACHE, event));
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

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: 'no-store',
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}) });
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) {
      return request.mode === 'navigate' ? offlineAppShell(cached) : cached;
    }
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) {
        return offlineAppShell(fallback);
      }
    }
    return unavailableResponse(request);
  }
}

async function offlineAppShell(cached) {
  // A cached page is still usable, but its former green status is not current.
  const html = (await cached.text()).replace(
    /(<script\b[^>]*\bid=["']myscoutee-runtime-status["'][^>]*>)[\s\S]*?(<\/script>)/i,
    '$1null$2'
  );
  const headers = new Headers(cached.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  return new Response(html, { status: cached.status, headers });
}

async function serveAppShell(request) {
  // The HTML head carries current nginx readiness; an old cached green snapshot
  // must not bypass it. Hashed bundles keep their existing cache-first behavior.
  return networkFirst(request, APP_CACHE, 1000);
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

async function staleWhileRevalidate(request, cacheName, event) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetchAndCache(request, cache).catch(() => null);
  event?.waitUntil(refresh.then(() => undefined));
  if (cached) {
    return cached;
  }
  // The query identifies the landing group and language, including its policy.
  // A cache miss must wait for that response, never substitute another group.
  return await refresh || unavailableResponse(request);
}

async function fetchAndCache(request, cache) {
  const response = await fetch(request, { cache: 'no-store' });
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone());
  }
  return response;
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
