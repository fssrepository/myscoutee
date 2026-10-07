import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Guide wiring/content regression only. Does not exercise or change permissions,
// issue keys, write settings, operate a browser or start another compiler.
assert.ok(process.argv[2], 'Pass the existing dev output directory');
const compiled = compiledDevModules(process.argv[2]);
const [ExplanationGuideService, signal, runInInjectionContext, Injector, DestroyRef] = await Promise.all(
  ['ExplanationGuideService', 'signal', 'runInInjectionContext', 'Injector', 'DestroyRef'].map(compiled.symbol));
const fields = JSON.parse(readFileSync(new URL('../src/app/shared/core/local/seed/data/help-center-guide-fields.json', import.meta.url)));
const seeds = ['demo_db', 'e2e_db', 'myscoutee_db'].map(database => JSON.parse(readFileSync(
  new URL(`../../server/docker/conf/mongodb/${database}/helpCenterRevisions.json`, import.meta.url))));
const local = ['work', 'community'].map(scope => JSON.parse(readFileSync(
  new URL(`../src/app/shared/core/local/seed/data/${scope}-help-center.json`, import.meta.url))));
const messages = Object.fromEntries(['en', 'hu'].map(lang => [lang, JSON.parse(readFileSync(
  new URL(`../src/assets/i18n/${lang}.json`, import.meta.url))).messages]));

for (const group of [null, 'myscoutee-work', 'myscoutee-community']) {
  const pending = new Set(), cleanup = [], loads = [];
  const scheduler = { add: node => pending.add(node), schedule: node => pending.add(node), remove: node => pending.delete(node) };
  const i18n = { currentLanguage: signal('en') };
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
  const guide = runInInjectionContext(injector, () => new ExplanationGuideService({ loadState: async (context, lang) => {
    loads.push([context, lang]);
    return { activeRevision: seeds[0].find(row => row.active && row.contextKey === context && row.lang === lang && (row.baseGroupId ?? null) === group),
      guideFields: fields[context] ?? [] };
  } }));
  async function flush() {
    for (let turn = 0; turn < 4; turn++) {
      await Promise.resolve(); let count = 0;
      while (pending.size) {
        assert.ok(++count < 50, 'Guide effects must settle');
        const node = pending.values().next().value; pending.delete(node); node.run();
      }
    }
  }
  const closeParent = guide.registerContext('profile.integrations');
  guide.openCurrent(); await flush();
  for (const id of ['integration-token-access', 'mcp-main-access', 'mcp-client-access', 'integration-access-save']) {
    assert.ok(guide.visibleGuideFields().some(field => field.id === id), id);
    assert.ok(guide.visibleRevision().sections.some(section => section.guideStepId === id), id);
  }
  const closeChild = guide.registerContext('profile.integration-access'); await flush();
  assert.equal(guide.currentContextKey(), 'profile.integration-access', 'Child must be registered as an enabled surface');
  assert.equal(guide.launcherVisible(), true);
  assert.deepEqual(guide.visibleGuideFields().map(field => field.id), ['integration-access-level', 'integration-access-apply', 'close']);
  assert.equal(guide.visibleRevision().sections.length, 3);
  guide.nextStep(); guide.setStepIndex(0);
  assert.equal(loads.length, 2, 'Walking steps must not reload the parent or child');
  i18n.currentLanguage.set('hu'); await flush();
  assert.equal(guide.visibleRevision().lang, 'hu');
  assert.deepEqual(loads.at(-1), ['profile.integration-access', 'hu']);
  closeChild(); await flush();
  assert.equal(guide.currentContextKey(), 'profile.integrations');
  assert.equal(guide.visibleRevision().contextKey, 'profile.integrations');
  guide.closePopup();
  const release = guide.registerContext('profile.integration-access'); guide.openCurrent(); await flush();
  assert.equal(guide.visibleRevision().contextKey, 'profile.integration-access');
  guide.closePopup(); assert.equal(guide.currentContextKey(), 'profile.integration-access');
  release(); closeParent(); assert.equal(guide.currentContextKey(), null);
  for (const fn of cleanup.reverse()) fn();
  console.log('PASS enabled parent/child Help, four button/save steps, three child steps, EN/HU and cleanup:', group ?? 'Dating');
}

for (const rows of [...seeds, ...local]) for (const group of [null, 'myscoutee-work', 'myscoutee-community']) {
  if (!seeds.includes(rows) && group !== (rows === local[0] ? 'myscoutee-work' : 'myscoutee-community')) continue;
  for (const lang of ['en', 'hu']) {
    const active = rows.filter(row => row.active && row.contextKey === 'profile.integration-access' && row.lang === lang && (row.baseGroupId ?? null) === group);
    assert.equal(active.length, 1); assert.equal(active[0].sections.length, 3);
    for (const field of fields['profile.integration-access']) {
      assert.equal(active[0].sections.find(section => section.guideStepId === field.id)?.contentHtml,
        '<p>' + messages[lang][field.i18nKey + '.description'] + '</p>');
    }
  }
}
console.log('PASS local Work/Community and all Mongo scopes contain the existing EN/HU permissions guide');
