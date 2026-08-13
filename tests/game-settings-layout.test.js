'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /role="tablist" aria-label="Разделы настроек"/, 'settings expose compact semantic sections');
assert.match(html, /data-game-panel-tab="general"[\s\S]*data-game-panel-tab="workshop"[\s\S]*data-game-panel-tab="effects"/, 'general, workshop and effects tabs stay explicit');
assert.match(html, /data-game-panel-pane="general"[\s\S]*data-game-panel-pane="workshop"[\s\S]*data-game-panel-pane="effects"/, 'each tab owns a stable pane instead of rebuilding the panel');
assert.match(html, /function\(\)\{\s*var resizing=null;/, 'settings resize state is isolated from render state');
assert.match(html, /closest\('#zg-game-settings-resize'\)/, 'the resize handle starts a pointer drag');
assert.match(html, /panel\.style\.width=clamp\(resizing\.width-\(ev\.clientX-resizing\.x\),300,maxWidth\)\+'px'/, 'left-edge drag resizes width with viewport bounds');
assert.match(html, /panel\.style\.height=clamp\(resizing\.height\+\(ev\.clientY-resizing\.y\),300,maxHeight\)\+'px'/, 'bottom-edge drag resizes height with viewport bounds');
assert.match(html, /\.zg-game-settings-pane\{[^}]*overflow:auto/, 'only the active settings content scrolls');
assert.match(html, /\.zg-party-round-gear\{position:absolute;z-index:14;top:2px;right:2px;/, 'GM portrait gear stays inside the portrait clipping boundary');

console.log('game settings layout contract passed');
