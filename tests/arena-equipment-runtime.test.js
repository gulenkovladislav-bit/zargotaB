'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const rules = require('../equipment-rules.js');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('  function inventoryClone(');
const end = html.indexOf('  w.zgVttArenaSnapshot=', start);
const context = {w:{ZargotaEquipmentRules:rules}};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);
const clone = value => JSON.parse(JSON.stringify(value));

for (const item of [
  {name:'Масло', category:'potion', description:'Нанести на оружие'},
  {name:'Свиток', category:'magic', description:'Создаёт магический щит'},
  {name:'Записка', category:'other', description:'Список покупок'},
  {name:'Список покупок', category:'other'}
]) assert.equal(rules.equipmentKind(item), 'other');
assert.equal(rules.equipmentKind({name:'Батон', description:'Тип: Рукопашное (одноручное)\nУрон: 1d4'}), 'weapon');
assert.equal(rules.equipmentKind({name:'Палиця', description:'Тип: Рукопашне (одноручне)'}), 'weapon');

const weapon = {name:'Батон', description:'Тип: Рукопашное (одноручное)', equipped:true, image:'baton.png'};
const equipped = {inventoryItems:[weapon], equipItems:[]};
const profile = context.inventoryWeaponProjection(equipped, [])[0];
assert.equal(profile.image, 'baton.png');
assert.equal(profile.source, 'inventory');
const removed = {inventoryItems:[{...weapon,equipped:false}],equipItems:[]};
assert.equal(context.inventoryWeaponProjection(removed, [profile]).length, 0);
assert.equal(context.inventoryWeaponProjection(removed, [{id:'inventory-weapon-0',sourceItemId:''}]).length, 0, 'old generated profiles migrate on refresh');
assert.equal(context.inventoryWeaponProjection(removed, [{id:'claws',name:'Когти'}]).length, 1, 'authored natural attacks survive');
assert.equal(context.inventoryWeaponProjection(removed, [{id:'Батон',name:'Батон'}]).length, 0, 'legacy session profiles with name-based IDs do not survive unequip');
const oldSession = {inventoryItems:[weapon],equipItems:[],weaponProfiles:[{id:'Батон',name:'Батон'}]};
context.applyInventoryCombatProjection(oldSession,{inventoryItems:[],equipItems:[]});
assert.equal(oldSession.weaponProfiles.length,0,'deleting a legacy weapon removes its old attack too');
assert.equal(rules.applyCreatureInventory({...equipped,weaponProfiles:[profile]}, {action:'equip',index:0}).source.weaponProfiles.length, 0);

const armor = {itemId:'armor',name:'Доспех',equipped:true,acBonus:3,hpBonus:4,speedBonus:2,initiativeBonus:1,statBonuses:{str:2}};
for (const stats of [{str:3}, {str:{base:3}}, {str:{base:3,cur:4}}]) {
  const target = {inventoryItems:[],equipItems:[],ac:10,hpMax:20,hp:12,hpCur:12,speed:7,initiative:2,stats:clone(stats),economy:{movementMax:7,movement:3,long:0},statuses:['poison']};
  const original = clone(target);
  context.applyInventoryCombatProjection(target,{inventoryItems:[armor,weapon],equipItems:[]});
  assert.equal(target.ac,13); assert.equal(target.hpMax,24); assert.equal(target.hp,16);
  assert.equal(target.speed,9); assert.equal(target.initiative,3);
  assert.equal(target.economy.movement,5); assert.equal(target.economy.long,0);
  assert.equal(typeof stats.str === 'number' ? target.stats.str : target.stats.str.cur, (typeof stats.str === 'number' ? stats.str : stats.str.cur ?? stats.str.base)+2);
  const once = clone(target);
  context.applyInventoryCombatProjection(target,{inventoryItems:[armor,weapon],equipItems:[]});
  assert.deepEqual(clone(target),once,'repeated projection does not stack bonuses');
  context.applyInventoryCombatProjection(target,{inventoryItems:[],equipItems:[]});
  for (const key of ['ac','hpMax','hp','hpCur','speed','initiative','economy','statuses']) assert.deepEqual(clone(target[key]),original[key]);
  assert.equal(target.weaponProfiles.length,0);
}

// Execute the actual QuickEquip and Drop handlers together, not a text contract.
const bag = {inventoryItems:[{...weapon,equipped:false}],equipItems:[]};
let committed = 0, catalogCalls = 0;
Object.assign(context, {
  drawerMember:()=>({uid:'hero'}), editableDrawerCharacter:()=>({character:bag}),
  inventoryMutationBusy:false, inventoryMutationSnapshot:clone,
  inventoryDropAllowed:rules.canEquipInSlot, clearInventoryDragFeedback:()=>{},
  renderDrawer:()=>{}, commitInventoryMutation:()=>{committed++;}
});
context.w.zgVttInventoryCatalogEquip = ()=>{catalogCalls++;};
context.w.zgVttInventoryCloseItem = ()=>{};
for (const [from,to] of [
  ['  w.zgVttInventoryDrop=function(', '  w.zgVttInventoryOpenItem='],
  ['  w.zgVttInventoryQuickEquip=function(', '  w.zgVttInventoryUnequip=']
]) { const offset=html.indexOf(from); vm.runInContext(html.slice(offset,html.indexOf(to,offset)),context); }
context.w.zgVttInventoryQuickEquip(0);
assert.equal(catalogCalls,0);
assert.equal(committed,1);
assert.equal(bag.inventoryItems[0].equipped,true);
assert.equal(bag.inventoryItems[0].slot,'mainHand');
console.log('Arena equipment runtime regressions passed');
