'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'data/campaign-heroes.v1.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'item-icon-catalog.js'), 'utf8');
const expectedCounts = { evan: 4, esteros: 8, 'lin-yin': 5 };

Object.keys(expectedCounts).forEach(function(campaignKey) {
  const hero = bundle.heroes.find(function(entry) { return entry.campaignKey === campaignKey; });
  assert.ok(hero, 'missing campaign hero ' + campaignKey);
  const items = (hero.equipItems || []).concat(hero.inventoryItems || []);
  assert.strictEqual(items.length, expectedCounts[campaignKey], campaignKey + ' custom item count changed');
  items.forEach(function(item) {
    assert.match(String(item.icon || ''), /^art:hero-[a-z0-9-]+$/, item.name + ' needs a real shared catalog icon');
    assert.match(String(item.image || ''), /^images\/ui\/item-icons\/hero-[a-z0-9-]+\.png$/, item.name + ' needs a shared catalog image');
    assert.strictEqual(item.imageThumb, item.image, item.name + ' must use the same art in thumbnails and details');
    const asset = path.join(root, item.image);
    assert.ok(fs.existsSync(asset), item.image + ' must exist');
    const png = fs.readFileSync(asset);
    assert.strictEqual(png.toString('ascii', 1, 4), 'PNG', item.image + ' must be PNG');
    assert.strictEqual(png.readUInt32BE(16), 192, item.image + ' width');
    assert.strictEqual(png.readUInt32BE(20), 192, item.image + ' height');
    assert.ok(catalog.includes("'" + item.icon.slice(4) + "'"), item.icon + ' must be registered in the shared picker');
    assert.ok(html.includes("'" + item.icon.slice(4) + "'"), item.icon + ' needs a persisted-sheet migration');
  });
});

assert.match(html, /function applyCharacterCustomItemImages\(character\)[\s\S]*?CHARACTER_CUSTOM_ITEM_ICONS\[String\(character && character\.campaignKey[\s\S]*?item\.icon = 'art:' \+ iconKey[\s\S]*?item\.image = image[\s\S]*?item\.imageThumb = image/, 'saved character sheets must receive one shared icon source for every surface');
assert.match(html, /function applyCharsMigrations\(arr, options\)[\s\S]*?applyCharacterCustomItemImages\(c\)/, 'saved campaign characters must receive custom art during migration');
assert.doesNotMatch(html.match(/function charInventoryImage\(item\) \{[\s\S]*?\n\}/)[0], /characterCustomItemImage/, 'inventory rendering must not use a global cross-character name map');
assert.match(html, /function charInventoryArt\(item\) \{[\s\S]*?charInventoryImage\(item\)[\s\S]*?zgItemVisualMarkup/, 'character sheets must resolve campaign art before generic icon markup');
assert.match(html, /id="ic-emoji-btn"[\s\S]*?zgItemVisualMarkup\(item/, 'the item detail modal must show the same item art as the grid');
assert.match(html, /if \(iconChanged\) \{[\s\S]*?item\.image = zgItemIconPath\(currentEmoji\)[\s\S]*?item\.imageThumb = item\.image/, 'choosing another icon must update every stored image source');
assert.match(html, /function openItemConstructorByName\(charId, type, encodedName, fallbackIdx\)[\s\S]*?items\.findIndex[\s\S]*?openItemConstructor\(charId, type, currentIdx >= 0 \? currentIdx : fallbackIdx\)/, 'inventory clicks must survive async storage reordering');
assert.match(html, /class="char-inventory-inline-slot" onclick="openItemConstructorByName\(/, 'inventory grid must open items through the stable-name resolver');
assert.match(html, /class="char-inventory-equip-art">' \+ icon/, 'equipment art must use the bounded shared icon frame');

console.log('character custom item images: ok');
