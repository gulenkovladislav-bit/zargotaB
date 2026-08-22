'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /role="tablist" aria-label="Разделы настроек"/, 'settings expose compact semantic sections');
assert.match(html, /data-game-panel-tab="general"[\s\S]*data-game-panel-tab="workshop"[\s\S]*data-game-panel-tab="effects"[\s\S]*data-game-panel-tab="optimization"/, 'general, workshop, effects and optimization tabs stay explicit');
assert.match(html, /data-game-panel-pane="general"[\s\S]*data-game-panel-pane="workshop"[\s\S]*data-game-panel-pane="effects"[\s\S]*data-game-panel-pane="optimization"/, 'each tab owns a stable pane instead of rebuilding the panel');
var effectsPaneStart = html.indexOf('<div class="zg-game-settings-pane" data-game-panel-pane="effects"');
var optimizationPaneStart = html.indexOf('<div class="zg-game-settings-pane" data-game-panel-pane="optimization"');
var effectsPane = html.slice(effectsPaneStart, optimizationPaneStart);
var optimizationPane = html.slice(optimizationPaneStart, html.indexOf('id="zg-game-settings-resize"', optimizationPaneStart));
assert.match(effectsPane, /zgCombatFxBrowserOpen/, 'effects tab keeps the live visual library');
assert.doesNotMatch(effectsPane, /data-combat-motion=/, 'performance controls are moved out of the visual effects library');
assert.match(optimizationPane, /id="zg-performance-monitor"/, 'optimization tab exposes live performance diagnostics');
assert.match(optimizationPane, /data-combat-motion="dynamic"/, 'combat motion settings live in optimization');
assert.match(optimizationPane, /data-combat-quality="auto"/, 'effect quality settings live in optimization');
assert.match(optimizationPane, /data-reduced-effects="auto"/, 'reduced effects has an explicit optimization control');
assert.match(html, /function\(\)\{\s*var resizing=null;/, 'settings resize state is isolated from render state');
assert.match(html, /closest\('#zg-game-settings-resize'\)/, 'the resize handle starts a pointer drag');
assert.match(html, /panel\.style\.width=clamp\(resizing\.width-\(ev\.clientX-resizing\.x\),minWidth,maxWidth\)\+'px'/, 'left-edge drag resizes width with readable viewport bounds');
assert.match(html, /panel\.style\.height=clamp\(resizing\.height\+\(ev\.clientY-resizing\.y\),minHeight,maxHeight\)\+'px'/, 'bottom-edge drag resizes height with readable viewport bounds');
assert.match(html, /\.zg-game-settings-pane\{[^}]*overflow:auto/, 'only the active settings content scrolls');
assert.match(html, /\.zg-game-settings-tabs\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, 'four settings tabs share the available width');
assert.match(html, /\.zg-game-settings,\.zg-game-overlay\.gm \.zg-game-settings\{width:min\(760px,calc\(100vw - 32px\)\);height:min\(1010px,calc\(100vh - 82px\)\)/, 'settings open at the large readable desktop size for players and GM');
assert.match(html, /\.zg-game-settings-resize\{left:12px;bottom:12px;width:38px;height:38px;border:1px solid #735a2d;border-radius:50%/, 'resize control is a compact circular grip instead of a bare corner bracket');
assert.match(html, /\.zg-qa-workshop-hint\{font-size:13px\}/, 'Workshop explanatory text keeps a readable font floor');
assert.match(html, /class="zg-qa-workshop-maintenance"/, 'Workshop maintenance actions have their own visual group');
assert.match(html, /\.zg-party-round-gear\{position:absolute;z-index:14;top:2px;right:2px;/, 'GM portrait gear stays inside the portrait clipping boundary');

console.log('game settings layout contract passed');
