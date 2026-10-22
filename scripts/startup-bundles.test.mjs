import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateStartupBundles } from './startup-bundles.js';

function fixture({ localAdapters = false, httpEntryAdapters = false, publicHelp = false } = {}) {
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
  if (localAdapters) {
    files['chunk-LOCAL001.js'] = `import {service} from './chunk-SHARED01.js'; globalThis.__localAdaptersLoaded=true; export const localAdapter={service};`;
    files['chunk-HTTP0001.js'] = `import {service} from './chunk-SHARED01.js'; globalThis.__httpAdaptersLoaded=true; export const httpAdapter={service};`;
    files['chunk-ENTRY001.js'] += ` export const openLocalAdapters=()=>import('./chunk-LOCAL001.js'); export const openHttpAdapters=()=>import('./chunk-HTTP0001.js');`;
    entries['chunk-LOCAL001.js'] = 'src/app/shared/core/base/local-adapters.ts';
    entries['chunk-HTTP0001.js'] = 'src/app/shared/core/base/http-adapters.ts';
  }
  if (httpEntryAdapters) {
    files['chunk-PUBLIC01.js'] = `import {service} from './chunk-SHARED01.js'; globalThis.__publicAdaptersLoaded=true; export const publicAdapter={service};`;
    files['chunk-HTTP0001.js'] = `import {publicAdapter} from './chunk-PUBLIC01.js'; globalThis.__httpAdaptersLoaded=true; export {publicAdapter};`;
    files['chunk-ENTRY001.js'] += ` export const openPublicAdapters=()=>import('./chunk-PUBLIC01.js');`;
    entries['chunk-PUBLIC01.js'] = 'src/app/shared/core/base/http-entry-adapters.ts';
  }
  if (publicHelp) {
    files['chunk-GUIDE001.js'] = `import {service} from './chunk-SHARED01.js'; globalThis.__guideLoaded=true; export const guide={service};`;
    files['chunk-DOC00001.js'] = `import {service} from './chunk-SHARED01.js'; globalThis.__documentLoaded=true; export const document={service};`;
    files['chunk-AUTHUI01.js'] = `import {service} from './chunk-SHARED01.js'; globalThis.__loginLoaded=true; export const login={service};`;
    files['chunk-DEMOUI01.js'] = `import {service} from './chunk-SHARED01.js'; globalThis.__demoSelectorLoaded=true; export const demo={service};`;
    files['chunk-ENTRY001.js'] += ` export const openGuide=()=>import('./chunk-GUIDE001.js'); export const openDocument=()=>import('./chunk-DOC00001.js'); export const openLogin=()=>import('./chunk-AUTHUI01.js'); export const openDemo=()=>import('./chunk-DEMOUI01.js');`;
    entries['chunk-GUIDE001.js'] = 'src/app/shared/ui/components/explanation-popup/explanation-guide-overlay.component.ts';
    entries['chunk-DOC00001.js'] = 'src/app/shared/ui/components/explanation-popup/explanation-popup.component.ts';
    entries['chunk-AUTHUI01.js'] = 'src/app/entry/components/entry-firebase-auth-popup/entry-firebase-auth-popup.component.ts';
    entries['chunk-DEMOUI01.js'] = 'src/app/shared/ui/components/demo-bootstrap-selector/demo-bootstrap-selector.component.ts';
  }
  for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), source);
  fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify({ outputs: Object.fromEntries(
    Object.keys(files).map(name => [name, entries[name] ? {entryPoint:entries[name]} : {}])
  ) }));
  fs.writeFileSync(path.join(dir, 'index.html'), '<link rel="modulepreload" href="chunk-BOOT0001.js"><script type="module" src="main-ORIGINAL.js"></script>');
  return dir;
}

