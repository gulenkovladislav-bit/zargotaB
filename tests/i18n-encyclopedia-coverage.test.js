const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const sidecar = require(path.join(root, 'zargota-i18n-encyclopedia-uk.js'));
const sourcePayload = { encyclopedia: data.encyclopedia, encyclopediaCategories: data.encyclopediaCategories };
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(sourcePayload)).digest('hex');
assert.strictEqual(sidecar.sourceHash, sourceHash, 'Encyclopedia source changed and requires a new Ukrainian review');

const russianText = /[А-ЯЁа-яё]/u;
const sourceStrings = new Set();
function collect(value) {
  if (typeof value === 'string') {
    if (russianText.test(value)) sourceStrings.add(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach(collect);
  if (value && typeof value === 'object') Object.values(value).forEach(collect);
}
collect(sourcePayload);

const translations = sidecar.translations;
const missing = Array.from(sourceStrings).filter((source) => typeof translations[source] !== 'string' || !translations[source].trim());
const unexpected = Object.keys(translations).filter((source) => !sourceStrings.has(source));
assert.deepStrictEqual(missing, [], `every Russian Encyclopedia string must have a reviewed Ukrainian translation; missing ${missing.length}`);
assert.deepStrictEqual(unexpected, [], `Encyclopedia sidecar must match its source; unexpected ${unexpected.length}`);

const numberTokens = (value) => (String(value).match(/\d+(?:[.,]\d+)?/g) || []).map((token) => token.replace(',', '.'));
const numericMismatches = Array.from(sourceStrings).filter((source) => numberTokens(source).join('|') !== numberTokens(translations[source]).join('|'));
assert.deepStrictEqual(numericMismatches, [], `Encyclopedia translations must preserve numeric tokens; mismatches ${numericMismatches.length}`);

const russianSpecific = Object.values(translations).filter((target) => /[ЫыЭэЪъЁё]/u.test(target));
assert.deepStrictEqual(russianSpecific, [], `Encyclopedia translations contain Russian-specific letters: ${russianSpecific.slice(0, 5).join(' | ')}`);

const sidecarSource = fs.readFileSync(path.join(root, 'zargota-i18n-encyclopedia-uk.js'), 'utf8');
assert(!/localStorage|indexedDB|firebase|database\s*\(/i.test(sidecarSource), 'Encyclopedia sidecar must not mutate storage or Firebase');

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(indexSource.includes('zargota-i18n-encyclopedia-uk.js'), 'index.html must load the reviewed Encyclopedia sidecar');
assert(indexSource.includes('function encDisplayText(value, localeOverride)'), 'Encyclopedia renderer must localize without changing source entries');
assert(indexSource.includes('function encMatchesQuery(entry, query)'), 'Encyclopedia search must support Ukrainian labels');
assert(indexSource.includes('encDisplayText(e.body)'), 'Encyclopedia article bodies must use the reviewed display translation');
assert(indexSource.includes('encConnectionPairs(e.connections || \'\')'), 'Encyclopedia connections must preserve source links while displaying Ukrainian labels');

const i18n = require(path.join(root, 'zargota-i18n.js'));
i18n.registerContentTranslations(translations);
const sampleSource = data.encyclopedia.entries.find((entry) => entry.id === 'enc_1776636892570');
assert(sampleSource, 'Ukrainian search sample entry must exist');
assert.strictEqual(i18n.translate(sampleSource.name, 'uk'), 'Село Півдуп’я', 'reviewed Encyclopedia title must translate in Ukrainian');
assert.strictEqual(i18n.translate(sampleSource.name, 'ru'), sampleSource.name, 'Russian Encyclopedia title must round-trip exactly');

console.log(`i18n Encyclopedia coverage: OK (${sourceStrings.size} strings reviewed)`);
