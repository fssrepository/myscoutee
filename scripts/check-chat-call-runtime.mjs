import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Exercise the running watcher's AOT output, without another build or browser session.
// node --max-old-space-size=192 scripts/check-chat-call-runtime.mjs <dev-output-directory>
assert.ok(process.argv[2], 'Pass the existing dev output directory');
const compiled = compiledDevModules(resolve(process.argv[2]));
const [signal, runInInjectionContext, Injector, DestroyRef, ChatCallService, ChatCallPopupComponent, SmartListComponent, ExplanationGuideService] = await Promise.all(
  ['signal', 'runInInjectionContext', 'Injector', 'DestroyRef', 'ChatCallService', 'ChatCallPopupComponent', 'SmartListComponent', 'ExplanationGuideService'].map(compiled.symbol)
);
const pending = new Set(), cleanup = [];
const scheduler = { add: node => pending.add(node), schedule: node => pending.add(node), remove: node => pending.delete(node) };
function flush() {
  let count = 0;
  while (pending.size) {
    assert.ok(++count <= 50, 'Call effects must settle within 50 executions');
    const node = pending.values().next().value; pending.delete(node); node.run();
  }
  return count;
}
let call, guide;
const i18n = { translate: key => key, currentLanguage: signal('en') };
const injector = { get(token, fallback) {
  const name = (token.name ?? '').replace(/^_/, '');
  if (token === Injector) return injector;
  if (token === DestroyRef) return { onDestroy: fn => { cleanup.push(fn); return () => {}; } };
  if (name === 'EffectScheduler') return scheduler;
  if (name === 'ChangeDetectionScheduler') return { notify() {} };
  if (name === 'ViewContext') return null;
  if (name === 'ChatCallService') return call;
  if (name === 'ChatsService') return {};
  if (name === 'I18nService') return i18n;
  if (name === 'ExplanationGuideService') return guide;
  if (fallback !== undefined) return fallback;
  throw Error('Missing test provider ' + name);
} };
call = runInInjectionContext(injector, () => new ChatCallService());
const guideFields = JSON.parse(readFileSync(new URL('../src/app/shared/core/local/seed/data/help-center-guide-fields.json', import.meta.url)));
const guideRevisions = JSON.parse(readFileSync(new URL('../../server/docker/conf/mongodb/demo_db/helpCenterRevisions.json', import.meta.url)));
const guideLoads = [];
guide = runInInjectionContext(injector, () => new ExplanationGuideService({ loadState: async (context, language) => {
  guideLoads.push([context, language]);
  return { activeRevision: guideRevisions.find(row => !row.baseGroupId && row.active && row.contextKey === context && row.lang === language),
    guideFields: guideFields[context] ?? [] };
} }));
const closeChatGuide = guide.registerContext('chats');
const messages = [];
call.send = async (id, payload) => messages.push({ id, ...payload });
for (const id of ['b', 'c', 'd']) call.peers.set(id, { pc: { connectionState: 'connected' } });
await call.setVisibleVideoPeers(['b', 'c']);
assert.deepEqual(messages.splice(0), [{ id: 'b', receiveVideo: true }, { id: 'c', receiveVideo: true }]);
await call.setVisibleVideoPeers(['d']);
assert.deepEqual(messages.splice(0), [{ id: 'b', receiveVideo: false }, { id: 'c', receiveVideo: false }, { id: 'd', receiveVideo: true }]);
await call.toggleReceivingVideo('d');
assert.equal(messages.pop().receiveVideo, false);
await call.setVisibleVideoPeers(['b']);
await call.setVisibleVideoPeers(['d']);
assert.equal(call.receivesVideo('d'), false, 'A viewport change must preserve an individual video prohibition');
assert.ok(!messages.some(message => message.id === 'd' && message.receiveVideo), 'Hidden-to-visible must not override manual prohibition');
messages.length = 0;
await call.setVisibleVideoPeers(['d']);
assert.equal(messages.length, 0, 'Unchanged visibility must not repeat signaling');
await call.toggleReceivingVideo('d');
assert.equal(messages.pop().receiveVideo, true);
console.log('PASS viewport video preferences pause old peers, resume visible peers and preserve individual prohibitions');