test('opening the public guide does not evaluate the explanation document or workspace adapters', async () => {
  const dir = fixture({ publicHelp: true, localAdapters: true, httpEntryAdapters: true });
  try {
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.startup.length, 2);
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const {app, entry} = await globalThis.__startupBundleProof;
    assert.equal(globalThis.__guideLoaded, undefined);
    assert.equal(globalThis.__documentLoaded, undefined);
    const guide = await entry.openGuide();
    assert.equal(guide.guide.service, app.App.service);
    assert.equal(globalThis.__guideLoaded, true);
    assert.equal(globalThis.__loginLoaded, undefined);
    assert.equal(globalThis.__demoSelectorLoaded, undefined);
    assert.equal(globalThis.__documentLoaded, undefined);
    assert.equal(globalThis.__httpAdaptersLoaded, undefined);
    assert.equal(globalThis.__localAdaptersLoaded, undefined);
    const document = await entry.openDocument();
    assert.equal(document.document.service, app.App.service);
    assert.equal(globalThis.__documentLoaded, true);
    const login = await entry.openLogin();
    assert.equal(login.login.service, app.App.service);
    assert.equal(globalThis.__loginLoaded, true);
    assert.equal(globalThis.__demoSelectorLoaded, true);
    assert.equal((await entry.openDemo()).demo.service, app.App.service);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    delete globalThis.__guideLoaded;
    delete globalThis.__documentLoaded;
    delete globalThis.__loginLoaded;
    delete globalThis.__demoSelectorLoaded;
    delete globalThis.__startupBundleProof;
  }
});

test('keeps only the build profile adapter side in the existing startup pair and preserves shared identities', async () => {
  for (const standalone of [false, true]) {
    const dir = fixture({ localAdapters: true });
    try {
      const manifest = await consolidateStartupBundles(dir, { localAdaptersInStartup: standalone });
      assert.equal(manifest.startup.length, 2);
      await import(pathToFileURL(path.join(dir, manifest.main)));
      const { app, entry } = await globalThis.__startupBundleProof;
      assert.equal(globalThis.__localAdaptersLoaded, standalone ? true : undefined);
      assert.equal(globalThis.__httpAdaptersLoaded, standalone ? undefined : true);
      const selected = standalone ? await entry.openLocalAdapters() : await entry.openHttpAdapters();
      assert.equal((standalone ? selected.localAdapter : selected.httpAdapter).service, app.App.service);
      const counterpart = standalone ? await entry.openHttpAdapters() : await entry.openLocalAdapters();
      assert.equal((standalone ? counterpart.httpAdapter : counterpart.localAdapter).service, app.App.service);
      assert.equal(globalThis.__localAdaptersLoaded, true);
      assert.equal(globalThis.__httpAdaptersLoaded, true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      delete globalThis.__localAdaptersLoaded;
      delete globalThis.__httpAdaptersLoaded;
      delete globalThis.__startupBundleProof;
    }
  }
});

test('keeps public HTTP adapters in startup and workspace transport separate from the member UI', async () => {
  const dir = fixture({localAdapters:true, httpEntryAdapters:true});
  try {
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.startup.length, 2);
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const {app, entry} = await globalThis.__startupBundleProof;
    assert.equal(globalThis.__publicAdaptersLoaded, true);
    assert.equal(globalThis.__httpAdaptersLoaded, undefined);
    assert.equal(globalThis.__localAdaptersLoaded, undefined);
    const publicModule = await entry.openPublicAdapters();
    const fullModule = await entry.openHttpAdapters();
    assert.equal(globalThis.__httpAdaptersLoaded, true);
    assert.equal(fullModule.publicAdapter, publicModule.publicAdapter);
    assert.equal(fullModule.publicAdapter.service, app.App.service);
    assert.notEqual(manifest.loads['src/app/shared/core/base/http-adapters.ts'][0],
      manifest.loads['src/app/shared/ui/components/side-menu/side-menu.component.ts'][0]);
    assert.equal(globalThis.__homeLoaded, undefined);
  } finally {
    fs.rmSync(dir, {recursive:true,force:true});
    for (const key of ['__publicAdaptersLoaded','__httpAdaptersLoaded','__localAdaptersLoaded','__startupBundleProof','__menuLoaded','__homeLoaded']) delete globalThis[key];
  }
});

