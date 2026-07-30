const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
const publishedCatalog = Array.isArray(data.catalog)
  ? data.catalog
  : (data.catalog && Array.isArray(data.catalog.entries) ? data.catalog.entries : []);

assert.ok(publishedCatalog.length > 0, 'the published spell catalog must not be empty');

const helperStart = html.indexOf('function getCharacterSpellCatalogEntries()');
const helperEnd = html.indexOf('function getSpellTypeCountsForCharacter', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'character spell catalog resolver must exist');

const helperSource = html.slice(helperStart, helperEnd);
const storedSpell = publishedCatalog[0];
const context = {
  entries: [],
  window: {},
  localStorage: {
    getItem(key) {
      assert.strictEqual(key, 'grimoire_v3');
      return JSON.stringify({ entries: [storedSpell] });
    }
  }
};
vm.createContext(context);
vm.runInContext(
  helperSource +
  '\nthis.catalogResult = getCharacterSpellCatalogEntries();' +
  '\nthis.foundResult = findCharacterCatalogSpell(' + JSON.stringify(String(storedSpell.id)) + ');',
  context
);

assert.strictEqual(context.catalogResult.length, 1, 'resolver must recover the catalog from storage');
assert.strictEqual(
  String(context.foundResult && context.foundResult.id),
  String(storedSpell.id),
  'spell lookup must tolerate string/number id differences'
);
assert.match(
  html,
  /window\.addEventListener\('zgDataReady',[\s\S]*?load\(\);[\s\S]*?window\.entries = entries;/,
  'the in-memory catalog must refresh after the asynchronous data loader completes'
);

const pickerStart = html.indexOf('function openSpellPicker(charId)');
const pickerEnd = html.indexOf('function filterSpellPicker', pickerStart);
const pickerSource = html.slice(pickerStart, pickerEnd);
assert.match(
  pickerSource,
  /var catalogEntries = getCharacterSpellCatalogEntries\(\)/,
  'the character spell picker must use the resolved catalog'
);
assert.doesNotMatch(
  pickerSource,
  /if \(entries\.length === 0\)/,
  'the picker must not rely on the stale initial catalog array'
);

console.log('character spell catalog binding contract passed');
