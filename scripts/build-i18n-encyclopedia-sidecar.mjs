import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataPath = path.resolve(process.argv[2] || path.join(root, 'data.json'));
const reviewPath = path.resolve(process.argv[3] || path.join(root, 'localization/uk/encyclopedia-reviewed.json'));
const outputPath = path.resolve(process.argv[4] || path.join(root, 'zargota-i18n-encyclopedia-uk.js'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const sourcePayload = { encyclopedia: data.encyclopedia, encyclopediaCategories: data.encyclopediaCategories };
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(sourcePayload)).digest('hex');
const russianText = /[А-ЯЁа-яё]/u;
const entryFields = ['name', 'sub', 'sub2', 'tag', 'body', 'details', 'connections', 'gmNotes'];
const translations = Object.create(null);

if (review.schemaVersion !== 1 || review.sourceHash !== sourceHash) {
  throw new Error(`Encyclopedia review does not match current source: ${review.sourceHash || 'missing'} != ${sourceHash}`);
}

function register(source, target, location) {
  if (typeof source !== 'string' || !russianText.test(source)) return;
  if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing Ukrainian translation at ${location}`);
  if (Object.prototype.hasOwnProperty.call(translations, source) && translations[source] !== target) {
    throw new Error(`Conflicting Ukrainian translations for ${JSON.stringify(source)} at ${location}`);
  }
  translations[source] = target;
}

const reviewedCategories = new Map((review.categories || []).map((category) => [category.key, category]));
for (const category of data.encyclopediaCategories || []) {
  const target = reviewedCategories.get(category.key);
  if (!target) throw new Error(`Missing reviewed category ${category.key}`);
  register(category.label, target.label, `category ${category.key}.label`);
  if (!Array.isArray(target.subs) || target.subs.length !== category.subs.length) {
    throw new Error(`Category ${category.key} must preserve ${category.subs.length} subcategories`);
  }
  category.subs.forEach((source, index) => register(source, target.subs[index], `category ${category.key}.subs[${index}]`));
}

const reviewedEntries = new Map((review.entries || []).map((entry) => [entry.id, entry]));
for (const entry of (data.encyclopedia && data.encyclopedia.entries) || []) {
  const target = reviewedEntries.get(entry.id);
  if (!target) throw new Error(`Missing reviewed encyclopedia entry ${entry.id}`);
  for (const field of entryFields) register(entry[field], target[field], `entry ${entry.id}.${field}`);
}

const sourceEntries = (data.encyclopedia && data.encyclopedia.entries) || [];
const unexpectedEntries = (review.entries || []).filter((entry) => !sourceEntries.some((source) => source.id === entry.id));
if (unexpectedEntries.length) throw new Error(`Unexpected reviewed entries: ${unexpectedEntries.map((entry) => entry.id).join(', ')}`);

const ordered = Object.fromEntries(
  Object.keys(translations)
    .sort((first, second) => first.localeCompare(second, 'ru'))
    .map((source) => [source, translations[source]])
);
const serialized = JSON.stringify(ordered).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const output = `(function(root, factory) {\n` +
  `  var payload = factory();\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = payload;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(payload.translations);\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze({ sourceHash: '${sourceHash}', translations: Object.freeze(${serialized}) });\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ outputPath, entries: sourceEntries.length, translations: Object.keys(ordered).length, bytes: Buffer.byteLength(output) }));