test('loads optional Firebase SDKs together without evaluating them on the landing', async () => {
  const dir = fixture();
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'stats.json')));
    const authSource = 'src/app/shared/core/base/services/accounts/firebase-auth.service.ts';
    const messagingSource = 'node_modules/firebase/messaging/dist/esm/index.esm.js';
    fs.writeFileSync(path.join(dir, 'chunk-AUTH0001.js'), "import {service} from './chunk-SHARED01.js'; globalThis.__firebaseAuthLoaded=true; export {service};");
    fs.writeFileSync(path.join(dir, 'chunk-PUSH0001.js'), "import {service} from './chunk-SHARED01.js'; globalThis.__firebaseMessagingLoads=(globalThis.__firebaseMessagingLoads??0)+1; export {service};");
    metadata.outputs['chunk-AUTH0001.js'] = {entryPoint:authSource};
    metadata.outputs['chunk-PUSH0001.js'] = {entryPoint:messagingSource};
    fs.appendFileSync(path.join(dir, 'chunk-ENTRY001.js'), " export const openAuth=()=>import('./chunk-AUTH0001.js'); export const openMessaging=()=>import('./chunk-PUSH0001.js');");
    fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(metadata));
    const manifest = await consolidateStartupBundles(dir);
    const authChunk = manifest.loads[authSource][0];
    assert.equal(authChunk, manifest.loads[messagingSource][0]);
    assert.ok(!manifest.startup.includes(authChunk));
    assert.equal(manifest.files.length, 6);
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const {app, entry} = await globalThis.__startupBundleProof;
    assert.equal(globalThis.__firebaseAuthLoaded, undefined);
    assert.equal(globalThis.__firebaseMessagingLoads, undefined);
    const messaging = await entry.openMessaging();
    assert.equal(messaging.service, app.App.service);
    assert.equal(globalThis.__firebaseAuthLoaded, true);
    assert.equal(globalThis.__firebaseMessagingLoads, 1);
    assert.equal((await entry.openAuth()).service, messaging.service);
    assert.equal(globalThis.__firebaseMessagingLoads, 1);
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
    for (const key of ['__startupBundleProof', '__firebaseAuthLoaded', '__firebaseMessagingLoads']) delete globalThis[key];
  }
});

