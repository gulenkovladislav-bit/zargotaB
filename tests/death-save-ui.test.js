'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /function combatDeathSaveCard\(/);
assert.match(html, /ТРЕБУЕТСЯ РУЧНОЙ БРОСОК/);
assert.match(html, /images\/vtt-dice\/d20\.png/);
assert.match(html, /onclick="zgCombatDeathSaveRoll\(\)"/);
assert.match(html, /0–9 — провал, 10–20 — успех/);
assert.match(html, /Натуральные 1 и 20 дают по два/);
assert.match(html, /deathRollRequired\?'disabled title="Сначала бросьте d20 борьбы за жизнь"'/);
assert.match(html, /w\.zgCombatDeathSaveRoll=function\(\)/);
assert.match(network, /rollDeathSave: function \(participantKey\)/);
assert.match(network, /death-save-required/);
assert.match(network, /death-save-already-rolled/);

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
