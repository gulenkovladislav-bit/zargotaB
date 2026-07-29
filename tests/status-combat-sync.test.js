'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var start = network.indexOf('  function combatNumber(');
var end = network.indexOf('  function normalizeRoomCode(', start);
assert.ok(start >= 0 && end > start, 'combat status helper block must remain extractable');

var deterministicMath = Object.create(Math);
deterministicMath.random = function () { return 0; };
var mechanics = [
  {key:'slow',speedMod:-3},
  {key:'shield',acMod:2},
  {key:'curse',attackMod:-2,damageMod:-1},
  {key:'custom-lock',cantAct:true,cantMove:true,cantReact:true},
  {key:'burn',startOfTurnEffect:'damage',startOfTurnDice:'1d4'}
];
var context = {
  Math:deterministicMath,
  Number:Number,
  String:String,
  Object:Object,
  Array:Array,
  JSON:JSON,
  isFinite:isFinite,
  w:{getStatusMechanics:function(){ return mechanics; }}
};
vm.runInNewContext(network.slice(start, end), context);

var effect = context.normalizeStatusEffectInput({
  duration:2,
  acMod:2,
  attackMod:-1,
  damageMod:3,
  speedMod:-2,
  cantMove:true,
  tickType:'damage',
  tickDice:'1d6',
  sourceId:'gm-manual:test'
}, 'test', 'Тест');
assert.strictEqual(effect.statusKey, 'test');
assert.strictEqual(effect.remaining, 2);
assert.strictEqual(effect.tickDice, '1d6');
assert.strictEqual(effect.cantMove, true);
assert.strictEqual(effect.stacks, 1);
assert.strictEqual(effect.visibility, 'public');
var privateStackedEffect = context.normalizeStatusEffectInput({stacks:99,visibility:'gm'}, 'secret', 'Скрытый');
assert.strictEqual(privateStackedEffect.stacks, 20, 'status stacks must be bounded');
assert.strictEqual(privateStackedEffect.visibility, 'gm');

var applied = context.applyStatusDomainOperation(
  {statuses:[],statusEffects:[]},
  {statusKey:'test',enable:true,effect:effect}
);
assert.deepStrictEqual(Array.from(applied.statuses), ['test']);
assert.strictEqual(applied.statusEffects.length, 1);
var removed = context.applyStatusDomainOperation(applied, {statusKey:'test',enable:false});
assert.strictEqual(removed.statuses.length, 0);
assert.strictEqual(removed.statusEffects.length, 0);

var modifiers = context.combatStatusModifiers({
  statuses:['shield','curse'],
  statusEffects:[
    {type:'status',statusKey:'shield',unit:'rounds',remaining:2,acMod:4},
    {type:'status',statusKey:'curse',unit:'manual',attackMod:-3,damageMod:-2}
  ]
});
assert.strictEqual(modifiers.acMod, 4, 'Firebase effect must override local mechanics');
assert.strictEqual(modifiers.attackMod, -3);
assert.strictEqual(modifiers.damageMod, -2);

var restrictions = context.combatRestrictions({statuses:['custom-lock'],statusEffects:[]});
assert.strictEqual(restrictions.blocked.long, true);
assert.strictEqual(restrictions.blocked.short, true);
assert.strictEqual(restrictions.blocked.reaction, true);
assert.strictEqual(restrictions.blocked.movement, true);
assert.strictEqual(context.combatTurnMovement({
  statuses:['slow'],
  statusEffects:[],
  economy:{movementMax:7}
}), 3, 'slow must halve movement without applying its legacy speed modifier twice');

var tick = context.statusTurnTick({
  hp:10,
  hpMax:10,
  tempHp:1,
  statuses:['burn'],
  statusEffects:[{
    type:'status',
    statusKey:'burn',
    label:'Горит',
    unit:'rounds',
    remaining:2,
    tickType:'damage',
    tickDice:'1d4'
  }]
});
assert.strictEqual(tick.hp, 10);
assert.strictEqual(tick.tempHp, 0, 'status tick must consume temporary HP before health');
assert.ok(tick.changes.length, 'status tick must produce a combat note');

var stackedTick = context.statusTurnTick({
  hp:10,
  hpMax:10,
  tempHp:0,
  statuses:['burn'],
  statusEffects:[{
    type:'status',
    statusKey:'burn',
    unit:'rounds',
    remaining:2,
    stacks:2,
    tickType:'damage',
    tickDice:'1d4'
  }]
});
assert.strictEqual(stackedTick.hp, 8, 'each stack must contribute one periodic damage roll');

deterministicMath.random = function () { return 0.99; };
var savedTick = context.statusTurnTick({
  hp:10,
  hpMax:10,
  statuses:['stun'],
  statusEffects:[{
    type:'status',
    statusKey:'stun',
    label:'Оглушён',
    unit:'rounds',
    remaining:2,
    autoRemove:'save_dc',
    saveDC:10,
    saveStat:'con'
  }],
  stats:{con:{cur:0}}
});
assert.strictEqual(savedTick.saves.length, 1);
assert.strictEqual(savedTick.saves[0].success, true);
assert.strictEqual(savedTick.statuses.length, 0, 'successful automatic save must remove the status');
assert.strictEqual(savedTick.statusEffects.length, 0, 'successful automatic save must remove its effect');

var room = {
  scene:{tokens:[{id:'beast-1'}]},
  zones:{crypt:{tokens:[{id:'beast-1'}]}},
  members:{}
};
var updates = {};
context.queueCombatEntryState(room, updates, {
  tokenId:'beast-1',
  hp:7,
  tempHp:2,
  statuses:['burn'],
  statusEffects:[effect]
}, true);
assert.strictEqual(updates['scene/tokens/0/hp'], 7);
assert.strictEqual(updates['zones/crypt/tokens/0/tempHp'], 2);
assert.deepStrictEqual(Array.from(updates['scene/tokens/0/statuses']), ['burn']);

assert.match(html, /function gmStatusCatalog\(\)/);
assert.match(html, /typeof w\.getStatusMechanics==='function'/);
assert.match(html, /effect:enable\?gmStatusEffectPayload\(def\):null/);
assert.match(html, /stacks:1,visibility:'public'/);
assert.match(html, /effect\.visibility==='gm'&&!isMaster/);
assert.match(html, /zgGmInterventionStatusUpdate/);
assert.match(html, /tokenCombatStatuses\(token\).*slice\(0,5\)/s);
assert.match(network, /normalizeStatusEffectInput\(operation\.effect,statusKey,statusLabel\)/);
assert.match(network, /stacks:Math\.max\(1,Math\.min\(20/);
assert.match(network, /autoRemove!=='save_dc'/);
assert.match(network, /queueCombatEntryState\(room,updates,current,true\)/);
assert.match(network, /combatRollMode\(String\(options\.mode\|\|'normal'\),targetModifiers\.grantAdvantageToAttackers,forcedDisadvantage\)/);
assert.match(network, /damageResult\.total\+statBonus\+attackerModifiers\.damageMod/);

console.log('status combat sync contract passed');
