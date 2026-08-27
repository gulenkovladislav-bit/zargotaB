const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const sidecar = require(path.join(root, 'zargota-i18n-bestiary-uk.js'));
const sourceEntries = data.beasts || [];
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(sourceEntries)).digest('hex');
assert.strictEqual(sidecar.sourceHash, sourceHash, 'Bestiary source changed and requires a new Ukrainian review');

const reviewedIds = new Set(sidecar.reviewedEntryIds.map(String));
const requiredReviewedEntries = sourceEntries.slice(0, 82);
const missingRequiredEntries = requiredReviewedEntries.filter((entry) => !reviewedIds.has(String(entry.id)));
assert.deepStrictEqual(missingRequiredEntries, [], 'every Bestiary entry must be manually reviewed');

const russianText = /[А-ЯЁа-яё]/u;
const reviewedSourceStrings = new Set();
function collect(value) {
  if (typeof value === 'string') {
    if (russianText.test(value)) reviewedSourceStrings.add(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach(collect);
  if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
sourceEntries.filter((entry) => reviewedIds.has(String(entry.id))).forEach(collect);

const translations = sidecar.translations;
const missing = Array.from(reviewedSourceStrings).filter((source) => typeof translations[source] !== 'string' || !translations[source].trim());
const unexpected = Object.keys(translations).filter((source) => !reviewedSourceStrings.has(source));
assert.deepStrictEqual(missing, [], `every Russian string in reviewed Bestiary entries must have a Ukrainian translation; missing ${missing.length}`);
assert.deepStrictEqual(unexpected, [], `Bestiary sidecar must match reviewed source entries; unexpected ${unexpected.length}`);

const numberTokens = (value) => (String(value).match(/\d+(?:[.,]\d+)?/g) || []).map((token) => token.replace(',', '.'));
const numericMismatches = Array.from(reviewedSourceStrings).filter((source) => numberTokens(source).join('|') !== numberTokens(translations[source]).join('|'));
assert.deepStrictEqual(numericMismatches, [], `Bestiary translations must preserve numeric tokens; mismatches ${numericMismatches.length}`);

const russianSpecific = Object.values(translations).filter((target) => /[ЫыЭэЪъЁё]/u.test(target));
assert.deepStrictEqual(russianSpecific, [], `Bestiary translations contain Russian-specific letters: ${russianSpecific.slice(0, 5).join(' | ')}`);

const sidecarSource = fs.readFileSync(path.join(root, 'zargota-i18n-bestiary-uk.js'), 'utf8');
assert(!/localStorage|indexedDB|firebase|database\s*\(/i.test(sidecarSource), 'Bestiary sidecar must not mutate storage or Firebase');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(indexSource.includes('zargota-i18n-bestiary-uk.js'), 'index.html must load the reviewed Bestiary sidecar');
assert(indexSource.includes('beastEntryIsReviewed') && indexSource.includes('beastEntrySkipAttr'), 'Bestiary rendering must isolate unreviewed authored text from global translations');

const i18n = require(path.join(root, 'zargota-i18n.js'));
i18n.registerContentTranslations(translations);
assert.strictEqual(i18n.translate(requiredReviewedEntries[0].name, 'uk'), 'Підвальний хом’як', 'reviewed Bestiary title must translate in Ukrainian');
assert.strictEqual(i18n.translate(requiredReviewedEntries[0].name, 'ru'), requiredReviewedEntries[0].name, 'Russian Bestiary title must round-trip exactly');

console.log(`i18n Bestiary coverage: OK (${reviewedIds.size}/${sourceEntries.length} entries, ${reviewedSourceStrings.size} strings reviewed)`);
