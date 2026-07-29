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
        equipmentBonuses:{acBonus:5,hpBonus:8,speedBonus:2}
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
assert.strictEqual(reconciledEntry.statuses[0], 'burn');
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
assert.match(html, /effect:enable\?gmStatusEffectPayload\(def\):null/);
assert.match(html, /stacks:1,visibility:'public'/);
assert.match(html, /effect\.visibility==='gm'&&!isMaster/);
assert.match(html, /zgGmInterventionStatusUpdate/);
assert.match(html, /tokenCombatStatuses\(token\).*slice\(0,5\)/s);
assert.match(network, /normalizeStatusEffectInput\(operation\.effect,statusKey,statusLabel\)/);
assert.match(network, /stacks:Math\.max\(1,Math\.min\(20/);
assert.match(network, /autoRemove!=='save_dc'/);
assert.match(network, /queueCombatEntryState\(room,updates,current,true\)/);
assert.match(network, /function scheduleMasterCombatEquipmentReconcile\(room\)/);
assert.match(network, /session\.role !== 'master'/);
assert.match(network, /firebase\.runTransaction\(combatRef/);
assert.match(network, /nextCombat\.equipmentSyncedAt/);
assert.match(network, /combatRollMode\(String\(options\.mode\|\|'normal'\),targetModifiers\.grantAdvantageToAttackers,forcedDisadvantage\)/);
assert.match(network, /damageResult\.total\+statBonus\+attackerModifiers\.damageMod/);
assert.match(network, /request\.target=normalizeAbilityTargeting\(details\.targeting\)/);
assert.match(network, /areaAnchorEntry=effect\.areaAnchorPoint\?\{scenePoint:effect\.areaAnchorPoint\}/);
assert.match(network, /updates\.combatEvent\.areaAnchorPoint=effect\.areaMode!=='manual'\?effect\.areaAnchorPoint:null/);
assert.match(network, /economy\[cost\]=Math\.max\(0,Number\(economy\[cost\]\|\|0\)-1\)/);
assert.match(network, /character\/abilityUsage\/'\+resourceKey/);
assert.match(network, /character\/hpCur'\]=result\.hp/);
assert.match(network, /scene\/tokens\/'\+index\+'\/statuses'\]=target\.statuses/);
assert.match(html, /var abilityTargeting = null/);
assert.match(html, /function completeAbilityTarget\(point,token\)/);
assert.match(html, /w\.zgSceneAbilityTarget=function\(profile,meta\)/);
assert.match(html, /w\.zgVttSendAbilityTarget=function\(selection\)/);
assert.match(html, /actionRequest\.details\|\|actionRequest\.target\|\|\{\}/);
assert.match(html, /requestedTargetKey=request\.target&&String\(request\.target\.targetKey\|\|''\)/);
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