// Run the real receiving control branch. Only the camera sender may be replaced.
call.chat = { id: 'chat' }; call.callId = 'call'; call.selfId = 'self';
call.participants.set([{ sessionId: 'b', clientId: 'client-b' }]);
const camera = { kind: 'video' }, replacements = [];
call.localStream.set({ getVideoTracks: () => [camera] }); call.cameraOff.set(false);
call.peers.set('b', { pc: { connectionState: 'connected', getTransceivers: () => [
  { receiver: { track: { kind: 'audio' } }, sender: { replaceTrack: () => assert.fail('Audio sender must remain intact') } },
  { receiver: { track: { kind: 'video' } }, sender: { replaceTrack: async track => replacements.push(track) } }
] } });
call.mls = { exists: async () => true, decrypt: async receiveVideo => ({ clientId: 'client-b', plaintext: JSON.stringify({
  chatId: 'chat', callId: 'call', senderSessionId: 'b', targetSessionId: 'self', receiveVideo
}) }) };
await call.receive({ kind: 'signal', callId: 'call', senderSessionId: 'b', data: false });
await call.receive({ kind: 'signal', callId: 'call', senderSessionId: 'b', data: true });
assert.deepEqual(replacements, [null, camera]);
console.log('PASS received pause/resume replaces only the video sender; audio is untouched (RTP media remains a manual check)');

const bounds = { left: 0, right: 500, top: 0, bottom: 300, width: 500, height: 300 };
const pages = [{ id: '0' }, { id: '1' }, { id: '2' }], emissions = [];
let rectangles = [bounds, { ...bounds, left: 510, right: 1010 }, { ...bounds, top: 310, bottom: 610 }];
const list = Object.create(SmartListComponent.prototype);
Object.assign(list, { items: pages, currentViewMode: 'list', viewportItems: [],
  viewportItemsChange: { observed: true, emit: items => emissions.push(items.map(item => item.id)) },
  scrollHostRef: { nativeElement: { getBoundingClientRect: () => bounds } },
  ownedListElements: () => rectangles.map((rect, index) => ({ dataset: { smartListIndex: String(index) }, getBoundingClientRect: () => rect }))
});
list.emitViewportItems(); assert.deepEqual(emissions.pop(), ['0']);
rectangles[1] = { ...bounds, left: 450, right: 950 };
list.emitViewportItems(); assert.deepEqual(emissions.pop(), ['0', '1'], 'Partially visible adjacent page is visible during native swipe');
rectangles[0] = { ...bounds, left: -510, right: -10 };
list.emitViewportItems(); assert.deepEqual(emissions.pop(), ['1']);
list.emitViewportItems(); assert.equal(emissions.length, 0);
list.viewportItemsChange.observed = false;
list.ownedListElements = () => assert.fail('Unsubscribed SmartLists must not measure viewport items');
list.emitViewportItems();
console.log('PASS shared SmartList reports clipped viewport items and avoids duplicate/unsubscribed work');

call.open.set(true); call.selfId = 'self';
call.participants.set([{ sessionId: 'self', userId: 'self' }, ...Array.from({ length: 7 }, (_, i) => ({ sessionId: 'p' + (i + 1), userId: 'u' + (i + 1) }))]);
call.activeSpeakers.set(new Set()); call.peers.clear();
const popup = runInInjectionContext(injector, () => new ChatCallPopupComponent());
const internal = signal(0), cursors = [];
let patches = 0;
popup.participantList = signal({ syncVisibleItems: () => { internal(); internal.update(value => value + 1); patches++; },
  setCursorIndex: index => { cursors.push(index); return Promise.resolve(true); } });