test('keeps startup preloads outside an earlier optional script condition', async () => {
  const dir = fixture();
  try {
    const index = path.join(dir, 'index.html');
    fs.writeFileSync(index, '<!--# if expr="$optional = 1" --><script src="assets/optional.js" async></script><!--# endif -->'
      + fs.readFileSync(index, 'utf8'));
    const manifest = await consolidateStartupBundles(dir);
    const html = fs.readFileSync(index, 'utf8');
    const conditional = html.match(/<!--# if[\s\S]*?<!--# endif -->/)[0];
    assert.ok(!conditional.includes('modulepreload'));
    const enabledOrDisabled = html.replace(conditional, '');
    const preloads = [...enabledOrDisabled.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(match => match[1]);
    assert.deepEqual(preloads, manifest.startup.filter(name => name !== manifest.main));
    assert.ok(enabledOrDisabled.indexOf('modulepreload') < enabledOrDisabled.indexOf(`src="${manifest.main}"`));
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
  }
});

test('groups startup while preserving environment ordering, shared identities and genuinely lazy features', async () => {
  const dir = fixture();
  try {
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.startup.length, 2);
    assert.equal(manifest.files.length, 5);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes(manifest.main));
    const preloads = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(match => match[1]);
    assert.deepEqual(preloads, manifest.startup.filter(name => name !== manifest.main));
    assert.ok(!html.includes('chunk-BOOT0001.js'));
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

test('absorbs a lazy JSON-style default wrapper and preserves its namespace, identity and dependency effects', async () => {
  const dir=fixture();
  try {
    fs.writeFileSync(path.join(dir,'chunk-JSON0001.js'),"import {service} from './chunk-FEATURE1.js'; import './chunk-SHARED01.js'; export {service as default};");
    fs.appendFileSync(path.join(dir,'chunk-ENTRY001.js')," export const openJson=()=>import('./chunk-JSON0001.js');");
    const metadata=JSON.parse(fs.readFileSync(path.join(dir,'stats.json')));
    metadata.outputs['chunk-JSON0001.js']={entryPoint:'src/app/data/demo.json',inputs:{}};
    fs.writeFileSync(path.join(dir,'stats.json'),JSON.stringify(metadata));
    const manifest=await consolidateStartupBundles(dir);
    await import(pathToFileURL(path.join(dir,manifest.main)));
    const {app,entry}=await globalThis.__startupBundleProof;
    assert.equal(globalThis.__optionalFeatureLoaded,undefined);
    const data=await entry.openJson();
    assert.equal(data.default,app.App.service);
    assert.equal(globalThis.__optionalFeatureLoaded,true);
    assert.equal((await entry.openFeature()).service,data.default);
    assert.ok(manifest.files.every(file=>fs.readFileSync(path.join(dir,file.name),'utf8').trim()));
    assert.equal(manifest.files.length,5);
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    delete globalThis.__optionalFeatureLoaded;
    delete globalThis.__startupBundleProof;
  }
});

test('shares lazy base services and their facade without another physical request or early evaluation', async () => {
  const dir = fixture();
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'stats.json')));
    fs.writeFileSync(path.join(dir, 'chunk-SERVICE1.js'), 'globalThis.__baseServiceLoads=(globalThis.__baseServiceLoads??0)+1; export class ResourceService {}');
    metadata.outputs['chunk-SERVICE1.js'] = {inputs:{
      'src/app/shared/core/base/services/events/activity-resources.service.ts':{bytesInOutput:100}
    }};
    fs.appendFileSync(path.join(dir, 'chunk-FEATURE1.js'), " export {ResourceService} from './chunk-SERVICE1.js';");
    fs.writeFileSync(path.join(dir, 'chunk-SECOND01.js'), "export {ResourceService} from './chunk-SERVICE1.js'; export const second=true;");
    metadata.outputs['chunk-SECOND01.js'] = {entryPoint:'src/app/second-popup.ts'};
    fs.writeFileSync(path.join(dir, 'chunk-FACADE01.js'), "export {ResourceService} from './chunk-SERVICE1.js';");
    metadata.outputs['chunk-FACADE01.js'] = {entryPoint:'src/app/resource-service.ts'};
    fs.appendFileSync(path.join(dir, 'chunk-ENTRY001.js'), " export const openSecond=()=>import('./chunk-SECOND01.js'); export const openFacade=()=>import('./chunk-FACADE01.js');");
    fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(metadata));
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.files.length, 6);
    assert.equal(manifest.startup.length, 2);
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const {entry} = await globalThis.__startupBundleProof;
    assert.equal(globalThis.__baseServiceLoads, undefined);
    const feature = await entry.openFeature();
    assert.equal(globalThis.__baseServiceLoads, 1);
    assert.equal(feature.ResourceService, (await entry.openSecond()).ResourceService);
    assert.equal(feature.ResourceService, (await entry.openFacade()).ResourceService);
    assert.equal(globalThis.__baseServiceLoads, 1);
    assert.equal(globalThis.__homeLoaded, undefined);
  } finally {
    fs.rmSync(dir, {recursive:true, force:true});
    for (const key of ['__baseServiceLoads','__startupBundleProof','__optionalFeatureLoaded','__homeLoaded','__menuLoaded']) delete globalThis[key];
  }
});

