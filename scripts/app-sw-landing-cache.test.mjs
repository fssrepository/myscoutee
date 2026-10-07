import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/app-sw.js', import.meta.url), 'utf8');
const origin = 'https://qa.example';
const dating = '/api/landing/content?lang=hu';
const work = `${dating}&groupId=myscoutee-work`;
const community = `${dating}&groupId=myscoutee-community`;

function runtime(entries = [], network = async () => new Response('NEW CONTENT')) {
  const cache = new Map(entries.map(([path, body]) => [origin + path, new Response(body)]));
  const handlers = new Map(), fetched = [], pending = [];
  let scans = 0;
  const context = vm.createContext({
    URL, Request, Response,
    caches: { open: async () => ({
      match: async request => cache.get(request.url)?.clone(),
      put: async (request, response) => { cache.set(request.url, response.clone()); },
      keys: async () => { scans++; return [...cache.keys()].map(url => new Request(url)); }
    }) },
    fetch: async request => { fetched.push(request.url); return network(request); },
    self: {
      location: { origin },
      addEventListener: (name, handler) => handlers.set(name, handler)
    }
  });
  vm.runInContext(source, context);
  return {
    fetched,
    get scans() { return scans; },
    settled: () => Promise.all(pending),
    async load(path) {
      let response;
      handlers.get('fetch')({
        request: new Request(origin + path),
        respondWith: result => { response = result; },
        waitUntil: result => pending.push(result)
      });
      assert.ok(response, 'Landing request must use the real fetch handler');
      return response;
    }
  };
}

for (const [path, expected] of [[work, 'WORK SLIDES'], [community, 'COMMUNITY SLIDES']]) {
  test(`first switch to ${path} returns its own slides without reload`, async () => {
    const app = runtime([[dating, 'DATING SLIDES']], async () => new Response(expected));
    assert.equal(await (await app.load(path)).text(), expected);
    await app.settled();
    assert.equal(await (await app.load(path)).text(), expected, 'Revisit keeps the same group');
    await app.settled();
    assert.equal(app.fetched.length, 2, 'Only one existing revalidation per request');
    assert.equal(app.scans, 0, 'No enumeration of other cached content');
  });
}

test('a new language cannot receive another language’s cached consent and slides', async () => {
  const app = runtime([['/api/landing/content?lang=en', 'ENGLISH']], async () => new Response('MAGYAR'));
  assert.equal(await (await app.load(dating)).text(), 'MAGYAR');
  await app.settled();
  assert.equal(app.fetched.length, 1);
  assert.equal(app.scans, 0);
});

test('an exact cached group remains immediately available while its refresh is pending', async () => {
  let finish;
  const app = runtime([[dating, 'DATING'], [work, 'CACHED WORK']],
    () => new Promise(resolve => { finish = resolve; }));
  assert.equal(await (await app.load(work)).text(), 'CACHED WORK');
  finish(new Response('REFRESHED WORK'));
  await app.settled();
  assert.equal(await (await app.load(work)).text(), 'REFRESHED WORK');
  finish(new Response('REFRESHED WORK'));
  await app.settled();
  assert.equal(app.fetched.length, 2);
  assert.equal(app.scans, 0);
});

test('offline revisits retain the exact requested group', async () => {
  const app = runtime([[dating, 'DATING'], [work, 'WORK']], async () => { throw Error('Offline'); });
  assert.equal(await (await app.load(work)).text(), 'WORK');
  await app.settled();
  assert.equal(app.fetched.length, 1);
});

test('offline first visits fail explicitly instead of displaying another group', async () => {
  const app = runtime([[dating, 'DATING']], async () => { throw Error('Offline'); });
  const response = await app.load(work);
  assert.equal(response.status, 503);
  assert.notEqual(await response.text(), 'DATING');
  await app.settled();
  assert.equal(app.fetched.length, 1);
  assert.equal(app.scans, 0);
});

test('an uncached group’s server error is not disguised as a successful different group', async () => {
  const app = runtime([[dating, 'DATING']], async () => new Response('Unavailable', { status: 503 }));
  const response = await app.load(community);
  assert.equal(response.status, 503);
  await app.settled();
  assert.equal(app.fetched.length, 1);
  assert.equal(app.scans, 0);
});
