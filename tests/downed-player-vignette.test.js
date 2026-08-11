'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.match(html, /function animateDownedVisual\(event,target\)/, 'downed playback adapter exists');
assert.match(html, /function combatDamageDefeated\(event\)/, 'downed transition has one shared live-event predicate');
assert.match(html, /if\(isDamage&&combatDamageDefeated\(event\)\)animateDownedVisual\(event,target\)/, 'downed visual follows the shared transition predicate');
assert.match(html, /String\(entry\.key\|\|''\)===String\(event\.targetKey\|\|''\)/, 'missing zeroHp flag falls back to the current Firebase combat entry');
assert.match(html, /schedulePlaybackCleanup\(event,'downed-mark-'\+index,2400/, 'downed DOM uses the shared playback scheduler');
assert.match(html, /noteCombatPlayback\(event,'downed'\)/, 'downed playback is observable in diagnostics');
assert.match(html, /class="zg-party-downed-state'\+\(isDead\?' dead':''\)\+'">'\+\(isDead\?'☠ ПОГИБ':'СРАЖЁН'\)/, 'party card distinguishes defeated from confirmed dead');
assert.match(html, /mark\.classList\.toggle\('dead',!!dead\);mark\.textContent=dead\?'☠ ПОГИБ':'СРАЖЁН'/, 'scene token shows a skull only after confirmed death');

var downedStart = html.indexOf('  function animateDownedVisual(event,target)');
var downedEnd = html.indexOf('  function animateDeathSaveVisual(event)', downedStart);
var downedBlock = html.slice(downedStart, downedEnd);
assert.ok(downedStart >= 0 && downedEnd > downedStart, 'downed function is extractable');
assert.doesNotMatch(downedBlock, /ZargotaSound|\.down\(/, 'downed label must not add a second impact sound');
assert.doesNotMatch(downedBlock, /setTimeout\(/, 'downed cleanup must not create an unmanaged timer');

assert.match(html, /function ownDeathSaveCombatEntry\(\)/);
assert.match(html, /session\.role==='master'&&w\.zgGmVisionMode==='players'/, 'GM receives the personal screen only while previewing player vision');
assert.match(html, /w\.zgPossessedPlayerUid\|\|w\.zgCombatLabPlayerUid\|\|gmControlledPlayerUid\(\)/, 'GM preview follows the explicitly represented hero');
assert.match(html, /String\(entry\.uid\|\|''\)===representedUid/, 'vignette belongs only to the represented player');
assert.match(html, /stateName==='death-saves'\|\|stateName==='awaiting-gm'/, 'ambient remains until the death-save state resolves');
assert.match(html, /node\.classList\.toggle\('awaiting-fate',awaiting\)/, 'awaiting fate has a distinct hidden-information ambient state');
assert.match(html, /node\.classList\.toggle\('unconscious',unconscious\)/, 'unconscious fate persists after the one-shot result');
assert.match(html, /node\.classList\.toggle\('dead',dead\)/, 'death fate persists after the one-shot result');
assert.match(html, /голоса судьбы теряются во тьме/, 'player sees deliberately vague fate copy');
assert.match(html, /syncOwnDeathSaveAmbient\(\);/, 'snapshot render synchronizes the persistent ambient layer');
assert.match(html, /ownPlayer\?' own-player':''/, 'the full death ritual distinguishes the owning player');
assert.match(html, /if\(ownPlayer\)syncOwnDeathSaveAmbient\(true\)/, 'coin toss temporarily intensifies the owning player vignette');
assert.match(html, /if\(ownPlayer\)syncOwnDeathSaveAmbient\(false\)/, 'coin completion returns to persistent state');

assert.match(html, /\.zg-death-save-ambient\{position:fixed;z-index:99990;inset:0;overflow:hidden;pointer-events:none/, 'ambient layer is fixed, non-interactive and singleton-friendly');
assert.match(html, /linear-gradient\(90deg,rgba\(25,0,2,\.76\)/, 'ambient darkness is concentrated at the side edges');
assert.match(html, /backdrop-filter:grayscale\(1\) saturate\(0\) brightness\(\.5\)/, 'the represented dead hero sees the battlefield in gray');
assert.match(html, /\.zg-death-ritual\.own-player \.zg-death-ritual-vignette\{background:linear-gradient\(90deg/, 'owning player ritual uses a side vignette');
assert.match(html, /prefers-reduced-motion:reduce\).*\.zg-death-save-ambient \*/, 'pre-death motion respects reduced-motion preference');

console.log('downed and player death-vignette contract passed');
