'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

assert.match(html, /overlay\.classList\.toggle\('gm-player-preview', !gm && isMaster\)/, 'the overlay exposes a dedicated player-preview presentation state');
assert.match(html, /document\.body\.classList\.toggle\('zg-gm-player-preview',!gm&&isMaster\)/, 'portaled GM dialogs inherit the preview state through the document body');
assert.match(html, /\['zg-scene-drawer','zg-scene-settings','zg-overview-panel','zg-fog-panel','zg-zones-panel','zg-game-settings','zg-scene-gm-note','zg-cue-panel'\]/, 'entering preview closes every open GM editor panel');
assert.match(html, /if\(w\.zgGmInterventionToggle\)w\.zgGmInterventionToggle\(null,false\)/, 'the open or minimized GM intervention panel closes on entry');
assert.match(html, /if\(w\.zgBagCalToggle\)w\.zgBagCalToggle\(null,false\)/, 'the bag calibrator closes on entry');
assert.match(html, /if\(w\.zgSpellPlaybackToggle\)w\.zgSpellPlaybackToggle\(false\)/, 'spell automation closes on entry');
assert.match(html, /if\(w\.zgMovementRequestsToggle\)w\.zgMovementRequestsToggle\(false\)/, 'GM request panel closes on entry');
assert.match(html, /\.gm-player-preview \.zg-gm-actions>:not\(\.zg-vision-gear\)\{display:none!important\}/, 'only the return-from-preview control stays visible');
assert.match(html, /\.gm-player-preview::before\{display:none\}/, 'the GM workspace strip is removed from player preview');
assert.match(html, /\.gm-player-preview \.zg-spell-playback-toggle,[\s\S]*?\.gm-player-preview \.zg-spell-playback,[\s\S]*?\{display:none!important\}/, 'automated spell playback is not rendered in player preview');
assert.match(html, /\.gm-player-preview \.zg-scene-gm-note,[\s\S]*?\.gm-player-preview \.zg-scene-drawer,/, 'persisted GM notes and scene library cannot reappear after reload');
assert.match(html, /body\.zg-gm-player-preview:has\(#zg-game-overlay\.open\.gm-player-preview\) #zg-scene-gm-note,[\s\S]*?body\.zg-gm-player-preview:has\(#zg-game-overlay\.open\.gm-player-preview\) #zg-scene-drawer,/, 'portaled GM dialogs stay hidden outside the overlay tree while the game is open');
assert.match(html, /\.gm-player-preview \.zg-gm-intervention,[\s\S]*?\.gm-player-preview \.zg-bag-cal-floating\{display:none!important\}/, 'bag calibration and the GM intervention surface cannot render in player preview');
assert.match(html, /function bagCalCanEdit\(\)\{[\s\S]*?w\.zgGmVisionMode!==['"]players['"]/, 'bag calibration access is revoked while the master previews the player surface');

assert.match(html, /function gmPlayerPreviewActive\(session\)/);
assert.match(html, /function presentationIsMaster\(session\)/);
assert.match(html, /function presentationSession\(session\)/);
assert.match(html, /var viewSession=presentationSession\(session\),masterSurface=presentationIsMaster\(session\)/, 'party portrait presentation uses the represented player');
assert.match(html, /masterRoundControl=masterSurface/, 'GM round controls do not leak into player preview');
assert.match(html, /event\.visibility==='gm'&&!presentationIsMaster\(session\)/, 'GM-only journal events remain hidden');
assert.match(html, /event\.revealResult===false&&!presentationIsMaster\(session\)/, 'hidden rolls remain hidden');
assert.match(html, /event\.visibility==='gm'&&!presentationIsMaster\(adjustmentSession\)/, 'GM-only adjustment VFX do not leak into preview');
assert.match(html, /w\.zgVttRefreshPresentation=function\(\)\{renderParty\(\);renderDrawer\(true\);renderJournal\(\);renderCombat\(\);syncOwnDeathSaveAmbient\(\);\}/, 'switching view immediately refreshes privacy and death presentation');

console.log('GM player-preview parity contract passed');
