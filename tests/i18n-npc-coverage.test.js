const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const baseline = require(path.join(root, 'zargota-i18n-content-uk.js'));
const sidecar = require(path.join(root, 'zargota-i18n-npc-uk.js'));
const entries = Array.isArray(data.npc) ? data.npc : [];
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex');
assert.strictEqual(sidecar.sourceHash, sourceHash, 'NPC source changed and requires a new Ukrainian review');

const reviewedIds = new Set(sidecar.reviewedEntryIds.map(String));
assert.deepStrictEqual(entries.filter((entry) => !reviewedIds.has(String(entry.id))), [], 'every NPC must be manually reviewed');

const cyrillicText = /[А-ЯЁа-яё]/u;
function collect(value, output = new Set()) {
  if (typeof value === 'string') {
    if (cyrillicText.test(value)) output.add(value);
  } else if (Array.isArray(value)) value.forEach((entry) => collect(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
  return output;
}

const sourceStrings = collect(entries);
const missing = Array.from(sourceStrings).filter((source) => !sidecar.translations[source] && !baseline[source]);
assert.deepStrictEqual(missing, [], 'reviewed NPC registry must have complete Ukrainian authored text');
const unexpected = Object.keys(sidecar.translations).filter((source) => !sourceStrings.has(source));
assert.deepStrictEqual(unexpected, [], 'NPC sidecar must contain only current NPC source strings');
const numericTokens = (value) => String(value).match(/\d+(?:[.,]\d+)?/g) || [];
const numericMismatches = Object.entries(sidecar.translations).filter(([source, target]) => numericTokens(source).join('|') !== numericTokens(target).join('|'));
assert.deepStrictEqual(numericMismatches, [], 'NPC translations must preserve numeric tokens');
assert.deepStrictEqual(Object.values(sidecar.translations).filter((target) => /[ЫыЭэЪъЁё]/u.test(target)), [], 'NPC translations must not contain Russian-specific letters');

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(indexSource.includes('zargota-i18n-npc-uk.js'), 'index.html must load the NPC sidecar');
assert(indexSource.includes('npcEntryIsReviewed') && indexSource.includes('npcEntryText') && indexSource.includes('npcEntrySkipAttr'), 'NPC renderers must localize reviewed entries and isolate unreviewed authored text');
console.log(`i18n NPC coverage: OK (${reviewedIds.size}/${entries.length} entries, ${sourceStrings.size} strings reviewed)`);
