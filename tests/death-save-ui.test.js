'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /function combatDeathSaveCard\(/);
assert.match(html, /БРОСОК МОНЕТЫ/);
assert.match(html, /images\/vtt-dice\/death-coin-life-v2\.png/);
assert.match(html, /images\/vtt-dice\/death-coin-death-v2\.png/);
assert.match(html, /zg-death-ritual/);
assert.match(html, /deathCoinToss/);
assert.match(html, /deathCoinReveal/);
assert.match(html, /deathRevealDelay=fateDecision\?\(sessionReducedEffects\(\)\?40:260\):\(sessionReducedEffects\(\)\?180:1600\)/, 'coin toss keeps the full reveal delay while the non-coin GM fate result reveals promptly');
assert.match(html, /claimCombatPlaybackEvent\(event,'death-sound-toss'\)/, 'coin toss audio owns an exactly-once channel');
assert.match(html, /claimCombatPlaybackEvent\(event,'death-sound-reveal'\)/, 'coin reveal audio owns a separate exactly-once channel');
assert.match(html, /claimCombatPlaybackEvent\(event,'visual'\).*noteCombatPlayback\(event,combatCreatureDeathEvent\(event\)\?'creature-death-local':'death-ritual'\).*animateDeathSaveVisual\(event\)/, 'the rolling client selects compact creature death or the hero ritual without waiting for a second Firebase render');
assert.match(html, /if\(combatCreatureDeathEvent\(event\)\)\{animateCreatureDeathVisual\(event\);return;\}/, 'confirmed creature death never reaches the fullscreen ritual');
assert.doesNotMatch(html, /claimCombatVisualEvent\(/, 'death saves must not call the removed legacy visual claimant');
assert.match(html, /audio\/vtt-actions\/coin-flip\.mp3/);
assert.match(html, /audio\/vtt-actions\/heartbeat-short\.mp3/);
assert.match(html, /audio\/vtt-actions\/life-full-success\.mp3/);
assert.match(html, /audio\/vtt-actions\/life-final-failure\.mp3/);
assert.match(html, /audio\/vtt-actions\/attack-swing\.mp3/);
assert.match(html, /audio\/vtt-actions\/hit-armor\.mp3/);
assert.match(html, /audio\/vtt-actions\/hit-body-heavy\.mp3/);
assert.match(html, /onclick="zgCombatDeathSaveRoll\(\)"/);
assert.match(html, /Шансы 50 на 50/);
assert.match(html, /deathRollRequired\?'disabled title="Сначала подбросьте монету борьбы за жизнь"'/);
assert.match(html, /w\.zgCombatDeathSaveRoll=function\(\)/);
assert.match(html, /w\.zgGmDeathCoinForce=function/);
assert.match(html, /w\.zgGmDeathOutcome=function/);
assert.match(html, /state==='awaiting-gm'/);
assert.match(html, /setTimeout\(function\(\)\{if\(snapshot\)render\(snapshot\);resolve\(\);\},1550\)/);
assert.match(html, /revealing=.*revealAt/);
assert.match(html, /Монета в воздухе/);
assert.match(html, /claimCombatPlaybackEvent\(event,'visual'\)/);
assert.match(network, /rollDeathSave: function \(participantKey\)/);
assert.match(network, /forcedCoin==='life'\?2:forcedCoin==='death'\?1:rollDie\(2\)/);
assert.match(network, /gmSetNextDeathCoin: function/);
assert.match(network, /gmResolveDeathOutcome: function/);
assert.match(network, /state='awaiting-gm'/);
assert.match(network, /revealAt:stamp\+1450/);
assert.match(network, /death-save-required/);
assert.match(network, /death-save-already-rolled/);
assert.match(html, /\.zg-death-gm-secret button,.zg-death-gm-outcome button\{min-width:0;/, 'GM death controls must not inherit the global 292px roll-button width');
assert.match(html, /button\.zg-death-coin\{box-sizing:border-box;display:grid;grid-template-rows:78px 16px;place-items:center;gap:0;width:92px;min-width:92px;/, 'death coin keeps its compact grid contract at desktop and zoomed responsive widths');
assert.match(html, /72%\{transform:translateY\(-3vh\) rotateY\(1740deg\)/, 'the restored ritual keeps its settling bounce before reveal');
assert.match(html, /zg-death-ritual\.death \.zg-death-ritual-particles i/, 'failure uses a distinct red particle treatment');
assert.match(html, /zg-death-ritual\.stabilized \.zg-death-ritual-vignette/, 'final stabilization has its own visual state');

var beginStart = network.indexOf('    beginCombatTurns: function ()');
var beginEnd = network.indexOf('    advanceCombat: function', beginStart);
var beginBlock = network.slice(beginStart, beginEnd);
assert.strictEqual(
  beginBlock.indexOf('resolveDeathSaveState(') >= 0,
  false,
  'starting combat must never roll a death save automatically'
);
var advanceStart = beginEnd;
var advanceEnd = network.indexOf('    rollDeathSave: function', advanceStart);
var advanceBlock = network.slice(advanceStart, advanceEnd);
assert.strictEqual(
  advanceBlock.indexOf('resolveDeathSaveState(') >= 0,
  false,
  'advancing a turn must only require the manual roll, never perform it'
);

console.log('manual death-save UI contract passed');
