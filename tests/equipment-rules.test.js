'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var rules = require('../equipment-rules.js');

var mixedCharacter = {
  inventoryItems:[
    {
      itemId:'equipped-armor',
      name:'Бригантина',
      category:'armor',
      equipped:true,
      slot:'armor',
      acBonus:3,
      effects:'+3 AC'
    },
    {
      itemId:'bag-ring',
      name:'Запасное кольцо',
      category:'accessory',
      equipped:false,
      effects:'+5 к Силе'
    },
    {
      itemId:'equipped-boots',
      name:'Сапоги ветра',
      category:'armor',
      equipped:true,
      slot:'legs',
      effects:'+2 к скорости · +1 к Ловкости'
    }
  ],
  equipItems:[
    {
      itemId:'legacy-amulet',
      name:'Амулет жизни',
      category:'accessory',
      equipped:true,
      hpBonus:4,
      description:'+4 к максимальному HP'
    }
  ],
  arenaEquipSlots:{ main_hand:'catalog-sword' }
};
var armory = [{
  id:'catalog-sword',
  name:'Сабля',
  category:'weapon',
  damageFormula:'1d8',
  damageType:'Рубящий',
  attackStat:'dex',
  effects:'+1 к инициативе'
}];

var mixedResult = rules.calculate(mixedCharacter, armory);
assert.strictEqual(mixedResult.acBonus, 3, 'typed AC and matching text must not double');
assert.strictEqual(mixedResult.hpBonus, 4, 'typed HP and matching text must not double');
assert.strictEqual(mixedResult.speedBonus, 2);
assert.strictEqual(mixedResult.initiativeBonus, 1);
assert.strictEqual(mixedResult.statBonuses.dex, 1);
assert.strictEqual(mixedResult.statBonuses.str, 0, 'unequipped inventory item must not apply');

assert.strictEqual(rules.normalizedEquipmentSlot({slot:'weapon',category:'weapon'}), 'mainHand');
assert.strictEqual(rules.normalizedEquipmentSlot({slot:'main_hand',category:'weapon'}), 'mainHand');
assert.strictEqual(rules.normalizedEquipmentSlot({name:'Старый щит',category:'shield'}), 'offHand');
assert.strictEqual(rules.normalizedEquipmentSlot({name:'Бригантина',category:'armor',preferredSlot:'armor'}), 'armor');
assert.strictEqual(rules.preferredEquipmentSlot({name:'Дорожная бригантина',category:'armor',preferredSlot:'armor'}), 'armor');
assert.strictEqual(rules.preferredEquipmentSlot({name:'Плащ следопыта',category:'armor',preferredSlot:'cloak'}), 'cloak');
assert.strictEqual(rules.preferredEquipmentSlot({name:'Кольцо',category:'accessory'}), 'accessory1');
assert.strictEqual(rules.itemHandsRequired({name:'Двуручный меч',category:'weapon'}), 2);
assert.strictEqual(rules.itemHandsRequired({name:'Рапира',category:'weapon'}), 1);
assert.strictEqual(rules.canEquipInSlot({name:'Щит',category:'shield'}, 'mainHand'), false);
assert.strictEqual(rules.canEquipInSlot({name:'Щит',category:'shield'}, 'offHand'), true);

var handItems = [
  {itemId:'sword',name:'Меч',category:'weapon',equipped:true,slot:'weapon'},
  {itemId:'shield',name:'Щит',category:'shield',equipped:true,slot:'offHand'},
  {itemId:'greatsword',name:'Двуручный меч',category:'weapon',equipped:false}
];
var initialHands = rules.resolveHandSlots(handItems);
assert.strictEqual(initialHands.mainHand.item.itemId, 'sword');
assert.strictEqual(initialHands.offHand.item.itemId, 'shield');
var plannedGreatsword = rules.planHandEquip(handItems, 2, 'mainHand');
assert.strictEqual(plannedGreatsword.ok, true);
assert.strictEqual(plannedGreatsword.handsRequired, 2);
assert.strictEqual(plannedGreatsword.items[0].equipped, false);
assert.strictEqual(plannedGreatsword.items[1].equipped, false);
assert.strictEqual(plannedGreatsword.items[2].slot, 'mainHand');
assert.strictEqual(rules.resolveHandSlots(plannedGreatsword.items).twoHanded, true);

var twoWeapons = rules.planHandEquip([
  {itemId:'sword',name:'Меч',category:'weapon',equipped:true,slot:'mainHand'},
  {itemId:'dagger',name:'Кинжал',category:'weapon',equipped:false}
], 1, 'offHand');
assert.strictEqual(twoWeapons.ok, true);
assert.strictEqual(twoWeapons.items[0].equipped, true);
assert.strictEqual(twoWeapons.items[1].slot, 'offHand');
assert.strictEqual(mixedResult.weapon.name, 'Сабля');
assert.strictEqual(mixedResult.weapon.damageFormula, '1d8');
assert.strictEqual(mixedResult.weapon.slot, 'mainHand');
assert.strictEqual(mixedResult.weapon.handsRequired, 1);
assert.strictEqual(mixedResult.sources.length, 4);

var duplicateCharacter = {
  inventoryItems:[{ itemId:'same-item', name:'Щит', category:'shield', equipped:true }],
  equipItems:[{ itemId:'same-item', name:'Старая копия щита', category:'shield', equipped:true }]
};
var duplicateResult = rules.calculate(duplicateCharacter, []);
assert.strictEqual(duplicateResult.acBonus, 2, 'same canonical item must not apply twice');
assert.strictEqual(duplicateResult.sources.length, 1);

