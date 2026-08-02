'use strict';

var assert = require('assert');
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
assert.strictEqual(economy.getShopSeedItems().length, 266);
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
assert.strictEqual(weapons.length, 20);
assert.deepStrictEqual(economy.validateWeaponItems(), []);
assert.strictEqual(new Set(weapons.map(function (item) { return item.id; })).size, 20);
assert.strictEqual(new Set(weapons.map(function (item) { return item.image; })).size, 20);
assert.ok(weapons.every(function (item) { return item.category === 'weapon'; }));
assert.ok(weapons.every(function (item) { return item.damageFormula === item.damage; }));
assert.ok(weapons.every(function (item) { return item.handsRequired === 1 || item.handsRequired === 2; }));
assert.ok(weapons.some(function (item) { return item.tags.indexOf('ranged') >= 0; }));
assert.ok(weapons.some(function (item) { return item.tags.indexOf('polearm') >= 0; }));
assert.ok(weapons.some(function (item) { return item.requirements && item.requirements.length; }));
var weaponAudit = economy.auditItemDefinitions(weapons);
assert.strictEqual(weaponAudit.length, 20);
assert.ok(weaponAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(weaponAudit.every(function (row) { return row.status === 'within-tier'; }));

var harpoon = weapons.filter(function (item) { return item.id === 'shp_weapon_17'; })[0];
assert.strictEqual(harpoon.effects[0].operation, 'pull-cells');
assert.strictEqual(harpoon.handsRequired, 2);

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
['shelter','water','cooking-fire','camp-tools','travel-support'].forEach(function (group) {
  assert.strictEqual(expeditionGear.filter(function (item) { return item.expeditionGroup === group; }).length, 4);
});
var expeditionAudit = economy.auditItemDefinitions(expeditionGear);
assert.ok(expeditionAudit.every(function (row) { return row.confidence === 'structured'; }));
assert.ok(expeditionAudit.every(function (row) { return row.status === 'within-tier'; }), JSON.stringify(expeditionAudit, null, 2));

var spellCatalog = require('../data.json').catalog.entries;
var scrolls = economy.getSpellScrollItems();
assert.strictEqual(scrolls.length, 12);
assert.deepStrictEqual(economy.validateSpellScrollItems(), []);
assert.strictEqual(new Set(scrolls.map(function (item) { return item.id; })).size, 12);
assert.strictEqual(new Set(scrolls.map(function (item) { return item.image; })).size, 12);
[1,2,3,4].forEach(function (level) {
  assert.strictEqual(scrolls.filter(function (item) { return item.spellLevel === level; }).length, 3);
});
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

var artifacts = economy.getMinorArtifactItems();
assert.strictEqual(artifacts.length, 12);
assert.deepStrictEqual(economy.validateMinorArtifactItems(), []);
[1,2,3].forEach(function(level){assert.strictEqual(artifacts.filter(function(item){return item.artifactLevel===level;}).length,4);});

var potions = economy.getPotionItems();
assert.strictEqual(potions.length, 15);
assert.deepStrictEqual(economy.validatePotionItems(), []);
assert.strictEqual(potions.filter(function(item){return item.role==='healing';}).length,4);

var adornments = economy.getMagicAdornmentItems();
assert.strictEqual(adornments.length, 15);
assert.deepStrictEqual(economy.validateMagicAdornmentItems(), []);
assert.ok(adornments.every(function(item){return /^images\/shop\/(ring|amulet|charm)-\d{2}\.png$/.test(item.image); }));
assert.strictEqual(new Set(adornments.map(function(item){return item.image;})).size,15);
['ring','amulet','charm'].forEach(function(kind){assert.strictEqual(adornments.filter(function(item){return item.kind===kind;}).length,5);});

var blackMarket = economy.getBlackMarketItems();
assert.strictEqual(blackMarket.length, 15);
assert.deepStrictEqual(economy.validateBlackMarketItems(), []);
assert.ok(blackMarket.every(function(item){return item.access.markets.indexOf('secret')>=0;}));
assert.ok(blackMarket.every(function(item){return /^images\/shop\/black-market-\d{2}\.png$/.test(item.image); }));
assert.strictEqual(new Set(blackMarket.map(function(item){return item.image;})).size,15);

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

[alcohol,movementGear,artifacts,potions,adornments,blackMarket,poisons,loreGoods,necromancyItems].forEach(function(group){
  var rows=economy.auditItemDefinitions(group);
  assert.ok(rows.every(function(row){return row.confidence==='structured';}));
  assert.ok(rows.every(function(row){return row.status==='within-tier';}),JSON.stringify(rows,null,2));
});

var allShopSeedItems = economy.getShopSeedItems();
assert.strictEqual(new Set(allShopSeedItems.map(function (item) { return item.id; })).size, allShopSeedItems.length);
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
