#!/usr/bin/env node

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { consolidateStartupBundles } = require('./startup-bundles');

const frontendRoot = path.resolve(__dirname, '..');
const outputDir = resolveOutputDir(process.env.FRONTEND_BUILD_OUTPUT_DIR || 'prod');
const indexPath = path.join(outputDir, 'index.html');
const serviceWorkerPath = path.join(outputDir, 'app-sw.js');
const versionPath = path.join(outputDir, 'app-version.json');

const explicitBuildId = (process.env.MYSCOUTEE_UI_BUILD_ID || process.env.BUILD_ID || '').trim();
const appVersion = sanitizeVersion((process.env.MYSCOUTEE_VERSION || packageVersion() || '1.3.0').trim());
const gitSha = explicitBuildId ? '' : runOptional('git', ['rev-parse', '--short=12', 'HEAD']);
const builtAt = new Date().toISOString();
const timestamp = builtAt.replace(/[-:.TZ]/g, '').slice(0, 14);
const buildId = sanitizeBuildId(explicitBuildId || `${gitSha || 'local'}-${timestamp}`);

assertFile(indexPath, 'production index.html');
assertFile(serviceWorkerPath, 'production service worker');

consolidateStartupBundles(outputDir, {
  localAdaptersInStartup: process.env.FRONTEND_BUILD_PROFILE === 'standalone'
}).then(manifest => {
  stampIndexHtml();
  stampServiceWorker(manifest);
  writeVersionFile();
  console.log(`Stamped production UI build ${buildId} in ${path.relative(frontendRoot, outputDir) || '.'}.`);
}).catch(error => { console.error(error); process.exitCode = 1; });

function stampIndexHtml() {
  const metaTag = `<meta name="myscoutee-build-id" content="${buildId}">`;
  const buildMetaPattern = /<meta\s+name=["']myscoutee-build-id["']\s+content=["'][^"']*["']\s*\/?>/i;
  let html = fs.readFileSync(indexPath, 'utf8');
  if (buildMetaPattern.test(html)) {
    html = html.replace(buildMetaPattern, metaTag);
  } else if (/<meta\s+name=["']theme-color["'][^>]*>/i.test(html)) {
    html = html.replace(/(<meta\s+name=["']theme-color["'][^>]*>)/i, `$1\n  ${metaTag}`);
  } else {
    html = html.replace(/(<head[^>]*>)/i, `$1\n  ${metaTag}`);
  }
  // Every entry mode uses the filled icon font. Discover its hashed URL from
  // the emitted stylesheet, so GitHub base paths and browser font reuse agree.
  html = html.replace(/<link\b[^>]*data-myscoutee-icon-font[^>]*>/g, '');
  for (const match of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g)) {
    const stylesheet = match[1];
    const css = fs.readFileSync(path.join(outputDir, stylesheet), 'utf8');
    const iconFont = css.match(/url\(["']?([^"'()]*material-icons-[a-z0-9]+\.woff2)["']?\)/i)?.[1];
    if (!iconFont) continue;
    const href = path.posix.join(path.posix.dirname(stylesheet), iconFont);
    assertFile(path.join(outputDir, href), 'filled icon font');
    html = html.replace(match[0], `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin data-myscoutee-icon-font>${match[0]}`);
    break;
  }
  fs.writeFileSync(indexPath, html, 'utf8');
}

function stampServiceWorker(manifest) {
  let serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
  const cacheVersion = JSON.stringify(`build-${buildId}`);
  const precacheBuildUrls = collectPrecacheBuildAssetUrls(manifest);
  if (!/const\s+CACHE_VERSION\s*=/.test(serviceWorker)) {
    throw new Error(`Could not find CACHE_VERSION in ${serviceWorkerPath}.`);
  }
  serviceWorker = serviceWorker.replace(
    /const\s+CACHE_VERSION\s*=\s*['"][^'"]+['"];/,
    `const CACHE_VERSION = ${cacheVersion};`
  );
  if (/const\s+BUILD_ID\s*=/.test(serviceWorker)) {
    serviceWorker = serviceWorker.replace(
      /const\s+BUILD_ID\s*=\s*['"][^'"]*['"];/,
      `const BUILD_ID = ${JSON.stringify(buildId)};`
    );
  } else {
    serviceWorker = serviceWorker.replace(
      /(const\s+CACHE_VERSION\s*=\s*['"][^'"]+['"];\n)/,
      `$1const BUILD_ID = ${JSON.stringify(buildId)};\n`
    );
  }
  if (!/const\s+PRECACHE_BUILD_URLS\s*=/.test(serviceWorker)) {
    throw new Error(`Could not find PRECACHE_BUILD_URLS in ${serviceWorkerPath}.`);
  }
  serviceWorker = serviceWorker.replace(
    /const\s+PRECACHE_BUILD_URLS\s*=\s*\[[\s\S]*?\];/,
    `const PRECACHE_BUILD_URLS = ${JSON.stringify(precacheBuildUrls, null, 2)};`
  );
  fs.writeFileSync(serviceWorkerPath, serviceWorker, 'utf8');
}

function writeVersionFile() {
  fs.writeFileSync(
    versionPath,
    `${JSON.stringify({
      version: appVersion,
      buildId,
      builtAt,
      gitSha: gitSha || null
    }, null, 2)}\n`,
    'utf8'
  );
}

function sanitizeBuildId(value) {
  const sanitized = value
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
  return sanitized || `local-${timestamp}`;
}

function sanitizeVersion(value) {
  const sanitized = value
    .replace(/[^a-zA-Z0-9._+-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return sanitized || '1.3.0';
}

function packageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' && pkg.version !== '0.0.0' ? pkg.version : '';
  } catch {
    return '';
  }
}

function assertFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${description} at ${filePath}. Run the production build first.`);
  }
}

function collectPrecacheBuildAssetUrls(manifest) {
  // Precache the startup shell, not every lazy feature and every font subset
  // emitted by Angular. Used lazy chunks/fonts enter the existing runtime cache.
  const urls = new Set(manifest.startup.map(name => `./${name}`));
  const html = fs.readFileSync(indexPath, 'utf8');
  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const script = match[1].toLowerCase() === 'script';
    if (!script && !/\brel=["']stylesheet["']/i.test(tag)) continue;
    const reference = tag.match(script ? /\bsrc=["']([^"']+)["']/i : /\bhref=["']([^"']+)["']/i)?.[1];
    if (!reference || /^(?:[a-z]+:|\/\/)/i.test(reference)) continue;
    const relativePath = reference.replace(/^\.\//, '').split(/[?#]/)[0];
    const absolutePath = path.resolve(outputDir, relativePath);
    if (!absolutePath.startsWith(outputDir + path.sep)) {
      throw new Error(`Startup asset is outside the build: ${reference}`);
    }
    assertFile(absolutePath, 'startup asset');
    urls.add(`./${relativePath}`);
  }
  return [...urls].sort();
}

function resolveOutputDir(value) {
  return path.isAbsolute(value) ? value : path.join(frontendRoot, value);
}

function runOptional(command, args) {
  try {
    return childProcess.execFileSync(command, args, {
      cwd: frontendRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}
