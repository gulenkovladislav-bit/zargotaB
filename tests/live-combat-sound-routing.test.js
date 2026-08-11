'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('  function combatSoundProfile(event)');
const end = html.indexOf('  function liveCombatAbilityPreset(event,tone)', start);
assert.ok(start >= 0 && end > start, 'live combat sound routing helpers must remain extractable');

const claimed = new Set();
const notes = [];
const calls = [];
const context = {
  String,
  Number,
  Array,
  state:{room:{combat:{order:[{key:'hero-1',hp:0,hpMax:12}]}}},
  w:{ZargotaSound:{
    combatAttackWindup(profile){calls.push(['windup', profile]);},
    combatAttackMiss(profile){calls.push(['miss', profile]);},
    combatDamageImpact(profile, critical, fatal){calls.push(['impact', profile, critical, fatal]);},
    combatHealing(){calls.push(['heal']);},
    damage(){calls.push(['damage']);},
    status(){calls.push(['status']);}
  }},
  claimCombatPlaybackEvent(event, channel){
    const key = channel + ':' + event.id;
    if(claimed.has(key)) return false;
    claimed.add(key);
    return true;
  },
  noteCombatPlayback(event, channel){notes.push([event.id, channel]);}
};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

assert.strictEqual(context.combatSoundProfile({weapon:'Длинный лук'}), 'arrow');
assert.strictEqual(context.combatSoundProfile({weapon:'Магический луч'}), 'magic');
assert.strictEqual(context.combatSoundProfile({weapon:'Длинный меч'}), 'physical');
assert.strictEqual(context.combatSoundProfile({weapon:'Метательный молот',distanceCells:5}), 'physical', 'distance alone must not invent an arrow sample');

const hit = {id:'combat-hit-result-op-1',kind:'combat-attack',hit:true,weapon:'Длинный меч'};
assert.strictEqual(context.playCombatAttackWindupSound(hit), true);
assert.strictEqual(context.playCombatAttackWindupSound(hit), false, 'Firebase replay cannot repeat windup');
assert.strictEqual(context.playCombatOutcomeSound(hit, false), false, 'confirmed hit stays silent until damage phase');

const arrowMiss = {id:'combat-hit-result-op-2',kind:'combat-attack',hit:false,weapon:'Короткий лук'};
assert.strictEqual(context.playCombatOutcomeSound(arrowMiss, false, true), false, 'hidden creature result must not leak through a miss sample');
assert.strictEqual(context.playCombatOutcomeSound(arrowMiss, false), true);
assert.strictEqual(context.playCombatOutcomeSound(arrowMiss, false), false, 'miss sample is exactly once');

const magicMiss = {id:'combat-hit-result-op-3',kind:'combat-attack',hit:false,weapon:'Магический луч'};
assert.strictEqual(context.playCombatOutcomeSound(magicMiss, false), true);

const criticalMiss = {id:'combat-hit-result-op-4',kind:'combat-attack',hit:false,attackRoll:1,weapon:'Длинный меч'};
assert.strictEqual(context.playCombatOutcomeSound(criticalMiss, false), false, 'natural one owns the quiet gong and cannot stack a sword miss');

const damage = {id:'combat-damage-result-op-1',kind:'combat-damage',critical:false,weapon:'Длинный меч'};
assert.strictEqual(context.playCombatOutcomeSound(damage, true), true);
assert.strictEqual(context.playCombatOutcomeSound(damage, true), false, 'damage impact is exactly once');

const critical = {id:'combat-damage-result-op-2',kind:'combat-damage',critical:true,weapon:'Топор'};
assert.strictEqual(context.playCombatOutcomeSound(critical, true), true);

const fatalMagic = {id:'combat-damage-result-op-3',kind:'combat-damage',critical:false,zeroHp:true,weapon:'Магический луч'};
assert.strictEqual(context.playCombatOutcomeSound(fatalMagic, true), true);

const fatalFromLiveState = {id:'combat-damage-result-op-4',kind:'combat-damage',critical:false,beforeHp:3,targetKey:'hero-1',weapon:'Длинный меч'};
assert.strictEqual(context.combatDamageDefeated(fatalFromLiveState), true, 'live HP transition detects defeat even if zeroHp flag is absent');
assert.strictEqual(context.playCombatOutcomeSound(fatalFromLiveState, true), true);
assert.strictEqual(context.playCombatOutcomeSound(fatalFromLiveState, true), false, 'derived defeat impact is exactly once');

const healing = {id:'combat-ability-op-1',kind:'combat-ability',heal:8,ability:'Лечащее заклинание'};
assert.strictEqual(context.playCombatAbilitySound(healing, 'heal'), true);
assert.strictEqual(context.playCombatAbilitySound(healing, 'heal'), false, 'healing sample is exactly once');

assert.deepStrictEqual(calls, [
  ['windup','physical'],
  ['miss','arrow'],
  ['miss','magic'],
  ['impact','physical',false,false],
  ['impact','physical',true,false],
  ['impact','magic',false,true],
  ['impact','physical',false,true],
  ['heal']
]);
assert.ok(notes.some(note => note[1] === 'damage-impact-sound'));
assert.ok(notes.some(note => note[1] === 'attack-miss-sound'));

const soundBlock = html.slice(html.indexOf('  var Sound = {'), html.indexOf('  w.ZargotaSound = Sound;'));
assert.match(soundBlock, /combatDiceRoll:.*sampleSources\.diceRoll/s);
assert.match(soundBlock, /combatAttackMiss:.*sampleSources\.attackMissArrow.*sampleSources\.attackMissMagic/s);
assert.match(soundBlock, /combatAttackMiss:.*sampleSources\.d20AttackMiss/s, 'physical misses use the selected recorded sword clash');
assert.match(soundBlock, /combatDamageImpact:.*Sound\.crit\(\).*Sound\.hit\(\)/s);
assert.match(soundBlock, /combatDamageImpact:.*fatal\)Sound\.down\(\)/s, 'physical defeat replaces the ordinary hit with one defeat cue');
assert.match(soundBlock, /combatHealing:.*sampleSources\.healingMagic/s);
assert.doesNotMatch(html.slice(start, end), /combatBlock|attackSlash|hitArmor|hitPunch/, 'unreliable block/slash/armor/punch semantics stay unrouted');

console.log('live combat sound routing exactly-once passed');
