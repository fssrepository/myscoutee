import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/app-sw.js', import.meta.url), 'utf8');

async function navigate(path, offline = false, shell = 'APP SHELL') {
  const handlers = new Map();
  const cache = new Map([['./index.html', shell]]);
  const fetched = [];
  const cached = key => cache.has(key) ? new Response(cache.get(key)) : undefined;
  const context = vm.createContext({
    URL, Response, Request, Headers, AbortSignal,
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

test('offline navigation retains the cached app shell after the bounded HTML fetch', async () => {
  const result = await navigate('/admin', true);
  assert.equal(result.body, 'APP SHELL');
  assert.equal(result.fetched.length, 1);
});

test('online navigation gets fresh HTML instead of reusing an old readiness snapshot', async () => {
  const result = await navigate('/entry');
  assert.equal(result.body, 'GRAPH PAGE');
  assert.equal(result.fetched.length, 1);
});

test('offline cached HTML never retains its former green readiness', async () => {
  const result = await navigate('/entry', true,
    '<head><script id="myscoutee-runtime-status" type="application/json">{"ready":true,"checkedAt":9999999999}</script></head>');
  assert.match(result.body, />null<\/script>/);
  assert.doesNotMatch(result.body, /"ready":true/);
});

test('an unavailable uncached asset page does not fall back to the app shell', async () => {
  const result = await navigate('/assets/admin/affinity-graph/index.html', true);
  assert.equal(result.status, 503);
  assert.notEqual(result.body, 'APP SHELL');
});
