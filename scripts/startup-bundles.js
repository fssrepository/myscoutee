const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { rollup } = require('rollup');

const LANDING_ENTRIES = [
  'src/app/app.ts',
  'src/app/app.config.ts',
  'src/app/entry/components/entry-page/entry-page.component.ts'
];
const digest = code => createHash('sha256').update(code).digest('hex');

// Angular splits shared code by its consumers, producing many tiny startup
// chunks. Regroup that existing module graph without copying services/tokens or
// evaluating the app before prepareDemoFailover has selected its environment.
async function consolidateStartupBundles(outputDir) {
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
  function entryFile(source) {
    const entry = Object.entries(metadata.outputs).find(([, info]) => {
      const value = info.entryPoint?.replaceAll('\\', '/');
      return value === source || value?.endsWith('/' + source);
    });
    if (!entry) throw new Error(`Missing startup entry in Angular stats: ${source}`);
    return outputFile(entry[0]);
  }
  const main = entryFile('src/main.ts');
  const landingEntries = LANDING_ENTRIES.map(entryFile);
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
  let bootstrap, landing, home, menu;
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
      manualChunks(id, { getModuleInfo }) {
        bootstrap ??= closure([main], getModuleInfo);
        landing ??= closure(landingEntries, getModuleInfo);
        home ??= closure([homeEntry], getModuleInfo);
        menu ??= closure([menuEntry], getModuleInfo);
        if (bootstrap.has(id)) return 'bootstrap';
        if (landing.has(id)) return 'landing';
        if (home.has(id) && menu.has(id)) return 'member-shared';
        if (home.has(id)) return 'member-home';
        if (menu.has(id)) return 'member-menu';
      }
    }));
  } finally { await bundle.close(); }
  const entry = output.find(file => file.type === 'chunk' && file.isEntry);
  if (!entry) throw new Error('Consolidated main entry is missing');
  const indexPath = path.join(outputDir, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes(path.basename(main))) throw new Error('HTML does not reference the Angular main entry');
  const files = [];
  for (const file of output) {
    const code = file.type === 'chunk' ? file.code : file.source;
    fs.writeFileSync(path.join(outputDir, file.fileName), code);
    files.push({ name: file.fileName, sha256: digest(code) });
  }
  fs.writeFileSync(indexPath, html.replaceAll(path.basename(main), entry.fileName)
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/g, ''));
  const retained = new Set(files.map(file => file.name));
  for (const file of oldFiles) {
    if (!retained.has(path.basename(file))) fs.rmSync(file);
  }
  const manifest = { version: 1, main: entry.fileName,
    startup: output.filter(file => file.type === 'chunk' &&
      Object.keys(file.modules).some(id => bootstrap.has(id) || landing.has(id))).map(file => file.fileName), files };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.rmSync(statsPath);
  return manifest;
}

module.exports = { consolidateStartupBundles };
