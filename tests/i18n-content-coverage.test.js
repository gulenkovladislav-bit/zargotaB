const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sidecarPath = path.join(root, 'zargota-i18n-content-uk.js');
assert(fs.existsSync(sidecarPath), 'generated Ukrainian content sidecar must exist');
const translations = require(sidecarPath);
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const economy = require(path.join(root, 'item-economy.js'));
const russianText = /[А-ЯЁа-яё]/u;
const values = new Set();

function collect(value) {
  if (typeof value === 'string') {
    if (russianText.test(value)) values.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(collect);
    return;
  }
  if (value && typeof value === 'object') Object.values(value).forEach(collect);
}

collect([
  data.catalog,
  data.beasts,
  data.atlas,
  data.encyclopedia,
  data.encyclopediaCategories,
  data.htree,
  data.characters,
  data.arena,
  data.armoryItems,
  data.armorySets,
  data.npc,
  data.shop,
  economy.getShopSeedItems(),
  economy.getShopRegions(),
  economy.getShopMarkets()
]);

const unexpected = Object.keys(translations).filter((source) => !values.has(source));
assert.deepStrictEqual(unexpected, [], `content sidecar must match the current source corpus; unexpected ${unexpected.length}`);
const empty = Object.keys(translations).filter((source) => typeof translations[source] !== 'string' || !translations[source].trim());
assert.deepStrictEqual(empty, [], `reviewed Ukrainian translations must not be empty; empty ${empty.length}`);

const numberTokens = (value) => String(value).match(/\d+(?:[.,]\d+)?/g) || [];
const tokenMismatches = Object.keys(translations).filter((source) => {
  return numberTokens(source).join('|') !== numberTokens(translations[source]).join('|');
});
assert.deepStrictEqual(tokenMismatches, [], `translations must preserve every numeric token; mismatches ${tokenMismatches.length}`);

const sidecarSource = fs.readFileSync(sidecarPath, 'utf8');
assert(!/localStorage|indexedDB|firebase|database\s*\(/i.test(sidecarSource), 'translation sidecar must not mutate storage or Firebase');

console.log(`i18n reviewed content: OK (${Object.keys(translations).length}/${values.size} strings)`);
