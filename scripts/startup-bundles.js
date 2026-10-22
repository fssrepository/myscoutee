const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { rollup } = require('rollup');
const popupModuleGroups = require('../src/app/shared/ui/context/popup-module-groups.json');

const LANDING_ENTRIES = [
  'src/app/app.ts',
  'src/app/app.config.ts',
  'src/app/entry/components/entry-page/entry-page.component.ts'
];
const SHARED_FORM_SOURCES = [
  '/shared/ui/components/core/form/',
  '/activity/components/event-editor-popup/event-payment-input/',
  '/activity/components/event-editor-popup/event-basket-input/',
  '/shared/ui/components/payment-refund-policy/'
];
const digest = code => createHash('sha256').update(code).digest('hex');

// Angular splits shared code by its consumers, producing many tiny startup
// chunks. Regroup that existing module graph without copying services/tokens or
// evaluating the app before prepareDemoFailover has selected its environment.
async function consolidateStartupBundles(outputDir, { localAdaptersInStartup = false } = {}) {
  const statsPath = path.join(outputDir, 'stats.json');
  const manifestPath = path.join(outputDir, 'startup-bundles.json');
  if (!fs.existsSync(statsPath)) {
    if (!fs.existsSync(manifestPath)) throw new Error('Missing Angular stats.json for startup consolidation');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.version !== 1 || !manifest.files?.length) throw new Error('Missing startup bundle metadata');
    for (const file of manifest.files) {
      if (digest(fs.readFileSync(path.join(outputDir, file.name))) !== file.sha256) {
        throw new Error(`Startup bundle changed after consolidation: ${file.name}`);
      }
    }
    return manifest;
  }
  const metadata = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  function outputFile(name) {
    const absolute = path.resolve(outputDir, name);
    return fs.existsSync(absolute) ? absolute : path.join(outputDir, path.basename(name));
  }
  function findEntry(source) {
    const entry = Object.entries(metadata.outputs).find(([, info]) => {
      const value = info.entryPoint?.replaceAll('\\', '/');
      return value === source || value?.endsWith('/' + source);
    });
    return entry ? outputFile(entry[0]) : undefined;
  }
  function entryFile(source) {
    const entry = findEntry(source);
    if (!entry) throw new Error(`Missing startup entry in Angular stats: ${source}`);
    return entry;
  }
  const main = entryFile('src/main.ts');
  const workspaceAdapters = 'src/app/shared/core/base/http-adapters.ts';
  const publicAdapters = 'src/app/shared/core/base/http-entry-adapters.ts';
  const adapterEntry = localAdaptersInStartup ? 'src/app/shared/core/base/local-adapters.ts'
    : findEntry(publicAdapters) ? publicAdapters : workspaceAdapters;
  const hasAdapterEntry = Object.values(metadata.outputs).some(info =>
    info.entryPoint?.replaceAll('\\', '/').endsWith(adapterEntry));
  const landingEntries = [...LANDING_ENTRIES,
    ...(hasAdapterEntry ? [adapterEntry] : [])
  ].map(entryFile);
  const homeEntry = entryFile('src/app/home/components/home/home.component.ts');
  const menuEntry = entryFile('src/app/shared/ui/components/side-menu/side-menu.component.ts');
  const oldFiles = Object.keys(metadata.outputs).filter(name => /\.js$/.test(name)).map(outputFile);
  if (oldFiles.some(file => !/^(?:main|chunk)-[^/]+\.js$/.test(path.basename(file)))) {
    throw new Error('Review additional JavaScript entry points before consolidating startup bundles');
  }
  const closure = (roots, getModuleInfo) => {
    const seen = new Set();
    function visit(id) {
      if (seen.has(id)) return;
      seen.add(id);
      for (const imported of getModuleInfo(id)?.importedIds ?? []) visit(imported);
    }
    roots.forEach(visit);
    return seen;
  };
  let bootstrap, landing, home, menu, loadingGroups;
  const bundle = await rollup({
    input: { main }, preserveEntrySignatures: false,
    onwarn(warning, warn) { if (warning.code !== 'CIRCULAR_DEPENDENCY') warn(warning); }
  });
  let output;
  try {
    ({ output } = await bundle.generate({
      format: 'es', compact: true, hashCharacters: 'hex',
      entryFileNames: 'main-[hash].js', chunkFileNames: 'chunk-[hash].js',
      onlyExplicitManualChunks: true,
      manualChunks(id, { getModuleInfo, getModuleIds }) {
        bootstrap ??= closure([main], getModuleInfo);
        landing ??= closure(landingEntries, getModuleInfo);
        home ??= closure([homeEntry], getModuleInfo);
        menu ??= closure([menuEntry], getModuleInfo);
        if (!loadingGroups) {
          loadingGroups = new Map();
          for (const module of getModuleIds()) {
            if (bootstrap.has(module)) loadingGroups.set(module, 'bootstrap');
            else if (landing.has(module)) loadingGroups.set(module, 'landing');
          }
          const controls = Object.entries(metadata.outputs).filter(([name, info]) => name.endsWith('.js')
            && Object.keys(info.inputs ?? {}).some(source => /\/components-(?:forms|date)\.mjs$/.test(source)
              || source.includes('/components-core-route-input-popup.component-')))
            .map(([name]) => outputFile(name));
          // Keep the first public demo independent of the workspace shell, and
          // keep transport constructors independent of the controls they serve.
          for (const [phase, roots] of [
            ['entry-popups', [
              findEntry('src/app/shared/ui/components/demo-bootstrap-selector/demo-bootstrap-selector.component.ts'),
              findEntry('src/app/shared/ui/components/explanation-popup/explanation-popup.component.ts'),
              findEntry('src/app/entry/components/entry-firebase-auth-popup/entry-firebase-auth-popup.component.ts')
            ].filter(Boolean)],
            ['workspace-adapters', localAdaptersInStartup ? [] : [findEntry(workspaceAdapters)].filter(Boolean)],
            ['member-controls', controls]
          ]) {
            for (const module of closure(roots, getModuleInfo)) {
              if (!loadingGroups.has(module)) loadingGroups.set(module, phase);
            }
          }
          for (const module of getModuleIds()) {
            if (loadingGroups.has(module)) continue;
            if (home.has(module) && menu.has(module)) loadingGroups.set(module, 'member-shared');
            else if (home.has(module)) loadingGroups.set(module, 'member-home');
            else if (menu.has(module)) loadingGroups.set(module, 'member-shared');
          }
          const available = [
            ['bootstrap', new Set(['bootstrap'])],
            ['landing', new Set(['bootstrap', 'landing'])],
            ['entry-popups', new Set(['bootstrap', 'landing', 'entry-popups'])],
            ['workspace-adapters', new Set(['bootstrap', 'landing', 'entry-popups', 'workspace-adapters'])],
            ['member-controls', new Set(['bootstrap', 'landing', 'workspace-adapters', 'entry-popups', 'member-controls'])],
            ['member-shared', new Set(['bootstrap', 'landing', 'workspace-adapters', 'entry-popups', 'member-controls', 'member-shared'])],
            ['member-home', new Set(['bootstrap', 'landing', 'workspace-adapters', 'entry-popups', 'member-controls', 'member-shared', 'member-home'])],
            ['member-menu', new Set(['bootstrap', 'landing', 'workspace-adapters', 'entry-popups', 'member-controls', 'member-shared', 'member-menu'])]
          ];
          const visiting = new Set();
          const aliasOnly = info => info?.ast.body.every(node =>
            node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration'
            || node.type === 'ExportNamedDeclaration' && !node.declaration
            || node.type === 'EmptyStatement');
          function groupAlias(module) {
            if (loadingGroups.has(module)) return loadingGroups.get(module);
            if (visiting.has(module)) return;
            const info = getModuleInfo(module);
            // Empty and export-only entries add no execution. Keep it with the phase
            // that already owns all its dependencies, rather than fetching a
            // separate wrapper on the first user action. Real lazy code stays lazy.
            if (!aliasOnly(info)) return;
            visiting.add(module);
            const dependencies = info.importedIds.map(groupAlias);
            visiting.delete(module);
            const group = available.find(([, groups]) => dependencies.every(dependency => groups.has(dependency)))?.[0];
            if (group) loadingGroups.set(module, group);
            return group;
          }
          for (const module of getModuleIds()) groupAlias(module);
          for (const [name, info] of Object.entries(metadata.outputs)) {
            const module = outputFile(name);
            if (name.endsWith('.js') && !loadingGroups.has(module) && !info.entryPoint
              && Object.keys(info.inputs ?? {}).some(source => SHARED_FORM_SOURCES.some(prefix => source.includes(prefix)))) {
              loadingGroups.set(module, 'member-shared');
            }
          }
          // Shared service wrappers use the existing workspace group; explicit
          // lazy service entry points retain their own loading boundary.
          const commonSources = ['/shared/ui/converters/', '/shared/core/base/builders/', '/shared/core/base/services/',
            '/shared/core/contracts/', '/shared/core/common/'];
          for (const [name, info] of Object.entries(metadata.outputs)) {
            const module = outputFile(name);
            const sources = Object.keys(info.inputs ?? {});
            if (name.endsWith('.js') && !loadingGroups.has(module) && !info.entryPoint && sources.length
              && sources.every(source => source.includes('/shared/ui/context/stores/') || source.endsWith('.store.ts'))) {
              loadingGroups.set(module, 'member-shared');
            } else if (name.endsWith('.js') && !loadingGroups.has(module) && !info.entryPoint && sources.length
              && sources.every(source => commonSources.some(prefix => source.includes(prefix)))) {
              loadingGroups.set(module, 'member-shared');
            }
          }
          for (const module of getModuleIds()) groupAlias(module);
          // Group popup implementations at their UI module boundaries.
          // Keep dependencies shared with other lazy phases independent, so a
          // cross-popup store/signal reference cannot pull in another surface.
          const phases = new Map(Object.entries(popupModuleGroups).map(([phase, sources]) =>
            [phase, sources.map(findEntry).filter(Boolean)]));
          // Optional Firebase SDKs share one loading boundary; neither belongs
          // to the public landing or the automatic guide.
          phases.set('firebase-runtime', [
            findEntry('src/app/shared/core/base/services/accounts/firebase-auth.service.ts'),
            findEntry('node_modules/firebase/messaging/dist/esm/index.esm.js')
          ].filter(Boolean));
          const lazyRoots = new Set([...getModuleIds()].flatMap(module => getModuleInfo(module).dynamicallyImportedIds));
          const infrastructure = [...loadingGroups].filter(([, group]) => group === 'member-shared').map(([module]) => module);
          for (const dependency of closure(infrastructure, getModuleInfo)) {
            if (!loadingGroups.has(dependency) && !lazyRoots.has(dependency)) loadingGroups.set(dependency, 'member-shared');
          }
          for (const module of getModuleIds()) groupAlias(module);
          const rootPhase = new Map([...phases].flatMap(([phase, roots]) => roots.map(root => [root, phase])));
          const consumers = new Map();
          for (const root of lazyRoots) {
            if (loadingGroups.has(root)) continue;
            const phase = rootPhase.get(root) ?? root;
            for (const dependency of closure([root], getModuleInfo)) {
              if (loadingGroups.has(dependency)) continue;
              if (!consumers.has(dependency)) consumers.set(dependency, new Set());
              consumers.get(dependency).add(phase);
            }
          }
          for (const [module, owners] of consumers) {
            // An unresolved export-only entry needs no manual chunk. Let Rollup
            // merge its namespace into the dependency instead of forcing an
            // empty JSON/entry wrapper into a separate network request.
            if (owners.size === 1 && !aliasOnly(getModuleInfo(module))) {
              const [phase] = owners;
              loadingGroups.set(module, `lazy-${path.basename(phase, '.js')}`);
            }
          }
        }
        return loadingGroups.get(id);
      }
    }));
  } finally { await bundle.close(); }
  const entry = output.find(file => file.type === 'chunk' && file.isEntry);
  if (!entry) throw new Error('Consolidated main entry is missing');
  const startup = output.filter(file => file.type === 'chunk' &&
    Object.keys(file.modules).some(id => bootstrap.has(id) || landing.has(id))).map(file => file.fileName);
  const indexPath = path.join(outputDir, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes(path.basename(main))) throw new Error('HTML does not reference the Angular main entry');
  const files = [];
  for (const file of output) {
    const code = file.type === 'chunk' ? file.code : file.source;
    fs.writeFileSync(path.join(outputDir, file.fileName), code);
    files.push({ name: file.fileName, sha256: digest(code) });
  }
  // Fetch the already-required landing graph alongside main. Module preload
  // does not evaluate it before prepareDemoFailover selects the environment.
  const preloads = startup.filter(name => name !== entry.fileName)
    .map(name => `<link rel="modulepreload" href="${name}">`).join('');
  fs.writeFileSync(indexPath, html.replaceAll(path.basename(main), entry.fileName)
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/g, '')
    .replace(/<script\b[^>]*\bsrc=["'][^"']*["'][^>]*>/i, tag => preloads + tag));
  const retained = new Set(files.map(file => file.name));
  for (const file of oldFiles) {
    if (!retained.has(path.basename(file))) fs.rmSync(file);
  }
  const emitted = new Map(output.filter(file => file.type === 'chunk').map(file => [file.fileName, file]));
  const moduleFiles = new Map([...emitted.values()].flatMap(file => Object.keys(file.modules).map(module => [module, file.fileName])));
  const loads = {};
  for (const [original, info] of Object.entries(metadata.outputs)) {
    if (!info.entryPoint) continue;
    const root = moduleFiles.get(outputFile(original));
    if (!root) continue;
    const required = new Set();
    function visit(name) {
      if (required.has(name)) return;
      required.add(name);
      for (const imported of emitted.get(name)?.imports ?? []) if (emitted.has(imported)) visit(imported);
    }
    visit(root);
    loads[info.entryPoint.replaceAll('\\', '/')] = [...required];
  }
  const manifest = { version: 1, main: entry.fileName,
    startup, files, loads };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.rmSync(statsPath);
  return manifest;
}

module.exports = { consolidateStartupBundles };