test('opens the public demo without workspace controls and keeps the date renderer with its form controls', async () => {
  const dir = fixture({localAdapters:true,httpEntryAdapters:true});
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'stats.json')));
    const add = (file, code, info) => {
      fs.writeFileSync(path.join(dir, file), code);
      metadata.outputs[file] = info;
    };
    add('chunk-CHOICE01.js', 'export const choice={};', {inputs:{'src/app/shared/core/common/user-profile-state.ts':{bytesInOutput:20}}});
    fs.appendFileSync(path.join(dir, 'chunk-HTTP0001.js'), " import {choice} from './chunk-CHOICE01.js'; export {choice};");
    add('chunk-DEMO0001.js', "import {choice} from './chunk-CHOICE01.js'; export {choice};", {
      entryPoint:'src/app/shared/ui/components/demo-bootstrap-selector/demo-bootstrap-selector.component.ts'
    });
    add('chunk-GUIDE001.js', "import {choice} from './chunk-CHOICE01.js'; export {choice};", {
      entryPoint:'src/app/shared/ui/components/explanation-popup/explanation-popup.component.ts'
    });
    add('chunk-DATE0001.js', 'globalThis.__dateControlLoaded=true; export const date={};', {
      entryPoint:'components/dist/fesm2022/components-date.mjs',
      inputs:{'components/dist/fesm2022/components-date.mjs':{bytesInOutput:40}}
    });
    add('chunk-CONTROL1.js', "import {date} from './chunk-DATE0001.js'; globalThis.__formControlsLoaded=true; export {date};", {
      inputs:{'components/dist/fesm2022/components-forms.mjs':{bytesInOutput:40}}
    });
    add('chunk-DATEAPI1.js', "export {date} from './chunk-DATE0001.js'; export {choice} from './chunk-CHOICE01.js';", {
      entryPoint:'src/app/date-facade.ts'
    });
    fs.appendFileSync(path.join(dir,'chunk-ENTRY001.js'), " export const openDemo=()=>import('./chunk-DEMO0001.js'); export const openGuide=()=>import('./chunk-GUIDE001.js'); export const openDate=()=>import('./chunk-DATEAPI1.js');");
    fs.appendFileSync(path.join(dir,'chunk-HOME0001.js'), " import {choice} from './chunk-CHOICE01.js'; export {choice};");
    fs.appendFileSync(path.join(dir,'chunk-MENU0001.js'), " import {date} from './chunk-CONTROL1.js'; export {date};");
    fs.writeFileSync(path.join(dir,'stats.json'),JSON.stringify(metadata));
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.loads['src/app/shared/ui/components/explanation-popup/explanation-popup.component.ts'][0],
      manifest.loads['src/app/shared/ui/components/demo-bootstrap-selector/demo-bootstrap-selector.component.ts'][0]);
    await import(pathToFileURL(path.join(dir,manifest.main)));
    const {entry}=await globalThis.__startupBundleProof;
    const demo=await entry.openDemo();
    assert.equal(demo.choice,(await entry.openGuide()).choice);
    assert.equal(globalThis.__httpAdaptersLoaded,undefined);
    await entry.openHttpAdapters();
    assert.equal(globalThis.__formControlsLoaded,undefined);
    assert.equal(globalThis.__dateControlLoaded,undefined);
    assert.equal(globalThis.__homeLoaded,undefined);
    assert.equal(globalThis.__menuLoaded,undefined);
    const menu=await entry.openMenu();
    assert.equal(menu.date,(await entry.openDate()).date);
    assert.equal(manifest.loads['src/app/date-facade.ts'][0],manifest.loads['components/dist/fesm2022/components-date.mjs'][0]);
    assert.equal(globalThis.__formControlsLoaded,true);
    assert.equal(demo.choice,(await entry.openHome()).choice);
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    for(const key of ['__publicAdaptersLoaded','__httpAdaptersLoaded','__localAdaptersLoaded','__startupBundleProof','__menuLoaded','__homeLoaded','__dateControlLoaded','__formControlsLoaded'])delete globalThis[key];
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

test('absorbs export-only wrappers into their existing loading phase without pulling optional code forward', async () => {
  const dir = fixture();
  try {
    const entryPath = path.join(dir, 'chunk-ENTRY001.js');
    fs.appendFileSync(entryPath, `export const openAlias=()=>import('./chunk-ALIAS001.js'); export const openMixed=()=>import('./chunk-MIXED001.js');`);
    fs.writeFileSync(path.join(dir, 'chunk-ALIAS001.js'), `export { service } from './chunk-SHARED01.js';`);
    fs.writeFileSync(path.join(dir, 'chunk-MIXED001.js'), `export { service } from './chunk-FEATURE1.js';`);
    const statsPath = path.join(dir, 'stats.json');
    const metadata = JSON.parse(fs.readFileSync(statsPath));
    metadata.outputs['chunk-ALIAS001.js'] = {entryPoint:'src/app/alias.ts'};
    metadata.outputs['chunk-MIXED001.js'] = {entryPoint:'src/app/mixed.ts'};
    fs.writeFileSync(statsPath, JSON.stringify(metadata));
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.startup.length, 2);
    assert.ok(manifest.loads['src/app/alias.ts'].every(file => manifest.startup.includes(file)));
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const {app, entry} = await globalThis.__startupBundleProof;
    assert.equal((await entry.openAlias()).service, app.App.service);
    assert.equal(globalThis.__optionalFeatureLoaded, undefined);
    assert.equal((await entry.openMixed()).service, app.App.service);
    assert.equal(globalThis.__optionalFeatureLoaded, true);
  } finally {
    fs.rmSync(dir, {recursive:true,force:true});
    delete globalThis.__startupBundleProof;
    delete globalThis.__optionalFeatureLoaded;
  }
});

