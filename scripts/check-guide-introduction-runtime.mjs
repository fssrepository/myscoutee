import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Real service + current seed content, using the existing watcher's AOT bundle.
// Storage and data transport are isolated in memory; no browser/DB is mutated.
assert.ok(process.argv[2], 'Pass the existing dev output directory');
const compiled = compiledDevModules(process.argv[2]);
const [ExplanationGuideService, APP_STORAGE_KEYS, signal, runInInjectionContext, Injector, DestroyRef] = await Promise.all(
  ['ExplanationGuideService', 'APP_STORAGE_KEYS', 'signal', 'runInInjectionContext', 'Injector', 'DestroyRef'].map(compiled.symbol));
const fields = JSON.parse(readFileSync(new URL('../src/app/shared/core/local/seed/data/help-center-guide-fields.json', import.meta.url)));
const revisions = JSON.parse(readFileSync(new URL('../../server/docker/conf/mongodb/demo_db/helpCenterRevisions.json', import.meta.url)));
const introKey = APP_STORAGE_KEYS.explanationGuideIntroductionSeen;
const consentKey = APP_STORAGE_KEYS.entryConsent;
const enabledKey = APP_STORAGE_KEYS.explanationGuideEnabled;

function fixture(initial = [], load) {
  const storage = new Map(initial), writes = [], loads = [], pending = new Set(), cleanup = [];
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); writes.push([key, value]); }
  };
  const i18n = { currentLanguage: signal('hu') };
  const scheduler = { add: node => pending.add(node), schedule: node => pending.add(node), remove: node => pending.delete(node) };
  const injector = { get(token, fallback) {
    const name = (token.name ?? '').replace(/^_/, '');
    if (token === Injector) return injector;
    if (token === DestroyRef) return { onDestroy: fn => { cleanup.push(fn); return () => {}; } };
    if (name === 'EffectScheduler') return scheduler;
    if (name === 'ChangeDetectionScheduler') return { notify() {} };
    if (name === 'ViewContext') return null;
    if (name === 'I18nService') return i18n;
    if (fallback !== undefined) return fallback;
    throw new Error('Missing provider ' + name);
  } };
  const guide = runInInjectionContext(injector, () => new ExplanationGuideService({ storageKey: enabledKey,
    loadState: async (context, language) => {
      loads.push([context, language]);
      return load ? load(context, language) : {
        activeRevision: revisions.find(row => row.active && !row.baseGroupId && row.contextKey === context && row.lang === language),
        guideFields: fields[context] ?? []
      };
    }
  }));
  guide.registerContext('landing.home');
  return { guide, storage, loads, writes, i18n, injector,
    async flush() {
      for (let tick = 0; tick < 4; tick++) {
        await Promise.resolve();
        let count = 0;
        while (pending.size) {
          assert.ok(++count < 50, 'Guide effects must settle');
          const node = pending.values().next().value; pending.delete(node); node.run();
        }
      }
    },
    destroy() { for (const fn of cleanup.reverse()) fn(); }
  };
}

const fresh = fixture();
assert.equal(fresh.guide.canOfferLauncherIntroduction(), true);
fresh.guide.offerLauncherIntroduction(); await fresh.flush();
assert.equal(fresh.guide.currentContextKey(), 'landing.guide');
assert.equal(fresh.guide.visibleGuideFields().length, 1);
assert.equal(fresh.guide.visibleRevision().sections.length, 1);
assert.equal(fresh.guide.visibleRevision().lang, 'hu');
for (let i = 0; i < 200; i++) fresh.guide.offerLauncherIntroduction();
assert.equal(fresh.loads.length, 1); assert.equal(fresh.guide.canOfferLauncherIntroduction(), false);
fresh.i18n.currentLanguage.set('en'); await fresh.flush();
assert.deepEqual(fresh.loads, [['landing.guide', 'hu'], ['landing.guide', 'en']]);
fresh.guide.closePopup(); await fresh.flush();
assert.equal(fresh.guide.currentContextKey(), 'landing.home');
assert.equal(fresh.guide.popupOpen(), false);
assert.equal(fresh.storage.get(introKey), 'true');
assert.equal(fresh.storage.has(consentKey), false);
assert.equal(fresh.storage.has(enabledKey), false);
fresh.guide.offerLauncherIntroduction(); assert.equal(fresh.loads.length, 2);
const retained = [...fresh.storage]; fresh.destroy();
const revisit = fixture(retained); revisit.guide.offerLauncherIntroduction(); await revisit.flush();
assert.equal(revisit.guide.popupOpen(), false); assert.equal(revisit.loads.length, 0);
assert.equal(revisit.guide.canOfferLauncherIntroduction(), false); revisit.destroy();
console.log('PASS first visit: one EN/HU step, bounded loads, seen persistence and unchanged consent/preference');

