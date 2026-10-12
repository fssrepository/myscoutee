import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/app-sw.js', import.meta.url), 'utf8');
async function deliver(clients, branding = { productName: 'QA' }, { offline = false, payload = {} } = {}) {
  const handlers = new Map(), notifications = [];
  const context = vm.createContext({
    URL, Response, Request,
    caches: { open: async () => ({ match: async () => offline ? null : ({ json: async () => branding }) }) },
    fetch: async () => { throw new Error('offline'); },
    self: {
      location: { origin: 'https://qa.example' },
      registration: { scope: 'https://qa.example/app/', showNotification: async (...args) => notifications.push(args) },
      clients: { matchAll: async () => clients },
      addEventListener: (name, fn) => handlers.set(name, fn)
    }
  });
  vm.runInContext(source, context);
  let completion;
  handlers.get('push')({
    data: { json: () => ({ data: { title: 'Chat', body: 'Message', tag: 'chat-qa', url: '/app/game?chatId=qa', ...payload } }) },
    waitUntil: promise => { completion = promise; }
  });
  await completion;
  return notifications;
}

test('visible app handles foreground delivery without a system notification', async () => {
  assert.equal((await deliver([{ url: 'https://qa.example/app/game', visibilityState: 'visible' }])).length, 0);
});
test('background app receives one notification with its tag and target', async () => {
  const notifications = await deliver([{ url: 'https://qa.example/app/game', visibilityState: 'hidden' }]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0][1].tag, 'chat-qa');
  assert.equal(notifications[0][1].data.url, '/app/game?chatId=qa');
});
test('closed app receives one system notification', async () => {
  assert.equal((await deliver([])).length, 1);
});
test('another visible surface outside app scope does not suppress delivery', async () => {
  assert.equal((await deliver([{ url: 'https://qa.example/other', visibilityState: 'visible' }])).length, 1);
});


test('a missing saved logo is not replaced with bundled branding', async () => {
  const notifications = await deliver([], { productName: 'Configured', logoUrl: '' });
  assert.equal(notifications[0][1].icon, '');
  assert.equal(notifications[0][1].badge, '');
});

test('cold offline push uses the supplied title without inventing app branding', async () => {
  const notifications = await deliver([], {}, { offline: true });
  assert.equal(notifications[0][0], 'Chat');
  assert.equal(notifications[0][1].icon, '');
  assert.equal(notifications[0][1].badge, '');
});

test('configured app badge and sender photo retain distinct roles', async () => {
  const notifications = await deliver([], { productName: 'Configured', logoUrl: '/media/public?key=public/branding/logo.webp' },
    { payload: { icon: '/media/sender.webp' } });
  assert.equal(notifications[0][1].icon, '/media/sender.webp');
  assert.equal(notifications[0][1].badge, 'https://qa.example/media/public?key=public/branding/logo.webp');
});
