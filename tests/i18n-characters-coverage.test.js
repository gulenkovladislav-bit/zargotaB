const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const baseline = require(path.join(root, 'zargota-i18n-content-uk.js'));
const sidecar = require(path.join(root, 'zargota-i18n-characters-uk.js'));
const characters = Array.isArray(data.characters) ? data.characters : [];
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(characters)).digest('hex');
assert.strictEqual(sidecar.sourceHash, sourceHash, 'character source changed and requires a new Ukrainian review');

const reviewedIds = new Set(sidecar.reviewedEntryIds.map(String));
const required = characters.slice(0, 6);
assert.deepStrictEqual(required.filter((entry) => !reviewedIds.has(String(entry.id))), [], 'every character must be manually reviewed');

const russianText = /[А-ЯЁа-яё]/u;
function collect(value, output = new Set()) {
  if (typeof value === 'string') {
    if (russianText.test(value)) output.add(value);
  } else if (Array.isArray(value)) value.forEach((entry) => collect(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
  return output;
}

for (const character of characters.filter((entry) => reviewedIds.has(String(entry.id)))) {
  const missing = Array.from(collect(character)).filter((source) => !sidecar.translations[source] && !baseline[source]);
  assert.deepStrictEqual(missing, [], `reviewed character ${character.id} must have complete Ukrainian authored text`);
}

const unexpected = Object.keys(sidecar.translations).filter((source) => !characters.some((entry) => collect(entry).has(source)));
assert.deepStrictEqual(unexpected, [], 'character sidecar must contain only current character source strings');
const numericTokens = (value) => String(value).match(/\d+(?:[.,]\d+)?/g) || [];
const numericMismatches = Object.entries(sidecar.translations).filter(([source, target]) => numericTokens(source).join('|') !== numericTokens(target).join('|'));
assert.deepStrictEqual(numericMismatches, [], 'character translations must preserve numeric tokens');
assert.deepStrictEqual(Object.values(sidecar.translations).filter((target) => /[ЫыЭэЪъЁё]/u.test(target)), [], 'character translations must not contain Russian-specific letters');

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(indexSource.includes('zargota-i18n-characters-uk.js'), 'index.html must load the character sidecar');
assert(indexSource.includes('characterEntryIsReviewed') && indexSource.includes('characterEntryText') && indexSource.includes('characterEntrySkipAttr'), 'reviewed character text must localize explicitly while unreviewed authored text remains isolated');
console.log(`i18n Character coverage: OK (${reviewedIds.size}/${characters.length} entries)`);
