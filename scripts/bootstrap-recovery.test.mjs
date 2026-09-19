import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('function recoverDeployment'));
assert.ok(source, 'The production bootstrap recovery script must be exercised');

function runtime({ bootstrapped = false, online = true, worker = true,
  blockedStorage = false, data = new Map(), registration = null } = {}) {
  const events = new Map();
  const classes = new Set(bootstrapped ? ['app-bootstrapped'] : []);
  const state = { reloads: 0, updates: 0 };
  let retry;
  const navigator = { onLine: online };
  if (worker) navigator.serviceWorker = {
    getRegistration: async () => { state.updates++; return registration; }
  };
  const context = vm.createContext({
    Promise, navigator,
    sessionStorage: {
      getItem(key) { if (blockedStorage) throw Error('Blocked'); return data.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw Error('Blocked'); data.set(key, value); }
    },
    document: {
      baseURI: 'https://qa.example/', readyState: 'complete',
      documentElement: { classList: { contains: value => classes.has(value), add: value => classes.add(value) } },
      querySelector: selector => selector === '[data-warmup-retry]'
        ? { addEventListener: (_, handler) => { retry = handler; } }
        : selector.startsWith('meta[') ? { content: 'build-a' } : null
    },
    window: {
      location: { pathname: '/game', reload: () => state.reloads++ },
      setTimeout() {}, clearTimeout() {},
      addEventListener: (name, handler) => events.set(name, handler)
    }
  });
  vm.runInContext(source, context);
  return {
    state, data,
    boot: () => classes.add('app-bootstrapped'),
    error: (tagName = 'SCRIPT', rel = '') => events.get('error')({ target: { tagName, rel } }),
    retry: () => retry(),
    settle: () => new Promise(resolve => setImmediate(resolve))
  };
}

for (const online of [true, false]) {
  test(`resource errors preserve an already running session (online=${online})`, async () => {
    const app = runtime({ bootstrapped: true, online });
    app.error();
    app.error('LINK', 'stylesheet');
    await app.settle();
    assert.equal(app.state.reloads, 0);
    assert.equal(app.state.updates, 0);
  });
}

test('offline startup errors do not create a reload loop', async () => {
  const app = runtime({ online: false });
  app.error();
  app.error();
  await app.settle();
  assert.equal(app.state.reloads, 0);
  app.retry();
  assert.equal(app.state.reloads, 1, 'Explicit retry remains available');
});

test('startup without a service worker retries a build at most once across reloads', async () => {
  const first = runtime({ worker: false });
  first.error();
  await first.settle();
  assert.equal(first.state.reloads, 1);
  const next = runtime({ worker: false, data: first.data });
  next.error();
  await next.settle();
  assert.equal(next.state.reloads, 0);
});

test('blocked session storage does not allow an unguarded automatic reload', async () => {
  const app = runtime({ blockedStorage: true });
  app.error();
  await app.settle();
  assert.equal(app.state.reloads, 0);
  app.retry();
  await app.settle();
  assert.equal(app.state.reloads, 1);
});

for (const rel of ['icon', 'apple-touch-icon', 'manifest', 'preconnect']) {
  test(`${rel} failure cannot restart the application`, async () => {
    const app = runtime();
    app.error('LINK', rel);
    await app.settle();
    assert.equal(app.state.reloads, 0);
    assert.equal(app.state.updates, 0);
  });
}

for (const [tag, rel] of [['SCRIPT', ''], ['LINK', 'stylesheet'], ['LINK', 'modulepreload']]) {
  test(`failed startup ${tag} ${rel} retains one guarded recovery`, async () => {
    const app = runtime();
    app.error(tag, rel);
    app.error(tag, rel);
    await app.settle();
    assert.equal(app.state.reloads, 1);
    assert.equal(app.state.updates, 1);
    const next = runtime({ data: app.data });
    next.error(tag, rel);
    await next.settle();
    assert.equal(next.state.reloads, 0);
  });
}

test('a completed bootstrap cancels an in-flight automatic recovery reload', async () => {
  let finishUpdate;
  const registration = {
    update: () => new Promise(resolve => { finishUpdate = resolve; })
  };
  const app = runtime({ registration });
  app.error();
  await app.settle();
  app.boot();
  finishUpdate();
  await app.settle();
  assert.equal(app.state.reloads, 0);
});
