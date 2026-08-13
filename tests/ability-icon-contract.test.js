'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

var helperStart = html.indexOf('function abilityAssetForItem(item,fallback)');
var builderStart = html.indexOf('function buildAbilityCards(', helperStart);
var panelStart = html.indexOf('function abilitiesPanel()', builderStart);
assert(helperStart >= 0 && builderStart > helperStart && panelStart > builderStart, 'ability asset resolver and shared card builder must exist before the Magic panel');

var helper = html.slice(helperStart, builderStart);
assert.match(helper, /item\.iconAsset\|\|item\.abilityIcon\|\|item\.iconImage\|\|item\.image/);
assert.match(helper, /data:image/);
assert.match(helper, /return asset\|\|fallback\|\|''/);

var panelEnd = html.indexOf('function drawerRenderSignature()', panelStart);
var builder = html.slice(builderStart, panelStart);
var panel = html.slice(panelStart, panelEnd);
assert.match(builder, /abilityAssetForItem\(item,'images\/ui\/combat-generated\/innate\.png'\)/);
assert.match(builder, /abilityAssetForItem\(spell,'images\/ui\/combat-generated\/'/);
assert.doesNotMatch(builder, /iconAsset:'images\/ui\/combat-generated\/innate\.png'/);

var renderStart = html.indexOf('function abilityIconHtml(card,extraClass)');
var renderEnd = html.indexOf('function abilityAssetForItem', renderStart);
var renderer = html.slice(renderStart, renderEnd);
assert.match(renderer, /card&&card\.iconAsset/);
assert.match(renderer, /zg-generated-ability-icon/);

var listUses = (panel.match(/abilityIconHtml\(card\)/g) || []).length;
assert(listUses >= 3, 'the same resolved image must be reused in list and prepared-slot renderers');
assert.match(html, /<header><i>'\+abilityIconHtml\(card\)/, 'the opened ability card must reuse the same image');

console.log('ability icon contract passed');
