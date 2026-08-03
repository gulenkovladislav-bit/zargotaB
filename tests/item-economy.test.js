'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var economy = require('../item-economy.js');

assert.strictEqual(economy.POWER_MODEL_VERSION, '0.1');
assert.strictEqual(economy.LEVEL_REQUIREMENTS.length, 10);
assert.strictEqual(economy.levelRequirement(1).title, 'Новички');
assert.match(economy.levelRequirement(7).worldRole, /не уничтожают города/);
assert.strictEqual(economy.levelRequirement(10).title, 'Живые катастрофы');
assert.strictEqual(economy.LEVEL_BENCHMARKS.length, 10);
assert.strictEqual(economy.benchmarkForLevel(7).scope, 'regional-factor');
assert.strictEqual(economy.benchmarkForLevel(99).level, 10);
assert.strictEqual(economy.averageDice('1d6'), 3.5);
assert.strictEqual(economy.averageDice('2d8'), 9);

var items = economy.getFoundationItems();
assert.strictEqual(items.length, 12);
assert.deepStrictEqual(economy.validateFoundationItems(), []);
assert.strictEqual(new Set(items.map(function (item) { return item.id; })).size, items.length);
assert.strictEqual(new Set(items.map(function (item) { return item.image; })).size, items.length);
assert.ok(items.some(function (item) { return /лук/i.test(item.name); }));
assert.ok(items.some(function (item) { return /посох/i.test(item.name); }));
assert.ok(items.filter(function (item) { return item.tags.indexOf('outfit') >= 0; }).length >= 3);
assert.ok(items.every(function (item) { return economy.priceInGold(item.price) > 0; }));

var boarSpear = items.filter(function (item) { return item.id === 'shp_foundation_05'; })[0];
assert.strictEqual(boarSpear.handsRequired, 2);
assert.strictEqual(boarSpear.effects[0].actionCost, 'reaction');
assert.strictEqual(boarSpear.effects[0].frequency, 'round');
var spearScore = economy.scoreItemDefinition(boarSpear);
assert.strictEqual(spearScore.benchmarkLevel, 2);
assert.strictEqual(spearScore.status, 'within-tier');
assert.ok(spearScore.vector.damage > 0);

var gambeson = items.filter(function (item) { return item.id === 'shp_foundation_09'; })[0];
var snapshot = economy.definitionToInventorySnapshot(gambeson, 'instance-1', 1);
assert.strictEqual(snapshot.itemId, 'instance-1');
assert.strictEqual(snapshot.definitionId, gambeson.id);
assert.strictEqual(snapshot.acBonus, 1);
assert.strictEqual(snapshot.definitionSnapshot.name, gambeson.name);
assert.notStrictEqual(snapshot.definitionSnapshot, gambeson);
var gambesonScore = economy.scoreItemDefinition(gambeson);
assert.strictEqual(gambesonScore.vector.defense, 8);
assert.strictEqual(gambesonScore.status, 'within-tier');

