const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const sidecar = require(path.join(root, 'zargota-i18n-catalog-uk.js'));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(data.catalog)).digest('hex');
assert.strictEqual(sidecar.sourceHash, sourceHash, 'Catalog source changed and requires a new Ukrainian review');

const sourceEntries = data.catalog.entries || [];
const reviewedIds = new Set(sidecar.reviewedEntryIds.map(String));
const requiredReviewedEntries = sourceEntries;
const missingRequiredEntries = requiredReviewedEntries.filter((entry) => !reviewedIds.has(String(entry.id)));
assert.deepStrictEqual(missingRequiredEntries, [], 'every Catalog entry must be manually reviewed');

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
assert.deepStrictEqual(missing, [], `every Russian string in reviewed Catalog entries must have a Ukrainian translation; missing ${missing.length}`);
assert.deepStrictEqual(unexpected, [], `Catalog sidecar must match reviewed source entries; unexpected ${unexpected.length}`);

const numberTokens = (value) => (String(value).match(/\d+(?:[.,]\d+)?/g) || []).map((token) => token.replace(',', '.'));
const numericMismatches = Array.from(reviewedSourceStrings).filter((source) => numberTokens(source).join('|') !== numberTokens(translations[source]).join('|'));
assert.deepStrictEqual(numericMismatches, [], `Catalog translations must preserve numeric tokens; mismatches ${numericMismatches.length}`);

const russianSpecific = Object.values(translations).filter((target) => /[ЫыЭэЪъЁё]/u.test(target));
assert.deepStrictEqual(russianSpecific, [], `Catalog translations contain Russian-specific letters: ${russianSpecific.slice(0, 5).join(' | ')}`);

const sidecarSource = fs.readFileSync(path.join(root, 'zargota-i18n-catalog-uk.js'), 'utf8');
assert(!/localStorage|indexedDB|firebase|database\s*\(/i.test(sidecarSource), 'Catalog sidecar must not mutate storage or Firebase');
assert(sidecarSource.includes('root.ZargotaI18nCatalogUk = payload'), 'Catalog sidecar must expose reviewed entry ids for scoped rendering');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(indexSource.includes('zargota-i18n-catalog-uk.js'), 'index.html must load the reviewed Catalog sidecar');
assert(indexSource.includes('catalogEntryIsReviewed') && indexSource.includes('data-zg-i18n-skip'), 'Catalog rendering must isolate unreviewed authored text from global translations');
assert(indexSource.includes('(?:Восстановление|Відновлення)(?=\\s|:|$)'), 'Catalog cooldown rendering must recognize a translated recovery prefix after an emoji');
assert(indexSource.includes('(?:Постоянно|Постійно)(?=\\s|,|;|:|$)'), 'Catalog cooldown rendering must not label permanent effects as recovery');
assert(indexSource.includes('^Одночасно(?=\\s|:|$)'), 'Catalog cooldown rendering must not label an active-capacity limit as recovery');

const i18n = require(path.join(root, 'zargota-i18n.js'));
i18n.registerContentTranslations(translations);
const sample = requiredReviewedEntries.find((entry) => entry.spellType === 'kodex');
assert.strictEqual(i18n.translate(sample.name, 'uk'), '🛡Шип відплати', 'reviewed Catalog title must translate in Ukrainian');
assert.strictEqual(i18n.translate(sample.name, 'ru'), sample.name, 'Russian Catalog title must round-trip exactly');

console.log(`i18n Catalog coverage: OK (${reviewedIds.size}/${sourceEntries.length} entries, ${reviewedSourceStrings.size} strings reviewed)`);
