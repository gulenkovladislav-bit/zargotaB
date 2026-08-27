import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const reviewPath = path.resolve(process.argv[2] || path.join(root, 'localization/uk/npc-reviewed.json'));
const outputPath = path.resolve(process.argv[3] || path.join(root, 'zargota-i18n-npc-uk.js'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const entries = Array.isArray(data.npc) ? data.npc : [];
const baseline = require(path.join(root, 'zargota-i18n-content-uk.js'));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
const cyrillicText = /[А-ЯЁа-яё]/u;

if (review.schemaVersion !== 1 || review.sourceHash !== sourceHash) {
  throw new Error(`NPC review does not match current source: ${review.sourceHash || 'missing'} != ${sourceHash}`);
}

function collect(value, output = new Set()) {
  if (typeof value === 'string') {
    if (cyrillicText.test(value)) output.add(value);
  } else if (Array.isArray(value)) value.forEach((entry) => collect(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
  return output;
}

const sourceById = new Map(entries.map((entry) => [String(entry.id), entry]));
const reviewedEntryIds = Array.isArray(review.reviewedEntryIds) ? review.reviewedEntryIds.map(String) : [];
if (new Set(reviewedEntryIds).size !== reviewedEntryIds.length) throw new Error('Duplicate reviewed NPC id');
for (const id of reviewedEntryIds) if (!sourceById.has(id)) throw new Error(`Unexpected reviewed NPC ${id}`);

const translations = review.translations || {};
const reviewedStrings = new Set();
for (const id of reviewedEntryIds) collect(sourceById.get(id), reviewedStrings);
const unexpected = Object.keys(translations).filter((text) => !reviewedStrings.has(text));
if (unexpected.length) throw new Error(`Unexpected NPC translations: ${unexpected.slice(0, 3).join(' | ')}`);
for (const sourceText of reviewedStrings) {
  const target = translations[sourceText] || baseline[sourceText];
  if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing Ukrainian NPC translation: ${JSON.stringify(sourceText)}`);
}
for (const [sourceText, target] of Object.entries(translations)) {
  if (typeof target !== 'string' || !target.trim()) throw new Error(`Empty Ukrainian NPC translation: ${JSON.stringify(sourceText)}`);
}

const ordered = Object.fromEntries(Object.keys(translations).sort((a, b) => a.localeCompare(b, 'ru')).map((key) => [key, translations[key]]));
const payload = JSON.stringify(ordered).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const output = `(function(root, factory) {\n` +
  `  var payload = factory();\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = payload;\n` +
  `  if (root) root.ZargotaI18nNpcUk = payload;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(payload.translations);\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze({ sourceHash: '${sourceHash}', reviewedEntryIds: Object.freeze(${JSON.stringify(reviewedEntryIds)}), translations: Object.freeze(${payload}) });\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ reviewedEntries: reviewedEntryIds.length, translations: Object.keys(ordered).length, bytes: Buffer.byteLength(output) }));