const known = fixture([[consentKey, '{"accepted":true}']]);
known.guide.offerLauncherIntroduction(); await known.flush();
assert.equal(known.loads.length, 0); assert.equal(known.writes.length, 0); known.destroy();
const disabled = fixture([[enabledKey, 'false'], [consentKey, '{"accepted":true}']]);
disabled.guide.offerLauncherIntroduction(); assert.equal(disabled.loads.length, 0);
assert.equal(disabled.guide.canOfferLauncherIntroduction(), false);
disabled.guide.toggleEnabled(); assert.equal(disabled.guide.launcherVisible(), true);
assert.equal(disabled.storage.get(enabledKey), 'true');
disabled.guide.openCurrent(); await disabled.flush();
assert.equal(disabled.guide.visibleRevision().contextKey, 'landing.home'); disabled.destroy();
console.log('PASS known visitors skip introduction; persisted OFF can be turned ON and opens the normal guide');

const transition = fixture(); transition.guide.offerLauncherIntroduction(); await transition.flush();
const closeMenu = transition.guide.registerContext('navigation.menu'); await transition.flush();
assert.equal(transition.guide.currentContextKey(), 'navigation.menu');
assert.equal(transition.guide.popupOpen(), false);
closeMenu(); assert.equal(transition.guide.currentContextKey(), 'landing.home'); transition.destroy();
const click = fixture(); click.guide.offerLauncherIntroduction(); await click.flush();
click.guide.openCurrent(); await click.flush();
assert.equal(click.guide.visibleRevision().contextKey, 'landing.home');
assert.equal(click.guide.popupOpen(), true); click.destroy();
console.log('PASS temporary context cleanup on navigation and reopening the ordinary guide');

let complete;
const cancelled = fixture([], () => new Promise(resolve => { complete = resolve; }));
cancelled.guide.offerLauncherIntroduction(); cancelled.guide.closePopup();
complete({ activeRevision: revisions.find(row => row.active && !row.baseGroupId && row.contextKey === 'landing.guide' && row.lang === 'hu'), guideFields: fields['landing.guide'] });
await cancelled.flush();
assert.equal(cancelled.guide.currentContextKey(), 'landing.home'); assert.equal(cancelled.guide.popupOpen(), false);
assert.equal(cancelled.storage.has(introKey), false); cancelled.destroy();
const empty = fixture([], async () => ({ activeRevision: null, guideFields: [] }));
empty.guide.offerLauncherIntroduction(); await empty.flush();
assert.equal(empty.guide.popupOpen(), true);
assert.equal(empty.guide.noGuide(), true, 'Missing content keeps explicit feedback open until dismissed');
empty.guide.closePopup(); await empty.flush();
assert.equal(empty.guide.currentContextKey(), 'landing.home'); assert.equal(empty.guide.popupOpen(), false);
assert.equal(empty.storage.has(introKey), false); empty.destroy();
console.log('PASS late/empty responses neither reopen the intro nor mark unseen content completed');

const [LandingGuideSurfaceDirective, LANDING_EXPLANATION_GUIDE, EntryPageComponent, DocumentViewerComponent, ExplanationPopupComponent] = await Promise.all(
  ['LandingGuideSurfaceDirective', 'LANDING_EXPLANATION_GUIDE', 'EntryPageComponent', 'DocumentViewerComponent', 'ExplanationPopupComponent'].map(compiled.symbol));
const consent = fixture();
const surface = runInInjectionContext({ get: (token, fallback) => token === LANDING_EXPLANATION_GUIDE
  ? consent.guide : consent.injector.get(token, fallback) }, () => new LandingGuideSurfaceDirective());
surface.appLandingGuideSurface = null; surface.ngOnChanges();
assert.equal(consent.guide.launcherVisible(), false, 'Loading/read-only consent must not open the underlying landing tour');
consent.guide.openCurrent(); assert.equal(consent.loads.length, 0);
surface.appLandingGuideSurface = 'landing.consent'; surface.ngOnChanges();
consent.guide.offerLauncherIntroduction(); await consent.flush();
assert.equal(consent.guide.currentContextKey(), 'landing.guide');
consent.guide.closePopup();
assert.equal(consent.guide.currentContextKey(), 'landing.consent', 'Introduction must restore the open consent context');
consent.guide.openCurrent(); await consent.flush();
assert.equal(consent.guide.popupOpen(), true);
assert.deepEqual(consent.guide.visibleGuideFields().map(field => field.id), ['entry-privacy-accept']);
assert.equal(consent.guide.visibleRevision().sections.length, 1);
consent.guide.closePopup(); consent.guide.openCurrent(); await consent.flush();
assert.deepEqual(consent.loads, [['landing.guide', 'hu'], ['landing.consent', 'hu']], 'Reopening reuses the loaded consent guide');
consent.i18n.currentLanguage.set('en'); await consent.flush();
assert.equal(consent.guide.visibleRevision().lang, 'en');

