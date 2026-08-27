import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const i18n = require(path.join(root, 'zargota-i18n.js'));
const russianText = /[А-ЯЁа-яё]/u;
const sourceFiles = [
  'index.html',
  'item-icon-catalog.js',
  'character-store.js',
  'character-sync-outbox.js',
  'gameplay-operation-outbox.js',
  'equipment-rules.js',
  'item-economy.js',
  'combat-playback.js',
  'dice-result-fx.js',
  'combat-vfx-presets.js',
  'combat-vfx-runtime.js',
  'combat-vfx-canvas.js',
  'spell-automation.js',
  'zargota-network.js',
  'gm-delivery.js',
  'gm-cues.js',
  'js/irl-name-catalog.js',
  'status-surface-masks.js',
  'zargota-progression.js'
];

function decodeLiteral(raw, quote) {
  if (quote === '"') {
    try { return JSON.parse('"' + raw + '"'); } catch {}
  }
  return raw
    .replace(/\\([\\'"`])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function collectSourceLiterals(source, values) {
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      index = source.indexOf('\n', index + 2);
      if (index < 0) break;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (char !== '"' && char !== "'" && char !== '`') {
      index += 1;
      continue;
    }
    const quote = char;
    let raw = '';
    let interpolated = false;
    index += 1;
    while (index < source.length) {
      const current = source[index];
      if (current === '\\') {
        raw += current + (source[index + 1] || '');
        index += 2;
        continue;
      }
      if (quote === '`' && current === '$' && source[index + 1] === '{') interpolated = true;
      if (current === quote) {
        index += 1;
        break;
      }
      raw += current;
      index += 1;
    }
    if (quote === '`' && interpolated) continue;
    const value = decodeLiteral(raw, quote);
    if (russianText.test(value)) values.add(value);
  }
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function collectHtmlText(source, values) {
  const markup = source
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  for (const match of markup.matchAll(/>([^<>]+)</g)) {
    const value = decodeHtml(match[1]).trim();
    if (value && russianText.test(value)) values.add(value);
  }
}

const values = new Set();
for (const relativePath of sourceFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (relativePath.endsWith('.html')) {
    for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) collectSourceLiterals(match[1], values);
    collectHtmlText(source, values);
  } else {
    collectSourceLiterals(source, values);
  }
}

const rows = Array.from(values)
  .sort((first, second) => first.localeCompare(second, 'ru'))
  .map((source) => ({ source, target: i18n.translate(source, 'uk') }));
const untranslated = rows.filter((row) => row.source === row.target);
const translated = rows.length - untranslated.length;
const report = {
  scannedFiles: sourceFiles.length,
  russianStrings: rows.length,
  translated,
  untranslated: untranslated.length,
  untranslatedRows: untranslated
};
const outputPath = process.argv[2];
if (outputPath) fs.writeFileSync(path.resolve(outputPath), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ scannedFiles: sourceFiles.length, russianStrings: rows.length, translated, untranslated: untranslated.length, outputPath: outputPath || null }));
