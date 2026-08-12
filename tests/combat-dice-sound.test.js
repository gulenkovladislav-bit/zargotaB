'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function playCombatDiceSound(');
const end = html.indexOf('  function animateCombatAttackResult(', start);
assert.ok(start >= 0 && end > start, 'combat dice sound helper must remain extractable');

const claimed = new Set();
const notes = [];
const scheduled = [];
const calls = [];
const context = {
  Math,
  Number,
  String,
  w:{ZargotaSound:{
    combatDiceRoll(){calls.push('sample-start');},
    diceRollStart(){calls.push('synthetic-start');},
    diceResult(result, sides){calls.push(['result', result, sides]);}
  }},
  claimCombatPlaybackEvent(event, channel){
    const key = channel + ':' + event.id;
    if(claimed.has(key)) return false;
    claimed.add(key);
    return true;
  },
  noteCombatPlayback(event, channel){notes.push([event.id, channel]);},
  schedulePlaybackCleanup(event, cue, delay, callback){scheduled.push({event, cue, delay, callback});return true;}
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

const visualEvent = {id:'combat-damage-result-operation-42'};
assert.strictEqual(context.combatDiceVisualId(visualEvent, 'damage'), 'combat-damage-visual-combat-damage-result-operation-42');
assert.strictEqual(context.combatDiceVisualId(visualEvent, 'damage'), context.combatDiceVisualId(visualEvent, 'damage'), 'one combat phase always reuses the same visual id');
assert.notStrictEqual(context.combatDiceVisualId(visualEvent, 'attack'), context.combatDiceVisualId(visualEvent, 'damage'), 'hit and damage phases keep independent visual channels');

const attack = {id:'combat-hit-result-operation-1',kind:'combat-attack'};
assert.strictEqual(context.playCombatDiceSound(attack, 'attack', 17, 20, 1580), true);
assert.deepStrictEqual(calls, ['sample-start'], 'the licensed rolling sample starts immediately with the local combat die');
assert.strictEqual(scheduled.length, 0, 'the rolling helper does not add a competing synthetic result tone');

assert.strictEqual(context.playCombatDiceSound(attack, 'attack', 17, 20, 1580), false);
assert.strictEqual(scheduled.length, 0, 'a repeated Firebase render cannot schedule a hidden second finale');
assert.deepStrictEqual(calls, ['sample-start'], 'the same combat event remains silent on replay');
assert.deepStrictEqual(notes, [
  ['combat-hit-result-operation-1','dice-attack-start']
]);

const released = {id:'combat-hit-result-operation-2',kind:'combat-attack'};
assert.strictEqual(context.playCombatDiceSound(released, 'attack', 12, 20, 1580, true), true);
assert.deepStrictEqual(calls, ['sample-start'], 'a drag-release sample is not played twice when the event arrives');

const attackStart = html.indexOf('  function animateCombatAttackResult(');
const damageEnd = html.indexOf('  function combatRollOptions(', attackStart);
const combatRollBlock = html.slice(attackStart, damageEnd);
assert.match(combatRollBlock, /playCombatDiceSound\(event,'attack',event\.attackRoll,20,throwMotion\?1580:1250,!!\(throwMotion&&throwMotion\.diceSoundStarted\)\)/, 'attack d20 uses the fast local exactly-once sound path');
assert.match(combatRollBlock, /playCombatDiceSound\(event,'damage',damageItems\[0\]\.value,damageItems\[0\]\.sides,throwMotion\?1580:1250,!!\(throwMotion&&throwMotion\.diceSoundStarted\)\)/, 'damage dice use their real die sides and a separate sound channel');
assert.match(combatRollBlock, /damageRollOptions=Object\.assign\(\{\},rollOptions\|\|\{\},\{scoreKind:'damage'\}\)/, 'damage rolls carry an explicit semantic final-sound kind');
assert.match(combatRollBlock, /attackClientId=combatDiceVisualId\(event,'attack'\)/, 'an attack replay reuses its combat event visual id');
assert.match(combatRollBlock, /damageClientId=combatDiceVisualId\(event,'damage'\)/, 'a damage replay reuses its combat event visual id');
assert.match(combatRollBlock, /throwMotion&&!renderedRollVisuals\[attackClientId\]/, 'a repeated local attack callback cannot reopen a completed visual');
assert.match(combatRollBlock, /throwMotion&&!renderedRollVisuals\[damageClientId\]/, 'a repeated local damage callback cannot reopen a completed visual');
assert.doesNotMatch(combatRollBlock, /combat-(?:hit|damage)-'\+Date\.now/, 'combat roll visuals never mint a fresh id while replaying the same event');
assert.match(html, /playCombatDiceSound\(event,'intent'/, 'short-action checks use the same licensed dice sample');
assert.match(html, /playCombatDiceSound\(event,'save'/, 'saving throws use the same licensed dice sample');

const remoteStart = html.indexOf('  function renderRollAnimations()');
const remoteEnd = html.indexOf('  function renderJournal()', remoteStart);
const remoteBlock = html.slice(remoteStart, remoteEnd);
assert.match(remoteBlock, /if\(!session\|\|ownerUid!==session\.uid\)/, 'the Firebase roll echo remains silent for its local owner');

console.log('combat dice sound exactly-once passed');
