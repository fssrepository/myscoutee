import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/app-sw.js', import.meta.url), 'utf8');

function runtime(entries = [], previousEntries = [], mediaEntries = []) {
  const current = new Map(entries);
  const previous = new Map(previousEntries);
  const media = new Map(mediaEntries);
  const handlers = new Map();
  const fetched = [];
  const fetchOptions = [];
  let offline = false;
  const match = (cache, request) => cache.has(request.url)
    ? new Response(cache.get(request.url)) : undefined;
  const context = vm.createContext({
    URL, Response, Request,
    caches: {
      open: async name => {
        const cache = name.includes('-media-') ? media : current;
        return {
          match: async request => match(cache, request),
          put: async (request, response) => cache.set(request.url, await response.text())
        };
      },
      match: async (request, options) => match(
        options.cacheName.endsWith('-previous') ? previous : current, request
      ),
      keys: async () => ['myscoutee-runtime-app-previous', 'myscoutee-runtime-app-v1']
    },
    fetch: async (request, options) => {
      fetched.push(request.url);
      fetchOptions.push(options);
      if (offline) throw new Error('Offline');
      return new Response('NETWORK BUNDLE');
    },
    self: {
      location: { origin: 'https://qa.example' },
      addEventListener: (name, handler) => handlers.set(name, handler)
    }
  });
  vm.runInContext(source, context);
  return {
    fetched,
    fetchOptions,
    media,
    goOffline() { offline = true; },
    async load(path, destination) {
      let result;
      const request = new Request(`https://qa.example${path}`);
      Object.defineProperty(request, 'destination', { value: destination ?? (path.endsWith('.css') ? 'style' : /\.woff2?$/.test(path) ? 'font' : 'script') });
      handlers.get('fetch')({
        request,
        respondWith: response => { result = response; }
      });
      return (await result).text();
    }
  };
}

for (const path of ['/main-ABCDEFGH.js', '/chunk-1234ABCD.js', '/chunk-a1b2c3d4.js', '/styles-ABCDEFGH.css', '/media/roboto-latin-400-normal-LOX3CHMS.woff2', '/media/material-icons-JLIDJUWE.woff']) {
  test(`cached ${path} avoids another network download`, async () => {
    const app = runtime([[`https://qa.example${path}`, 'CACHED BUNDLE']]);
    assert.equal(await app.load(path), 'CACHED BUNDLE');
    assert.equal(app.fetched.length, 0);
  });
}

test('a changed hash downloads once and is reused on the next request', async () => {
  const app = runtime([['https://qa.example/chunk-AAAAAAAA.js', 'OLD BUNDLE']]);
  assert.equal(await app.load('/chunk-BBBBBBBB.js'), 'NETWORK BUNDLE');
  assert.equal(await app.load('/chunk-BBBBBBBB.js'), 'NETWORK BUNDLE');
  assert.equal(app.fetched.length, 1);
});

test('an open older tab can reuse its retained immutable chunk without a request', async () => {
  const app = runtime([], [['https://qa.example/chunk-AAAAAAAA.js', 'PREVIOUS BUNDLE']]);
  assert.equal(await app.load('/chunk-AAAAAAAA.js'), 'PREVIOUS BUNDLE');
  assert.equal(app.fetched.length, 0);
});

test('unhashed scripts still refresh from the network', async () => {
  const app = runtime([['https://qa.example/config.js', 'OLD CONFIG']]);
  assert.equal(await app.load('/config.js'), 'NETWORK BUNDLE');
  assert.equal(app.fetched.length, 1);
});

for (const path of ['/chunk-LAZY0001.js', '/media/roboto-latin-400-normal.woff2']) {
  test(`an on-demand ${path} remains available offline after use`, async () => {
    const app = runtime();
    assert.equal(await app.load(path), 'NETWORK BUNDLE');
    app.goOffline();
    assert.equal(await app.load(path), 'NETWORK BUNDLE');
  });
}

for (const path of ['/media/roboto-latin-400-normal-LOX3CHMS.woff2', '/media/material-icons-JLIDJUWE.woff']) {
  test(`a new immutable ${path} can reuse HTTP cache and then stays in the worker cache`, async () => {
    const app = runtime();
    assert.equal(await app.load(path), 'NETWORK BUNDLE');
    assert.equal(await app.load(path), 'NETWORK BUNDLE');
    assert.equal(app.fetched.length, 1);
    assert.equal(app.fetchOptions[0]?.cache, 'default');
  });
}

test('a precached logo is reused without a second download or a second cache copy', async () => {
  const path = '/assets/logo/heart.webp';
  const app = runtime([[`https://qa.example${path}`, 'PRECACHED LOGO']]);
  assert.equal(await app.load(path, 'image'), 'PRECACHED LOGO');
  assert.equal(app.fetched.length, 0);
  assert.equal(app.media.size, 0);
});

test('on-demand public images use their exact URL and remain available offline', async () => {
  const first = '/media/public?key=images/system/idea-posts/first/medium.webp';
  const second = '/media/public?key=images/system/idea-posts/second/medium.webp';
  const app = runtime();
  assert.equal(await app.load(first, 'image'), 'NETWORK BUNDLE');
  assert.equal(await app.load(first, 'image'), 'NETWORK BUNDLE');
  assert.deepEqual(app.fetched, [`https://qa.example${first}`]);
  assert.equal(await app.load(second, 'image'), 'NETWORK BUNDLE');
  assert.equal(app.fetched.length, 2);
  app.goOffline();
  assert.equal(await app.load(first, 'image'), 'NETWORK BUNDLE');
  assert.equal(await app.load(second, 'image'), 'NETWORK BUNDLE');
  assert.equal(app.fetched.length, 2);
});
