import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/app-sw.js', import.meta.url), 'utf8');

function runtime(entries = [], previousEntries = []) {
  const current = new Map(entries);
  const previous = new Map(previousEntries);
  const handlers = new Map();
  const fetched = [];
  const match = (cache, request) => cache.has(request.url)
    ? new Response(cache.get(request.url)) : undefined;
  const context = vm.createContext({
    URL, Response, Request,
    caches: {
      open: async () => ({
        put: async (request, response) => current.set(request.url, await response.text())
      }),
      match: async (request, options) => match(
        options.cacheName.endsWith('-previous') ? previous : current, request
      ),
      keys: async () => ['myscoutee-runtime-app-previous', 'myscoutee-runtime-app-v1']
    },
    fetch: async request => {
      fetched.push(request.url);
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
    async load(path) {
      let result;
      const request = new Request(`https://qa.example${path}`);
      Object.defineProperty(request, 'destination', { value: path.endsWith('.css') ? 'style' : 'script' });
      handlers.get('fetch')({
        request,
        respondWith: response => { result = response; }
      });
      return (await result).text();
    }
  };
}

for (const path of ['/main-ABCDEFGH.js', '/chunk-1234ABCD.js', '/styles-ABCDEFGH.css']) {
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