var audit = economy.auditItemDefinitions(items);
assert.strictEqual(audit.length, 12);
assert.ok(audit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(audit.every(function (row) { return row.status === 'within-tier'; }));

var consumables = economy.getConsumableItems();
assert.strictEqual(consumables.length, 20);
assert.deepStrictEqual(economy.validateConsumableItems(), []);
assert.strictEqual(new Set(consumables.map(function (item) { return item.id; })).size, 20);
assert.strictEqual(new Set(consumables.map(function (item) { return item.image; })).size, 20);
assert.ok(consumables.every(function (item) { return item.category === 'consumable'; }));
assert.ok(consumables.every(function (item) { return item.charges === 1; }));
assert.ok(consumables.every(function (item) { return item.tags.indexOf('consumable') >= 0; }));
assert.ok(consumables.every(function (item) { return item.effects.length >= 1; }));
assert.strictEqual(economy.getShopSeedItems().length, 408);
var consumableAudit = economy.auditItemDefinitions(consumables);
assert.strictEqual(consumableAudit.length, 20);
assert.ok(consumableAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(consumableAudit.every(function (row) { return row.status === 'within-tier'; }));

var runicStitch = consumables.filter(function (item) { return item.id === 'shp_consumable_20'; })[0];
var stitchSnapshot = economy.definitionToInventorySnapshot(runicStitch, 'stitch-1', 2);
assert.strictEqual(stitchSnapshot.qty, 2);
assert.strictEqual(stitchSnapshot.charges, 1);
assert.strictEqual(stitchSnapshot.effects[0].operation, 'prevent-item-break');

var weapons = economy.getWeaponItems();
assert.strictEqual(weapons.length, 32);
assert.deepStrictEqual(economy.validateWeaponItems(), []);
assert.strictEqual(new Set(weapons.map(function (item) { return item.id; })).size, 32);
assert.strictEqual(new Set(weapons.map(function (item) { return item.image; })).size, 32);
assert.ok(weapons.every(function (item) { return item.category === 'weapon'; }));
assert.ok(weapons.every(function (item) { return item.damageFormula === item.damage; }));
assert.ok(weapons.every(function (item) { return item.handsRequired === 1 || item.handsRequired === 2; }));
assert.ok(weapons.some(function (item) { return item.tags.indexOf('ranged') >= 0; }));
assert.ok(weapons.some(function (item) { return item.tags.indexOf('polearm') >= 0; }));
assert.ok(weapons.some(function (item) { return item.requirements && item.requirements.length; }));
var weaponAudit = economy.auditItemDefinitions(weapons);
assert.strictEqual(weaponAudit.length, 32);
assert.ok(weaponAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(weaponAudit.every(function (row) { return row.status === 'within-tier'; }));

var harpoon = weapons.filter(function (item) { return item.id === 'shp_weapon_17'; })[0];
assert.strictEqual(harpoon.effects[0].operation, 'pull-cells');
assert.strictEqual(harpoon.handsRequired, 2);

var greatbow = weapons.filter(function (item) { return item.id === 'shp_weapon_21'; })[0];
var heavyCrossbow = weapons.filter(function (item) { return item.id === 'shp_weapon_22'; })[0];
assert.strictEqual(greatbow.damageFormula, '1d10');
assert.strictEqual(greatbow.requirements[0].min, 4);
assert.ok(greatbow.effects.some(function (effect) { return effect.operation === 'set-speed-to-zero'; }));
assert.strictEqual(heavyCrossbow.damageFormula, '1d12');
assert.ok(heavyCrossbow.effects.some(function (effect) { return effect.operation === 'damage-roll-advantage'; }));
assert.ok(heavyCrossbow.effects.some(function (effect) { return effect.operation === 'require-reload-action' && effect.actionCost === 'long'; }));
[greatbow,heavyCrossbow].forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..','images/shop/thumbs/'+path.basename(item.image,'.png')+'.jpg')));
});

var ninthAnswer = weapons.filter(function (item) { return item.id === 'shp_weapon_23'; })[0];
var mountainEcho = weapons.filter(function (item) { return item.id === 'shp_weapon_24'; })[0];
var moonlessTide = weapons.filter(function (item) { return item.id === 'shp_weapon_25'; })[0];
assert.strictEqual(ninthAnswer.effects[0].operation, 'make-reaction-weapon-attack');
assert.ok(mountainEcho.effects.some(function (effect) { return effect.operation === 'suppress-shield-defense'; }));
assert.ok(mountainEcho.effects.some(function (effect) { return effect.operation === 'disable-weapon-attacks'; }));
assert.match(moonlessTide.effects[0].condition, /does-not-remove-invisible-status/);
[ninthAnswer,mountainEcho,moonlessTide].forEach(function(item){
  assert.ok(item.price.pl >= 18);
  assert.doesNotMatch(item.effect, /\+\s*\d/);
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var rootPledge = weapons.filter(function (item) { return item.id === 'shp_weapon_26'; })[0];
var stoneVerdict = weapons.filter(function (item) { return item.id === 'shp_weapon_27'; })[0];
var deadCalm = weapons.filter(function (item) { return item.id === 'shp_weapon_28'; })[0];
assert.ok(rootPledge.effects.some(function (effect) { return effect.operation === 'halt-after-first-move-cell'; }));
assert.ok(rootPledge.effects.some(function (effect) { return effect.operation === 'bind-wielder-to-target'; }));
assert.strictEqual(stoneVerdict.effects[0].operation, 'make-reaction-attack-and-halt-on-hit');
assert.strictEqual(deadCalm.effects[0].operation, 'choose-pull-target-or-wielder');
[rootPledge,stoneVerdict,deadCalm].forEach(function(item){
  assert.ok(item.price.pl >= 20);
  assert.doesNotMatch(item.effect, /\+\s*\d/);
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var quietBoundary = weapons.filter(function (item) { return item.id === 'shp_weapon_29'; })[0];
var thunderSlope = weapons.filter(function (item) { return item.id === 'shp_weapon_30'; })[0];
var ebbThread = weapons.filter(function (item) { return item.id === 'shp_weapon_31'; })[0];
assert.strictEqual(quietBoundary.effects[0].operation, 'attack-first-enemy-entering-line');
assert.strictEqual(thunderSlope.effects[0].operation, 'push-downhill-or-knock-prone');
assert.strictEqual(ebbThread.effects[0].operation, 'tether-target-to-adjacent-anchor');
[quietBoundary,thunderSlope,ebbThread].forEach(function(item){
  assert.ok(item.price.pl >= 19);
  assert.doesNotMatch(item.effect, /\+\s*\d/);
  assert.ok(item.tags.indexOf('bow') >= 0);
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var throughArgument = weapons.filter(function (item) { return item.id === 'shp_weapon_32'; })[0];
assert.strictEqual(throughArgument.price.pl, 42);
assert.strictEqual(throughArgument.effects[0].operation, 'pierce-aligned-second-target');
assert.strictEqual(throughArgument.effects[0].dice, '1d8');
assert.ok(throughArgument.effects.some(function (effect) { return effect.operation === 'require-reload-action' && effect.actionCost === 'long'; }));
assert.doesNotMatch(throughArgument.effect, /\+\s*\d/);
assert.ok(fs.existsSync(path.resolve(__dirname,'..',throughArgument.image)));
assert.ok(fs.existsSync(path.resolve(__dirname,'..',throughArgument.imageThumb)));

var counterItems = economy.getCreatureCounterItems();
assert.strictEqual(counterItems.length, 12);
assert.deepStrictEqual(economy.validateCreatureCounterItems(), []);
assert.strictEqual(new Set(counterItems.map(function (item) { return item.id; })).size, 12);
assert.strictEqual(new Set(counterItems.map(function (item) { return item.image; })).size, 12);
assert.ok(counterItems.every(function (item) { return item.counterTargets.length >= 1; }));
assert.ok(counterItems.filter(function (item) { return item.tags.indexOf('reusable') >= 0; }).length >= 8);
assert.ok(counterItems.filter(function (item) { return item.charges > 1; }).length >= 3);
assert.ok(counterItems.some(function (item) { return item.category === 'weapon'; }));
assert.ok(counterItems.some(function (item) { return item.category === 'clothing'; }));
assert.ok(counterItems.some(function (item) { return item.category === 'jewelry'; }));
var explicitTypes = ['beast','plant','undead','construct','humanoid','demon','elemental','dragon','aberration','cursed','other'];
explicitTypes.forEach(function (type) {
  assert.ok(counterItems.some(function (item) { return item.counterTargets.indexOf(type) >= 0; }), 'missing counter for ' + type);
});
var counterAudit = economy.auditItemDefinitions(counterItems);
assert.strictEqual(counterAudit.length, 12);
assert.ok(counterAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(counterAudit.every(function (row) { return row.status === 'within-tier'; }));

var dragonCloak = counterItems.filter(function (item) { return item.id === 'shp_counter_08'; })[0];
assert.strictEqual(dragonCloak.effects[0].actionCost, 'reaction');
assert.strictEqual(dragonCloak.effects[0].operation, 'reduce-damage-dice');
var hunterTokens = counterItems.filter(function (item) { return item.id === 'shp_counter_12'; })[0];
assert.strictEqual(hunterTokens.counterTargets.length, 11);
assert.strictEqual(hunterTokens.effects[0].operation, 'prepare-counter');

var armorItems = economy.getArmorAndClothingItems();
assert.strictEqual(armorItems.length, 12);
assert.deepStrictEqual(economy.validateArmorAndClothingItems(), []);
assert.strictEqual(new Set(armorItems.map(function (item) { return item.id; })).size, 12);
assert.strictEqual(new Set(armorItems.map(function (item) { return item.image; })).size, 12);
assert.strictEqual(armorItems.filter(function (item) { return item.armorFamily === 'leather'; }).length, 3);
assert.strictEqual(armorItems.filter(function (item) { return item.armorFamily === 'studded-leather'; }).length, 3);
assert.strictEqual(armorItems.filter(function (item) { return item.armorFamily === 'chainmail'; }).length, 4);
assert.strictEqual(armorItems.filter(function (item) { return item.armorFamily === 'clothing'; }).length, 2);
assert.ok(armorItems.every(function (item) { return item.rarity === 'common' || item.rarity === 'uncommon'; }));
assert.ok(armorItems.filter(function (item) { return item.category === 'clothing'; }).every(function (item) {
  return !item.acBonus && !item.defense;
}));
assert.ok(armorItems.filter(function (item) { return item.armorFamily === 'leather'; }).every(function (item) {
  return item.acBonus === 1;
}));
assert.ok(armorItems.filter(function (item) { return item.armorFamily === 'studded-leather'; }).every(function (item) {
  return item.acBonus === 2;
}));
var armorAudit = economy.auditItemDefinitions(armorItems);
assert.strictEqual(armorAudit.length, 12);
assert.ok(armorAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(armorAudit.every(function (row) { return row.status === 'within-tier'; }));

var shields = economy.getShieldItems();
assert.strictEqual(shields.length,5);
assert.deepStrictEqual(economy.validateShieldItems(),[]);
assert.strictEqual(new Set(shields.map(function(item){return item.shieldRole;})).size,5);
assert.strictEqual(new Set(shields.map(function(item){return item.image;})).size,5);
assert.ok(shields.every(function(item){return /^images\/shop\/shield-\d{2}\.png$/.test(item.image);}));
assert.ok(shields.every(function(item){return /^images\/shop\/thumbs\/shield-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(shields.every(function(item){return item.cat==='armor' && item.category==='shield' && item.slot==='offHand' && item.handsRequired===1;}));
assert.ok(shields.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
shields.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var cuirasses = economy.getCuirassItems();
assert.strictEqual(cuirasses.length,4);
assert.deepStrictEqual(economy.validateCuirassItems(),[]);
assert.strictEqual(new Set(cuirasses.map(function(item){return item.cuirassRole;})).size,4);
assert.strictEqual(new Set(cuirasses.map(function(item){return item.image;})).size,4);
assert.ok(cuirasses.every(function(item){return /^images\/shop\/cuirass-\d{2}\.png$/.test(item.image);}));
assert.ok(cuirasses.every(function(item){return /^images\/shop\/thumbs\/cuirass-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(cuirasses.every(function(item){return item.cat==='armor' && item.category==='armor' && item.slot==='body' && item.handsRequired===0;}));
assert.ok(cuirasses.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
cuirasses.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});
var superheavyCuirass = cuirasses.filter(function(item){return item.weightClass==='superheavy';})[0];
assert.ok(superheavyCuirass);
assert.strictEqual(superheavyCuirass.rarity,'uncommon');
assert.ok(superheavyCuirass.effects.some(function(effect){return effect.operation==='prevent-forced-movement';}));
assert.ok(superheavyCuirass.effects.some(function(effect){return effect.operation==='block-dash';}));

var huntConsumables = economy.getCreatureHuntConsumableItems();
assert.strictEqual(huntConsumables.length, 20);
assert.deepStrictEqual(economy.validateCreatureHuntConsumableItems(), []);
assert.strictEqual(new Set(huntConsumables.map(function (item) { return item.id; })).size, 20);
assert.strictEqual(new Set(huntConsumables.map(function (item) { return item.image; })).size, 20);
assert.ok(huntConsumables.every(function (item) { return item.category === 'consumable'; }));
assert.ok(huntConsumables.every(function (item) { return item.charges === 1; }));
assert.ok(huntConsumables.every(function (item) { return item.counterTargets.length >= 1; }));
assert.strictEqual(huntConsumables.filter(function (item) { return item.delivery === 'weapon-coating'; }).length, 8);
assert.strictEqual(huntConsumables.filter(function (item) { return item.delivery === 'thrown'; }).length, 6);
assert.strictEqual(huntConsumables.filter(function (item) { return item.delivery === 'device'; }).length, 6);
assert.ok(huntConsumables.filter(function (item) { return item.delivery === 'weapon-coating'; }).every(function (item) { return item.cat === 'potion'; }));
assert.ok(huntConsumables.filter(function (item) { return item.delivery !== 'weapon-coating'; }).every(function (item) { return item.cat === 'tool'; }));
explicitTypes.forEach(function (type) {
  assert.ok(huntConsumables.some(function (item) { return item.counterTargets.indexOf(type) >= 0; }), 'missing consumable counter for ' + type);
});
var huntAudit = economy.auditItemDefinitions(huntConsumables);
assert.strictEqual(huntAudit.length, 20);
assert.ok(huntAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(huntAudit.every(function (row) { return row.status === 'within-tier'; }), JSON.stringify(huntAudit, null, 2));

var coldIronOil = huntConsumables.filter(function (item) { return item.id === 'shp_hunt_04'; })[0];
assert.strictEqual(coldIronOil.effects[1].operation, 'block-teleport');
var huntingOils = huntConsumables.filter(function (item) { return item.delivery === 'weapon-coating'; });
assert.ok(huntingOils.every(function (item) { return /3-rounds/.test(item.appliesTo); }));
assert.ok(huntingOils.every(function (item) { return !/\+1d4|получает \+1(?:\D|$)/.test(item.effect); }));
assert.ok(huntingOils.filter(function (item) { return item.id !== 'shp_hunt_07'; }).every(function (item) {
  return item.effects[0].dice === '1d6' && item.effects[0].maxHits >= 2;
}));
assert.strictEqual(huntingOils.filter(function (item) { return item.id === 'shp_hunt_07'; })[0].effects[0].operation, 'grant-advantage');
var memoryDust = huntConsumables.filter(function (item) { return item.id === 'shp_hunt_20'; })[0];
assert.strictEqual(memoryDust.counterTargets.length, 11);
assert.strictEqual(memoryDust.effects[1].operation, 'prevent-hide');

var expeditionGear = economy.getExpeditionGearItems();
assert.strictEqual(expeditionGear.length, 20);
assert.deepStrictEqual(economy.validateExpeditionGearItems(), []);
assert.strictEqual(new Set(expeditionGear.map(function (item) { return item.id; })).size, 20);
assert.strictEqual(new Set(expeditionGear.map(function (item) { return item.image; })).size, 20);
assert.ok(expeditionGear.every(function (item) { return item.category === 'tool'; }));
assert.ok(expeditionGear.every(function (item) { return item.rarity === 'common' || item.rarity === 'uncommon'; }));
['shp_expedition_14','shp_expedition_15','shp_expedition_16'].forEach(function (id) {
  var item = expeditionGear.filter(function (candidate) { return candidate.id === id; })[0];
  assert.ok(item && !/\+\s*1/.test(item.effect));
});
['shelter','water','cooking-fire','camp-tools','travel-support'].forEach(function (group) {
  assert.strictEqual(expeditionGear.filter(function (item) { return item.expeditionGroup === group; }).length, 4);
});
var expeditionAudit = economy.auditItemDefinitions(expeditionGear);
assert.ok(expeditionAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(expeditionAudit.every(function (row) { return row.status === 'within-tier'; }), JSON.stringify(expeditionAudit, null, 2));

var spellCatalog = require('../data.json').catalog.entries;
var scrolls = economy.getSpellScrollItems();
assert.strictEqual(scrolls.length, 15);
assert.deepStrictEqual(economy.validateSpellScrollItems(), []);
assert.strictEqual(new Set(scrolls.map(function (item) { return item.id; })).size, scrolls.length);
assert.strictEqual(new Set(scrolls.map(function (item) { return item.image; })).size, scrolls.length);
[1,2,3,4,5].forEach(function (level) {
  assert.strictEqual(scrolls.filter(function (item) { return item.spellLevel === level; }).length, 3);
});
var costlyScrolls = scrolls.filter(function (item) { return item.spellLevel === 5; });
assert.ok(costlyScrolls.every(function (item) { return item.rarity === 'legendary'; }));
assert.ok(costlyScrolls.every(function (item) { return economy.priceInGold(item.price) >= 450; }));
assert.ok(costlyScrolls.every(function (item) { return item.imageThumb && fs.existsSync(path.resolve(__dirname, '..', item.imageThumb)); }));
scrolls.forEach(function (item) {
  var source = spellCatalog.filter(function (spell) { return Number(spell.id) === item.spellRefId; })[0];
  assert.ok(source, 'missing catalog spell ' + item.spellRefId);
  assert.strictEqual(source.spellType, 'folio');
  assert.strictEqual(Number(source.level), item.spellLevel);
  assert.ok(String(source.name).indexOf(item.spellName) >= 0);
  assert.strictEqual(item.consumption.teachesSpell, false);
  assert.strictEqual(item.effects[0].operation, 'cast-catalog-spell');
});
var scrollAudit = economy.auditItemDefinitions(scrolls);
assert.ok(scrollAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(scrollAudit.every(function (row) { return row.status === 'within-tier'; }), JSON.stringify(scrollAudit, null, 2));
var scrollSnapshot = economy.definitionToInventorySnapshot(scrolls[0], 'scroll-1', 1);
assert.strictEqual(scrollSnapshot.spellRefId, scrolls[0].spellRefId);
assert.strictEqual(scrollSnapshot.spellLevel, 1);
assert.strictEqual(scrollSnapshot.consumption.teachesSpell, false);

var magicalConsumables = economy.getMagicalConsumableItems();
assert.strictEqual(magicalConsumables.length, 10);
assert.deepStrictEqual(economy.validateMagicalConsumableItems(), []);
assert.strictEqual(new Set(magicalConsumables.map(function (item) { return item.id; })).size, 10);
assert.strictEqual(new Set(magicalConsumables.map(function (item) { return item.image; })).size, 10);
assert.ok(magicalConsumables.every(function (item) { return item.cat === 'magic' && item.category === 'consumable'; }));
assert.ok(magicalConsumables.every(function (item) { return item.charges === 1; }));
assert.ok(magicalConsumables.every(function (item) { return item.consumption.mode === 'consume-on-use'; }));
var magicalConsumableAudit = economy.auditItemDefinitions(magicalConsumables);
assert.ok(magicalConsumableAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(magicalConsumableAudit.every(function (row) { return row.status === 'within-tier'; }), JSON.stringify(magicalConsumableAudit, null, 2));

var craftingComponents = economy.getCraftingComponentItems();
assert.strictEqual(craftingComponents.length, 10);
assert.deepStrictEqual(economy.validateCraftingComponentItems(), []);
assert.strictEqual(new Set(craftingComponents.map(function (item) { return item.id; })).size, 10);
assert.strictEqual(new Set(craftingComponents.map(function (item) { return item.image; })).size, 10);
assert.ok(craftingComponents.every(function (item) { return item.category === 'material'; }));
assert.ok(craftingComponents.every(function (item) { return item.crafting.consumedByRecipe === true; }));
assert.ok(craftingComponents.every(function (item) { return item.crafting.affinities.length >= 2; }));
assert.ok(craftingComponents.every(function (item) { return item.crafting.potionRefs.length >= 2; }));
assert.ok(craftingComponents.every(function (item) { return /Для зелий:/.test(item.effect); }));
var potionIds = new Set(economy.getPotionItems().map(function (item) { return item.id; }));
assert.ok(craftingComponents.every(function (item) { return item.crafting.potionRefs.every(function (id) { return potionIds.has(id); }); }));
var craftingAudit = economy.auditItemDefinitions(craftingComponents);
assert.ok(craftingAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(craftingAudit.every(function (row) { return row.status === 'within-tier'; }), JSON.stringify(craftingAudit, null, 2));
var craftingSnapshot = economy.definitionToInventorySnapshot(craftingComponents[0], 'craft-1', 3);
assert.strictEqual(craftingSnapshot.qty, 3);
assert.strictEqual(craftingSnapshot.crafting.grade, 1);
assert.strictEqual(craftingSnapshot.crafting.consumedByRecipe, true);

var alcohol = economy.getAlcoholItems();
assert.strictEqual(alcohol.length, 12);
assert.deepStrictEqual(economy.validateAlcoholItems(), []);
assert.ok(alcohol.every(function(item){return item.intoxication.strength >= 1 && item.intoxication.strength <= 5;}));
assert.strictEqual(economy.definitionToInventorySnapshot(alcohol[0], 'drink-1', 1).intoxication.strength, 1);

var movementGear = economy.getMovementGearItems();
assert.strictEqual(movementGear.length, 12);
assert.deepStrictEqual(economy.validateMovementGearItems(), []);
['shp_mobility_01','shp_mobility_06','shp_mobility_07','shp_mobility_08'].forEach(function (id) {
  var item = movementGear.filter(function (candidate) { return candidate.id === id; })[0];
  assert.ok(item && !/\+\s*1/.test(item.effect));
});

var artifacts = economy.getMinorArtifactItems();
assert.strictEqual(artifacts.length, 12);
assert.deepStrictEqual(economy.validateMinorArtifactItems(), []);
[1,2,3].forEach(function(level){assert.strictEqual(artifacts.filter(function(item){return item.artifactLevel===level;}).length,4);});

var potions = economy.getPotionItems();
assert.strictEqual(potions.length, 16);
assert.deepStrictEqual(economy.validatePotionItems(), []);
assert.strictEqual(potions.filter(function(item){return item.role==='healing';}).length,4);
assert.strictEqual(potions.filter(function(item){return item.id==='shp_potion_01';})[0].effects[0].dice,'2d4');
assert.strictEqual(potions.filter(function(item){return item.id==='shp_potion_02';})[0].effects[0].dice,'3d6');
assert.strictEqual(potions.filter(function(item){return item.id==='shp_potion_03';})[0].effects[0].dice,'5d6');
assert.ok(potions.slice(0,15).every(function(item){return !/\+\s*1 к одной|На 3 раунда \+1/.test(item.effect);}));
assert.strictEqual(potions.filter(function(item){return item.id==='shp_potion_11';})[0].effects[0].operation,'grant-advantage');
assert.strictEqual(potions.filter(function(item){return item.id==='shp_potion_14';})[0].effects[0].operation,'perfect-route-recall');
var invisibilityPotion = potions.filter(function(item){return item.id==='shp_potion_16';})[0];
assert.strictEqual(invisibilityPotion.effects[0].operation,'apply-status');
assert.strictEqual(invisibilityPotion.effects[0].status,'invisible');
assert.strictEqual(invisibilityPotion.effects[0].durationRounds,3);
assert.deepStrictEqual(invisibilityPotion.effects[0].endsOn,['attack','harmful-spell']);
assert.match(invisibilityPotion.desc,/услышать/);
assert.match(invisibilityPotion.desc,/дым/);
assert.match(invisibilityPotion.desc,/жидкост/);
assert.ok(fs.existsSync(path.resolve(__dirname,'..',invisibilityPotion.image)));
assert.ok(fs.existsSync(path.resolve(__dirname,'..',invisibilityPotion.imageThumb)));

var adornments = economy.getMagicAdornmentItems();
assert.strictEqual(adornments.length, 15);
assert.deepStrictEqual(economy.validateMagicAdornmentItems(), []);
assert.ok(adornments.every(function(item){return /^images\/shop\/(ring|amulet|charm)-\d{2}\.png$/.test(item.image); }));
assert.strictEqual(new Set(adornments.map(function(item){return item.image;})).size,15);
['ring','amulet','charm'].forEach(function(kind){assert.strictEqual(adornments.filter(function(item){return item.kind===kind;}).length,5);});

var spellFormItems = economy.getSpellFormItems();
assert.strictEqual(spellFormItems.length,4);
assert.deepStrictEqual(economy.validateSpellFormItems(),[]);
assert.deepStrictEqual(spellFormItems.map(function(item){return item.spellForm;}).sort(),['area','concentration','directed','touch']);
assert.ok(spellFormItems.every(function(item){return item.charges===1&&item.maxCharges===1&&item.recharge==='next-combat';}));
assert.ok(spellFormItems.every(function(item){return item.effects.every(function(effect){return effect.frequency==='combat'&&effect.charges===1&&effect.recharge==='next-combat';});}));
assert.ok(spellFormItems.every(function(item){return /^images\/shop\/spell-form-[a-z-]+\.png$/.test(item.image)&&/^images\/shop\/thumbs\/spell-form-[a-z-]+\.jpg$/.test(item.imageThumb);}));
spellFormItems.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});
var areaSpellFormItem = spellFormItems.filter(function(item){return item.spellForm==='area';})[0];
assert.strictEqual(areaSpellFormItem.effects[0].targetLimit,1);
var spellFormSnapshot = economy.definitionToInventorySnapshot(spellFormItems[0],'spell-form-ring-1',1);
assert.strictEqual(spellFormSnapshot.charges,1);
assert.strictEqual(spellFormSnapshot.maxCharges,1);
assert.strictEqual(spellFormSnapshot.recharge,'next-combat');

var spellCategoryItems = economy.getSpellCategoryItems();
assert.strictEqual(spellCategoryItems.length,5);
assert.deepStrictEqual(economy.validateSpellCategoryItems(),[]);
assert.deepStrictEqual(spellCategoryItems.map(function(item){return item.spellCategory;}).sort(),['control','healing','movement','protection','summon']);
assert.ok(spellCategoryItems.every(function(item){return item.charges===1&&item.maxCharges===1&&item.recharge==='next-combat';}));
assert.ok(spellCategoryItems.every(function(item){return item.effects.every(function(effect){return effect.frequency==='combat'&&effect.charges===1&&effect.recharge==='next-combat';});}));
assert.ok(spellCategoryItems.every(function(item){return /^images\/shop\/spell-category-[a-z-]+\.png$/.test(item.image)&&/^images\/shop\/thumbs\/spell-category-[a-z-]+\.jpg$/.test(item.imageThumb);}));
spellCategoryItems.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});
var controlCategoryItem = spellCategoryItems.filter(function(item){return item.spellCategory==='control';})[0];
assert.strictEqual(controlCategoryItem.effects[0].operation,'impose-disadvantage');
assert.strictEqual(controlCategoryItem.effects[0].targetLimit,1);
var movementCategoryItem = spellCategoryItems.filter(function(item){return item.spellCategory==='movement';})[0];
assert.strictEqual(movementCategoryItem.effects[0].distanceScale,0.5);
assert.strictEqual(movementCategoryItem.effects[0].minimumCells,2);
assert.match(movementCategoryItem.effect,/без ответного удара/);
assert.ok(economy.auditItemDefinitions(spellCategoryItems).every(function(row){return row.status==='within-tier'&&row.confidence==='structured';}));

var blackMarket = economy.getBlackMarketItems();
assert.strictEqual(blackMarket.length, 15);
assert.deepStrictEqual(economy.validateBlackMarketItems(), []);
assert.ok(blackMarket.every(function(item){return item.access.markets.indexOf('secret')>=0;}));
assert.ok(blackMarket.every(function(item){return /^images\/shop\/black-market-\d{2}\.png$/.test(item.image); }));
assert.strictEqual(new Set(blackMarket.map(function(item){return item.image;})).size,15);

var forbiddenGoods = economy.getForbiddenGoodsItems();
assert.strictEqual(forbiddenGoods.length,12);
assert.deepStrictEqual(economy.validateForbiddenGoodsItems(),[]);
assert.strictEqual(forbiddenGoods.filter(function(item){return item.tags.indexOf('fictional-drug')>=0;}).length,6);
assert.strictEqual(new Set(forbiddenGoods.map(function(item){return item.contrabandKind;})).size,12);
assert.strictEqual(new Set(forbiddenGoods.map(function(item){return item.image;})).size,12);
assert.ok(forbiddenGoods.every(function(item){return /^images\/shop\/forbidden-good-\d{2}\.png$/.test(item.image);}));
assert.ok(forbiddenGoods.every(function(item){return /^images\/shop\/thumbs\/forbidden-good-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(forbiddenGoods.every(function(item){return item.cat==='contraband' && item.access.legality==='forbidden';}));
assert.ok(forbiddenGoods.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
forbiddenGoods.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var thiefGear = economy.getThiefGearItems();
assert.strictEqual(thiefGear.length,6);
assert.deepStrictEqual(economy.validateThiefGearItems(),[]);
assert.strictEqual(new Set(thiefGear.map(function(item){return item.image;})).size,6);
assert.ok(thiefGear.every(function(item){return /^images\/shop\/thief-gear-\d{2}\.png$/.test(item.image);}));
assert.ok(thiefGear.every(function(item){return /^images\/shop\/thumbs\/thief-gear-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(thiefGear.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
assert.ok(thiefGear.some(function(item){return item.thiefRole==='restraint';}));
assert.ok(thiefGear.some(function(item){return item.thiefRole==='lockpicks-basic';}));
assert.ok(thiefGear.some(function(item){return item.thiefRole==='lockpicks-expert';}));
assert.ok(thiefGear.some(function(item){return item.thiefRole==='disguise-kit';}));
assert.ok(thiefGear.some(function(item){return item.thiefRole==='magic-disguise';}));
thiefGear.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});
var throwingNet = economy.getCreatureCounterItems().filter(function(item){return item.id==='shp_counter_05';})[0];
assert.match(throwingNet.name,/Сеть метательная/);

var arcaneFocuses = economy.getArcaneFocusItems();
assert.strictEqual(arcaneFocuses.length,25);
assert.deepStrictEqual(economy.validateArcaneFocusItems(),[]);
var focusKindCounts = {staff:8,wand:7,scepter:4,bracer:3,glove:3};
Object.keys(focusKindCounts).forEach(function(kind){
  assert.strictEqual(arcaneFocuses.filter(function(item){return item.focusKind===kind;}).length,focusKindCounts[kind]);
});
assert.strictEqual(new Set(arcaneFocuses.map(function(item){return item.image;})).size,25);
assert.ok(arcaneFocuses.every(function(item){return /^images\/shop\/focus-[a-z0-9-]+\.png$/.test(item.image);}));
assert.ok(arcaneFocuses.every(function(item){return /^images\/shop\/thumbs\/focus-[a-z0-9-]+\.jpg$/.test(item.imageThumb);}));
assert.ok(arcaneFocuses.every(function(item){return !/\+\s*1/.test(item.effect);}));
assert.ok(arcaneFocuses.every(function(item){return item.definitionVersion===2 && item.focusRole;}));
assert.ok(arcaneFocuses.every(function(item){return item.effects.some(function(effect){return effect.operation!=='cast-catalog-spell' && /spell|caster/.test(String(effect.trigger||''));});}));
assert.ok(arcaneFocuses.filter(function(item){return item.focusKind==='scepter';}).every(function(item){return item.damageFormula==='1d6' && item.access.legality==='restricted';}));
assert.ok(arcaneFocuses.filter(function(item){return item.focusKind==='scepter';}).every(function(item){return !item.effects.some(function(effect){return effect.trigger==='ranged-hit-once-per-combat';});}));
assert.ok(arcaneFocuses.filter(function(item){return item.focusKind==='bracer';}).every(function(item){return item.slot==='wrists' && item.handsRequired===0;}));
assert.ok(arcaneFocuses.filter(function(item){return item.focusKind==='glove';}).every(function(item){return item.slot==='hands' && item.handsRequired===0;}));
var boundFocuses = arcaneFocuses.filter(function(item){return item.boundSpell;});
assert.strictEqual(boundFocuses.length,9);
boundFocuses.forEach(function(item){
  var source = spellCatalog.filter(function(spell){return Number(spell.id)===Number(item.boundSpell.spellRefId);})[0];
  assert.ok(source,'missing bound catalog spell '+item.boundSpell.spellRefId);
  assert.strictEqual(String(source.name).replace(/^[^А-ЯA-Z]+/i,''),item.boundSpell.spellName);
  assert.strictEqual(Number(source.level),item.boundSpell.spellLevel);
  assert.ok(item.effects.some(function(effect){return effect.operation==='cast-catalog-spell' && Number(effect.spellRefId)===Number(item.boundSpell.spellRefId);}));
});

var prostheses = economy.getProsthesisItems();
assert.strictEqual(prostheses.length,7);
assert.deepStrictEqual(economy.validateProsthesisItems(),[]);
assert.strictEqual(new Set(prostheses.map(function(item){return item.prosthesisSlot;})).size,7);
assert.strictEqual(new Set(prostheses.map(function(item){return item.image;})).size,7);
assert.ok(prostheses.every(function(item){return /^images\/shop\/prosthesis-\d{2}\.png$/.test(item.image);}));
assert.ok(prostheses.every(function(item){return /^images\/shop\/thumbs\/prosthesis-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(prostheses.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
assert.ok(prostheses.some(function(item){return item.rarity==='common';}));
assert.ok(prostheses.some(function(item){return item.rarity==='uncommon';}));
assert.ok(prostheses.some(function(item){return item.rarity==='rare';}));
assert.ok(prostheses.some(function(item){return item.rarity==='epic';}));
prostheses.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var transports = economy.getTransportItems();
assert.strictEqual(transports.length,21);
assert.deepStrictEqual(economy.validateTransportItems(),[]);
[{kind:'horse',count:4},{kind:'wagon',count:13},{kind:'boat',count:4}].forEach(function(expected){
  assert.strictEqual(transports.filter(function(item){return item.transportKind===expected.kind;}).length,expected.count);
});
['stagecoach','carriage','cart'].forEach(function(kind){
  assert.strictEqual(transports.filter(function(item){return item.roadVehicleKind===kind;}).length,3);
});
assert.strictEqual(new Set(transports.map(function(item){return item.image;})).size,21);
assert.ok(transports.every(function(item){return /^images\/shop\/transport-[a-z0-9-]+\.png$/.test(item.image);}));
assert.ok(transports.every(function(item){return /^images\/shop\/thumbs\/transport-[a-z0-9-]+\.jpg$/.test(item.imageThumb);}));
assert.ok(transports.every(function(item){return item.cat==='mount' && item.capacityKg>0;}));
assert.ok(transports.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
assert.ok(transports.filter(function(item){return item.roadVehicleKind;}).every(function(item){return item.tags.indexOf(item.roadVehicleKind)>=0;}));
transports.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var saddles = economy.getSaddleItems();
assert.strictEqual(saddles.length,6);
assert.deepStrictEqual(economy.validateSaddleItems(),[]);
assert.strictEqual(new Set(saddles.map(function(item){return item.saddleRole;})).size,6);
assert.strictEqual(new Set(saddles.map(function(item){return item.image;})).size,6);
assert.ok(saddles.every(function(item){return item.cat==='mount' && item.category==='saddle' && item.slot==='mountBack';}));
assert.ok(saddles.every(function(item){return item.tags.indexOf('saddle')>=0 && item.compatibleMounts.indexOf('horse')>=0;}));
assert.ok(saddles.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
var saddleAudit = economy.auditItemDefinitions(saddles);
assert.ok(saddleAudit.every(function(row){return row.confidence==='structured';}));
assert.ok(saddleAudit.every(function(row){return row.status==='within-tier';}),JSON.stringify(saddleAudit,null,2));
saddles.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var trainedAnimals = economy.getTrainedAnimalItems();
assert.strictEqual(trainedAnimals.length,3);
assert.deepStrictEqual(economy.validateTrainedAnimalItems(),[]);
assert.strictEqual(new Set(trainedAnimals.map(function(item){return item.trainedRole;})).size,3);
assert.strictEqual(new Set(trainedAnimals.map(function(item){return item.image;})).size,3);
assert.ok(trainedAnimals.every(function(item){return /^images\/shop\/trained-animal-\d{2}\.png$/.test(item.image);}));
assert.ok(trainedAnimals.every(function(item){return /^images\/shop\/thumbs\/trained-animal-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(trainedAnimals.every(function(item){return item.cat==='mount' && item.category==='trained-animal' && item.tags.indexOf('animal')>=0;}));
assert.ok(trainedAnimals.every(function(item){return item.care && item.care.feed && item.care.rest;}));
assert.ok(trainedAnimals.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
trainedAnimals.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var ammunitionAndSiege = economy.getAmmunitionAndSiegeItems();
assert.strictEqual(ammunitionAndSiege.length,12);
assert.deepStrictEqual(economy.validateAmmunitionAndSiegeItems(),[]);
assert.strictEqual(ammunitionAndSiege.filter(function(item){return item.munitionKind==='arrow';}).length,4);
assert.strictEqual(ammunitionAndSiege.filter(function(item){return item.munitionKind==='bolt';}).length,4);
assert.strictEqual(ammunitionAndSiege.filter(function(item){return item.munitionKind.indexOf('siege')===0;}).length,4);
assert.strictEqual(new Set(ammunitionAndSiege.map(function(item){return item.image;})).size,12);
assert.ok(ammunitionAndSiege.every(function(item){return /^images\/shop\/(ammunition-(arrow|bolt)|siege-weapon)-\d{2}\.png$/.test(item.image);}));
assert.ok(ammunitionAndSiege.every(function(item){return /^images\/shop\/thumbs\/(ammunition-(arrow|bolt)|siege-weapon)-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(ammunitionAndSiege.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
assert.ok(ammunitionAndSiege.filter(function(item){return item.munitionKind==='siege-weapon';}).every(function(item){return item.crew>=1 && item.mountRequired;}));
ammunitionAndSiege.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var services = economy.getServiceItems();
assert.strictEqual(services.length,12);
assert.deepStrictEqual(economy.validateServiceItems(),[]);
assert.strictEqual(new Set(services.map(function(item){return item.serviceKind;})).size,12);
assert.strictEqual(new Set(services.map(function(item){return item.image;})).size,12);
assert.ok(services.every(function(item){return /^images\/shop\/service-\d{2}\.png$/.test(item.image);}));
assert.ok(services.every(function(item){return /^images\/shop\/thumbs\/service-\d{2}\.jpg$/.test(item.imageThumb);}));
assert.ok(services.every(function(item){return item.cat==='service' && item.category==='service' && item.nonInventory;}));
assert.ok(services.every(function(item){return item.consumption.mode==='service-on-purchase';}));
assert.ok(services.every(function(item){return !/\+\s*\d|−\s*\d/.test(item.effect);}));
services.forEach(function(item){
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

var poisons = economy.getPoisonItems();
assert.strictEqual(poisons.length, 12);
assert.deepStrictEqual(economy.validatePoisonItems(), []);
assert.ok(poisons.every(function(item){return item.access.legality==='forbidden' && item.charges===1;}));
assert.ok(poisons.every(function(item){return /^images\/shop\/poison-\d{2}\.png$/.test(item.image); }));
assert.strictEqual(new Set(poisons.map(function(item){return item.image;})).size,12);

var loreGoods = economy.getLoreGoodsItems();
assert.strictEqual(loreGoods.length, 19);
assert.deepStrictEqual(economy.validateLoreGoodsItems(), []);
assert.ok(loreGoods.every(function(item){return item.tags.indexOf('nonmagical')>=0;}));
assert.ok(loreGoods.every(function(item){return item.access.legality==='open';}));
assert.ok(loreGoods.every(function(item){return /^images\/shop\/lore-goods-\d{2}\.png$/.test(item.image);}));
assert.strictEqual(loreGoods.filter(function(item){return item.goodsGroup==='alcohol';}).length,3);
assert.strictEqual(loreGoods.filter(function(item){return item.goodsGroup==='boots';}).length,1);
assert.strictEqual(loreGoods.filter(function(item){return item.goodsGroup==='climbing';}).length,1);
assert.strictEqual(loreGoods.filter(function(item){return item.goodsGroup==='cloak';}).length,3);
assert.strictEqual(loreGoods.filter(function(item){return item.goodsGroup==='instrument';}).length,3);
assert.strictEqual(loreGoods.filter(function(item){return item.goodsGroup==='melee-weapon';}).length,4);
assert.strictEqual(loreGoods.filter(function(item){return item.goodsGroup==='ranged-weapon';}).length,4);
assert.ok(loreGoods.every(function(item){return !item.effects.some(function(effect){return effect.operation==='check-bonus'||effect.operation==='check-penalty';});}));
var apprenticeClimbingKit = items.filter(function(item){return item.id==='shp_foundation_11';})[0];
assert.strictEqual(apprenticeClimbingKit.name,'Ученический комплект Лесорубки');
assert.strictEqual(apprenticeClimbingKit.image,'images/shop/lore-goods-05.png');
assert.ok(apprenticeClimbingKit.effects.every(function(effect){return effect.operation!=='check-bonus'&&effect.operation!=='check-penalty';}));

var necromancyItems = economy.getNecromancyItems();
assert.strictEqual(necromancyItems.length,6);
assert.deepStrictEqual(economy.validateNecromancyItems(), []);
assert.ok(necromancyItems.every(function(item){return item.tags.indexOf('necromancy')>=0;}));
assert.ok(necromancyItems.every(function(item){return item.access.markets.indexOf('secret')>=0;}));
assert.strictEqual(necromancyItems.filter(function(item){return item.necromancyClass==='secret';}).length,3);
assert.strictEqual(necromancyItems.filter(function(item){return item.necromancyClass==='forbidden';}).length,3);
assert.ok(necromancyItems.filter(function(item){return item.necromancyClass==='forbidden';}).every(function(item){return item.access.legality==='forbidden';}));
assert.ok(necromancyItems.every(function(item){return /^images\/shop\/necromancy-\d{2}\.png$/.test(item.image);}));

var currencyItems = economy.getCurrencyItems();
assert.strictEqual(currencyItems.length,4);
assert.deepStrictEqual(currencyItems.map(function(item){return item.id;}),['shp_currency_copper','shp_currency_silver','shp_currency_gold','shp_currency_platinum']);
assert.deepStrictEqual(currencyItems.map(function(item){return economy.priceInGold(item.price);}),[0.01,0.1,1,10]);
assert.ok(currencyItems.every(function(item){return item.powerTier===0 && item.effects.length===0;}));
assert.ok(currencyItems.every(function(item){return item.tags.indexOf('currency')>=0 && item.tags.indexOf('nonmagical')>=0;}));
assert.ok(currencyItems.every(function(item){return /^images\/shop\/zargota-coin-(copper|silver|gold|platinum)\.webp$/.test(item.image);}));
assert.ok(currencyItems.every(function(item){return /^images\/shop\/thumbs\/zargota-coin-(copper|silver|gold|platinum)\.jpg$/.test(item.imageThumb);}));
currencyItems.forEach(function(item){
  assert.deepStrictEqual(economy.validateItemDefinition(item),[]);
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.image)));
  assert.ok(fs.existsSync(path.resolve(__dirname,'..',item.imageThumb)));
});

[alcohol,movementGear,artifacts,potions,adornments,blackMarket,forbiddenGoods,thiefGear,arcaneFocuses,prostheses,transports,trainedAnimals,ammunitionAndSiege,shields,cuirasses,services,poisons,loreGoods,necromancyItems].forEach(function(group){
  var rows=economy.auditItemDefinitions(group);
  assert.ok(rows.every(function(row){return row.confidence==='structured';}));
  assert.ok(rows.every(function(row){return row.status==='within-tier';}),JSON.stringify(rows,null,2));
});

var allShopSeedItems = economy.getShopSeedItems();
assert.strictEqual(new Set(allShopSeedItems.map(function (item) { return item.id; })).size, allShopSeedItems.length);
var shopRegions = economy.getShopRegions();
var shopMarkets = economy.getShopMarkets();
var regionIds = new Set(shopRegions.map(function(region){return region.id;}));
var marketIds = new Set(shopMarkets.map(function(market){return market.id;}));
assert.ok(shopRegions.some(function(region){return region.id === 'zargota-all' && region.includes.length === 4;}));
assert.strictEqual(shopRegions.filter(function(region){return region.label === 'Вся Заргота';}).length,1);
assert.ok(!shopRegions.some(function(region){return region.id === 'zargota' || region.label === 'Общезарготское';}));
assert.ok(shopMarkets.some(function(market){return market.id === 'glupishche-last-rest' && /Симур/.test(market.owner);}));
assert.ok(shopMarkets.some(function(market){return market.id === 'glupishche-hypnoks-eye' && /Дельмарис/.test(market.description);}));
assert.ok(shopMarkets.some(function(market){return market.id === 'glupishche-tuk-da-bryak' && market.stock.length === 4;}));
assert.ok(shopMarkets.every(function(market){return fs.existsSync(path.resolve(__dirname,'..','images/shop/market-crests',market.id+'.png'));}));
assert.ok(allShopSeedItems.every(function(item){return regionIds.has(item.baseRegion);}));
assert.ok(allShopSeedItems.every(function(item){return Array.isArray(item.marketIds) && item.marketIds.length && item.marketIds.every(function(id){return marketIds.has(id);});}));
assert.ok(allShopSeedItems.filter(function(item){return item.image;}).every(function(item){return /^images\/shop\/thumbs\/.+\.jpg$/.test(item.imageThumb);}));
assert.ok(allShopSeedItems.filter(function(item){return item.imageThumb;}).every(function(item){return fs.existsSync(path.resolve(__dirname,'..',item.imageThumb));}));
assert.ok(economy.getMovementGearItems().every(function(item){return !!item.rarity;}));
var renderedImages = allShopSeedItems.map(function (item) { return item.image; }).filter(Boolean);
assert.strictEqual(new Set(renderedImages).size, renderedImages.length);

var invalid = Object.assign({}, items[0], {
  id:'bad id',
  powerTier:9,
  recommendedLevel:{min:8,max:2},
  access:{markets:['unknown']},
  effects:[{type:'unknown',stacking:'forever'}]
});
var errors = economy.validateItemDefinition(invalid);
assert.ok(errors.length >= 6);

console.log('item economy tests passed');
