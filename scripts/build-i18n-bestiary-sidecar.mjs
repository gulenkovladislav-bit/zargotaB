import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataPath = path.resolve(process.argv[2] || path.join(root, 'data.json'));
const reviewPath = path.resolve(process.argv[3] || path.join(root, 'localization/uk/bestiary-reviewed.json'));
const outputPath = path.resolve(process.argv[4] || path.join(root, 'zargota-i18n-bestiary-uk.js'));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const beasts = Array.isArray(data.beasts) ? data.beasts : [];
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(beasts)).digest('hex');
const russianText = /[А-ЯЁа-яё]/u;
const translations = Object.create(null);
const entryFields = ['name', 'alignment', 'role', 'description', 'lore', 'speed', 'level', 'behavior', 'family', 'variants'];
const entryArrayFields = ['immunities', 'resistances', 'vulnerabilities'];
const attackFields = ['name', 'damage', 'toHit', 'range', 'cd', 'desc'];
const attackArrayFields = ['damageTypes', 'statuses'];
const traitFields = ['name', 'desc'];
const lootFields = ['name', 'desc'];

if (review.schemaVersion !== 1 || review.sourceHash !== sourceHash) {
  throw new Error(`Bestiary review does not match current source: ${review.sourceHash || 'missing'} != ${sourceHash}`);
}

function register(source, target, location) {
  if (typeof source !== 'string' || !russianText.test(source)) return;
  if (typeof target !== 'string' || !target.trim()) throw new Error(`Missing Ukrainian translation at ${location}`);
  if (Object.prototype.hasOwnProperty.call(translations, source) && translations[source] !== target) {
    throw new Error(`Conflicting Ukrainian translations for ${JSON.stringify(source)} at ${location}`);
  }
  translations[source] = target;
}

function registerFields(source, target, fields, location) {
  fields.forEach((field) => register(source && source[field], target && target[field], `${location}.${field}`));
}

function registerArray(source, target, location) {
  const sourceArray = Array.isArray(source) ? source : [];
  const targetArray = Array.isArray(target) ? target : [];
  if (targetArray.length !== sourceArray.length) throw new Error(`${location} must preserve ${sourceArray.length} entries`);
  sourceArray.forEach((value, index) => register(value, targetArray[index], `${location}[${index}]`));
}

function registerObjectArray(source, target, fields, arrayFields, location) {
  const sourceArray = Array.isArray(source) ? source : [];
  const targetArray = Array.isArray(target) ? target : [];
  if (targetArray.length !== sourceArray.length) throw new Error(`${location} must preserve ${sourceArray.length} entries`);
  sourceArray.forEach((value, index) => {
    registerFields(value, targetArray[index], fields, `${location}[${index}]`);
    arrayFields.forEach((field) => registerArray(value && value[field], targetArray[index] && targetArray[index][field], `${location}[${index}].${field}`));
  });
}

const sourceById = new Map(beasts.map((entry) => [String(entry.id), entry]));
const reviewedIds = [];
for (const target of review.entries || []) {
  const id = String(target.id);
  const source = sourceById.get(id);
  if (!source) throw new Error(`Unexpected reviewed Bestiary entry ${id}`);
  if (reviewedIds.includes(id)) throw new Error(`Duplicate reviewed Bestiary entry ${id}`);
  reviewedIds.push(id);
  registerFields(source, target, entryFields, `entry ${id}`);
  entryArrayFields.forEach((field) => registerArray(source[field], target[field], `entry ${id}.${field}`));
  registerObjectArray(source.attacks, target.attacks, attackFields, attackArrayFields, `entry ${id}.attacks`);
  registerObjectArray(source.traits, target.traits, traitFields, [], `entry ${id}.traits`);
  registerObjectArray(source.loot, target.loot, lootFields, [], `entry ${id}.loot`);
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
  `  if (root) root.ZargotaI18nBestiaryUk = payload;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(payload.translations);\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze({ sourceHash: '${sourceHash}', reviewedEntryIds: Object.freeze(${JSON.stringify(reviewedIds)}), translations: Object.freeze(${serialized}) });\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ outputPath, reviewedEntries: reviewedIds.length, translations: Object.keys(ordered).length, bytes: Buffer.byteLength(output) }));