popup.compact.set(true); popup.stageSize.set({ width: 375, height: 500 }); flush();
assert.deepEqual(popup.pages().map(page => [page.ids.length, page.columns]), [[4, 2], [4, 2]], 'Mobile pages are 2x2');
assert.equal(popup.participantsConfig.mobileStepper, true);
assert.equal(popup.participantsConfig.pagination.step, 'page');
const beforePatches = patches; internal.update(value => value + 1); assert.equal(flush(), 0); assert.equal(patches, beforePatches);
popup.compact.set(false); popup.stageSize.set({ width: 960, height: 400 }); flush();
assert.deepEqual(popup.pages().map(page => [page.ids.length, page.columns]), [[6, 3], [2, 2]], 'Laptop pages fit up to 3x2');
popup.followSpeakers.set(true); call.activeSpeakers.set(new Set(['p7'])); flush();
assert.equal(popup.pages()[0].ids[0], 'p7'); assert.equal(cursors.at(-1), 0);
call.activeSpeakers.set(new Set(['p4'])); flush();
assert.deepEqual(popup.pages()[0].ids.slice(0, 2), ['p4', 'p7']);
call.activeSpeakers.set(new Set()); flush();
assert.deepEqual(popup.pages()[0].ids.slice(0, 2), ['p4', 'p7'], 'Recent speakers remain after a speech gap');
popup.followSpeakers.set(false); flush(); assert.equal(popup.pages()[0].ids[0], 'self');
popup.zoom('p7'); flush(); assert.deepEqual(popup.pages().flatMap(page => page.ids), ['p7']);
popup.zoom('p7'); flush(); assert.equal(popup.pages().flatMap(page => page.ids).length, 8);
const model = popup.model(); for (let i = 0; i < 100; i++) assert.strictEqual(popup.model(), model);
assert.equal(model.headerControls[0].items[0].kind, 'toggle');
assert.equal(model.headerControls[0].items[0].showToggleIndicator, true);
assert.equal(model.headerControls[0].items[0].togglePalette, undefined, 'Follow toggle keeps the standard filled active palette');
assert.equal(model.headerTitleBadge, undefined, 'Waiting badge does not crowd the call header');
assert.ok(!model.headerControls.some(control => control.id === 'call-verification' || control.id === 'receive-all-video'));
assert.ok(ChatCallPopupComponent.ɵcmp.styles.some(style => /\.call-grid[^{}]*\{[^}]*width: 100%/.test(style)), 'Projected participant grid fills its SmartList item');
assert.equal(guide.currentContextKey(), 'chat.call');
guide.openCurrent(); await Promise.resolve(); flush();
assert.equal(guide.visibleRevision().contextKey, 'chat.call');
assert.equal(guide.visibleGuideFields().length, 17);
const openVolume = () => popup.toggleVolume({ stopPropagation() {}, currentTarget: { getBoundingClientRect: () => bounds } });
openVolume(); flush(); await Promise.resolve(); flush();
assert.equal(guide.currentContextKey(), 'chat.call.volume', 'The child volume panel owns the active guide');
assert.equal(guide.visibleRevision().contextKey, 'chat.call.volume');
assert.equal(guide.visibleGuideFields().length, 7);
assert.notEqual(popup.volumePanel().hideFloatingControls, true, 'The compact panel retains the shared guide launcher');
const loadsBeforeLanguageChange = guideLoads.length;
i18n.currentLanguage.set('hu'); flush(); await Promise.resolve(); flush();
assert.deepEqual(guideLoads.slice(loadsBeforeLanguageChange), [['chat.call.volume', 'hu']], 'Language changes reload only the child guide without re-registering its parent');
assert.equal(guide.visibleRevision().lang, 'hu');
guide.closePopup(); flush();
assert.equal(call.open(), true, 'Closing the guide keeps the call open');
assert.ok(popup.volumePanel(), 'Closing the guide keeps the volume panel open');
openVolume(); flush();
assert.equal(guide.currentContextKey(), 'chat.call', 'Closing the volume panel restores the call guide');
openVolume(); flush();
assert.equal(guide.currentContextKey(), 'chat.call.volume');
call.open.set(false); flush();
assert.equal(popup.volumePanel(), null);
assert.equal(guide.currentContextKey(), 'chats', 'Closing a call with its child open restores the underlying chat guide');
call.open.set(true); flush();
assert.equal(guide.currentContextKey(), 'chat.call', 'A subsequent call registers its own guide again');
for (const destroy of cleanup.reverse()) destroy();
assert.equal(guide.currentContextKey(), 'chats', 'Component destruction unregisters its guide context');
closeChatGuide(); assert.equal(guide.currentContextKey(), null);
console.log('PASS call layout, native stepper configuration, recent-speaker ordering, stable models and bounded SmartList effects');
console.log('PASS real Help guide loads EN/HU call and volume seeds, switches nested contexts, preserves the call and cleans up registrations');
