'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
[
  'blood-token-atlas-a-v2.webp','blood-token-atlas-b-v2.webp',
  'blood-portrait-atlas-a-v2.webp','blood-portrait-atlas-b-v2.webp',
  'blood-state-atlas-a-v2.webp','blood-state-atlas-b-v2.webp'
].forEach(function(file){
  assert.ok(fs.existsSync(path.join(root,'images','vtt-effects',file)),file+' must exist');
  assert.match(html,new RegExp(file.replace(/\./g,'\\.')),file+' must be wired to a live surface');
});
assert.match(html,/combatHpPresentation\(/,'HP presentation must own the wound level');
assert.match(html,/combat-wound-1/,'map tokens must receive wound classes');
assert.match(html,/class="zg-state-portrait wound-/,'the large portrait must receive its wound class');
assert.match(html,/portraitHost\.className='wound-/,'the character sheet portrait must receive its wound class');
assert.match(html, /function approvedDamageDiceHtml\(/, 'player damage prompt must render the actual weapon dice');
assert.match(html, /function combatPlayerAttackError\(/, 'player attack UI must explain local range, turn and status failures before sending');
assert.match(html, /function combatAdvanceError\(/, 'end-turn UI must validate turn ownership and manual death saves before writing');
assert.match(html, /var combatAttackTargetKey='',combatAttackTargetTokenId='',combatAttackTargetUid='',combatAttackWeaponId=''/, 'player attack state must preserve target key, token and hero identities independently from the selected weapon');
assert.match(html, /w\.zgCombatAttackWeapon=function\(id\)/, 'player attack panel must allow choosing a weapon');
assert.match(html, /clearCombatAttackTarget\(\);combatAttackError='Нельзя выбрать себя/, 'invalid map targets must clear every stale target identity');
assert.match(html, /request\.status==='damage-requested'/, 'a successful hit must be animated before the damage prompt is enabled');
assert.match(html, /zg-approved-attack-dice\.multi/, 'multiple damage dice must have a readable non-overlapping layout');
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
  {key:'burn',startOfTurnEffect:'damage',startOfTurnDice:'1d4'},
  {key:'poison',startOfTurnEffect:'damage',startOfTurnValue:1,attackDisadvantage:true,abilityCheckDisadvantage:true},
  {key:'bleed',startOfTurnEffect:'damage',startOfTurnValue:1},
  {key:'blind',attackDisadvantage:true,grantAdvantageToAttackers:true}
];
var context = {
  Math:deterministicMath,
  Number:Number,
  String:String,
  Object:Object,
  Array:Array,
  JSON:JSON,
  isFinite:isFinite,
  w:{getStatusMechanics:function(){ return mechanics; }},
  now:function(){ return 1700000000000; },
  rememberActionOperation:function(existing,operationId,timestamp){
    var next=Object.assign({},existing||{});next[operationId]=timestamp;return next;
  }
};
vm.runInNewContext(network.slice(start, end), context);

var enteredZeroHp = context.syncCombatZeroHp({hp:0}, 6, 'enemy:test', 1700000000000);
assert.strictEqual(enteredZeroHp.zeroHp.pending, true);
assert.strictEqual(enteredZeroHp.zeroHp.successes, 0);
assert.strictEqual(enteredZeroHp.zeroHp.failures, 0);
var deathCoin = context.resolveDeathSaveState(enteredZeroHp.zeroHp, 1, 2, 1700000000100);
assert.strictEqual(deathCoin.failures, 1, 'the death face adds one failure');
assert.strictEqual(deathCoin.lastOutcome, 'failure');
var firstLifeCoin = context.resolveDeathSaveState(deathCoin, 2, 3, 1700000000200);
assert.strictEqual(firstLifeCoin.successes, 1, 'the life face adds one success');
assert.strictEqual(firstLifeCoin.lastOutcome, 'success');
var secondLifeCoin = context.resolveDeathSaveState(firstLifeCoin, 2, 4, 1700000000300);
var thirdLifeCoin = context.resolveDeathSaveState(secondLifeCoin, 2, 5, 1700000000400);
var stabilizedSave = context.resolveDeathSaveState(thirdLifeCoin, 2, 6, 1700000000500);
assert.strictEqual(stabilizedSave.state, 'stabilized');
assert.strictEqual(stabilizedSave.pending, false);
var fatalSave = context.resolveDeathSaveState({pending:true,state:'death-saves',failures:3}, 1, 7, 1700000000600);
assert.strictEqual(fatalSave.state, 'awaiting-gm');
assert.strictEqual(fatalSave.failures, 4);
assert.strictEqual(context.syncCombatZeroHp({hp:3,zeroHp:stabilizedSave}, 0, 'heal', 1700000000700).zeroHp, null, 'healing above zero clears death-save state');

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
assert.strictEqual(effect.durationUnit, 'rounds');
assert.strictEqual(effect.remainingRounds, 2);
assert.match(effect.effectId, /^status-test-[0-9a-f]{8}$/, 'network normalization must assign a stable effectId');
var normalizedPoison = context.normalizeStatusEffectInput({
  tickType:'damage',
  tickDice:'1d4'
}, 'poison', 'Отравлен');
assert.strictEqual(normalizedPoison.tickType, 'damage');
assert.strictEqual(normalizedPoison.tickDice, '', 'legacy poison dice must not survive the new fixed-damage canon');
assert.strictEqual(normalizedPoison.tickValue, 1);
var normalizedBleed = context.normalizeStatusEffectInput({
  tickType:'damage',
  tickDice:'1d8',
  stacks:3
}, 'bleed', 'Кровотечение');
assert.strictEqual(normalizedBleed.tickDice, '');
assert.strictEqual(normalizedBleed.tickValue, 1);
assert.strictEqual(normalizedBleed.stacks, 3);
assert.strictEqual(
  context.normalizeStatusEffectInput({sourceId:'gm-manual:test'}, 'test', 'Тест').effectId,
  context.normalizeStatusEffectInput({sourceId:'gm-manual:test'}, 'test', 'Тест').effectId,
  'the same status source must keep the same effectId across retries'
);
assert.notStrictEqual(
  context.normalizeStatusEffectInput({sourceId:'spell:first'}, 'test', 'Тест').effectId,
  context.normalizeStatusEffectInput({sourceId:'spell:second'}, 'test', 'Тест').effectId,
  'independent sources must not collapse into one effectId'
);
assert.strictEqual(
  context.normalizeStatusEffectInput({effectId:'status-custom-id',sourceId:'spell:first'}, 'test', 'Тест').effectId,
  'status-custom-id',
  'an existing safe effectId must survive normalization'
);
var hourlyEffect = context.normalizeStatusEffectInput({
  unit:'hours',
  duration:4,
  remaining:3
}, 'hourly', 'Часовой');
assert.strictEqual(hourlyEffect.unit, 'hours', 'hour duration must survive network normalization');
assert.strictEqual(hourlyEffect.durationUnit, 'hours');
assert.strictEqual(hourlyEffect.duration, 4);
assert.strictEqual(hourlyEffect.remaining, 3);
assert.strictEqual(hourlyEffect.remainingRounds, null);
var dailyEffect = context.normalizeStatusEffectInput({
  durationUnit:'days',
  durationValue:2
}, 'daily', 'Дневной');
assert.strictEqual(dailyEffect.unit, 'days', 'day duration must survive network normalization');
assert.strictEqual(dailyEffect.remaining, 2);
var manualEffect = context.normalizeStatusEffectInput({
  unit:'manual',
  duration:8,
  remaining:6
}, 'manual', 'До снятия');
assert.strictEqual(manualEffect.unit, 'manual');
assert.strictEqual(manualEffect.duration, null, 'manual status must not retain a misleading numeric duration');
assert.strictEqual(manualEffect.remaining, null);
assert.strictEqual(hourlyEffect.durationMinutes, 240);
assert.strictEqual(hourlyEffect.remainingMinutes, 180);
assert.strictEqual(dailyEffect.durationMinutes, 2880);
assert.strictEqual(dailyEffect.remainingMinutes, 2880);
var legacyRoundEffect = context.normalizeStatusEffectInput({duration:3}, 'legacy', 'Старый');
assert.strictEqual(legacyRoundEffect.unit, 'rounds', 'legacy positive duration without a unit remains round-based');
assert.strictEqual(legacyRoundEffect.remaining, 3);
var privateStackedEffect = context.normalizeStatusEffectInput({stacks:99,visibility:'gm'}, 'secret', 'Скрытый');
assert.strictEqual(privateStackedEffect.stacks, 20, 'status stacks must be bounded');
assert.strictEqual(privateStackedEffect.visibility, 'gm');

var collectedStatuses = context.collectActiveStatusEffects({
  statuses:['BURN','Оглушён'],
  statusEffects:[
    {type:'status',statusKey:'burn',sourceId:'spell:first',stacks:1,unit:'rounds',remainingRounds:2},
    {type:'status',statusKey:'Горит',sourceId:'item:torch',stacks:3,unit:'rounds',remainingRounds:2},
    {type:'status',statusKey:'stun',sourceId:'gm-manual:stun',visibility:'gm',unit:'manual'}
  ]
}, {includeHidden:true});
assert.deepStrictEqual(Array.from(collectedStatuses.keys), ['burn','stun'], 'combat collector must canonicalize structured and legacy keys once');
assert.strictEqual(collectedStatuses.effects.length, 3, 'independent sources of one status must remain distinct');
assert.strictEqual(collectedStatuses.levelsByKey.burn, 3, 'combat collector must preserve the strongest stack level');
var collectedBleeding = context.collectActiveStatusEffects({
  statuses:['bleed'],
  statusEffects:[
    {type:'status',statusKey:'bleed',sourceId:'weapon:first',stacks:1,unit:'rounds',remainingRounds:2},
    {type:'status',statusKey:'bleed',sourceId:'weapon:second',stacks:2,unit:'rounds',remainingRounds:2}
  ]
}, {includeHidden:true});
assert.strictEqual(collectedBleeding.levelsByKey.bleed, 3, 'bleeding stacks from independent sources must add together');
var playerVisibleStatuses = context.collectActiveStatusEffects({
  statuses:['STUN'],
  statusEffects:[{type:'status',statusKey:'stun',sourceId:'gm-manual:stun',visibility:'gm',unit:'manual'}]
}, {includeHidden:false});
assert.strictEqual(playerVisibleStatuses.keys.length, 0, 'hidden structured status must reserve its key and not leak through legacy fallback');

var timedSource = {
  statuses:['hourly','daily','round','manual'],
  statusEffects:[
    {type:'status',statusKey:'hourly',unit:'hours',duration:2,remaining:2,durationMinutes:120,remainingMinutes:90},
    {type:'status',statusKey:'daily',unit:'days',duration:1,remaining:1,durationMinutes:1440,remainingMinutes:1440},
    {type:'status',statusKey:'round',unit:'rounds',duration:2,remaining:2,remainingRounds:2},
    {type:'status',statusKey:'manual',unit:'manual',remaining:null}
  ]
};
var hourAdvance = context.advanceWorldTimedStatusEffects(timedSource, 60);
assert.strictEqual(hourAdvance.changed, true);
assert.strictEqual(hourAdvance.value.statusEffects[0].remainingMinutes, 30, 'world time keeps sub-hour precision');
assert.strictEqual(hourAdvance.value.statusEffects[0].remaining, 1);
assert.strictEqual(hourAdvance.value.statusEffects[1].remainingMinutes, 1380);
assert.strictEqual(hourAdvance.value.statusEffects[2].remainingRounds, 2, 'world time must not consume combat rounds');
assert.strictEqual(hourAdvance.value.statusEffects[3].remaining, null, 'manual status is untouched');
var dayAdvance = context.advanceWorldTimedStatusEffects(timedSource, 1440);
assert.deepStrictEqual(Array.from(dayAdvance.value.statuses), ['round','manual']);
assert.strictEqual(dayAdvance.value.statusEffects.length, 2);

var timedRoom = {
  masterUid:'gm',
  worldClock:{totalMinutes:1380,revision:4,appliedOperationIds:{}},
  members:{player:{character:Object.assign({revision:2},timedSource)}},
  scene:{tokens:[Object.assign({id:'hero-player'},timedSource)]},
  zones:{crypt:{tokens:[Object.assign({id:'hero-player'},timedSource)]}},
  combat:{active:true,round:7,turnIndex:1,order:[Object.assign({key:'hero:player'},timedSource)]}
};
var roomAdvance = context.advanceRoomWorldTimeState(timedRoom, 60, 'world-time-test', 'gm', 1700000000000);
assert.strictEqual(roomAdvance.changed, true);
assert.strictEqual(roomAdvance.room.worldClock.totalMinutes, 1440);
assert.strictEqual(roomAdvance.room.worldClock.day, 2);
assert.strictEqual(roomAdvance.room.worldClock.displayMode, 'phase', 'a room without a saved display choice defaults to time-of-day');
assert.strictEqual(roomAdvance.room.worldClock.lastOperation.beforeMinutes, 1380);
assert.strictEqual(roomAdvance.room.worldClock.lastOperation.afterMinutes, 1440);
assert.strictEqual(roomAdvance.room.worldClock.lastOperation.uid, 'gm');
assert.strictEqual(roomAdvance.room.combat.round, 7, 'world clock transaction must not advance combat round');
assert.strictEqual(roomAdvance.room.combat.turnIndex, 1, 'world clock transaction must not move combat turn');
assert.strictEqual(roomAdvance.room.members.player.character.revision, 3);
assert.strictEqual(roomAdvance.room.scene.tokens[0].statusEffects[0].remainingMinutes, 30);
assert.strictEqual(roomAdvance.room.zones.crypt.tokens[0].statusEffects[0].remainingMinutes, 30);
assert.strictEqual(roomAdvance.room.combat.order[0].statusEffects[0].remainingMinutes, 30);
var duplicateAdvance = context.advanceRoomWorldTimeState(roomAdvance.room, 60, 'world-time-test', 'gm', 1700000000100);
assert.strictEqual(duplicateAdvance.duplicate, true);
assert.strictEqual(duplicateAdvance.room.worldClock.totalMinutes, 1440, 'operationId makes retries idempotent');
assert.strictEqual(duplicateAdvance.room.members.player.character.statusEffects[0].remainingMinutes, 30, 'duplicate world-time operation must not expire a status twice');
assert.strictEqual(duplicateAdvance.room.scene.tokens[0].statusEffects[0].remainingMinutes, 30);
var exactClock = context.setRoomWorldClockState(timedRoom, 1440, 'exact', 'world-clock-exact', 'gm', 1700000000200);
assert.strictEqual(exactClock.room.worldClock.totalMinutes, 1440);
assert.strictEqual(exactClock.room.worldClock.displayMode, 'exact');
assert.strictEqual(exactClock.room.worldClock.calendarId, 'zargota-lvk');
assert.strictEqual(exactClock.room.members.player.character.statusEffects[0].remainingMinutes, 30, 'forward exact-time changes expire timed effects');
var approximateClock = context.setRoomWorldClockState(exactClock.room, 1320, 'phase', 'world-clock-phase', 'gm', 1700000000300);
assert.strictEqual(approximateClock.room.worldClock.totalMinutes, 1320);
assert.strictEqual(approximateClock.room.worldClock.displayMode, 'phase');
assert.strictEqual(approximateClock.room.members.player.character.statusEffects[0].remainingMinutes, 30, 'moving the clock backward never restores or consumes effects');
var duplicateClockSet = context.setRoomWorldClockState(approximateClock.room, 1320, 'phase', 'world-clock-phase', 'gm', 1700000000400);
assert.strictEqual(duplicateClockSet.duplicate, true, 'exact calendar writes must be idempotent');

var normalizedAbilityTarget = context.normalizeAbilityTargeting({
  mode:'token',
  x:140,
  y:-4,
  tokenId:'enemy-1',
  targetKey:'token:enemy-1',
  targetName:'Страж',
  tokenType:'custom',
  distanceCells:999
});
assert.strictEqual(normalizedAbilityTarget.mode, 'token');
assert.strictEqual(normalizedAbilityTarget.x, 100);
assert.strictEqual(normalizedAbilityTarget.y, 0);
assert.strictEqual(normalizedAbilityTarget.targetKey, 'token:enemy-1');
assert.strictEqual(normalizedAbilityTarget.targetName, 'Страж');
assert.strictEqual(normalizedAbilityTarget.distanceCells, 200);
assert.strictEqual(context.normalizeAbilityTargeting({}), null, 'empty spell target must not be persisted');

var applied = context.applyStatusDomainOperation(
  {statuses:[],statusEffects:[]},
  {statusKey:'test',enable:true,effect:effect}
);
assert.deepStrictEqual(Array.from(applied.statuses), ['test']);
assert.strictEqual(applied.statusEffects.length, 1);
var appliedSecondSource = context.applyStatusDomainOperation(applied, {
  statusKey:'test',
  enable:true,
  effect:context.normalizeStatusEffectInput({sourceId:'spell:second'}, 'test', 'Тест')
});
assert.strictEqual(appliedSecondSource.statusEffects.length, 2, 'two independent status sources must coexist');
var retriedFirstSource = context.applyStatusDomainOperation(appliedSecondSource, {
  statusKey:'test',
  enable:true,
  effect:context.normalizeStatusEffectInput({sourceId:'gm-manual:test',stacks:2}, 'test', 'Тест')
});
assert.strictEqual(retriedFirstSource.statusEffects.length, 2, 'retrying one source must replace it instead of duplicating it');
assert.strictEqual(retriedFirstSource.statusEffects.filter(function(item){return item.sourceId==='gm-manual:test';})[0].stacks, 2);
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
var preciseDisadvantage = context.combatStatusModifiers({statuses:['blind'],statusEffects:[]});
assert.strictEqual(preciseDisadvantage.attackDisadvantage, true);
assert.strictEqual(preciseDisadvantage.saveDisadvantage, false, 'attack disadvantage must not silently affect every saving throw');

var restrictions = context.combatRestrictions({statuses:['custom-lock'],statusEffects:[]});
assert.strictEqual(restrictions.blocked.long, true);
assert.strictEqual(restrictions.blocked.short, true);
assert.strictEqual(restrictions.blocked.reaction, true);
assert.strictEqual(restrictions.blocked.movement, true);
assert.deepStrictEqual(
  Array.from(context.combatStatusKeys({statuses:['STUN','Оглушён','Горит','BURN']})),
  ['stun','burn'],
  'legacy uppercase and localized status names must normalize and deduplicate for combat'
);
var localizedRestrictions = context.combatRestrictions({
  statuses:['Паралич'],
  statusEffects:[{type:'status',statusKey:'Паралич',unit:'manual'}]
});
assert.strictEqual(localizedRestrictions.blocked.long, true);
assert.strictEqual(localizedRestrictions.blocked.short, true);
assert.strictEqual(localizedRestrictions.blocked.reaction, true);
assert.strictEqual(localizedRestrictions.blocked.movement, true);
var exhaustedRestrictions = context.combatRestrictions({
  statuses:['exhausted'],
  statusEffects:[{type:'status',statusKey:'exhausted',unit:'manual',stacks:5}]
});
assert.strictEqual(context.combatStatusLevel({
  statuses:['exhausted'],
  statusEffects:[{type:'status',statusKey:'exhausted',unit:'manual',stacks:5}]
}, 'exhausted'), 5);
assert.strictEqual(exhaustedRestrictions.blocked.reaction, true, 'structured exhaustion stacks must drive combat restrictions');
assert.strictEqual(exhaustedRestrictions.blocked.long, true);
assert.strictEqual(exhaustedRestrictions.blocked.short, true);
assert.strictEqual(exhaustedRestrictions.blocked.movement, true);
assert.strictEqual(context.combatTurnMovement({
  statuses:['exhausted'],
  statusEffects:[{type:'status',statusKey:'exhausted',unit:'manual',stacks:2}],
  economy:{movementMax:7}
}), 3, 'exhaustion II must halve movement');
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
assert.strictEqual(tick.impacts.length, 1, 'status tick exposes one structured presentation impact');
assert.deepStrictEqual(JSON.parse(JSON.stringify(tick.impacts[0])), {statusKey:'burn',label:'Горит',type:'damage',amount:1,hpDelta:0,tempHpAbsorbed:1,beforeHp:10,beforeTempHp:1,hp:10,tempHp:0,damageType:'fire'});

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
assert.strictEqual(stackedTick.hp, 9, 'burning always rolls 1d4 once and does not multiply by stacks');

var poisonTick = context.statusTurnTick({
  hp:10,
  hpMax:10,
  tempHp:0,
  statuses:['poison'],
  statusEffects:[{
    type:'status',
    statusKey:'poison',
    unit:'rounds',
    remaining:2,
    stacks:5,
    tickType:'damage',
    tickDice:'1d12'
  }]
});
assert.strictEqual(poisonTick.hp, 9, 'poison must deal exactly 1 damage regardless of stale dice or stacks');
var poisonModifiers = context.combatStatusModifiers({
  statuses:['poison'],
  statusEffects:[{type:'status',statusKey:'poison',attackDisadvantage:false,abilityCheckDisadvantage:false}]
});
assert.strictEqual(poisonModifiers.attackDisadvantage, true, 'poison always gives disadvantage on attacks');
assert.strictEqual(poisonModifiers.abilityCheckDisadvantage, true, 'poison always gives disadvantage on ability checks');

var bleedingTick = context.statusTurnTick({
  hp:10,
  hpMax:10,
  tempHp:0,
  statuses:['bleed'],
  statusEffects:[
    {type:'status',statusKey:'bleed',sourceId:'weapon:first',unit:'rounds',remaining:2,stacks:1,tickType:'damage',tickDice:'1d12'},
    {type:'status',statusKey:'bleed',sourceId:'weapon:second',unit:'rounds',remaining:2,stacks:2,tickType:'damage',tickDice:'1d12'}
  ]
});
assert.strictEqual(bleedingTick.hp, 7, 'bleeding deals 1 damage per accumulated stack');
assert.strictEqual(bleedingTick.impacts[0].amount, 3, 'structured status impact preserves the accumulated damage amount');

var roundExpiry = context.expireTurnStatuses({
  statuses:['burn'],
  statusEffects:[{
    type:'status',
    statusKey:'burn',
    unit:'rounds',
    durationUnit:'rounds',
    duration:3,
    remaining:2,
    remainingRounds:2
  }]
});
assert.strictEqual(roundExpiry.effects[0].remaining, 1, 'combat turn must decrement a round duration');
assert.strictEqual(roundExpiry.effects[0].remainingRounds, 1);
var worldTimeExpiry = context.expireTurnStatuses({
  statuses:['poison','curse'],
  statusEffects:[
    {type:'status',statusKey:'poison',unit:'hours',durationUnit:'hours',duration:3,remaining:2},
    {type:'status',statusKey:'curse',unit:'days',durationUnit:'days',duration:2,remaining:2}
  ]
});
assert.strictEqual(worldTimeExpiry.effects[0].remaining, 2, 'combat turn must not decrement an hourly duration');
assert.strictEqual(worldTimeExpiry.effects[1].remaining, 2, 'combat turn must not decrement a daily duration');
assert.strictEqual(worldTimeExpiry.expired.length, 0);

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

var pointAreaRoom = {
  scene:{
    boardWidth:20,boardHeight:20,
    tokens:[
      {id:'caster',x:10,y:10},
      {id:'near',x:51,y:50},
      {id:'far',x:80,y:80}
    ]
  },
  zones:{}
};
var casterEntry = {key:'token:caster',tokenId:'caster'};
var nearEntry = {key:'token:near',tokenId:'near'};
var farEntry = {key:'token:far',tokenId:'far'};
var freePointAnchor = {scenePoint:{x:50,y:50}};
var areaHelpersStart = network.indexOf('  function movementCells(');
var areaHelpersEnd = network.indexOf('  function combatDamageTraits(', areaHelpersStart);
var areaContext = {Math:Math,Number:Number,String:String,Object:Object,Array:Array,isFinite:isFinite};
vm.runInNewContext(network.slice(areaHelpersStart,areaHelpersEnd),areaContext);
assert.strictEqual(areaContext.combatAreaContains(pointAreaRoom,'circle',casterEntry,freePointAnchor,nearEntry,2,1),true,'free scene point must anchor a spell area');
assert.strictEqual(areaContext.combatAreaContains(pointAreaRoom,'circle',casterEntry,freePointAnchor,farEntry,2,1),false);
assert.strictEqual(areaContext.combatEntryDistance(pointAreaRoom,casterEntry,freePointAnchor),8,'range to a free scene point must use the scene grid');

var equipmentRoom = {
  combat:{
    phase:'active',
    order:[{
      key:'member:player-1',kind:'hero',uid:'player-1',
      hp:8,hpMax:14,tempHp:2,ac:12,bonus:0,total:13,
      stats:{str:{base:2,cur:2,tmp:0}},
      weaponProfiles:[{id:'old'}],
      equipmentBonuses:{acBonus:2,hpBonus:4},
      statuses:['burn'],statusEffects:[],
      economy:{long:0,short:1,reaction:0,movement:4,movementMax:7}
    }]
  },
  members:{
    'player-1':{
      character:{
        hpMax:18,ac:15,initiative:2,speed:9,
        stats:{str:{base:3,cur:3,tmp:0}},
        mastery:[{name:'Стойка'}],
        weaponProfiles:[{id:'new',name:'Сабля'}],
        equipmentBonuses:{acBonus:5,hpBonus:8,speedBonus:2},
        statuses:['stun'],
        statusEffects:[{type:'status',statusKey:'stun',sourceId:'sheet:stun'}]
      }
    }
  }
};
var equipmentReconcile = context.reconcileCombatEquipmentOrder(equipmentRoom);
var reconciledEntry = equipmentReconcile.order[0];
assert.strictEqual(equipmentReconcile.changed, true);
assert.strictEqual(reconciledEntry.hpMax, 18);
assert.strictEqual(reconciledEntry.hp, 12, 'equipment reconcile must preserve six points of received damage');
assert.strictEqual(reconciledEntry.tempHp, 2);
assert.strictEqual(reconciledEntry.ac, 15);
assert.strictEqual(reconciledEntry.bonus, 2);
assert.strictEqual(reconciledEntry.total, 13, 'active combat order must not be reordered by a later initiative bonus');
assert.strictEqual(reconciledEntry.economy.movementMax, 9);
assert.strictEqual(reconciledEntry.economy.movement, 6, 'spent movement must be preserved when maximum speed changes');
assert.strictEqual(reconciledEntry.economy.long, 0);
assert.strictEqual(reconciledEntry.economy.reaction, 0);
assert.deepStrictEqual(Array.from(reconciledEntry.statuses), ['stun'], 'member sheet states must replace a stale combat projection');
assert.strictEqual(reconciledEntry.statusEffects[0].sourceId, 'sheet:stun');
equipmentRoom.combat.order = equipmentReconcile.order;
assert.strictEqual(context.reconcileCombatEquipmentOrder(equipmentRoom).changed, false, 'equal equipment snapshot must not cause a write loop');

var racialEquipmentStatusConflict = {
  ac:13,
  speed:9,
  stats:{dex:{base:1,cur:3,tmp:0}},
  equipmentBonuses:{
    acBonus:3,
    speedBonus:2,
    statBonuses:{dex:2}
  },
  statuses:['shield','curse','slow'],
  statusEffects:[],
  economy:{movement:9,movementMax:9}
};
var conflictModifiers = context.combatStatusModifiers(racialEquipmentStatusConflict);
assert.strictEqual(racialEquipmentStatusConflict.stats.dex.base, 1, 'racial stat remains in the immutable base');
assert.strictEqual(racialEquipmentStatusConflict.stats.dex.cur, 3, 'equipment bonus is represented once in the current stat');
assert.strictEqual(racialEquipmentStatusConflict.equipmentBonuses.statBonuses.dex, 2);
assert.strictEqual(conflictModifiers.attackMod, -2, 'status attack modifier remains separate from racial and equipment stats');
assert.strictEqual(racialEquipmentStatusConflict.stats.dex.cur + conflictModifiers.attackMod, 1, 'attack uses final stat plus status exactly once');
assert.strictEqual(racialEquipmentStatusConflict.ac + conflictModifiers.acMod, 15, 'status AC stacks once on top of item-derived AC');
assert.strictEqual(context.combatTurnMovement(racialEquipmentStatusConflict), 4, 'slow halves item-enhanced speed without subtracting its legacy modifier twice');

var initiativeEntry = context.reconcileCombatEquipmentEntry({
  kind:'hero',uid:'player-1',roll:11,total:11,bonus:0,hp:14,hpMax:14,
  economy:{long:1,short:1,reaction:1,movement:7,movementMax:7}
}, equipmentRoom.members['player-1'].character, 'initiative');
assert.strictEqual(initiativeEntry.total, 13, 'initiative preview must use the updated bonus before combat begins');

assert.match(html, /function gmStatusCatalog\(\)/);
assert.match(html, /typeof w\.getStatusMechanics==='function'/);
assert.match(html, /function gmStatusEffectPayload\(status,options\)/);
assert.match(html, /durationUnit:unit/);
assert.match(html, /zgGmStatusDurationOpen/);
assert.match(html, />Раунды<\/option>/);
assert.match(html, />Часы<\/option>/);
assert.match(html, />Дни<\/option>/);
assert.match(html, />До снятия<\/option>/);
assert.match(html, /zg-gm-status-duration-visibility/);
assert.match(html, /zg-gm-status-duration-stacks/);
assert.match(html, /effect\.visibility==='gm'&&!options\.isMaster/);
assert.match(html, /seen\[key\]=true;\s*if\(effect\.visibility==='gm'&&!options\.isMaster\)return/);
assert.match(html, /zgGmInterventionStatusUpdate/);
assert.match(html, /tokenCombatStatuses\(token\).*slice\(0,5\)/s);
assert.match(network, /normalizeStatusEffectInput\(operation\.effect,statusKey,statusLabel\)/);
assert.match(network, /function normalizeStatusDurationUnit\(/);
assert.match(network, /function stableStatusEffectId\(/);
assert.match(network, /function collectActiveStatusEffects\(/);
assert.match(network, /w\.zgCollectActiveStatusEffects=collectActiveStatusEffects/);
assert.match(network, /function normalizeWorldClock\(/);
assert.match(network, /function advanceWorldTimedStatusEffects\(/);
assert.match(network, /function advanceRoomWorldTimeState\(/);
assert.match(network, /gmAdvanceWorldTime: function \(operation\)/);
assert.match(network, /gmSetWorldClock: function \(operation\)/);
assert.match(network, /function setRoomWorldClockState\(/);
assert.match(network, /firebase\.runTransaction\(roomTarget/);
var worldTimeApiStart=network.indexOf('gmAdvanceWorldTime: function (operation)');
var worldTimeApiEnd=network.indexOf('gmBroadcastVisual: function',worldTimeApiStart);
var worldTimeApiBlock=network.slice(worldTimeApiStart,worldTimeApiEnd);
assert.match(worldTimeApiBlock, /session\.role!=='master'/);
assert.match(worldTimeApiBlock, /room\.masterUid!==user\.uid/);
assert.match(network, /world-time-delta-invalid/);
assert.match(network, /deltaMinutes<1\|\|deltaMinutes>525600/);
assert.match(html, /function worldClockView\(clock\)/);
assert.match(html, /id="zg-world-clock"/);
assert.match(html, /zgGmAdvanceWorldTime\(1440\)/);
assert.match(html, /zgGmSetExactWorldTime/);
assert.match(html, /zgGmSetDayPhase/);
assert.match(html, /zgGmWorldTimeMode/);
assert.match(html, /Раунд боя не меняется/);
assert.match(network, /effect\.durationUnit\|\|effect\.unit/);
assert.match(network, /unit==='rounds'/);
assert.match(network, /function normalizeCombatStatusKey\(/);
assert.match(network, /function combatStatusLevel\(/);
assert.match(network, /attackDisadvantage/);
assert.match(network, /dexSaveDisadvantage/);
assert.match(network, /Истощение IV запрещает применять заклинания/);
assert.match(network, /stacks:Math\.max\(1,Math\.min\(20/);
assert.match(network, /autoRemove!=='save_dc'/);
assert.match(network, /queueCombatEntryState\(room,updates,ending,false,\{/);
assert.match(network, /queueCombatEntryState\(room,updates,current,true,\{/);
assert.match(network, /writeMember:masterAdvance\|\|String\(current\.uid\|\|''\)===String\(user\.uid\)/);
assert.match(network, /writeScene:masterAdvance/);
assert.match(html, /showCreatureRollTotals/);
assert.match(network, /revealResult: options\.revealResult !== false/);
assert.match(html, /РЕЗУЛЬТАТ СКРЫТ/);
assert.match(network, /hiddenText:'Существо атакует цель/);
assert.match(network, /hiddenText:'Существо наносит урон цели/);
assert.match(html, /journalVisibleText/);
assert.match(html, /burst\.textContent=hideResult\?'\?'/);
assert.match(network, /function scheduleMasterCombatEquipmentReconcile\(room\)/);
assert.match(network, /session\.role !== 'master'/);
assert.match(network, /firebase\.runTransaction\(combatRef/);
assert.match(network, /nextCombat\.equipmentSyncedAt/);
assert.match(network, /combatRollMode\(String\(options\.mode\|\|'normal'\),targetModifiers\.grantAdvantageToAttackers,forcedDisadvantage\)/);
assert.match(network, /damageResult\.total\+bonusDamage\+statBonus\+attackerModifiers\.damageMod/);
assert.match(network, /request\.target=normalizeAbilityTargeting\(details\.targeting\)/);
assert.match(network, /areaAnchorEntry=effect\.areaAnchorPoint\?\{scenePoint:effect\.areaAnchorPoint\}/);
assert.match(network, /updates\.combatEvent\.areaAnchorPoint=effect\.effectKind==='summon'\?summonPoint:\(effect\.areaMode!=='manual'\?effect\.areaAnchorPoint:null\)/);
assert.match(network, /economy\[cost\]=Math\.max\(0,Number\(economy\[cost\]\|\|0\)-1\)/);
assert.match(network, /character\/abilityUsage\/'\+resourceKey/);
assert.match(network, /character\/hpCur'\]=result\.hp/);
assert.match(network, /scene\/tokens\/'\+index\+'\/statuses'\]=target\.statuses/);
assert.match(html, /var abilityTargeting = null/);
assert.match(html, /function completeAbilityTarget\(point,token\)/);
assert.match(html, /w\.zgSceneAbilityTarget=function\(profile,meta\)/);
assert.match(html, /w\.zgVttSendAbilityTarget=function\(selection\)/);
assert.match(html, /actionRequest\.details\|\|actionRequest\.target\|\|\{\}/);
assert.match(html, /requestedTargetKey=request\.abilityResolution&&String\(request\.abilityResolution\.targetKey\|\|''\)\|\|request\.target&&String\(request\.target\.targetKey\|\|''\)/);
assert.match(html, /areaAnchorPoint=\{x:clamp\(request\.target\.x,0,100\),y:clamp\(request\.target\.y,0,100\)\}/);
assert.match(html, /a=d\.areaAnchorPoint&&d\.areaAnchorPoint\.x!=null&&d\.areaAnchorPoint\.y!=null\?d\.areaAnchorPoint:abilityEntryToken\(anchor\)/);
assert.match(html, /function animateCombatAbilityVisual\(event\)/);
assert.match(html, /kind==='combat-ability'/);
assert.match(html, /Обычное и тяжёлое ближнее оружие/);
assert.match(html, /Лёгкое и точное оружие/);
assert.match(html, /Дальнобойное оружие/);
assert.match(html, /каждые полные 3 Силы дают \+1 к запугиванию/);
var abilityRequestStart = network.indexOf('requestAction: function');
var abilityRequestEnd = network.indexOf('resolveAction: function', abilityRequestStart);
var abilityRequestBlock = network.slice(abilityRequestStart, abilityRequestEnd);
assert.match(abilityRequestBlock, /abilityOperationId/);
assert.match(abilityRequestBlock, /queueGameplayOperation\('ability-request', abilityOperationId/);
assert.match(abilityRequestBlock, /gameplayOperationSnapshot\('ability-request', abilityOperationId\)/);
assert.match(abilityRequestBlock, /member\.actionOperationIds\s*&&\s*member\.actionOperationIds\[abilityOperationId\]/);
assert.match(abilityRequestBlock, /member\.actionRequest\.id \|\| ''\)\s*===\s*abilityOperationId/);
assert.match(abilityRequestBlock, /member\.actionRequest\.status === 'pending' \|\| abilityFromOutbox/);
assert.match(abilityRequestBlock, /removeGameplayOperation\(request\.id\)/);
assert.match(abilityRequestBlock, /appendOperationEvent\('ability-cast', request\.id, 'sending-request'/);
assert.match(abilityRequestBlock, /appendOperationEvent\('ability-cast', request\.id, 'pending-gm'/);
assert.match(abilityRequestBlock, /abilityRequestWritten\?'request-refresh-failed':'request-failed'/);
var abilityResolveStart = network.indexOf('resolveCombatAbility: function');
var abilityResolveEnd = network.indexOf('prepareCombatReaction: function', abilityResolveStart);
var abilityResolveBlock = network.slice(abilityResolveStart, abilityResolveEnd);
assert.match(abilityResolveBlock, /appendOperationEvent\('ability-cast',castDiagnostic\.id,'resolving'/);
assert.match(abilityResolveBlock, /appendOperationEvent\('ability-cast',castDiagnostic\.id,'applying'/);
assert.match(abilityResolveBlock, /appendOperationEvent\('ability-cast',castDiagnostic\.id,'applied'/);
assert.match(abilityResolveBlock, /castWriteCommitted\?'resolve-refresh-failed':'resolve-failed'/);
assert.match(abilityResolveBlock, /actionOperationIds'\]=rememberActionOperation\(member\.actionOperationIds,request\.id,stamp\)/);
assert.match(html, /заявка сохранена и отправится автоматически/);
var actionHistoryStart = network.indexOf('  function rememberActionOperation');
var actionHistoryEnd = network.indexOf('  function setCharacterSync', actionHistoryStart);
var oldActionHistory = {};
for(var historyIndex=0;historyIndex<45;historyIndex++)oldActionHistory['old-'+historyIndex]=historyIndex+1;
var actionHistoryContext = {result:null,existing:oldActionHistory,Date:Date,Math:Math,Number:Number,Object:Object,String:String};
vm.runInNewContext('function now(){return 1000;}\n'+network.slice(actionHistoryStart,actionHistoryEnd)+';result=rememberActionOperation(existing,"new-operation",1000);',actionHistoryContext);
assert.strictEqual(Object.keys(actionHistoryContext.result).length,40,'completed ability operation history is bounded');
assert.strictEqual(actionHistoryContext.result['new-operation'],1000);
var turnOperationContext={first:null,second:null,Math:Math,Number:Number,Object:Object,String:String};
vm.runInNewContext(
  network.slice(actionHistoryStart,actionHistoryEnd)+
  '; first=beginCombatTurnOperation({round:3,turnIndex:1,appliedTurnOperationIds:{}},"turn-op",1000,"player");'+
  'second=beginCombatTurnOperation(first.combat,"turn-op",1100,"player");',
  turnOperationContext
);
assert.strictEqual(turnOperationContext.first.duplicate,false);
assert.strictEqual(turnOperationContext.second.duplicate,true,'the same turn operation must not tick round statuses twice');
assert.strictEqual(turnOperationContext.second.combat.lastTurnOperation.fromRound,3);
assert.strictEqual(turnOperationContext.second.combat.lastTurnOperation.fromTurn,1);
assert.match(html, /\.zg-combat-spell-cast/);
assert.match(html, /function openAbilityTargetEntity\(key,order\)/);
assert.match(html, /gmInterventionTab='entity'/);
assert.match(html, /data-ability-field="damageFormula"/);
assert.match(html, /data-ability-field="healFormula"/);
assert.match(html, /data-ability-field="statuses"/);
assert.match(html, /data-ability-field="durationRounds"/);
assert.match(html, /id='zg-ability-target-hud'|id="zg-ability-target-hud"|hud\.id='zg-ability-target-hud'/);
assert.match(html, /\.zg-vtt-token\.zg-ability-target-valid/);

console.log('status combat sync contract passed');
