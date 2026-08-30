'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /var COMBAT_UI_TEXT_SCALE=1\.3;/, 'combat UI copy must use the requested exact 130 percent scale');
[
  '#zg-combat-bar',
  '#zg-combat-economy',
  '#zg-combat-save',
  '#zg-combat-intent',
  '#zg-move-requests',
  '.zg-action-request-detail',
  '#zg-action-menu',
  '#zg-initiative-stage'
].forEach(function(selector){
  assert.ok(html.indexOf("'" + selector + "'") >= 0, selector + ' must be covered by the shared combat typography layer');
});

assert.match(html, /Combat UI readability v1: exact 130% text with layout room instead of visual zoom/, 'the final combat layout layer must document its readability contract');
assert.match(html, /\.zg-combat-economy\{\s*width:min\(832px,calc\(100vw - 320px\)\);height:112px/, 'the main turn toolbar must be 20 percent tighter and 15 percent shorter');
assert.match(html, /\.zg-combat-economy button\{height:99px;min-width:94px/, 'combat action cells must follow the shorter toolbar without shrinking typography');
assert.match(html, /\.zg-combat-economy button>i img\{width:52px;height:52px\}/, 'combat toolbar icons must be enlarged');
assert.match(html, /\.zg-combat-economy button>b\{margin-top:2px;[^}]*font-size:10px/, 'combat toolbar labels must be enlarged before the shared readability scale');
assert.match(html, /\.zg-combat-economy button>i,\.zg-combat-economy button>b,\.zg-combat-economy button>small\{position:relative;top:-3px\}/, 'combat toolbar art and copy must sit above the lower clipping edge');
assert.match(html, /\.zg-combat-economy button>b\{margin-top:2px;color:#ead29a;/, 'combat toolbar labels must remain bright against the dark toolbar');
assert.match(html, /\.zg-combat-economy \.zg-combat-movement-points\.exhausted\{color:#ff6868;/, 'spent movement must show a clearly red zero');
assert.match(html, /class="zg-combat-movement-points'\+\(movementUnavailable\?' exhausted':''\)\+'"/, 'movement points must expose their exhausted state to the presentation layer');
assert.match(html, /\.zg-combat-economy\.long-action-menu,\.zg-combat-economy\.ability-palette\{\s*width:min\(1240px/, 'nested combat toolbars must expand rather than clip their text');
assert.match(html, /\.zg-move-requests\{[\s\S]*?width:min\(430px/, 'the requests panel must widen for 130 percent copy');
assert.match(html, /\.zg-move-request-actions button\{[\s\S]*?min-height:41px/, 'request decisions must keep readable touch targets');
assert.match(html, /\.zg-action-request-detail>article\{width:min\(920px/, 'the full request dialog must reflow into a wider card');
assert.match(html, /\.zg-combat-save\{z-index:10056;width:min\(920px/, 'saving throw assignment must have room for larger controls');
assert.match(html, /\.zg-combat-save-stat\{min-height:72px/, 'saving throw stat cards must grow with their text');
assert.match(html, /\.zg-combat-bar\{width:300px/, 'the compact combat clock must widen before its labels are enlarged');
assert.match(html, /\.zg-combat-own-turn\{\s*box-sizing:border-box;width:224px;height:224px;min-width:224px;min-height:224px;/, 'the active-turn notice must remain a true circle after readability scaling');
assert.match(html, /\.zg-combat-own-turn b\{[\s\S]*?font-size:15px/, 'the active-turn hero name must stay readable');
assert.match(html, /\.zg-combat-own-turn small\{[\s\S]*?font-size:11px/, 'the active-turn round label must stay readable');
assert.match(html, /\.zg-combat-own-turn button\{[\s\S]*?min-height:42px[\s\S]*?font-size:11px/, 'the active-turn advance action must remain readable and easy to press');

console.log('combat UI readability contract passed');
