'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'gm-cues.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'gm-cues.css'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /gm-cues\.css\?v=/, 'the cue stylesheet must be loaded');
assert.match(html, /gm-cues\.js\?v=/, 'the cue runtime must be loaded');
assert.match(html, /class="zg-scene-publish zg-gm-cue-button"[^>]+onclick="zgCueToggle\(\)"/, 'the GM toolbar needs a cue-library button');

assert.match(ui, /zargota_gm_cue_presets_v1/, 'GM presets must use a dedicated persistent library');
assert.match(ui, /id=\"zg-cue-message\"/, 'the message field must not reuse the composer container id');
assert.match(ui, /selectedTargets/, 'the composer must keep a multi-recipient selection');
assert.match(ui, /zgCueTargetsAll/, 'the composer must provide an all-player shortcut');
assert.match(ui, /imageSrc/, 'image content must be supported');
assert.match(ui, /audioSrc/, 'audio content must be supported');
assert.match(ui, /play\(\).*catch/, 'blocked autoplay must be handled');
assert.match(ui, /zg-cue-audio-fallback/, 'blocked audio must have a custom retry control');
assert.match(ui, /sessionStorage\.setItem\(SEEN_KEY/, 'cue playback must be claimed exactly once per tab');
assert.match(ui, /recipientUids\.map\(String\)\.indexOf/, 'player playback must be filtered by recipient UID');
assert.doesNotMatch(ui, /\b(?:alert|confirm|prompt)\s*\(/, 'native browser dialogs are forbidden');

assert.match(network, /gmBroadcastCue:\s*function\s*\(recipientUids, value\)/, 'the room API must expose GM cue broadcasting');
assert.match(network, /session\.role!==['"]master['"]/, 'only the GM may broadcast a cue');
assert.match(network, /member&&member\.role===['"]player['"]/, 'recipients must resolve to room players');
assert.match(network, /cueEvent:event/, 'the room must receive a single shared cue event');
assert.match(network, /recipientUids:targets/, 'the event must retain its explicit audience');
assert.match(network, /cue-image-large/, 'image payloads need a size guard');
assert.match(network, /cue-audio-large/, 'audio payloads need a size guard');

assert.match(css, /\.zg-cue-panel/, 'the custom cue composer must be styled');
assert.match(css, /\.zg-cue-player-overlay/, 'the player presentation overlay must be styled');
assert.match(css, /%3C\/svg%3E\"\);min-width:/, 'the toolbar icon data URL must close before the remaining cue styles');
assert.match(css, /@media\(max-width:680px\)/, 'the composer must have a compact layout');

console.log('gm-cues.test.js: all assertions passed');
