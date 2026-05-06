#!/usr/bin/env node

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(process.env.FRONTEND_BUILD_OUTPUT_DIR || path.join(frontendRoot, 'docs'));
const indexPath = path.join(outputDir, 'index.html');
const serviceWorkerPath = path.join(outputDir, 'app-sw.js');
const versionPath = path.join(outputDir, 'app-version.json');

const explicitBuildId = (process.env.MYSCOUTEE_UI_BUILD_ID || process.env.BUILD_ID || '').trim();
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
  fs.writeFileSync(serviceWorkerPath, serviceWorker, 'utf8');
}

function writeVersionFile() {
  fs.writeFileSync(
    versionPath,
    `${JSON.stringify({
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

function assertFile(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${description} at ${filePath}. Run the production build first.`);
  }
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
