import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateStartupBundles } from './startup-bundles.js';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myscoutee-startup-bundles-'));
  const files = {
    'chunk-BOOT0001.js': 'export const token = {}; export const state = {ready:false};',
    'chunk-SHARED01.js': `import {token,state} from './chunk-BOOT0001.js'; if(!state.ready) throw Error('App evaluated before environment selection'); export const service={token};`,
    'chunk-APP00001.js': `import {service} from './chunk-SHARED01.js'; export class App { static service=service; }`,
    'chunk-CONFIG01.js': `import {service} from './chunk-SHARED01.js'; export const appConfig={service};`,
    'chunk-ENTRY001.js': `import {service} from './chunk-SHARED01.js'; export class EntryPageComponent { static service=service; } export const openFeature=()=>import('./chunk-FEATURE1.js'); export const openHome=()=>import('./chunk-HOME0001.js'); export const openMenu=()=>import('./chunk-MENU0001.js');`,
    'chunk-MEMBER01.js': `import {service} from './chunk-SHARED01.js'; export const memberService={rootService:service};`,
    'chunk-HOME0001.js': `import {memberService} from './chunk-MEMBER01.js'; globalThis.__homeLoaded=true; export class HomeComponent {static service=memberService;}`,
    'chunk-MENU0001.js': `import {memberService} from './chunk-MEMBER01.js'; globalThis.__menuLoaded=true; export class SideMenuComponent {static service=memberService;}`,
    'chunk-FEATURE1.js': `import {service} from './chunk-SHARED01.js'; globalThis.__optionalFeatureLoaded=true; export {service};`,
    'main-ORIGINAL.js': `import {state} from './chunk-BOOT0001.js'; globalThis.__startupBundleProof=(async()=>{state.ready=true;const [app,config,entry]=await Promise.all([import('./chunk-APP00001.js'),import('./chunk-CONFIG01.js'),import('./chunk-ENTRY001.js')]);return {app,config,entry};})();`
  };
  const entries = {
    'main-ORIGINAL.js': 'src/main.ts', 'chunk-APP00001.js': 'src/app/app.ts',
    'chunk-CONFIG01.js': 'src/app/app.config.ts',
    'chunk-ENTRY001.js': 'src/app/entry/components/entry-page/entry-page.component.ts',
    'chunk-HOME0001.js': 'src/app/home/components/home/home.component.ts',
    'chunk-MENU0001.js': 'src/app/shared/ui/components/side-menu/side-menu.component.ts'
  };
  for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), source);
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify({ outputs: Object.fromEntries(
    Object.keys(files).map(name => [name, entries[name] ? {entryPoint:entries[name]} : {}])
  ) }));
  fs.writeFileSync(path.join(dir, 'index.html'), '<link rel="modulepreload" href="chunk-BOOT0001.js"><script type="module" src="main-ORIGINAL.js"></script>');
  return dir;
}

test('groups startup while preserving environment ordering, shared identities and genuinely lazy features', async () => {
  const dir = fixture();
  try {
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.startup.length, 2);
    assert.equal(manifest.files.length, 6);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes(manifest.main));
    assert.ok(!html.includes('modulepreload'));
    assert.ok(!fs.existsSync(path.join(dir, 'main-ORIGINAL.js')));
    assert.ok(!fs.existsSync(path.join(dir, 'stats.json')));
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const { app, config, entry } = await globalThis.__startupBundleProof;
    assert.equal(app.App.service, config.appConfig.service);
    assert.equal(app.App.service, entry.EntryPageComponent.service);
    assert.equal(globalThis.__optionalFeatureLoaded, undefined);
    const feature = await entry.openFeature();
    assert.equal(globalThis.__optionalFeatureLoaded, true);
    assert.equal(feature.service, app.App.service);
  } finally {
    fs.rmSync(dir, {recursive:true,force:true});
    delete globalThis.__startupBundleProof;
    delete globalThis.__optionalFeatureLoaded;
  }
});

test('opening the navigator keeps the home screen lazy and shares its existing services when opened later', async () => {
  const dir = fixture();
  try {
    await consolidateStartupBundles(dir);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'startup-bundles.json')));
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const {app, entry} = await globalThis.__startupBundleProof;
    assert.equal(globalThis.__homeLoaded, undefined);
    assert.equal(globalThis.__menuLoaded, undefined);
    const menu = await entry.openMenu();
    assert.equal(globalThis.__menuLoaded, true);
    assert.equal(globalThis.__homeLoaded, undefined);
    assert.equal(menu.SideMenuComponent.service.rootService, app.App.service);
    const home = await entry.openHome();
    assert.equal(globalThis.__homeLoaded, true);
    assert.equal(home.HomeComponent.service, menu.SideMenuComponent.service);
    assert.equal(globalThis.__optionalFeatureLoaded, undefined);
  } finally {
    fs.rmSync(dir, {recursive:true,force:true});
    delete globalThis.__startupBundleProof;
    delete globalThis.__homeLoaded;
    delete globalThis.__menuLoaded;
  }
});

