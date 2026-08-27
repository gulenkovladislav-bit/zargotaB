import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataPath = path.resolve(process.argv[2] || path.join(root, 'data.json'));
const reviewPath = path.resolve(process.argv[3] || path.join(root, 'localization/uk/catalog-reviewed.json'));
const outputPath = path.resolve(process.argv[4] || path.join(root, 'zargota-i18n-catalog-uk.js'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(data.catalog)).digest('hex');
const russianText = /[А-ЯЁа-яё]/u;
const entryFields = ['school', 'schoolCustom', 'klasse', 'tip', 'name', 'description', 'manifestation', 'effect', 'battle', 'learnText', 'cd', 'restriction'];
const translations = Object.create(null);

if (review.schemaVersion !== 1 || review.sourceHash !== sourceHash) {
  throw new Error(`Catalog review does not match current source: ${review.sourceHash || 'missing'} != ${sourceHash}`);
}

function register(source, target, location) {
  if (typeof source !== 'string' || !russianText.test(source)) return;
  if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing Ukrainian translation at ${location}`);
  if (Object.prototype.hasOwnProperty.call(translations, source) && translations[source] !== target) {
    throw new Error(`Conflicting Ukrainian translations for ${JSON.stringify(source)} at ${location}`);
  }
  translations[source] = target;
}

const sourceEntries = (data.catalog && data.catalog.entries) || [];
const sourceById = new Map(sourceEntries.map((entry) => [String(entry.id), entry]));
const reviewedIds = [];
for (const target of review.entries || []) {
  const id = String(target.id);
  const source = sourceById.get(id);
  if (!source) throw new Error(`Unexpected reviewed Catalog entry ${id}`);
  if (reviewedIds.includes(id)) throw new Error(`Duplicate reviewed Catalog entry ${id}`);
  reviewedIds.push(id);
  for (const field of entryFields) register(source[field], target[field], `entry ${id}.${field}`);
  const sourceOptFields = Array.isArray(source.optFields) ? source.optFields : [];
  const targetOptFields = Array.isArray(target.optFields) ? target.optFields : [];
  if (targetOptFields.length !== sourceOptFields.length) {
    throw new Error(`Entry ${id} must preserve ${sourceOptFields.length} optional fields`);
  }
  sourceOptFields.forEach((sourceField, index) => {
    const targetField = targetOptFields[index] || {};
    if (String(targetField.id) !== String(sourceField.id)) throw new Error(`Entry ${id} optional field ${index} must preserve id`);
    register(sourceField.label, targetField.label, `entry ${id}.optFields[${index}].label`);
    register(sourceField.text, targetField.text, `entry ${id}.optFields[${index}].text`);
  });
}

const ordered = Object.fromEntries(
  Object.keys(translations)
    .sort((first, second) => first.localeCompare(second, 'ru'))
    .map((source) => [source, translations[source]])
);
const serialized = JSON.stringify(ordered).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const output = `(function(root, factory) {\n` +
  `  var payload = factory();\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = payload;\n` +
  `  if (root) root.ZargotaI18nCatalogUk = payload;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(payload.translations);\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze({ sourceHash: '${sourceHash}', reviewedEntryIds: Object.freeze(${JSON.stringify(reviewedIds)}), translations: Object.freeze(${serialized}) });\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ outputPath, reviewedEntries: reviewedIds.length, translations: Object.keys(ordered).length, bytes: Buffer.byteLength(output) }));