test('groups an Asset module while retaining a shared signal store and the Activity-to-Asset boundary', async () => {
  const dir = fixture();
  try {
    const additions = {
      'chunk-SIGNAL01.js': `export const sharedSignal={value:0};`,
      'chunk-ACTIVITY.js': `import {sharedSignal} from './chunk-SIGNAL01.js';globalThis.__activityLoaded=true;export const state=sharedSignal;export const openAssets=()=>import('./chunk-ASSETS01.js');`,
      'chunk-ASSETS01.js': `import {sharedSignal} from './chunk-SIGNAL01.js';import {helper} from './chunk-ASSETDEP.js';import {first} from './chunk-FORM0001.js';import {second} from './chunk-FORM0002.js';globalThis.__assetLoaded=true;export const state=sharedSignal;export {helper,first,second};`,
      'chunk-ASSETDEP.js': `export const helper={};`,
      'chunk-FORM0001.js': `globalThis.__formLoaded=true;export const first={};`,
      'chunk-FORM0002.js': `export const second={};`,
      'chunk-ASSETAVL.js': `import {sharedSignal} from './chunk-SIGNAL01.js';globalThis.__availabilityLoaded=true;export const state=sharedSignal;`
    };
    for (const [name, code] of Object.entries(additions)) fs.writeFileSync(path.join(dir, name), code);
    fs.appendFileSync(path.join(dir, 'chunk-ENTRY001.js'), `export const openActivity=()=>import('./chunk-ACTIVITY.js');export const openAssetMenu=()=>import('./chunk-ASSETS01.js');export const openAvailability=()=>import('./chunk-ASSETAVL.js');`);
    const statsPath = path.join(dir, 'stats.json');
    const metadata = JSON.parse(fs.readFileSync(statsPath));
    for (const name of Object.keys(additions)) metadata.outputs[name]={};
    for (const name of ['chunk-FORM0001.js','chunk-FORM0002.js']) metadata.outputs[name].inputs={
      [`src/app/shared/ui/components/core/form/inputs/${name}.ts`]: {bytesInOutput:100}
    };
    const activity='src/app/activity/components/activities-popup/activities-popup.component.ts';
    const asset='src/app/asset/components/asset-popup/asset-popup.component.ts';
    const availability='src/app/asset/components/asset-availability-popup/asset-availability-popup.component.ts';
    metadata.outputs['chunk-ACTIVITY.js'].entryPoint=activity;
    metadata.outputs['chunk-ASSETS01.js'].entryPoint=asset;
    metadata.outputs['chunk-ASSETAVL.js'].entryPoint=availability;
    fs.writeFileSync(statsPath, JSON.stringify(metadata));
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.startup.length, 2);
    assert.equal(manifest.loads[asset][0], manifest.loads[availability][0]);
    assert.ok(!manifest.loads[activity].includes(manifest.loads[asset][0]));
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const {entry}=await globalThis.__startupBundleProof;
    assert.equal(globalThis.__formLoaded, undefined);
    await entry.openMenu();
    assert.equal(globalThis.__formLoaded, true);
    const list=await entry.openActivity();
    assert.equal(globalThis.__assetLoaded, undefined);
    list.state.value=3;
    const module=await list.openAssets();
    assert.equal(module, await entry.openAssetMenu());
    assert.equal(module.state, list.state);
    assert.equal(module.state.value,3);
    assert.equal(globalThis.__assetLoaded,true);
    assert.equal(globalThis.__availabilityLoaded,true);
    assert.equal(globalThis.__formLoaded,true);
    const formChunks=manifest.files.map(file=>fs.readFileSync(path.join(dir,file.name),'utf8'));
    assert.equal(formChunks.filter(code=>code.includes('__formLoaded')).length,1);
    assert.equal((await entry.openAvailability()).state,list.state);
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    delete globalThis.__startupBundleProof;
    delete globalThis.__activityLoaded;
    delete globalThis.__assetLoaded;
    delete globalThis.__availabilityLoaded;
    delete globalThis.__formLoaded;
  }
});

