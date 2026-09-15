import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/app-sw.js', import.meta.url), 'utf8');

async function navigate(path, offline = false) {
  const handlers = new Map();
  const cache = new Map([['./index.html', 'APP SHELL']]);
  const fetched = [];
  const cached = key => cache.has(key) ? new Response(cache.get(key)) : undefined;
  const context = vm.createContext({
    URL, Response, Request,
    caches: {
      open: async () => ({
        match: async key => cached(key),
        put: async (request, response) => cache.set(request.url, await response.text())
      }),
      match: async request => cached(request.url),
      keys: async () => []
    },
    fetch: async request => {
      fetched.push(request.url);
      if (offline) throw new Error('Offline');
      return new Response('GRAPH PAGE');
    },
    self: {
      location: { origin: 'https://qa.example' },
      addEventListener: (name, handler) => handlers.set(name, handler)
    }
  });
  vm.runInContext(source, context);
  let response;
  handlers.get('fetch')({
    request: { url: `https://qa.example${path}`, method: 'GET', mode: 'navigate', destination: 'iframe' },
    respondWith: promise => { response = promise; }
  });
  const result = await response;
  return { body: await result.text(), status: result.status, fetched };
}

test('embedded graph navigation receives its HTML instead of the cached app shell', async () => {
  const result = await navigate('/assets/admin/affinity-graph/index.html?v=123');
  assert.equal(result.body, 'GRAPH PAGE');
  assert.equal(result.fetched.length, 1);
});

test('ordinary app navigation retains the cached app shell', async () => {
  const result = await navigate('/admin', true);
  assert.equal(result.body, 'APP SHELL');
  assert.equal(result.fetched.length, 0);
});

test('an unavailable uncached asset page does not fall back to the app shell', async () => {
  const result = await navigate('/assets/admin/affinity-graph/index.html', true);
  assert.equal(result.status, 503);
  assert.notEqual(result.body, 'APP SHELL');
});
