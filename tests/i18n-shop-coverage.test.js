const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const economy = require(path.join(root, 'item-economy.js'));
const items = economy.getShopSeedItems();
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const featuredMatch = indexSource.match(/var featured = (\[[\s\S]*?\n    \]);\n    var foundation/);
assert(featuredMatch, 'built-in featured shop items must remain discoverable for localization coverage');
const featuredItems = Function(`"use strict"; return (${featuredMatch[1]});`)();
const sidecar = require(path.join(root, 'zargota-i18n-shop-uk.js'));
const sourceHash = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
const featuredSourceHash = crypto.createHash('sha256').update(JSON.stringify(featuredItems)).digest('hex');
assert.strictEqual(sidecar.sourceHash, sourceHash, 'shop source changed and requires a new Ukrainian review');
assert.strictEqual(sidecar.featuredSourceHash, featuredSourceHash, 'featured shop source changed and requires a new Ukrainian review');

const reviewedIds = new Set(sidecar.reviewedEntryIds.map(String));
const required = featuredItems.concat(items);
assert.deepStrictEqual(required.filter((entry) => !reviewedIds.has(String(entry.id))), [], 'all built-in shop items must have complete Ukrainian review');

const russianText = /[А-ЯЁа-яё]/u;
function collect(value, output = new Set()) {
  if (typeof value === 'string') {
    if (russianText.test(value)) output.add(value);
  } else if (Array.isArray(value)) value.forEach((entry) => collect(entry, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((entry) => collect(entry, output));
  return output;
}

for (const item of required) {
  const missing = Array.from(collect(item)).filter((source) => !sidecar.translations[source]);
  assert.deepStrictEqual(missing, [], `reviewed shop item ${item.id} must have complete Ukrainian authored text`);
}
const unexpected = Object.keys(sidecar.translations).filter((source) => !required.some((entry) => collect(entry).has(source)));
assert.deepStrictEqual(unexpected, [], 'shop sidecar must contain only reviewed shop source strings');
const numericTokens = (value) => String(value).match(/\d+(?:[.,]\d+)?/g) || [];
const numericMismatches = Object.entries(sidecar.translations).filter(([source, target]) => numericTokens(source).join('|') !== numericTokens(target).join('|'));
assert.deepStrictEqual(numericMismatches, [], 'shop translations must preserve numeric tokens');
assert.deepStrictEqual(Object.values(sidecar.translations).filter((target) => /[ЫыЭэЪъЁё]/u.test(target)), [], 'shop translations must not contain Russian-specific letters');

assert(indexSource.includes('zargota-i18n-shop-uk.js'), 'index.html must load the shop sidecar');
assert(indexSource.includes('shopItemIsReviewed') && indexSource.includes('shopItemText'), 'reviewed shop text must localize explicitly while unreviewed items keep their source text');
assert(indexSource.includes("document.addEventListener('zargota:localechange'") && indexSource.includes("zgShopView(popup.dataset.shopItemId"), 'shop grid and open item details must rerender immediately after a locale change');
console.log(`i18n Shop coverage: OK (${reviewedIds.size}/${required.length} entries, ${Object.keys(sidecar.translations).length} strings reviewed)`);
