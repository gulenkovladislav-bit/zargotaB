'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

var helperStart = html.indexOf('function abilityAssetForItem(item,fallback)');
var panelStart = html.indexOf('function abilitiesPanel()', helperStart);
assert(helperStart >= 0 && panelStart > helperStart, 'ability asset resolver must exist before the Magic panel');

var helper = html.slice(helperStart, panelStart);
assert.match(helper, /item\.iconAsset\|\|item\.abilityIcon\|\|item\.iconImage\|\|item\.image/);
assert.match(helper, /data:image/);
assert.match(helper, /return asset\|\|fallback\|\|''/);

var panelEnd = html.indexOf('function drawerRenderSignature()', panelStart);
var panel = html.slice(panelStart, panelEnd);
assert.match(panel, /abilityAssetForItem\(item,'images\/ui\/combat-generated\/innate\.png'\)/);
assert.match(panel, /abilityAssetForItem\(spell,'images\/ui\/combat-generated\/'/);
assert.doesNotMatch(panel, /iconAsset:'images\/ui\/combat-generated\/innate\.png'/);

var renderStart = html.indexOf('function abilityIconHtml(card,extraClass)');
var renderEnd = html.indexOf('function abilityAssetForItem', renderStart);
var renderer = html.slice(renderStart, renderEnd);
assert.match(renderer, /card&&card\.iconAsset/);
assert.match(renderer, /zg-generated-ability-icon/);

var listUses = (panel.match(/abilityIconHtml\(card\)/g) || []).length;
assert(listUses >= 3, 'the same resolved image must be reused in list and prepared-slot renderers');
assert.match(html, /<header><i>'\+abilityIconHtml\(card\)/, 'the opened ability card must reuse the same image');

console.log('ability icon contract passed');
