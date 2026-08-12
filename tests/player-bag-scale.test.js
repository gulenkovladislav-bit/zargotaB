'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /zg_player_bag_scale_v1/, 'player bag size preference must persist locally');
assert.match(html, /data-player-bag-scale="normal"[\s\S]*data-player-bag-scale="large"/, 'settings must expose normal and enlarged bag modes');
assert.match(html, /if\(playerBagScalePreference!=='large'[\s\S]*return 1\.3/, 'enlarged mode must target 130 percent');
assert.match(html, /Math\.max\(1,Math\.min\(1\.3,sideRoom,verticalRoom\)\)/, 'enlarged bag must stay inside the available viewport');
assert.match(html, /\.zg-game-overlay\.gm \.zg-player-bag-settings\{display:none\}/, 'bag size control must be player-only');
assert.match(html, /\.zg-game-gear\{[^}]*z-index:72/, 'settings button must stay above the open bag layer');
assert.match(html, /\.zg-game-overlay\.gm \.zg-game-gear\{z-index:72/, 'GM layout must not lower the shared settings button behind the bag');
assert.match(html, /\.zg-ping-toggle\{[^}]*z-index:72/, 'ping button must stay above the open bag layer');
assert.match(html, /\.zg-vtt-drawer\.backpack-skin\.open\{z-index:36/, 'bag layer contract changed unexpectedly');
assert.match(html, /if\(w\.zgPlayerBagScaleApply\)w\.zgPlayerBagScaleApply\(\);\s*if \(drawer\) drawer\.classList\.add\('open'\)/, 'bag scale must be applied before its opening animation');

console.log('player bag scale contract passed');
