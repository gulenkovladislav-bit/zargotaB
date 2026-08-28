'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  html,
  /\.zg-vtt-party\.combat\{gap:15px;overflow-x:auto;overflow-y:hidden;padding:12px 16px 20px;scroll-padding-inline:16px\}/,
  'combat party strip reserves space for initiative circles, exact HP bars and current-turn translation'
);
assert.match(html, /\.zg-party-init\{position:absolute;z-index:3;left:-8px;top:-7px;width:24px;height:24px/, 'initiative badge geometry remains unchanged');
assert.match(html, /\.zg-party-card\.current-turn\{transform:translateY\(5px\)/, 'active-card treatment remains unchanged');
assert.match(html, /\.zg-party-hp\.exact\{position:relative;height:12px/, 'exact HP bar remains readable');
assert.match(html, /@media\(max-width:1100px\)\{[\s\S]*?\.zg-game-overlay\.gm \.zg-vtt-party\.combat\{left:422px\}/, 'tablet combat portraits start after the enlarged combat clock');
assert.match(html, /@media\(max-width:760px\)\{\s*\.zg-game-overlay\.gm \.zg-vtt-party\.combat\{left:8px;right:8px;top:154px\}/, 'phone combat portraits move below the compact combat clock');

console.log('party card overflow contract passed');
