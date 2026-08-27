import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sourcePath = path.resolve(process.argv[2] || '/tmp/zargota-i18n-content-source.json');
const translatedPath = path.resolve(process.argv[3] || '/tmp/zargota-i18n-content-uk.generated.json');
const outputPath = path.resolve(process.argv[4] || path.join(root, 'zargota-i18n-content-uk.js'));
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const translated = JSON.parse(fs.readFileSync(translatedPath, 'utf8'));
const entries = Array.isArray(source.entries) ? source.entries : [];
const translations = translated && translated.translations;

if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
  throw new Error('Translation output must contain a translations object');
}
if (translated.sourceLocale !== 'ru' || translated.targetLocale !== 'uk') {
  throw new Error('Translation locale pair must be ru -> uk');
}
if (translated.total !== entries.length || translated.completed !== Object.keys(translations).length) {
  throw new Error(`Translation metadata mismatch: ${translated.completed}/${translated.total}; source has ${entries.length}`);
}

const expected = new Set(entries.map((entry) => entry.text));
const unexpected = Object.keys(translations).filter((text) => !expected.has(text));
const empty = Object.keys(translations).filter((text) => typeof translations[text] !== 'string' || !translations[text].trim());
if (empty.length || unexpected.length) {
  throw new Error(`Translation key mismatch: empty ${empty.length}, unexpected ${unexpected.length}`);
}

const ordered = Object.fromEntries(
  Object.keys(translations)
    .sort((first, second) => first.localeCompare(second, 'ru'))
    .map((text) => [text, translations[text]])
);
const payload = JSON.stringify(ordered)
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
const output = `(function(root, factory) {\n` +
  `  var translations = factory();\n` +
  `  if (typeof module === 'object' && module.exports) module.exports = translations;\n` +
  `  if (root && root.ZargotaI18n && typeof root.ZargotaI18n.registerContentTranslations === 'function') {\n` +
  `    root.ZargotaI18n.registerContentTranslations(translations);\n` +
  `  } else if (root) {\n` +
  `    root.ZargotaI18nContentUk = translations;\n` +
  `  }\n` +
  `})(typeof window !== 'undefined' ? window : null, function() {\n` +
  `  'use strict';\n` +
  `  return Object.freeze(${payload});\n` +
  `});\n`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({ outputPath, translations: Object.keys(ordered).length, total: entries.length, bytes: Buffer.byteLength(output) }));
