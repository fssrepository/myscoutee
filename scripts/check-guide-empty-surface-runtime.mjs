import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Render the running watcher's actual AOT template, without another compiler,
// browser session, server, or application-data mutation. JSDOM needs test rects.
assert.ok(process.argv[2], 'Pass the existing dev output directory');
const { symbol } = compiledDevModules(process.argv[2]);
const dom = new JSDOM('<!doctype html><body><main data-guide-surface="landing.home"></main><app-explanation-popup></app-explanation-popup>',
  { url: 'http://localhost', pretendToBeVisual: true });
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLButtonElement', 'Event', 'MouseEvent', 'KeyboardEvent',
  'MutationObserver', 'DOMRect', 'getComputedStyle', 'localStorage']) globalThis[key] = dom.window[key];
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const frames = new Map(); let frameId = 0;
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
HTMLElement.prototype.scrollIntoView = function () {};
HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.hidden || this.closest('[hidden]')) return new DOMRect();
  return this.matches('button') ? new DOMRect(80, 80, 120, 40) : new DOMRect(0, 0, 700, 600);
};
const [bootstrap, Popup, Guide, I18n, Navigation, signal] = await Promise.all(
  ['bootstrapApplication', 'ExplanationPopupComponent', 'ExplanationGuideService', 'I18nService', 'OverlayNavigationStore', 'signal'].map(symbol));
const bundles = Object.fromEntries(['en', 'hu'].map(lang => [lang,
  JSON.parse(readFileSync(new URL(`../src/assets/i18n/${lang}.json`, import.meta.url))).messages]));
