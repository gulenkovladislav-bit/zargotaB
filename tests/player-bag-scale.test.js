'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /zg_player_bag_scale_v1/, 'player bag size preference must persist locally');
assert.match(html, /data-player-bag-scale="normal"[\s\S]*data-player-bag-scale="large"/, 'settings must expose normal and enlarged bag modes');
assert.match(html, /return playerBagScalePreference==='large'\?1\.3:1/, 'enlarged mode must apply the requested 130 percent without collapsing back to 100 percent');
assert.match(html, /drawer\.setAttribute\('data-player-bag-scale',playerBagScalePreference\)/, 'bag element must retain its scale mode across panel rerenders');
assert.match(html, /\.zg-vtt-drawer\.backpack-skin\[data-player-bag-scale="large"\]\{--bag-user-scale:1\.3/, 'CSS must provide a durable 130 percent enlarged mode');
assert.match(html, /if\(w\.zgSyncPlayerDockBagLayout\)w\.zgSyncPlayerDockBagLayout\(\);/, 'switching bag size must immediately restore or apply toolbar docking');
assert.doesNotMatch(html, /\.zg-game-overlay\.gm \.zg-player-bag-settings\{display:none\}/, 'GM must also receive the bag size control');
assert.match(html, /function playerBagScaleBind\(\)[\s\S]*closest\('\[data-player-bag-scale\]'\)[\s\S]*zgPlayerBagScaleSet/, 'bag size cards must use a stable delegated click handler');
assert.match(html, /\.zg-player-bag-settings\{[^}]*pointer-events:auto/, 'bag size panel must accept pointer input above overlapping layers');
assert.match(html, /\.zg-game-gear\{[^}]*z-index:72/, 'settings button must stay above the open bag layer');
assert.match(html, /\.zg-game-overlay\.gm \.zg-game-gear\{z-index:72/, 'GM layout must not lower the shared settings button behind the bag');
assert.match(html, /\.zg-ping-toggle\{[^}]*z-index:72/, 'ping button must stay above the open bag layer');
assert.match(html, /\.zg-vtt-drawer\.backpack-skin\.open\{z-index:36/, 'bag layer contract changed unexpectedly');
assert.match(html, /if\(w\.zgPlayerBagScaleApply\)w\.zgPlayerBagScaleApply\(\);\s*if \(drawer\) drawer\.classList\.add\('open'\)/, 'bag scale must be applied before its opening animation');
assert.match(html, /var PLAYER_BAG_TEXT_SCALE=1\.3;/, 'all visible bag text must use the requested 130 percent typography scale');
assert.match(html, /playerBagTypographyCandidates[\s\S]*getComputedStyle\(node\)\.fontSize[\s\S]*item\.size\*PLAYER_BAG_TEXT_SCALE/, 'bag typography must scale measured text without scaling the outer bag frame');
assert.match(html, /function playerBagTypographyFit\(drawer\)[\s\S]*scaled\/PLAYER_BAG_TEXT_SCALE/, 'scaled bag text must preserve its readable pre-scale size as the fitting floor');
assert.match(html, /while\(size>floor&&!playerBagTypographyFits\(node,host\)\)/, 'text size must only step back when its actual field overflows');
assert.match(html, /hasOwnBox=node\.clientWidth>0&&node\.clientHeight>0[\s\S]*node\.scrollWidth<=node\.clientWidth\+1/, 'visible text boxes must be measured before overflow clipping can hide large numbers');
assert.match(html, /playerBagTypographyFit\(drawer\);[\s\S]*data-zg-bag-text-scale/, 'overflow fitting must run after the shared 130 percent typography pass');
assert.match(html, /style\.setProperty\('font-size',[\s\S]*'important'\)/, 'bag typography must override legacy fixed font sizes consistently');
assert.match(html, /if\(backpackPanels\[activePanel\]\)\{[\s\S]*zgPlayerBagTypographyApply/, 'every bag panel rerender must reapply readable typography');
assert.doesNotMatch(html, /<aside class="zg-vtt-drawer" id="zg-vtt-drawer">[\s\S]*?<button type="button" class="zg-vtt-panel-close" onclick="zgVttCloseDrawer\(\)"/, 'the top-right bag close cross must be removed from the drawer markup');

console.log('player bag scale contract passed');
