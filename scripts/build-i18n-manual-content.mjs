import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sourcePath = path.resolve(process.argv[2] || '/tmp/zargota-i18n-content-source.json');
const manualPath = path.resolve(process.argv[3] || path.join(root, 'localization/uk/content-manual.ndjson'));
const outputPath = path.resolve(process.argv[4] || '/tmp/zargota-i18n-content-uk.manual.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const require = createRequire(import.meta.url);
const i18n = require(path.join(root, 'zargota-i18n.js'));
const entries = Array.isArray(source.entries) ? source.entries : [];
const byId = new Map(entries.map((entry) => [String(entry.id), entry]));
const translations = {};
const seenIds = new Set();
const catalogOnly = (entry) => Array.isArray(entry.sources)
  && entry.sources.length > 0
  && entry.sources.every((sourceRef) => String(sourceRef).startsWith('catalog:'));
const ukrainianSpecific = /[ІіЇїЄєҐґ]/u;
const russianSpecific = /[ЫыЭэЪъЁё]/u;
const uiDictionary = i18n.dictionary('uk');
let preservedUkrainian = 0;
let reusedInterface = 0;
let excludedCatalogOnly = 0;

for (const entry of entries) {
  if (catalogOnly(entry)) continue;
  if (ukrainianSpecific.test(entry.text) && !russianSpecific.test(entry.text)) {
    translations[entry.text] = entry.text;
    preservedUkrainian += 1;
  } else if (typeof uiDictionary[entry.text] === 'string') {
    translations[entry.text] = uiDictionary[entry.text];
    reusedInterface += 1;
  }
}

const lines = fs.readFileSync(manualPath, 'utf8').split(/\r?\n/u).filter((line) => line.trim());
for (const [index, line] of lines.entries()) {
  const row = JSON.parse(line);
  const id = String(row.id);
  const sourceEntry = byId.get(id);
  if (!sourceEntry) throw new Error(`Unknown source id ${id} on line ${index + 1}`);
  if (seenIds.has(id)) throw new Error(`Duplicate source id ${id} on line ${index + 1}`);
  if (typeof row.text !== 'string' || !row.text.trim()) throw new Error(`Empty translation for id ${id}`);
  seenIds.add(id);
  if (catalogOnly(sourceEntry)) {
    excludedCatalogOnly += 1;
    continue;
  }
  translations[sourceEntry.text] = row.text;
}

const exactManual = seenIds.size - excludedCatalogOnly;
const completed = Object.keys(translations).length;
const payload = {
  schemaVersion: 1,
  sourceLocale: 'ru',
  targetLocale: 'uk',
  translationMethod: 'manual',
  stats: { exactManual, preservedUkrainian, reusedInterface, excludedCatalogOnly },
  completed,
  total: entries.length,
  translations
};
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({ outputPath, completed, total: entries.length, remaining: entries.length - completed, stats: payload.stats }));