test('a second stamp verifies and reuses the same consolidated artifacts', async () => {
  const dir = fixture();
  try {
    const manifest = await consolidateStartupBundles(dir);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.deepEqual(await consolidateStartupBundles(dir), manifest);
    assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), html);
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
    fs.writeFileSync(path.join(dir, 'media/material-icons-FILLED001.woff2'), 'FILLED');
    fs.writeFileSync(path.join(dir, 'styles-STYLE001.css'), '@font-face{font-family:Roboto;src:url(media/roboto-latin.woff2)}@font-face{font-family:Material Icons;src:url("./media/material-icons-FILLED001.woff2")}');
    fs.appendFileSync(path.join(dir, 'index.html'), '<script id="myscoutee-landing-debug-recorder" src="assets/diagnostics/landing.js" async></script><link rel="stylesheet" href="styles-STYLE001.css">');
    const stamp = () => execFileSync(process.execPath, [new URL('./stamp-prod-build.js', import.meta.url).pathname], {
      env: {...process.env, FRONTEND_BUILD_OUTPUT_DIR:dir, MYSCOUTEE_UI_BUILD_ID:'startup-precache-test'},
      stdio:'pipe'
    });
    stamp();
    stamp(); // Re-stamping must not bring the blanket precache back.
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.equal((html.match(/data-myscoutee-icon-font/g) ?? []).length, 1);
    assert.ok(html.includes('href="media/material-icons-FILLED001.woff2" crossorigin'));
    assert.ok(html.indexOf('data-myscoutee-icon-font') < html.indexOf('rel="stylesheet"'));
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
      ...manifest.startup, 'styles-STYLE001.css'
    ].map(name => `https://qa.example/myscoutee/${name}`).sort());
    assert.ok(!fetched.some(url => url.includes('/media/')));
    assert.ok(!fetched.some(url => url.includes('/assets/i18n/')), 'Language assets are cached on use, never downloaded by worker installation');
    assert.ok(!fetched.some(url => url.includes('/assets/diagnostics/')), 'Disabled diagnostics are not downloaded by worker installation');
    assert.ok(html.includes('id="myscoutee-landing-debug-recorder"'), 'HTTP builds retain the server-controlled recorder');
    execFileSync(process.execPath, [new URL('./stamp-prod-build.js', import.meta.url).pathname], {
      env: {...process.env, FRONTEND_BUILD_OUTPUT_DIR:dir, FRONTEND_BUILD_PROFILE:'standalone', MYSCOUTEE_UI_BUILD_ID:'startup-precache-test'},
      stdio:'pipe'
    });
    assert.ok(!fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('id="myscoutee-landing-debug-recorder"'),
      'Standalone builds do not load the nginx-owned recorder');
    assert.equal(requests.find(request => request.url.endsWith('/' + manifest.main)).cache, 'default');
    assert.equal(requests.find(request => request.url.endsWith('/index.html')).cache, 'reload');
    for (const file of manifest.files.filter(file => !manifest.startup.includes(file.name))) {
      assert.ok(!fetched.some(url => url.endsWith('/' + file.name)), file.name);
      assert.ok(fs.existsSync(path.join(dir, file.name)), 'Lazy features remain available on demand');
    }
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});


test('absorbs an empty optional entry without adding a network chunk', async () => {
  const baseline = fixture();
  const dir = fixture();
  try {
    const expected = await consolidateStartupBundles(baseline);
    fs.writeFileSync(path.join(dir, 'chunk-EMPTY001.js'), 'export {};');
    fs.appendFileSync(path.join(dir, 'chunk-ENTRY001.js'), `export const openEmpty=()=>import('./chunk-EMPTY001.js');`);
    const statsPath = path.join(dir, 'stats.json');
    const stats = JSON.parse(fs.readFileSync(statsPath));
    stats.outputs['chunk-EMPTY001.js'] = { entryPoint: 'src/app/optional-empty.ts' };
    fs.writeFileSync(statsPath, JSON.stringify(stats));
    const manifest = await consolidateStartupBundles(dir);
    assert.equal(manifest.files.length, expected.files.length);
    assert.ok(manifest.files.every(file => fs.readFileSync(path.join(dir, file.name), 'utf8').trim()));
    await import(pathToFileURL(path.join(dir, manifest.main)));
    const { entry } = await globalThis.__startupBundleProof;
    assert.deepEqual(Object.keys(await entry.openEmpty()), []);
  } finally {
    fs.rmSync(baseline, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
    delete globalThis.__startupBundleProof;
  }
});