const i18n = { revision: signal(0), currentLanguage: signal('en'), translate: (key, fallback) => bundles[i18n.currentLanguage()][key] || fallback || key };
const navigation = new Map(), navigationCalls = [];
const transport = [];
const app = await bootstrap(Popup, { providers: [
  { provide: I18n, useValue: i18n },
  { provide: Navigation, useValue: {
    register(close) { const token = Symbol(); navigation.set(token, close); navigationCalls.push('register'); return token; },
    unregister(token) { navigation.delete(token); navigationCalls.push('unregister'); }, bringToFront() {}
  } },
  { provide: Guide, useFactory: () => new Guide({ loadState: (context, language) => new Promise((resolve, reject) => transport.push({ context, language, resolve, reject })) }) }
] });
const guide = app.injector.get(Guide);
const main = document.querySelector('main');
const surface = document.createElement('div'); surface.className = 'ui-popup'; surface.style.zIndex = '2450'; document.body.append(surface);
const state = (fields = [{ id: 'known-action', order: 1, group: 'popup', i18nKey: 'guide.test' }]) => ({
  activeRevision: { contextKey: guide.currentContextKey(), title: 'Test guide', presentation: 'tour', sections: [] }, guideFields: fields
});
const visuals = () => document.querySelectorAll('.explanation-guide-overlay__shade, .explanation-guide-overlay__card, .explanation-guide-overlay__focus, .explanation-guide-overlay__loading-indicator').length;
async function render() { await Promise.resolve(); app.tick(); await Promise.resolve(); app.tick(); }
async function position() {
  for (let i = 0; i < 8; i++) {
    await render();
    const batch = [...frames.values()]; frames.clear();
    for (const callback of batch) callback(performance.now());
  }
  await render();
}
function silent(label) {
  assert.equal(visuals(), 0, label + ': no shade, card, focus or loading flash');
  assert.equal(guide.hasVisiblePopup(), false, label + ': launcher stays inactive');
  assert.equal(navigation.size, 0, label + ': no invisible Back boundary');
}
function noGuide(label) {
  const card = document.querySelector('.explanation-guide-overlay__card--center');
  assert.ok(card, label + ': centered card');
  assert.ok(card.textContent.includes(bundles[i18n.currentLanguage()]['guide.empty.body']), label + ': translated feedback');
  assert.equal(document.querySelectorAll('.explanation-guide-overlay__focus, .explanation-guide-overlay__controls, .explanation-guide-overlay__loading-indicator').length, 0);
  assert.equal(guide.popupOpen(), true, label + ': feedback stays open');
  assert.equal(guide.hasVisiblePopup(), true); assert.equal(navigation.size, 1);
  return card;
}
try {
  guide.registerContext('landing.home');
  surface.innerHTML = '<article><p>Article without a guide</p><button>Close</button></article>';
  // A target behind the article must not count as an article guide target.
  main.innerHTML = '<button data-guide-item="known-action">Underlying action</button>';
  guide.openCurrent(); await render(); silent('Pending article guide');
  transport.at(-1).resolve(state()); await render(); silent('Loaded article before target resolution');
  await position(); const firstCard = noGuide('Article without targets');
  let scans = 0;
  const query = surface.querySelectorAll.bind(surface);
  surface.querySelectorAll = (...args) => { scans++; return query(...args); };
  for (let i = 0; i < 200; i++) { window.dispatchEvent(new Event('resize')); await position(); }
  assert.equal(noGuide('Feedback after 200 viewport notifications'), firstCard, 'No card close/recreate flash');
  assert.equal(scans, 0, 'Stable feedback must not repeat target indexing');
  assert.deepEqual(navigationCalls, ['register'], 'One stable Back boundary');
  document.querySelector('.explanation-guide-overlay__close').click(); await render(); silent('Close feedback');
  const loaded = transport.length;
  for (const close of [
    () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })),
    () => [...navigation.values()].at(-1)(),
    () => guide.openCurrent(),
    () => document.querySelector('.explanation-guide-overlay__shade').click()
  ]) {
    guide.openCurrent(); await render(); silent('Cached no-target reopen'); await position();
    noGuide('Cached missing targets'); close(); await render(); silent('Dismiss feedback');
  }
  assert.equal(transport.length, loaded, 'No refetch loop for the same loaded guide');
  console.log('PASS article/other empty popup: persistent centered feedback, cold/cached open, X/Escape/Back/launcher/shade close; 200 notifications / zero rescans');

  for (const response of [{ activeRevision: null, guideFields: [] }, state([])]) {
    const release = guide.registerContext('landing.consent');
    guide.openCurrent(); await render(); silent('Unresolved guide');
    transport.at(-1).resolve(response); await position(); noGuide('Missing/empty guide');
    guide.closePopup(); await render(); silent('Closed empty guide');
    const loads = transport.length;
    guide.openCurrent(); await position(); noGuide('Cached empty revision');
    assert.equal(transport.length, loads); guide.closePopup(); release(); await render();
  }
  console.log('PASS absent revision and empty fields show the same stable feedback; cached reopening avoids duplicate requests');

  surface.innerHTML = '<button data-guide-item="known-action">Available action</button><button data-guide-item="second-action">Second action</button>';
  guide.openCurrent(); await render(); transport.at(-1).resolve(state([
    ...state().guideFields, { id: 'second-action', order: 2, group: 'popup', i18nKey: 'guide.second' }
  ])); await position();
  assert.ok(document.querySelector('.explanation-guide-overlay__card'), 'Valid guide still opens');
  assert.equal(guide.hasVisiblePopup(), true); assert.equal(navigation.size, 1);
  const tourCard = document.querySelector('.explanation-guide-overlay__card');
  for (const [id, step] of [['next', 1], ['previous', 0], ['next', 1]]) {
    document.querySelector(`app-explanation-guide-overlay [data-guide-item="${id}"]`).click();
    await position(); assert.equal(guide.stepIndex(), step);
    assert.equal(document.querySelector('.explanation-guide-overlay__card'), tourCard, 'Next/Back retain the mounted card');
  }
  document.querySelector('app-explanation-guide-overlay [data-guide-item="next"]').click();
  await render(); silent('Done closes the valid guide');
  const cached = transport.length;
  guide.openCurrent(); await position(); assert.ok(visuals()); assert.equal(transport.length, cached);
  surface.innerHTML = '<p>Replacement popup without guide fields</p>';
  await position(); noGuide('Valid guide loses its surface targets');
  guide.closePopup(); await render(); silent('Lost-target feedback closed');
  console.log('PASS valid guide, Next/Back/Done without card recreation, cached reopen, target disappearance and cleanup');

  const release = guide.registerContext('landing.consent');
  guide.openCurrent(); await render(); transport.at(-1).reject(new Error('offline')); await position();
  assert.ok(document.querySelector('.explanation-guide-overlay__card--center'), 'Transport failures keep the existing readable error');
  assert.equal(guide.hasVisiblePopup(), true); assert.equal(navigation.size, 1);
  guide.closePopup(); await render(); silent('Error closed'); release();
  console.log('PASS genuine load failure remains a stable centered error, not a flash');

  surface.remove(); main.remove();
  guide.openCurrent(); await render(); transport.at(-1).resolve(state()); await position();
  noGuide('No mounted surface');
  i18n.currentLanguage.set('hu'); i18n.revision.update(n => n + 1); await render();
  transport.at(-1).resolve(state()); await position(); noGuide('Hungarian feedback after language switch');
  guide.closePopup(); await render(); silent('No-surface feedback closed');
  console.log('PASS absent surface and EN/HU feedback after language switch');
} finally { app.destroy(); dom.window.close(); }
