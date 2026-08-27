import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const reviewPath = path.resolve(process.argv[2] || path.join(root, 'localization/uk/characters-reviewed.json'));
const outputPath = path.resolve(process.argv[3] || path.join(root, 'zargota-i18n-characters-uk.js'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const characters = Array.isArray(data.characters) ? data.characters : [];
const baseline = require(path.join(root, 'zargota-i18n-content-uk.js'));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(characters)).digest('hex');
const russianText = /[А-ЯЁа-яё]/u;
const translations = Object.create(null);
const reviewedEntryIds = [];
const reviewedTranslations = Object.create(null);

if (review.schemaVersion !== 1 || review.sourceHash !== sourceHash) {
  throw new Error(`Character review does not match current source: ${review.sourceHash || 'missing'} != ${sourceHash}`);
}

function collect(value, output) {
  if (typeof value === 'string') {
    if (russianText.test(value)) output.add(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach((entry) => collect(entry, output));
  if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
}

const sourceById = new Map(characters.map((entry) => [String(entry.id), entry]));
for (const reviewed of review.entries || []) {
  for (const [sourceText, target] of Object.entries(reviewed.translations || {})) {
    if (typeof target !== 'string' || !target.trim()) throw new Error(`Empty Ukrainian character translation for ${reviewed.id}: ${JSON.stringify(sourceText)}`);
    if (reviewedTranslations[sourceText] && reviewedTranslations[sourceText] !== target) {
      throw new Error(`Conflicting character translation: ${JSON.stringify(sourceText)}`);
    }
    reviewedTranslations[sourceText] = target;
  }
}
for (const reviewed of review.entries || []) {
  const id = String(reviewed.id);
  const source = sourceById.get(id);
  if (!source) throw new Error(`Unexpected reviewed character ${id}`);
  if (reviewedEntryIds.includes(id)) throw new Error(`Duplicate reviewed character ${id}`);
  const sourceStrings = new Set();
  collect(source, sourceStrings);
  const supplied = reviewed.translations || {};
  const unexpected = Object.keys(supplied).filter((text) => !sourceStrings.has(text));
  if (unexpected.length) throw new Error(`Unexpected character translations for ${id}: ${unexpected.slice(0, 3).join(' | ')}`);
  for (const sourceText of sourceStrings) {
    const target = reviewedTranslations[sourceText] || baseline[sourceText];
    if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing Ukrainian character translation for ${id}: ${JSON.stringify(sourceText)}`);
  }
  for (const [sourceText, target] of Object.entries(supplied)) {
    translations[sourceText] = target;
  }
  reviewedEntryIds.push(id);
}

const ordered = Object.fromEntries(Object.keys(translations).sort((a, b) => a.localeCompare(b, 'ru')).map((key) => [key, translations[key]]));
const payload = JSON.stringify(ordered).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const output = `(function(root, factory) {\n` +
  `  var payload = factory();\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = payload;\n` +
  `  if (root) root.ZargotaI18nCharactersUk = payload;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(payload.translations);\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze({ sourceHash: '${sourceHash}', reviewedEntryIds: Object.freeze(${JSON.stringify(reviewedEntryIds)}), translations: Object.freeze(${payload}) });\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ reviewedEntries: reviewedEntryIds.length, translations: Object.keys(ordered).length, bytes: Buffer.byteLength(output) }));
