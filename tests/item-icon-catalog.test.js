const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'item-icon-catalog.js'), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context, { filename: 'item-icon-catalog.js' });

const icons = context.window.ZargotaItemIcons;
assert.ok(icons, 'shared item icon catalog must be exported');
assert.ok(icons.catalog.length >= 50, 'catalog must contain a broad media set');
assert.strictEqual(new Set(icons.catalog.map((entry) => entry.key)).size, icons.catalog.length, 'icon keys must be unique');
assert.strictEqual(new Set(icons.catalog.map((entry) => entry.path)).size, icons.catalog.length, 'icon paths must be unique');

icons.catalog.forEach((entry) => {
  const file = path.join(root, entry.path);
  assert.ok(fs.existsSync(file), `missing item icon media: ${entry.path}`);
  const png = fs.readFileSync(file);
  assert.strictEqual(png.toString('ascii', 1, 4), 'PNG', `${entry.path} must be PNG`);
  assert.strictEqual(png.readUInt32BE(16), 192, `${entry.path} must be 192px wide`);
  assert.strictEqual(png.readUInt32BE(20), 192, `${entry.path} must be 192px high`);
});

assert.strictEqual(icons.resolveKey('🍞'), 'rations', 'legacy food emoji must migrate to media');
assert.strictEqual(icons.resolveKey('📦'), 'backpack', 'legacy package emoji must migrate to media');
assert.strictEqual(icons.valueFor({ name: 'Кольцо ветров' }), 'art:ring', 'item names must infer a useful icon');
assert.strictEqual(icons.valueFor({ category: 'weapon' }), 'art:sword', 'item categories must infer a useful icon');
assert.match(icons.markup({ name: 'Зелье', image: 'images/shop/custom.png' }), /images\/shop\/custom\.png/, 'real item art must take priority');
assert.match(icons.markup({ name: 'Зелье' }), /images\/ui\/item-icons\/potion\.png/, 'missing item art must use the shared media catalog');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const delivery = fs.readFileSync(path.join(root, 'gm-delivery.js'), 'utf8');
assert.ok(html.indexOf('item-icon-catalog.js') < html.indexOf('character-store.js'), 'catalog must load before item storage/UI');
assert.doesNotMatch(html, /INV_EMOJI_SET/, 'inventory item picker must not expose the old emoji palette');
assert.match(html, /window\.ZargotaItemIcons \? window\.ZargotaItemIcons\.catalog/, 'item editors must consume the shared catalog');
assert.doesNotMatch(delivery, /<select id="zg-gm-delivery-icon">/, 'GM item editor must use the visual media picker');
assert.match(delivery, /zg-gm-delivery-icon-grid/, 'GM item editor must expose the visual media grid');

console.log(`item icon catalog tests passed (${icons.catalog.length} media icons)`);
