#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const mongoRoot = path.join(repoRoot, 'server/docker/conf/mongodb');
const languages = ['en', 'hu'];
const seedDatabases = ['demo_db', 'e2e_db', 'myscoutee_db'];
const issues = [];

const bundles = new Map();
for (const language of languages) {
  const filePath = path.join(frontendRoot, `src/assets/i18n/${language}.json`);
  const result = readJson(filePath);
  if (result.ok && validateSourceBundle(filePath, language, result.value)) {
    bundles.set(language, result.value);
  }
}

if (bundles.size === languages.length) {
  validateSourceKeySets();
  validateLiteralSourceReferences();
  for (const databaseName of seedDatabases) {
    validateSeedDatabase(databaseName);
  }
}

if (issues.length > 0) {
  issues.sort();
  console.error(`i18n seed audit failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  const messageCount = [...bundles.values()].reduce(
    (total, bundle) => total + Object.keys(bundle.messages).length,
    0
  );
  console.log(
    `i18n seed audit passed: ${languages.length} source bundles (${messageCount} messages) ` +
      `and ${seedDatabases.length} Mongo seeds are synchronized.`
  );
}

function readJson(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    };
  } catch (error) {
    issues.push(`${relativePath(filePath)}: cannot read valid JSON (${error.message})`);
    return { ok: false, value: null };
  }
}

function validateSourceBundle(filePath, expectedLanguage, bundle) {
  const file = relativePath(filePath);
  if (!isObject(bundle)) {
    issues.push(`${file}: bundle must be a JSON object`);
    return false;
  }
  if (bundle.lang !== expectedLanguage) {
    issues.push(
      `${file}: lang must be ${formatValue(expectedLanguage)}, got ${formatValue(bundle.lang)}`
    );
  }
  if (typeof bundle.version !== 'string' || bundle.version.trim() === '') {
    issues.push(`${file}: version must be a non-empty string`);
  }
  if (!isObject(bundle.messages)) {
    issues.push(`${file}: messages must be a JSON object`);
    return false;
  }
  for (const [key, value] of Object.entries(bundle.messages)) {
    if (key.trim() === '') {
      issues.push(`${file}: messages contains an empty key`);
    }
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push(`${file}: message ${formatValue(key)} must be a non-empty string`);
    }
  }
  return true;
}

function validateSourceKeySets() {
  const enKeys = new Set(Object.keys(bundles.get('en').messages));
  const huKeys = new Set(Object.keys(bundles.get('hu').messages));

  for (const key of sortedDifference(enKeys, huKeys)) {
    issues.push(`source bundles: key ${formatValue(key)} exists in en but is missing from hu`);
  }
  for (const key of sortedDifference(huKeys, enKeys)) {
    issues.push(`source bundles: key ${formatValue(key)} exists in hu but is missing from en`);
  }
}

function validateLiteralSourceReferences() {
  const sourceRoot = path.join(frontendRoot, 'src');
  const knownKeys = new Set(Object.keys(bundles.get('en').messages));
  const patterns = [
    {
      label: 'i18n pipe',
      expression: /(['"])([A-Za-z0-9][A-Za-z0-9_.-]*)\1\s*\|\s*i18n\b/g
    },
    {
      label: 'translation call',
      expression: /\b(?:translate|translateParams)\(\s*(['"])([A-Za-z0-9][A-Za-z0-9_.-]*)\1/g
    }
  ];

  for (const filePath of sourceFiles(sourceRoot)) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const { label, expression } of patterns) {
      expression.lastIndex = 0;
      for (const match of source.matchAll(expression)) {
        const key = match[2];
        if (!knownKeys.has(key)) {
          const line = source.slice(0, match.index).split('\n').length;
          issues.push(
            `${relativePath(filePath)}:${line}: ${label} references missing key ${formatValue(key)}`
          );
        }
      }
    }
  }
}

function sourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(entryPath));
      continue;
    }
    if (!entry.isFile() || !/\.(?:html|ts)$/.test(entry.name) || /\.spec\.ts$/.test(entry.name)) {
      continue;
    }
    files.push(entryPath);
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

function validateSeedDatabase(databaseName) {
  const databaseDir = path.join(mongoRoot, databaseName);
  validateSeedBundles(
    databaseName,
    path.join(databaseDir, 'i18n_bundles.json')
  );
  validateSeedMessages(
    databaseName,
    path.join(databaseDir, 'i18n_messages.json')
  );
}

function validateSeedBundles(databaseName, filePath) {
  const result = readJson(filePath);
  const file = `${databaseName}/i18n_bundles.json`;
  if (!result.ok) {
    return;
  }
  const documents = result.value;
  if (!Array.isArray(documents)) {
    issues.push(`${file}: root value must be an array`);
    return;
  }

  const documentsByLanguage = groupBy(documents, document => document?.lang);
  for (const [language, languageDocuments] of documentsByLanguage) {
    if (!languages.includes(language)) {
      issues.push(`${file}: unexpected language ${formatValue(language)}`);
      continue;
    }
    if (languageDocuments.length > 1) {
      issues.push(
        `${file}: duplicate bundle for language ${formatValue(language)} ` +
          `(${languageDocuments.length} documents)`
      );
    }
  }

  for (const language of languages) {
    const languageDocuments = documentsByLanguage.get(language) ?? [];
    if (languageDocuments.length === 0) {
      issues.push(`${file}: missing bundle for language ${formatValue(language)}`);
      continue;
    }
    const actualVersion = languageDocuments[0]?.version;
    const expectedVersion = bundles.get(language).version;
    if (actualVersion !== expectedVersion) {
      issues.push(
        `${file}: ${language} version differs; expected ${formatValue(expectedVersion)}, ` +
        `got ${formatValue(actualVersion)}`
      );
    }
    const expectedId = `i18n-bundle-${language}`;
    if (languageDocuments[0]?._id !== expectedId) {
      issues.push(
        `${file}: ${language} _id differs; expected ${formatValue(expectedId)}, ` +
          `got ${formatValue(languageDocuments[0]?._id)}`
      );
    }
    const expectedUpdatedAt = bundleUpdatedAt(expectedVersion);
    if (languageDocuments[0]?.updatedAt !== expectedUpdatedAt) {
      issues.push(
        `${file}: ${language} updatedAt differs; expected ${formatValue(expectedUpdatedAt)}, ` +
          `got ${formatValue(languageDocuments[0]?.updatedAt)}`
      );
    }
  }
}

function validateSeedMessages(databaseName, filePath) {
  const result = readJson(filePath);
  const file = `${databaseName}/i18n_messages.json`;
  if (!result.ok) {
    return;
  }
  const documents = result.value;
  if (!Array.isArray(documents)) {
    issues.push(`${file}: root value must be an array`);
    return;
  }

  const expectedMessages = new Map();
  for (const language of languages) {
    for (const [key, value] of Object.entries(bundles.get(language).messages)) {
      expectedMessages.set(pairId(language, key), { language, key, value });
    }
  }

  const actualMessages = new Map();
  for (const document of documents) {
    const language = document?.lang;
    const key = document?.key;
    const id = pairId(language, key);
    const existing = actualMessages.get(id);
    if (existing) {
      existing.count += 1;
      continue;
    }
    actualMessages.set(id, {
      language,
      key,
      value: document?.value,
      count: 1
    });
  }

  for (const actual of actualMessages.values()) {
    if (actual.count > 1) {
      issues.push(
        `${file}: duplicate lang/key pair ${formatPair(actual.language, actual.key)} ` +
          `(${actual.count} documents)`
      );
    }
  }

  for (const [id, expected] of expectedMessages) {
    const actual = actualMessages.get(id);
    if (!actual) {
      issues.push(`${file}: missing message ${formatPair(expected.language, expected.key)}`);
      continue;
    }
    if (actual.value !== expected.value) {
      issues.push(
        `${file}: value differs for ${formatPair(expected.language, expected.key)}; ` +
          `expected ${formatValue(expected.value)}, got ${formatValue(actual.value)}`
      );
    }
  }

  for (const [id, actual] of actualMessages) {
    if (!expectedMessages.has(id)) {
      issues.push(`${file}: unexpected message ${formatPair(actual.language, actual.key)}`);
    }
  }
}

function groupBy(values, keySelector) {
  const groups = new Map();
  for (const value of values) {
    const key = keySelector(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function pairId(language, key) {
  return JSON.stringify([language, key]);
}

function bundleUpdatedAt(version) {
  const match = `${version ?? ''}`.match(/^(\d{4})\.(\d{2})\.(\d{2})\./);
  if (!match) {
    return Number.NaN;
  }
  return Date.UTC(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10) - 1,
    Number.parseInt(match[3], 10)
  );
}

function formatPair(language, key) {
  return `${formatValue(language)} / ${formatValue(key)}`;
}

function formatValue(value) {
  const formatted = JSON.stringify(value);
  if (formatted === undefined) {
    return String(value);
  }
  const limit = 240;
  return formatted.length <= limit ? formatted : `${formatted.slice(0, limit - 3)}...`;
}

function sortedDifference(left, right) {
  return [...left]
    .filter(value => !right.has(value))
    .sort();
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