var explicitStats = rules.calculate({
  inventoryItems:[{
    itemId:'stat-item',
    name:'Знак',
    equipped:true,
    statBonuses:{ per:2, con:-1 },
    effects:'+9 к Восприятию · +9 к Выносливости'
  }]
}, []);
assert.strictEqual(explicitStats.statBonuses.per, 2, 'typed stat bonus has priority over prose');
assert.strictEqual(explicitStats.statBonuses.con, -1);

var npcSource = {
  name:'Страж NPC',hp:12,hpMax:12,ac:10,initiative:0,speed:7,
  stats:{str:1,dex:0,int:0,cha:0,per:0,con:1},
  inventoryItems:[
    {itemId:'npc-shield',name:'Щит',category:'shield',qty:1,equipped:false},
    {itemId:'npc-bow',name:'Лук',category:'weapon',qty:1,equipped:false,damageFormula:'1d6',damageType:'Колющий',range:'8 клеток'},
    {itemId:'npc-wand',name:'Жезл',category:'focus',qty:1,equipped:false,charges:2,maxCharges:2},
    {itemId:'npc-potion',name:'Зелье',category:'consumable',qty:2,equipped:false,consumption:{kind:'use'}}
  ],
  equipmentBonuses:{acBonus:0,hpBonus:0,speedBonus:0,initiativeBonus:0,statBonuses:{str:0,dex:0,int:0,cha:0,per:0,con:0}},
  weaponProfiles:[{id:'authored-strike',name:'Удар',damageFormula:'1d4'}],
  economy:{long:1,short:1,reaction:1,movement:7,movementMax:7}
};
var npcShield = rules.applyCreatureInventory(npcSource,{action:'equip',itemId:'npc-shield'});
assert.strictEqual(npcShield.ok,true);
assert.strictEqual(npcShield.source.ac,12,'equipped NPC shield applies the same AC bonus as hero equipment');
assert.strictEqual(npcShield.source.inventoryItems[0].equipped,true);
var npcBow = rules.applyCreatureInventory(npcShield.source,{action:'equip',itemId:'npc-bow'});
assert.strictEqual(npcBow.ok,true);
assert.ok(npcBow.source.weaponProfiles.some(function(profile){return profile.sourceItemId==='npc-bow';}),'equipped NPC weapon becomes a combat profile');
assert.ok(npcBow.source.weaponProfiles.some(function(profile){return profile.id==='authored-strike';}),'authored creature attacks remain beside inventory weapons');
var npcWandUse = rules.applyCreatureInventory(npcBow.source,{action:'use',itemId:'npc-wand'});
assert.strictEqual(npcWandUse.source.inventoryItems.find(function(item){return item.itemId==='npc-wand';}).charges,1);
var npcPotionUse = rules.applyCreatureInventory(npcWandUse.source,{action:'use',itemId:'npc-potion'});
assert.strictEqual(npcPotionUse.source.inventoryItems.find(function(item){return item.itemId==='npc-potion';}).qty,1);
var npcPotionLast = rules.applyCreatureInventory(npcPotionUse.source,{action:'use',itemId:'npc-potion'});
assert.strictEqual(npcPotionLast.source.inventoryItems.some(function(item){return item.itemId==='npc-potion';}),false,'last consumable is removed atomically');

var network = fs.readFileSync(path.resolve(__dirname, '..', 'zargota-network.js'), 'utf8');
var derivedStart = network.indexOf('  function equipmentBonusTotals(');
var derivedEnd = network.indexOf('  function pointInPolygon(', derivedStart);
assert.ok(derivedStart >= 0 && derivedEnd > derivedStart, 'equipment derived helper block must remain extractable');
var derivedContext = { Number:Number, Object:Object, Math:Math, Array:Array, JSON:JSON };
vm.runInNewContext(network.slice(derivedStart, derivedEnd), derivedContext);

var reconciled = derivedContext.applyEquipmentDerivedSnapshot({
  hpCur:8,hpMax:14,ac:12,initiative:1,speed:7,
  stats:{ dex:{base:3,cur:3,tmp:0} },
  equipmentBonuses:{ acBonus:2,hpBonus:4,speedBonus:0,initiativeBonus:0,statBonuses:{dex:0} }
}, {
  hpMax:10,ac:13,initiative:2,speed:9,
  stats:{ dex:{base:3,cur:4,tmp:0} },
  weaponProfiles:[{id:'sword'}],
  equipmentBonuses:{ acBonus:3,hpBonus:0,speedBonus:2,initiativeBonus:1,statBonuses:{dex:1} }
});
assert.strictEqual(reconciled.hpMax, 10);
assert.strictEqual(reconciled.hpCur, 4, 'equipment HP delta must preserve damage already applied in room');
assert.strictEqual(reconciled.ac, 13);
assert.strictEqual(reconciled.initiative, 2);
assert.strictEqual(reconciled.speed, 9);
assert.strictEqual(reconciled.stats.dex.cur, 4);
assert.strictEqual(reconciled.weaponProfiles[0].id, 'sword');

assert.match(network, /equipmentBonuses: clean\(rawEquipmentBonuses, \{\}\)/);
assert.match(network, /applied\.character = applyEquipmentDerivedSnapshot\(applied\.character, liveSnapshot\)/);
assert.match(network, /equipmentBonuses:member\.character\.equipmentBonuses\|\|\{\}/);
assert.match(network, /damageFormula:String\(item\.damageFormula \|\| item\.damage \|\| ''\)/);

console.log('equipment rules tests passed');