// Resolve the actual entry action through the shared document menu and the
// existing overlay index. No browser, acceptance or persistence is exercised.
const page = Object.create(EntryPageComponent.prototype);
Object.assign(page, { showEntryConsentPopup: true, entryConsentViewOnly: false,
  entryPrivacyLoading: false, entryPrivacySaving: false, uiText: text => text,
  privacyPolicy: { activeRevision: () => ({ sections: [{ id: 'privacy' }] }) } });
const viewer = Object.create(DocumentViewerComponent.prototype);
viewer.config = { actions: page.entryPrivacyDocumentActions() };
const accept = viewer.actionMenuItems().find(item => item.id === 'entry-privacy-accept');
assert.ok(accept && !accept.disabled);
const Overlay = ExplanationPopupComponent.ɵcmp.dependencies.find(type => type.name.replace(/^_/, '') === 'ExplanationGuideOverlayComponent');
assert.ok(Overlay);
const overlay = Object.create(Overlay.prototype);
Object.assign(overlay, { guide: consent.guide, fieldElements: new Map(), fieldsDirty: true, fieldsRoot: null,
  steps: signal([]), step: consent.guide.stepIndex });
globalThis.HTMLButtonElement = class {};
globalThis.getComputedStyle = () => ({ visibility: 'visible' });
const button = Object.assign(new HTMLButtonElement(), { getAttribute: name => name === 'data-guide-item' ? accept.id : null,
  getBoundingClientRect: () => ({ width: 160, height: 40 }), closest: () => null });
let scans = 0;
const root = { querySelector: () => null, querySelectorAll: () => { scans++; return [button]; } };
overlay.indexFields(root); overlay.syncAvailableSteps(root);
assert.equal(overlay.steps().length, 1, 'The consent popup has a rendered target instead of closing without one');
assert.equal(overlay.resolveTarget(consent.guide.visibleGuideFields()[0], root).element, button);
for (let i = 0; i < 200; i++) overlay.syncAvailableSteps(root);
assert.equal(scans, 1, 'Unchanged consent targets reuse the existing overlay index');
assert.equal(consent.storage.has(consentKey), false, 'Reading Help must not accept consent');
consent.guide.closePopup(); surface.ngOnDestroy(); await consent.flush();
assert.equal(consent.guide.currentContextKey(), 'landing.home');
assert.equal(consent.guide.popupOpen(), false); consent.destroy();
console.log('PASS consent: loading/read-only suppression, intro restoration, one Accept target, EN/HU, cached reopen and cleanup; 200 checks / one index scan');

for (const lang of ['hu', 'en']) {
  const bundle = JSON.parse(readFileSync(new URL(`../src/assets/i18n/${lang}.json`, import.meta.url))).messages;
  const text = bundle['guide.landing.guide.guide-launcher.description'];
  assert.ok(text.length <= 175, 'Keep the single-step introduction concise; rendered five-line fit remains a UI check');
  for (const database of ['demo_db', 'e2e_db', 'myscoutee_db']) {
    const rows = JSON.parse(readFileSync(new URL(`../../server/docker/conf/mongodb/${database}/helpCenterRevisions.json`, import.meta.url)));
    for (const baseGroupId of [null, 'myscoutee-work', 'myscoutee-community']) {
      const active = rows.filter(row => row.active && (row.baseGroupId ?? null) === baseGroupId && row.contextKey === 'landing.guide' && row.lang === lang);
      assert.equal(active.length, 1); assert.equal(active[0].sections.length, 1);
      assert.equal(active[0].sections[0].contentHtml, `<p>${text}</p>`);
      const navigation = rows.filter(row => row.active && (row.baseGroupId ?? null) === baseGroupId && row.contextKey === 'navigation.menu' && row.lang === lang);
      assert.equal(navigation.length, 1);
      for (const id of ['notifications', 'explanations']) {
        const field = fields['navigation.menu'].find(field => field.i18nKey === `guide.navigation.menu.${id}`);
        const section = navigation[0].sections.find(section => section.guideStepId === field.id);
        assert.equal(section.contentHtml, `<p>${bundle[field.i18nKey + '.description']}</p>`);
      }
    }
  }
}
console.log('PASS short introductory and side-menu copy across EN/HU × 3 workspaces × 3 Mongo seeds');
