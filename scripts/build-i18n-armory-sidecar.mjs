import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const items = Array.isArray(data.armoryItems) ? data.armoryItems : [];
const baseline = require(path.join(root, 'zargota-i18n-characters-uk.js')).translations;
const reviewPath = path.resolve(process.argv[2] || path.join(root, 'localization/uk/armory-reviewed.json'));
const outputPath = path.resolve(process.argv[3] || path.join(root, 'zargota-i18n-armory-uk.js'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
const cyrillicText = /[А-ЯЁа-яёІіЇїЄєҐґ]/u;
const translations = Object.create(null);
const reviewedTranslations = Object.create(null);
const reviewedEntryIds = [];

if (review.schemaVersion !== 1 || review.sourceHash !== sourceHash) throw new Error(`Armory review does not match current source: ${review.sourceHash || 'missing'} != ${sourceHash}`);

function collect(value, output = new Set()) {
  if (typeof value === 'string') {
    if (cyrillicText.test(value)) output.add(value);
  } else if (Array.isArray(value)) value.forEach((entry) => collect(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
  return output;
}

const sourceById = new Map(items.map((entry) => [String(entry.id), entry]));
for (const reviewed of review.entries || []) {
  for (const [sourceText, target] of Object.entries(reviewed.translations || {})) {
    if (typeof target !== 'string' || !target.trim()) throw new Error(`Empty Ukrainian armory translation for ${reviewed.id}: ${JSON.stringify(sourceText)}`);
    if (reviewedTranslations[sourceText] && reviewedTranslations[sourceText] !== target) throw new Error(`Conflicting armory translation: ${JSON.stringify(sourceText)}`);
    reviewedTranslations[sourceText] = target;
  }
}
for (const reviewed of review.entries || []) {
  const id = String(reviewed.id);
  const source = sourceById.get(id);
  if (!source) throw new Error(`Unexpected reviewed armory item ${id}`);
  if (reviewedEntryIds.includes(id)) throw new Error(`Duplicate reviewed armory item ${id}`);
  const sourceStrings = collect(source);
  const supplied = reviewed.translations || {};
  const unexpected = Object.keys(supplied).filter((text) => !sourceStrings.has(text));
  if (unexpected.length) throw new Error(`Unexpected armory translations for ${id}: ${unexpected.slice(0, 3).join(' | ')}`);
  for (const sourceText of sourceStrings) {
    const target = reviewedTranslations[sourceText] || baseline[sourceText];
    if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing Ukrainian armory translation for ${id}: ${JSON.stringify(sourceText)}`);
    translations[sourceText] = target;
  }
  reviewedEntryIds.push(id);
}

const ordered = Object.fromEntries(Object.keys(translations).sort((a, b) => a.localeCompare(b, 'uk')).map((key) => [key, translations[key]]));
const payload = JSON.stringify(ordered).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const output = `(function(root, factory) {\n` +
  `  var payload = factory();\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = payload;\n` +
  `  if (root) root.ZargotaI18nArmoryUk = payload;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(payload.translations);\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze({ sourceHash: '${sourceHash}', reviewedEntryIds: Object.freeze(${JSON.stringify(reviewedEntryIds)}), translations: Object.freeze(${payload}) });\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ reviewedEntries: reviewedEntryIds.length, translations: Object.keys(ordered).length, bytes: Buffer.byteLength(output) }));
