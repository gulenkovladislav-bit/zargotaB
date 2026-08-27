import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const economy = require(path.join(root, 'item-economy.js'));
const items = economy.getShopSeedItems();
const defaultReviewPaths = [
  path.join(root, 'localization/uk/shop-foundation-reviewed.json'),
  path.join(root, 'localization/uk/shop-consumables-reviewed.json'),
  path.join(root, 'localization/uk/shop-weapons-reviewed.json'),
  path.join(root, 'localization/uk/shop-creature-counters-reviewed.json'),
  path.join(root, 'localization/uk/shop-armor-clothing-reviewed.json'),
  path.join(root, 'localization/uk/shop-shields-cuirasses-reviewed.json'),
  path.join(root, 'localization/uk/shop-creature-hunt-reviewed.json'),
  path.join(root, 'localization/uk/shop-expedition-reviewed.json'),
  path.join(root, 'localization/uk/shop-scrolls-reviewed.json'),
  path.join(root, 'localization/uk/shop-magical-consumables-reviewed.json'),
  path.join(root, 'localization/uk/shop-crafting-components-reviewed.json'),
  path.join(root, 'localization/uk/shop-alcohol-reviewed.json'),
  path.join(root, 'localization/uk/shop-food-reviewed.json'),
  path.join(root, 'localization/uk/shop-remedies-reviewed.json'),
  path.join(root, 'localization/uk/shop-mobility-reviewed.json'),
  path.join(root, 'localization/uk/shop-minor-artifacts-reviewed.json')
];
const reviewPaths = process.argv[2] ? [path.resolve(process.argv[2])] : defaultReviewPaths;
const outputPath = path.resolve(process.argv[3] || path.join(root, 'zargota-i18n-shop-uk.js'));
const reviews = reviewPaths.map((reviewPath) => JSON.parse(fs.readFileSync(reviewPath, 'utf8')));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
const russianText = /[А-ЯЁа-яё]/u;
const translations = Object.create(null);
const reviewedTranslations = Object.create(null);
const reviewedEntryIds = [];

for (const review of reviews) {
  if (review.schemaVersion !== 1 || review.sourceHash !== sourceHash) {
    throw new Error(`Shop review does not match current source: ${review.sourceHash || 'missing'} != ${sourceHash}`);
  }
}

function collect(value, output = new Set()) {
  if (typeof value === 'string') {
    if (russianText.test(value)) output.add(value);
  } else if (Array.isArray(value)) value.forEach((entry) => collect(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
  return output;
}

const sourceById = new Map(items.map((entry) => [String(entry.id), entry]));
const reviewedEntries = reviews.flatMap((review) => review.entries || []);
for (const reviewed of reviewedEntries) {
  for (const [sourceText, target] of Object.entries(reviewed.translations || {})) {
    if (typeof target !== 'string' || !target.trim()) throw new Error(`Empty Ukrainian shop translation for ${reviewed.id}: ${JSON.stringify(sourceText)}`);
    if (reviewedTranslations[sourceText] && reviewedTranslations[sourceText] !== target) throw new Error(`Conflicting shop translation: ${JSON.stringify(sourceText)}`);
    reviewedTranslations[sourceText] = target;
  }
}
for (const reviewed of reviewedEntries) {
  const id = String(reviewed.id);
  const source = sourceById.get(id);
  if (!source) throw new Error(`Unexpected reviewed shop item ${id}`);
  if (reviewedEntryIds.includes(id)) throw new Error(`Duplicate reviewed shop item ${id}`);
  const sourceStrings = collect(source);
  const supplied = reviewed.translations || {};
  const unexpected = Object.keys(supplied).filter((text) => !sourceStrings.has(text));
  if (unexpected.length) throw new Error(`Unexpected shop translations for ${id}: ${unexpected.slice(0, 3).join(' | ')}`);
  for (const sourceText of sourceStrings) {
    if (!reviewedTranslations[sourceText]) throw new Error(`Missing Ukrainian shop translation for ${id}: ${JSON.stringify(sourceText)}`);
  }
  for (const [sourceText, target] of Object.entries(supplied)) translations[sourceText] = target;
  reviewedEntryIds.push(id);
}

const ordered = Object.fromEntries(Object.keys(translations).sort((a, b) => a.localeCompare(b, 'ru')).map((key) => [key, translations[key]]));
const payload = JSON.stringify(ordered).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const output = `(function(root, factory) {\n` +
  `  var payload = factory();\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = payload;\n` +
  `  if (root) root.ZargotaI18nShopUk = payload;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(payload.translations);\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze({ sourceHash: '${sourceHash}', reviewedEntryIds: Object.freeze(${JSON.stringify(reviewedEntryIds)}), translations: Object.freeze(${payload}) });\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ reviewedEntries: reviewedEntryIds.length, totalEntries: items.length, translations: Object.keys(ordered).length, bytes: Buffer.byteLength(output) }));
