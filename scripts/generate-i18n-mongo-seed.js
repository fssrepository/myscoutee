#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const mongoRoot = path.join(repoRoot, 'server/docker/conf/mongodb');
const seedDatabases = ['demo_db', 'e2e_db', 'myscoutee_db'];
const bundlePaths = [
  path.join(frontendRoot, 'src/assets/i18n/en.json'),
  path.join(frontendRoot, 'src/assets/i18n/hu.json')
];

const bundles = bundlePaths.map(readBundle);
const bundleDocs = bundles.map(bundle => ({
  _id: `i18n-bundle-${bundle.lang}`,
  lang: bundle.lang,
  version: bundle.version,
  updatedAt: bundleUpdatedAt(bundle.version)
}));
const messageDocs = buildMessageDocs(bundles);

for (const databaseName of seedDatabases) {
  const databaseDir = path.join(mongoRoot, databaseName);
  fs.mkdirSync(databaseDir, { recursive: true });
  writeJson(path.join(databaseDir, 'i18n_bundles.json'), bundleDocs);
  writeJson(path.join(databaseDir, 'i18n_messages.json'), messageDocs);
}

console.log(`Generated i18n Mongo seed for ${seedDatabases.join(', ')}.`);

function readBundle(filePath) {
  const bundle = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const lang = normalizeText(bundle.lang);
  const version = normalizeText(bundle.version);
  const messages = bundle.messages;
  if (!lang || !version || !messages || typeof messages !== 'object') {
    throw new Error(`Invalid i18n bundle ${filePath}`);
  }
  return { lang, version, messages };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function normalizeText(value) {
  return `${value ?? ''}`.trim();
}

function bundleUpdatedAt(version) {
  const match = normalizeText(version).match(/^(\d{4})\.(\d{2})\.(\d{2})\./);
  if (!match) {
    throw new Error(`Invalid i18n bundle version date: ${version}`);
  }
  return Date.UTC(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10) - 1,
    Number.parseInt(match[3], 10)
  );
}

function stableSlug(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  return normalized || hashText(value);
}

function buildMessageDocs(sourceBundles) {
  const usedIds = new Set();
  return sourceBundles.flatMap(bundle =>
    Object.entries(bundle.messages).map(([key, value]) => {
      const baseId = `i18n-message-${bundle.lang}-${stableSlug(key)}`;
      let id = baseId;
      if (usedIds.has(id)) {
        const suffix = hashText(key);
        id = `${baseId}-${suffix}`;
        let ordinal = 2;
        while (usedIds.has(id)) {
          id = `${baseId}-${suffix}-${ordinal}`;
          ordinal += 1;
        }
      }
      usedIds.add(id);
      return {
        _id: id,
        key,
        lang: bundle.lang,
        value
      };
    })
  );
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of `${value ?? ''}`) {
    hash ^= char.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
