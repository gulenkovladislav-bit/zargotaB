'use strict';

var assert = require('assert');
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
assert.strictEqual(mixedResult.weapon.name, 'Сабля');
assert.strictEqual(mixedResult.weapon.damageFormula, '1d8');
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

console.log('equipment rules tests passed');
