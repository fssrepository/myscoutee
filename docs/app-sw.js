const CACHE_PREFIX = 'myscoutee-runtime';
const CACHE_VERSION = "build-65232767e698-20261017080634";
const BUILD_ID = "65232767e698-20261017080634";
const APP_CACHE = `${CACHE_PREFIX}-app-${CACHE_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${CACHE_VERSION}`;
const MEDIA_CACHE = `${CACHE_PREFIX}-media-${CACHE_VERSION}`;
const ACTIVE_CACHES = [APP_CACHE, API_CACHE, MEDIA_CACHE];
const APP_CACHE_PREFIX = `${CACHE_PREFIX}-app-`;
const PREVIOUS_APP_CACHE_LIMIT = 1;
const DEPLOYMENT_CONFIGURATION_URL = './api/deployment/configuration';
const DEPLOYMENT_BRANDING_CACHE_KEY = './__deployment-branding__';
const DEFAULT_DEPLOYMENT_BRANDING = Object.freeze({
  productName: '',
  homeLabel: '',
  logoUrl: ''
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
  "./chunk-22V3SPXD.js",
  "./chunk-22ZZOEGC.js",
  "./chunk-2AGNGXFS.js",
  "./chunk-2Y4OMHLW.js",
  "./chunk-3356SE3Z.js",
  "./chunk-3BJWBSAO.js",
  "./chunk-3CA7M2XN.js",
  "./chunk-3DQH4A2E.js",
  "./chunk-3FJ2K3FP.js",
  "./chunk-3MJGPNIP.js",
  "./chunk-3RKKNPHR.js",
  "./chunk-3RXZMHKK.js",
  "./chunk-3WQFAYET.js",
  "./chunk-3XUO24U4.js",
  "./chunk-3YSZNJLS.js",
  "./chunk-43NMGCYZ.js",
  "./chunk-4DLGA6S3.js",
  "./chunk-4KBHDRAH.js",
  "./chunk-4O6TGU6W.js",
  "./chunk-4QVV7HKU.js",
  "./chunk-53SRFMOS.js",
  "./chunk-53V2YAS2.js",
  "./chunk-54R6NJJV.js",
  "./chunk-5BRBIXLC.js",
  "./chunk-5CCWEUX7.js",
  "./chunk-5GTIIJMF.js",
  "./chunk-5MB5P7SO.js",
  "./chunk-5OQTT6OE.js",
  "./chunk-5RPDM3D4.js",
  "./chunk-5SCQBXZK.js",
  "./chunk-66ASVUJB.js",
  "./chunk-6JE3UTIV.js",
  "./chunk-6S3WJ7NP.js",
  "./chunk-6YRYISR6.js",
  "./chunk-72UM4VWK.js",
  "./chunk-73E6PKPB.js",
  "./chunk-74E7OYA2.js",
  "./chunk-76TYLXS6.js",
  "./chunk-77GWBLGN.js",
  "./chunk-7AGQHLTF.js",
  "./chunk-7EJZB7W5.js",
  "./chunk-7G4Z4KNB.js",
  "./chunk-7LLCMIDY.js",
  "./chunk-7RFPBDNW.js",
  "./chunk-A2TIAKQO.js",
  "./chunk-A6OC4SFW.js",
  "./chunk-A7FNMF7U.js",
  "./chunk-AACT4VAH.js",
  "./chunk-AOOGD2BD.js",
  "./chunk-AP34REC3.js",
  "./chunk-ATMHCPFH.js",
  "./chunk-AYLK5TGN.js",
  "./chunk-AYO5ZF45.js",
  "./chunk-BA3DHQPG.js",
  "./chunk-BGA7UENN.js",
  "./chunk-BLI4QTCE.js",
  "./chunk-BOTDU73J.js",
  "./chunk-BPVUYR2L.js",
  "./chunk-BWPMRPXI.js",
  "./chunk-C3VC6NQE.js",
  "./chunk-C75O44HF.js",
  "./chunk-CJS3ARQY.js",
  "./chunk-CLGBASAK.js",
  "./chunk-CM2JQGSJ.js",
  "./chunk-CTA5WIMR.js",
  "./chunk-CYIKY3C6.js",
  "./chunk-CYZGO4GO.js",
  "./chunk-D7IGUAMY.js",
  "./chunk-D7NDHXFA.js",
  "./chunk-D7SEEGFG.js",
  "./chunk-DA3JEKBE.js",
  "./chunk-DGE6MRDY.js",
  "./chunk-DGF2U7ZA.js",
  "./chunk-DHVKKMGD.js",
  "./chunk-DIGB5PLY.js",
  "./chunk-DK22RU5X.js",
  "./chunk-DM3NWMWU.js",
  "./chunk-DMKQYPN6.js",
  "./chunk-DOTYY24T.js",
  "./chunk-DPUJODAM.js",
  "./chunk-DVBIU47N.js",
  "./chunk-DZ2M6ZLN.js",
  "./chunk-E4EFRHVX.js",
  "./chunk-EAP6PYWJ.js",
  "./chunk-EFNROIQR.js",
  "./chunk-EIRK5X5A.js",
  "./chunk-ENCZYLKS.js",
  "./chunk-EOGM7G3D.js",
  "./chunk-EUC6LMOW.js",
  "./chunk-F26J5GW6.js",
  "./chunk-F3U4XKKK.js",
  "./chunk-FAIE7JCL.js",
  "./chunk-FIOOSYWY.js",
  "./chunk-FJAWNIE3.js",
  "./chunk-FJQWCMPL.js",
  "./chunk-FLVIYM6P.js",
  "./chunk-FMJXHDSQ.js",
  "./chunk-FO2MRYT6.js",
  "./chunk-FRNK5F4I.js",
  "./chunk-FXZ3PUHB.js",
  "./chunk-FY2EX6KB.js",
  "./chunk-G5XIFF4Y.js",
  "./chunk-G6KOYE5R.js",
  "./chunk-GC7YV2X5.js",
  "./chunk-GCBNEKXQ.js",
  "./chunk-GFE5AOR4.js",
  "./chunk-GI3GY3M4.js",
  "./chunk-GJ6W2VTR.js",
  "./chunk-GLVZ2FBX.js",
  "./chunk-GMUEDRNI.js",
  "./chunk-GNSBJG6C.js",
  "./chunk-GOQMNFYQ.js",
  "./chunk-H5JWAMIO.js",
  "./chunk-HBKEQDCM.js",
  "./chunk-HCR2PYX3.js",
  "./chunk-HERBKPEP.js",
  "./chunk-HLTFJC67.js",
  "./chunk-HTLLW3EV.js",
  "./chunk-HTQDM2JP.js",
  "./chunk-HVVJYPII.js",
  "./chunk-HYJUEQN4.js",
  "./chunk-I3I7TQJC.js",
  "./chunk-IKI7WSBU.js",
  "./chunk-IPOLXZ7Q.js",
  "./chunk-JACFMFHQ.js",
  "./chunk-JAVQMZMJ.js",
  "./chunk-JBEXTOPR.js",
  "./chunk-JSBD6FZT.js",
  "./chunk-JTC5Y2NT.js",
  "./chunk-JYHBYKXC.js",
  "./chunk-K3MY4FNE.js",
  "./chunk-K5HSERQV.js",
  "./chunk-K6VFV7JL.js",
  "./chunk-KCSTNYIY.js",
  "./chunk-KF7P2VCU.js",
  "./chunk-KIXZCDQT.js",
  "./chunk-KS55HTC6.js",
  "./chunk-L3HVRSKU.js",
  "./chunk-LB57XEOV.js",
  "./chunk-LGXDVYBZ.js",
  "./chunk-LJ5YIA4W.js",
  "./chunk-LL2QKFS2.js",
  "./chunk-LOT3F6CO.js",
  "./chunk-LQBGFECF.js",
  "./chunk-MAEUF6FZ.js",
  "./chunk-MDTFJTS4.js",
  "./chunk-MJQQQUTJ.js",
  "./chunk-NA4D4U4T.js",
  "./chunk-NDHNVPUF.js",
  "./chunk-NGQ56ABC.js",
  "./chunk-NP3SFYY4.js",
  "./chunk-NYKAO2HO.js",
  "./chunk-NZZ6EYGL.js",
  "./chunk-O7QXZBBK.js",
  "./chunk-OA6RSVBK.js",
  "./chunk-OB6DOI7R.js",
  "./chunk-OEVY2WXU.js",
  "./chunk-OKYK3TDE.js",
  "./chunk-OMY5JRJZ.js",
  "./chunk-OOEYAAWS.js",
  "./chunk-OOZZ3GYL.js",
  "./chunk-OPW47B24.js",
  "./chunk-OSN3YIUA.js",
  "./chunk-OU2SVUZO.js",
  "./chunk-OZH2KMUF.js",
  "./chunk-P7W7SXBB.js",
  "./chunk-PDDCMT3P.js",
  "./chunk-PFVDYQV6.js",
  "./chunk-PK4EOBDT.js",
  "./chunk-PL3L564H.js",
  "./chunk-PLB7ILNY.js",
  "./chunk-PQZYNJT4.js",
  "./chunk-PSWIWCPT.js",
  "./chunk-PTDRVFQR.js",
  "./chunk-PUR7Q4SW.js",
  "./chunk-PW2C5AMI.js",
  "./chunk-Q2C7SEOL.js",
  "./chunk-QD2Q4WSV.js",
  "./chunk-QEMU4Y5B.js",
  "./chunk-QGHR26WW.js",
  "./chunk-QIFQAWQP.js",
  "./chunk-QMS2C3IS.js",
  "./chunk-QPH5S35B.js",
  "./chunk-QS7WBQYT.js",
  "./chunk-QXH3A2ER.js",
  "./chunk-RO52XXKS.js",
  "./chunk-RX5U64O2.js",
  "./chunk-S36A6LHS.js",
  "./chunk-S5M7PV43.js",
  "./chunk-SCGWP4T7.js",
  "./chunk-SCWT5VHL.js",
  "./chunk-SDN3P42Y.js",
  "./chunk-SEICVQGV.js",
  "./chunk-SFKG3R33.js",
  "./chunk-SJUOBOCK.js",
  "./chunk-SOA4KNMW.js",
  "./chunk-SR7HZY2V.js",
  "./chunk-STNAT5JU.js",
  "./chunk-SUBJUWAP.js",
  "./chunk-SUBRA4LM.js",
  "./chunk-T7SR5ALW.js",
  "./chunk-TBSOVQER.js",
  "./chunk-TU7KWJWZ.js",
  "./chunk-TYBJMAQ3.js",
  "./chunk-TYBNPTZ2.js",
  "./chunk-TZCIDXGZ.js",
  "./chunk-UFUWBZYZ.js",
  "./chunk-UFUZ5EKZ.js",
  "./chunk-UG4BASAZ.js",
  "./chunk-ULB7GP3U.js",
  "./chunk-UM45OM5A.js",
  "./chunk-UQZMS6QO.js",
  "./chunk-VHAUXBXV.js",
  "./chunk-VPJGTGTD.js",
  "./chunk-VYNL4LZD.js",
  "./chunk-VZCLKFXN.js",
  "./chunk-W3UA3SL7.js",
  "./chunk-W6EGDY6M.js",
  "./chunk-WE5GY3GM.js",
  "./chunk-WFP4QQM7.js",
  "./chunk-WHVYJSNT.js",
  "./chunk-WNC2SX5F.js",
  "./chunk-WX4NP5LA.js",
  "./chunk-WXORVR4F.js",
  "./chunk-X32EAFXS.js",
  "./chunk-X7DN3PVU.js",
  "./chunk-XAMN2W22.js",
  "./chunk-XC2AW636.js",
  "./chunk-XFGKHK2A.js",
  "./chunk-XH3HINTL.js",
  "./chunk-XQT5YNCH.js",
  "./chunk-XQVP6JIO.js",
  "./chunk-XZMCGKOH.js",
  "./chunk-YB7APK47.js",
  "./chunk-YBBZXK42.js",
  "./chunk-YF5SMAQB.js",
  "./chunk-YGGVTN5U.js",
  "./chunk-YLIFNDFJ.js",
  "./chunk-YWJ6WPVO.js",
  "./chunk-ZDTYQFMH.js",
  "./chunk-ZEQNRGAA.js",
  "./chunk-ZK35U3EZ.js",
  "./chunk-ZOC5BUOK.js",
  "./chunk-ZSZP7NIZ.js",
  "./chunk-ZXO66JEM.js",
  "./chunk-ZYD3SJRR.js",
  "./main-C3FXZFZM.js",
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
    // No saved branding is available while offline; leave it absent.
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
  const productName = normalizedText(source.productName, 80);
  const homeLabel = normalizedText(source.homeLabel, 120);
  return {
    productName,
    homeLabel,
    logoUrl: normalizedLogoUrl(source.logoUrl)
  };
}

function normalizedLogoUrl(value) {
  if (typeof value !== 'string') {
    return '';
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
    // An invalid logo must not select a different image.
  }
  return '';
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
