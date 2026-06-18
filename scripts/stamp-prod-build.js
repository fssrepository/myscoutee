#!/usr/bin/env node

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const outputDir = resolveOutputDir(process.env.FRONTEND_BUILD_OUTPUT_DIR || 'prod');
const indexPath = path.join(outputDir, 'index.html');
const serviceWorkerPath = path.join(outputDir, 'app-sw.js');
const versionPath = path.join(outputDir, 'app-version.json');

const explicitBuildId = (process.env.MYSCOUTEE_UI_BUILD_ID || process.env.BUILD_ID || '').trim();
const appVersion = sanitizeVersion((process.env.MYSCOUTEE_VERSION || packageVersion() || '1.0.0').trim());
const gitSha = runOptional('git', ['rev-parse', '--short=12', 'HEAD']);
const builtAt = new Date().toISOString();
const timestamp = builtAt.replace(/[-:.TZ]/g, '').slice(0, 14);
const buildId = sanitizeBuildId(explicitBuildId || `${gitSha || 'local'}-${timestamp}`);

assertFile(indexPath, 'production index.html');
assertFile(serviceWorkerPath, 'production service worker');

stampIndexHtml();
stampServiceWorker();
writeVersionFile();

console.log(`Stamped production UI build ${buildId} in ${path.relative(frontendRoot, outputDir) || '.'}.`);

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
  fs.writeFileSync(indexPath, html, 'utf8');
}

function stampServiceWorker() {
  let serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
  const cacheVersion = JSON.stringify(`build-${buildId}`);
  const precacheBuildUrls = collectPrecacheBuildAssetUrls();
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
  return sanitized || '1.0.0';
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

function collectPrecacheBuildAssetUrls() {
  const urls = [];
  visitOutputDir(outputDir, '');
  return urls.sort();

  function visitOutputDir(directory, relativeDirectory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (relativePath === 'assets' || relativePath === 'keys') {
          continue;
        }
        visitOutputDir(absolutePath, relativePath);
        continue;
      }
      if (shouldPrecacheBuildAsset(relativePath)) {
        urls.push(`./${relativePath}`);
      }
    }
  }
}

function shouldPrecacheBuildAsset(relativePath) {
  if (
    relativePath === 'app-sw.js' ||
    relativePath === 'index.html' ||
    relativePath === 'app-version.json' ||
    relativePath.endsWith('.map')
  ) {
    return false;
  }
  return /\.(?:js|css|woff2?|ttf)$/i.test(relativePath);
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
