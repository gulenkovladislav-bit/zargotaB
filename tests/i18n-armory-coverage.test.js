const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).armoryItems || [];
const sidecar = require(path.join(root, 'zargota-i18n-armory-uk.js'));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
assert.strictEqual(sidecar.sourceHash, sourceHash, 'armory source changed and requires a new Ukrainian review');
const reviewedIds = new Set(sidecar.reviewedEntryIds.map(String));
assert.deepStrictEqual(items.filter((entry) => !reviewedIds.has(String(entry.id))), [], 'every armory item must be manually reviewed');

const cyrillicText = /[А-ЯЁа-яёІіЇїЄєҐґ]/u;
function collect(value, output = new Set()) {
  if (typeof value === 'string') {
    if (cyrillicText.test(value)) output.add(value);
  } else if (Array.isArray(value)) value.forEach((entry) => collect(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
  return output;
}
for (const item of items) {
  const missing = Array.from(collect(item)).filter((source) => !sidecar.translations[source]);
  assert.deepStrictEqual(missing, [], `reviewed armory item ${item.id} must have complete Ukrainian display text`);
}
const numericTokens = (value) => String(value).match(/\d+(?:[.,]\d+)?/g) || [];
const numericMismatches = Object.entries(sidecar.translations).filter(([source, target]) => numericTokens(source).join('|') !== numericTokens(target).join('|'));
assert.deepStrictEqual(numericMismatches, [], 'armory translations must preserve numeric tokens');
assert.deepStrictEqual(Object.values(sidecar.translations).filter((target) => /[ЫыЭэЪъЁё]/u.test(target)), [], 'armory translations must not contain Russian-specific letters');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(indexSource.includes('zargota-i18n-armory-uk.js'), 'index.html must load the armory sidecar');
assert(indexSource.includes('armoryItemIsReviewed') && indexSource.includes('armoryItemText'), 'reviewed armory text must localize explicitly while unknown items keep their source text');
console.log(`i18n Armory coverage: OK (${reviewedIds.size}/${items.length} entries, ${Object.keys(sidecar.translations).length} strings reviewed)`);
