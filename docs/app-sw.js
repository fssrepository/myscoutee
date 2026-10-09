const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-ea583507831b-20261009035541";
const BUILD_ID = "ea583507831b-20261009035541";
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
  "./chunk-24IZNJNO.js",
  "./chunk-272BZL7Q.js",
  "./chunk-2AFVZUIZ.js",
  "./chunk-2IAS5SKR.js",
  "./chunk-2PHNUEB2.js",
  "./chunk-2RK2QKRX.js",
  "./chunk-2TN6NQ2S.js",
  "./chunk-2VLZFV5L.js",
  "./chunk-2YOIQLXA.js",
  "./chunk-322UFCCL.js",
  "./chunk-3A2HIZVI.js",
  "./chunk-3OBFJS62.js",
  "./chunk-3YWNWQ46.js",
  "./chunk-47X2T52C.js",
  "./chunk-4KCJFJYI.js",
  "./chunk-4LNS7QXH.js",
  "./chunk-4O7QYR2A.js",
  "./chunk-4QEQMBBR.js",
  "./chunk-4QYRUUW6.js",
  "./chunk-52RYEKUF.js",
  "./chunk-55Y73HAO.js",
  "./chunk-5ITE3FEZ.js",
  "./chunk-5KOY55KT.js",
  "./chunk-5LRPZT3H.js",
  "./chunk-5WVM6U6L.js",
  "./chunk-6PDC3YQA.js",
  "./chunk-6Y7RPG7W.js",
  "./chunk-76TYLXS6.js",
  "./chunk-77TKTCFN.js",
  "./chunk-7D65LM3L.js",
  "./chunk-7DANC3E7.js",
  "./chunk-7DQLDWXM.js",
  "./chunk-7EB43O4P.js",
  "./chunk-7GS5OQZ4.js",
  "./chunk-7L6NSSG2.js",
  "./chunk-A3B6C54Y.js",
  "./chunk-A5Q4II5N.js",
  "./chunk-ADVULKFG.js",
  "./chunk-AEIXXNOU.js",
  "./chunk-AELW2D62.js",
  "./chunk-AIKUVFKR.js",
  "./chunk-AM4GDNI5.js",
  "./chunk-AN5FMAVA.js",
  "./chunk-AOGJEJEU.js",
  "./chunk-B5Q4WLSW.js",
  "./chunk-BA3DHQPG.js",
  "./chunk-BESIZMRR.js",
  "./chunk-BESV7UAZ.js",
  "./chunk-BLUZRQZ2.js",
  "./chunk-C34SUBG6.js",
  "./chunk-CARGZI5F.js",
  "./chunk-CESIK64J.js",
  "./chunk-CFW4YKZG.js",
  "./chunk-CIOIQOM4.js",
  "./chunk-CJ3ANKTL.js",
  "./chunk-CJIPK52S.js",
  "./chunk-CM7623FL.js",
  "./chunk-CMGNVJRD.js",
  "./chunk-COAWSRNM.js",
  "./chunk-CZ6CSLZJ.js",
  "./chunk-DBGBZT2C.js",
  "./chunk-DEQITGVY.js",
  "./chunk-DGV4NAVW.js",
  "./chunk-E6EHQNCY.js",
  "./chunk-EHDCY6HP.js",
  "./chunk-EPZA3NNU.js",
  "./chunk-EYVXM6AD.js",
  "./chunk-FDDQFSYI.js",
  "./chunk-FMQL556U.js",
  "./chunk-FP2RVVSL.js",
  "./chunk-FSOPIU26.js",
  "./chunk-FUBOONHD.js",
  "./chunk-FWKRXVUS.js",
  "./chunk-FXNO3GDL.js",
  "./chunk-FXWXG7EM.js",
  "./chunk-G6IFVNBA.js",
  "./chunk-G72ERZQK.js",
  "./chunk-GCFZBWKC.js",
  "./chunk-GDOB3UC4.js",
  "./chunk-GKWWJRKG.js",
  "./chunk-GLXDUONZ.js",
  "./chunk-GOCTUONY.js",
  "./chunk-GRA2QIME.js",
  "./chunk-GRAJYXZX.js",
  "./chunk-GWQV5X2J.js",
  "./chunk-GZ5ECIKZ.js",
  "./chunk-H3K3IAI5.js",
  "./chunk-H47LTUXI.js",
  "./chunk-HBYRN4OF.js",
  "./chunk-HDJY3LEU.js",
  "./chunk-HFWDWOSS.js",
  "./chunk-HMUGZPUK.js",
  "./chunk-HU5AQOGF.js",
  "./chunk-HXPIQQEY.js",
  "./chunk-HYT6TUF3.js",
  "./chunk-HZQP7H4T.js",
  "./chunk-I3IQBSIU.js",
  "./chunk-I3XNYRTS.js",
  "./chunk-I6T66UK7.js",
  "./chunk-IGOFYQGG.js",
  "./chunk-IKI7WSBU.js",
  "./chunk-ILYEL5SY.js",
  "./chunk-IN6DX4F7.js",
  "./chunk-INJCK3SS.js",
  "./chunk-INOTJ2ST.js",
  "./chunk-IO4GQAZO.js",
  "./chunk-IWGHAF6K.js",
  "./chunk-JACFMFHQ.js",
  "./chunk-JAWHVUHR.js",
  "./chunk-JC4LQFC5.js",
  "./chunk-JDX7ZAVX.js",
  "./chunk-JEJ2DH4L.js",
  "./chunk-JGA3MRWO.js",
  "./chunk-JLAZVDWI.js",
  "./chunk-JLUZKGP7.js",
  "./chunk-JQLBQC3W.js",
  "./chunk-JSJH6AWK.js",
  "./chunk-JVQM5NHU.js",
  "./chunk-JZTU2H4V.js",
  "./chunk-K557M4KK.js",
  "./chunk-KBOXQCJB.js",
  "./chunk-KCAASKS7.js",
  "./chunk-KJK3CHS7.js",
  "./chunk-KKXA7ZCY.js",
  "./chunk-KUTZR4WR.js",
  "./chunk-L37N2GKP.js",
  "./chunk-L3FQLHTL.js",
  "./chunk-L4KHYHYT.js",
  "./chunk-L4WHVLA4.js",
  "./chunk-LBOO42PX.js",
  "./chunk-LFAFC3YA.js",
  "./chunk-LMHPB5TU.js",
  "./chunk-LT3CG3WO.js",
  "./chunk-LTCNEDP5.js",
  "./chunk-M362O6WO.js",
  "./chunk-M7J4M66M.js",
  "./chunk-MCK4CN5C.js",
  "./chunk-N2BL3X7O.js",
  "./chunk-NASXEZHI.js",
  "./chunk-NBWRSVOE.js",
  "./chunk-NCO6UZCI.js",
  "./chunk-NEHOCJ5D.js",
  "./chunk-NJJXEINF.js",
  "./chunk-NKZWODG2.js",
  "./chunk-NO2EPUI5.js",
  "./chunk-NP5PILRD.js",
  "./chunk-NSBN2TBF.js",
  "./chunk-NSRZNSBD.js",
  "./chunk-NUI5CV2L.js",
  "./chunk-O2NLTOWS.js",
  "./chunk-O32IBC5P.js",
  "./chunk-O3F3YMHR.js",
  "./chunk-OAOTIHKC.js",
  "./chunk-OB6DOI7R.js",
  "./chunk-OFOQAR76.js",
  "./chunk-OJCYBGML.js",
  "./chunk-OMOLGUMV.js",
  "./chunk-OMR35YGW.js",
  "./chunk-OS36SO7S.js",
  "./chunk-OUFVJNEU.js",
  "./chunk-OVKPMEBZ.js",
  "./chunk-OVLMMOLE.js",
  "./chunk-P5IIA7L3.js",
  "./chunk-PBDPSTNN.js",
  "./chunk-PDDCMT3P.js",
  "./chunk-PLB7ILNY.js",
  "./chunk-PLVAAT7W.js",
  "./chunk-PN4HUYWR.js",
  "./chunk-PWPDUAWM.js",
  "./chunk-QBJDVQG6.js",
  "./chunk-QI7UAQJG.js",
  "./chunk-QIITERLQ.js",
  "./chunk-QKPHMQPY.js",
  "./chunk-QLPXB4OU.js",
  "./chunk-QN5P2RNA.js",
  "./chunk-QNOE5A3B.js",
  "./chunk-QQVTUYXC.js",
  "./chunk-QSSBTGXL.js",
  "./chunk-QZKS5HRR.js",
  "./chunk-R6VOL6UM.js",
  "./chunk-RBJAEC3R.js",
  "./chunk-RTGTCPIY.js",
  "./chunk-RTPKJVY6.js",
  "./chunk-RVA3J4LB.js",
  "./chunk-RWLHXQXL.js",
  "./chunk-S24YZLS5.js",
  "./chunk-S3NYENS3.js",
  "./chunk-S7ILP7AX.js",
  "./chunk-SGPY7UZI.js",
  "./chunk-SHBEEB6U.js",
  "./chunk-SMX2NZBP.js",
  "./chunk-SNLZP6A7.js",
  "./chunk-SOA6MBQC.js",
  "./chunk-SPHBGV5W.js",
  "./chunk-SQIGUUJK.js",
  "./chunk-SUXCT4UW.js",
  "./chunk-SXOYLZYV.js",
  "./chunk-SXUSROAF.js",
  "./chunk-TPXY4SQJ.js",
  "./chunk-TV73LWR7.js",
  "./chunk-TX5W7DJN.js",
  "./chunk-UCHB3LRU.js",
  "./chunk-UDGXDN7P.js",
  "./chunk-UHALAN3T.js",
  "./chunk-ULG2WKGN.js",
  "./chunk-UQWFAD5U.js",
  "./chunk-UUAVW2RG.js",
  "./chunk-UV57F7BQ.js",
  "./chunk-V34OSPIJ.js",
  "./chunk-VB73EJDE.js",
  "./chunk-VFMEDRWW.js",
  "./chunk-VJYF765J.js",
  "./chunk-VM7OLACY.js",
  "./chunk-VQTWWHOA.js",
  "./chunk-W3DZNSX3.js",
  "./chunk-WE5GY3GM.js",
  "./chunk-WFZLTYIA.js",
  "./chunk-WKNRCN5I.js",
  "./chunk-WOGIZX7N.js",
  "./chunk-WRRNGMDW.js",
  "./chunk-WVZQ5H7C.js",
  "./chunk-X25HG5US.js",
  "./chunk-XAM2ORZ6.js",
  "./chunk-XE3LNLV6.js",
  "./chunk-XNEHHAVU.js",
  "./chunk-XQ6UIFQY.js",
  "./chunk-XSU6LGCI.js",
  "./chunk-XV6A4PAS.js",
  "./chunk-XW7UEF7C.js",
  "./chunk-YA3DLNGX.js",
  "./chunk-YEMKFWJ4.js",
  "./chunk-YF5SMAQB.js",
  "./chunk-YJVP77MQ.js",
  "./chunk-YM3767A2.js",
  "./chunk-YQ4HOQUF.js",
  "./chunk-YQSDVTLL.js",
  "./chunk-YZQUGAQX.js",
  "./chunk-Z4LPAE7V.js",
  "./chunk-Z6TKTN26.js",
  "./chunk-ZCKUZOVQ.js",
  "./chunk-ZDR7KJKW.js",
  "./chunk-ZEQNRGAA.js",
  "./chunk-ZN3ODLVK.js",
  "./chunk-ZOO7WILW.js",
  "./chunk-ZQASLTHR.js",
  "./chunk-ZRMNR7MV.js",
  "./main-RROYTYRO.js",
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