test('a second stamp verifies and reuses the same consolidated artifacts', async () => {
  const dir = fixture();
  try {
    const manifest = await consolidateStartupBundles(dir);
    assert.deepEqual(await consolidateStartupBundles(dir), manifest);
    fs.appendFileSync(path.join(dir, manifest.main), '\n// changed');
    await assert.rejects(consolidateStartupBundles(dir), /changed after consolidation/);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});

test('missing Angular entry metadata fails before changing the original build', async () => {
  const dir = fixture();
  try {
    const statsPath = path.join(dir, 'stats.json');
    const metadata = JSON.parse(fs.readFileSync(statsPath));
    delete metadata.outputs['chunk-APP00001.js'].entryPoint;
    fs.writeFileSync(statsPath, JSON.stringify(metadata));
    await assert.rejects(consolidateStartupBundles(dir), /Missing startup entry/);
    assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('main-ORIGINAL.js'));
    assert.ok(fs.existsSync(path.join(dir, 'main-ORIGINAL.js')));
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});

test('the stamped worker installs the startup shell without fetching unused features or font subsets', async () => {
  const dir = fixture();
  try {
    fs.copyFileSync(new URL('../src/app-sw.js', import.meta.url), path.join(dir, 'app-sw.js'));
    fs.mkdirSync(path.join(dir, 'assets/diagnostics'), {recursive:true});
    fs.writeFileSync(path.join(dir, 'assets/diagnostics/landing.js'), '// diagnostic recorder');
    fs.mkdirSync(path.join(dir, 'media'));
    fs.writeFileSync(path.join(dir, 'media/roboto-latin.woff2'), 'LATIN');
    fs.writeFileSync(path.join(dir, 'media/roboto-greek.woff2'), 'GREEK');
    fs.writeFileSync(path.join(dir, 'styles-STYLE001.css'), '@font-face{font-family:Roboto;src:url(media/roboto-latin.woff2)}');
    fs.appendFileSync(path.join(dir, 'index.html'), '<script src="assets/diagnostics/landing.js" async></script><link rel="stylesheet" href="styles-STYLE001.css">');
    const stamp = () => execFileSync(process.execPath, [new URL('./stamp-prod-build.js', import.meta.url).pathname], {
      env: {...process.env, FRONTEND_BUILD_OUTPUT_DIR:dir, MYSCOUTEE_UI_BUILD_ID:'startup-precache-test'},
      stdio:'pipe'
    });
    stamp();
    stamp(); // Re-stamping must not bring the blanket precache back.
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'startup-bundles.json')));
    const handlers = new Map();
    let fetched;
    let requests;
    vm.runInNewContext(fs.readFileSync(path.join(dir, 'app-sw.js'), 'utf8'), {
      URL,
      Request: class extends Request {
        constructor(url, options) { super(new URL(url, 'https://qa.example/myscoutee/'), options); }
      },
      caches: {open: async () => ({addAll: async entries => {
        requests = Array.from(entries);
        fetched = requests.map(request => request.url);
      }})},
      self: {addEventListener: (name, handler) => handlers.set(name, handler)}
    });
    let install;
    handlers.get('install')({waitUntil: promise => {install = promise;}});
    await install;
    const buildRequests = fetched.filter(url => /\.(?:js|css|woff2?)$/.test(url));
    assert.deepEqual(buildRequests.sort(), [
      ...manifest.startup, 'assets/diagnostics/landing.js', 'styles-STYLE001.css'
    ].map(name => `https://qa.example/myscoutee/${name}`).sort());
    assert.ok(!fetched.some(url => url.includes('/media/')));
    assert.equal(requests.find(request => request.url.endsWith('/' + manifest.main)).cache, 'default');
    assert.equal(requests.find(request => request.url.endsWith('/index.html')).cache, 'reload');
    for (const file of manifest.files.filter(file => !manifest.startup.includes(file.name))) {
      assert.ok(!fetched.some(url => url.endsWith('/' + file.name)), file.name);
      assert.ok(fs.existsSync(path.join(dir, file.name)), 'Lazy features remain available on demand');
    }
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
