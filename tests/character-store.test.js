'use strict';

var assert = require('assert');
var store = require('../character-store.js');

var templates = {
  templateVersion: '1.0.0',
  heroes: [
    { id: 1, campaignKey: 'evan', name: 'Шаблон Еван', hpCur: 10 },
    { id: 2, campaignKey: 'melissa', name: 'Мелисса', hpCur: 12 }
  ]
};

var existing = [{ id: 1, campaignKey: 'evan', name: 'Пользовательский Еван', hpCur: 3, revision: 7 }];
var first = store.mergeStarterHeroes(existing, templates, {}, 123);
assert.deepStrictEqual(first.added, ['melissa']);
assert.strictEqual(first.characters.length, 2);
assert.strictEqual(first.characters[0].name, 'Пользовательский Еван');
assert.strictEqual(first.characters[0].hpCur, 3);
assert.strictEqual(first.characters[0].revision, 7);
assert.strictEqual(first.characters[1].starterTemplateVersion, '1.0.0');
assert.strictEqual(first.characters[1].revision, 0);

var repeated = store.mergeStarterHeroes(first.characters, templates, {}, 456);
assert.deepStrictEqual(repeated.added, []);
assert.strictEqual(repeated.characters.length, 2);
assert.strictEqual(repeated.characters[0].name, 'Пользовательский Еван');

var tombstoned = store.mergeStarterHeroes([], templates, { evan: { deletedAt: 1 } }, 789);
assert.deepStrictEqual(tombstoned.added, ['melissa']);
assert.strictEqual(tombstoned.characters.some(function(character) {
  return character.campaignKey === 'evan';
}), false);

var mergedStores = store.mergeStoredCollections(
  [{ id: 1, name: 'LS', _updatedAt: 20 }, { id: 3, name: 'LS only' }],
  [{ id: 1, name: 'IDB stale', _updatedAt: 10 }, { id: 2, name: 'IDB only' }]
);
assert.deepStrictEqual(mergedStores.map(function(character) { return character.name; }), ['LS', 'LS only', 'IDB only']);

var revisionCharacters = [
  { id: 'a', name: 'A', revision: 4, _updatedAt: 10 },
  { id: 'b', name: 'B', revision: 9, _updatedAt: 20 }
];
store.rememberCollection(revisionCharacters);
revisionCharacters[0].name = 'A changed';
var revisionPlan = store.prepareCollectionForSave(revisionCharacters, { now: 100 });
assert.deepStrictEqual(revisionPlan.changedIds, ['a']);
assert.strictEqual(revisionCharacters[0].revision, 5);
assert.strictEqual(revisionCharacters[0]._updatedAt, 100);
assert.strictEqual(revisionCharacters[1].revision, 9);
assert.strictEqual(revisionCharacters[1]._updatedAt, 20);
assert.deepStrictEqual(store.prepareCollectionForSave(revisionCharacters, { now: 200 }).changedIds, []);
revisionCharacters[0].name = 'Retry after failure';
var failedPlan = store.prepareCollectionForSave(revisionCharacters, { now: 250 });
store.markCollectionSaveFailed(failedPlan.changedIds);
assert.deepStrictEqual(store.prepareCollectionForSave(revisionCharacters, { now: 260 }).changedIds, ['a']);
revisionCharacters[0].name = 'Room value';
revisionCharacters[0].revision = 12;
var remotePlan = store.prepareCollectionForSave(revisionCharacters, { now: 300, preserveRevision: true });
assert.deepStrictEqual(remotePlan.changedIds, ['a']);
assert.strictEqual(revisionCharacters[0].revision, 12);

var legacyInventoryCharacter = {
  id: 'legacy-inventory',
  inventory: '- 2x Зелье лечения\n• Старый ключ; Факел x3',
  equipItems: ['Старый меч']
};
var inventoryMigration = store.normalizeCharacterInventory(legacyInventoryCharacter);
assert.strictEqual(inventoryMigration.changed, true);
assert.strictEqual(inventoryMigration.migratedLegacyText, true);
assert.strictEqual(legacyInventoryCharacter.inventory, '- 2x Зелье лечения\n• Старый ключ; Факел x3');
assert.deepStrictEqual(legacyInventoryCharacter.inventoryItems.map(function(item) {
  return [item.name, item.qty];
}), [['Зелье лечения', 2], ['Старый ключ', 1], ['Факел', 3]]);
assert.strictEqual(legacyInventoryCharacter.equipItems[0].name, 'Старый меч');
legacyInventoryCharacter.inventoryItems.concat(legacyInventoryCharacter.equipItems).forEach(function(item) {
  assert.match(item.itemId, /^zg-item-legacy-inventory-[ie]-/);
});
var migratedItemIds = legacyInventoryCharacter.inventoryItems.map(function(item) { return item.itemId; });
assert.strictEqual(store.normalizeCharacterInventory(legacyInventoryCharacter).changed, false);
assert.deepStrictEqual(legacyInventoryCharacter.inventoryItems.map(function(item) { return item.itemId; }), migratedItemIds);
legacyInventoryCharacter.inventoryItems[0].name = 'Переименованное зелье';
store.normalizeCharacterInventory(legacyInventoryCharacter);
assert.strictEqual(legacyInventoryCharacter.inventoryItems[0].itemId, migratedItemIds[0]);

var existingStructuredInventory = {
  id: 'structured',
  inventory: 'Этот старый текст не должен создать дубликат',
  inventoryItems: [{ name:'Карта', qty:0, itemId:'kept-item-id' }]
};
var structuredMigration = store.normalizeCharacterInventory(existingStructuredInventory);
assert.strictEqual(structuredMigration.migratedLegacyText, false);
assert.strictEqual(existingStructuredInventory.inventoryItems.length, 1);
assert.strictEqual(existingStructuredInventory.inventoryItems[0].itemId, 'kept-item-id');
assert.strictEqual(existingStructuredInventory.inventoryItems[0].qty, 1);

var duplicatedEquipmentCharacter = {
  id: 'equipped-copy',
  inventoryItems: [{
    itemId:'shared-sword',
    name:'Меч',
    description:'Полное описание',
    image:'images/sword.png',
    qty:1
  }],
  equipItems: [{
    itemId:'shared-sword',
    name:'Меч',
    description:'Полное описание',
    image:'images/sword.png',
    equipped:true,
    slot:'weapon',
    _sourceInventoryIndex:0
  }]
};
var equipmentMigration = store.normalizeCharacterInventory(duplicatedEquipmentCharacter);
assert.strictEqual(equipmentMigration.collapsedEquipmentCopies, 1);
assert.strictEqual(duplicatedEquipmentCharacter.equipItems.length, 0);
assert.strictEqual(duplicatedEquipmentCharacter.inventoryItems[0].equipped, true);
assert.strictEqual(duplicatedEquipmentCharacter.inventoryItems[0].slot, 'weapon');
assert.strictEqual(duplicatedEquipmentCharacter.inventoryItems[0].description, 'Полное описание');
assert.strictEqual(duplicatedEquipmentCharacter.inventoryItems[0].image, 'images/sword.png');
assert.strictEqual(store.normalizeCharacterInventory(duplicatedEquipmentCharacter).collapsedEquipmentCopies, 0);

var staleIndexCharacter = {
  id:'stale-index',
  inventoryItems:[{ name:'Совсем другой предмет' }],
  equipItems:[{ name:'Старый меч', equipped:true, _sourceInventoryIndex:0 }]
};
var staleIndexMigration = store.normalizeCharacterInventory(staleIndexCharacter);
assert.strictEqual(staleIndexMigration.collapsedEquipmentCopies, 0);
assert.strictEqual(staleIndexCharacter.inventoryItems[0].name, 'Совсем другой предмет');
assert.strictEqual(staleIndexCharacter.equipItems[0].name, 'Старый меч');
var consolidatedEquipmentCharacter = {
  id:'consolidated-equipment',
  inventoryItems:[{ itemId:'bag-item', name:'Ключ', qty:1 }],
  equipItems:[
    { itemId:'legacy-sword', name:'Старый меч', description:'Не потерять', equipped:true, slot:'weapon' },
    { itemId:'legacy-cloak', name:'Запасной плащ', equipped:false }
  ]
};
var consolidatedEquipmentMigration = store.normalizeCharacterInventory(
  consolidatedEquipmentCharacter,
  { consolidateEquipment:true }
);
assert.strictEqual(consolidatedEquipmentMigration.migratedEquipmentItems, 2);
assert.strictEqual(consolidatedEquipmentCharacter.equipItems.length, 0);
assert.deepStrictEqual(consolidatedEquipmentCharacter.inventoryItems.map(function(item) {
  return [item.itemId,item.name,item.equipped,item.slot||'',item.qty];
}), [
  ['bag-item','Ключ',undefined,'',1],
  ['legacy-sword','Старый меч',true,'weapon',1],
  ['legacy-cloak','Запасной плащ',false,'',1]
]);
assert.strictEqual(consolidatedEquipmentCharacter.inventoryItems[1].description, 'Не потерять');
assert.strictEqual(
  store.normalizeCharacterInventory(consolidatedEquipmentCharacter,{consolidateEquipment:true}).migratedEquipmentItems,
  0
);
var duplicateEquipmentIdsCharacter = {
  id:'duplicate-equipment-ids',
  inventoryItems:[],
  equipItems:[
    { itemId:'duplicate-id', name:'Первый предмет', equipped:true },
    { itemId:'duplicate-id', name:'Второй предмет', equipped:true }
  ]
};
store.normalizeCharacterInventory(duplicateEquipmentIdsCharacter,{consolidateEquipment:true});
assert.strictEqual(duplicateEquipmentIdsCharacter.inventoryItems.length, 2);
assert.strictEqual(new Set(duplicateEquipmentIdsCharacter.inventoryItems.map(function(item) {
  return item.itemId;
})).size, 2);
assert.deepStrictEqual(duplicateEquipmentIdsCharacter.inventoryItems.map(function(item) {
  return item.name;
}), ['Первый предмет','Второй предмет']);

function createLocalStorage() {
  var values = new Map();
  return {
    getItem: function(key) { return values.has(key) ? values.get(key) : null; },
    setItem: function(key, value) { values.set(key, String(value)); },
    removeItem: function(key) { values.delete(key); },
    clear: function() { values.clear(); }
  };
}

function createIndexedDb() {
  var values = new Map();
  var hasStore = false;
  return {
    values: values,
    open: function() {
      var request = {};
      setImmediate(function() {
        var db = {
          objectStoreNames: { contains: function() { return hasStore; } },
          createObjectStore: function() { hasStore = true; },
          close: function() {},
          transaction: function() {
            var transaction = {};
            transaction.objectStore = function() {
              return {
                get: function(key) {
                  var getRequest = {};
                  setImmediate(function() {
                    getRequest.result = values.has(key) ? values.get(key) : undefined;
                    if (getRequest.onsuccess) getRequest.onsuccess();
                  });
                  return getRequest;
                },
                put: function(value, key) {
                  values.set(key, value);
                  setImmediate(function() {
                    if (transaction.oncomplete) transaction.oncomplete();
                  });
                }
              };
            };
            return transaction;
          }
        };
        request.result = db;
        if (!hasStore && request.onupgradeneeded) request.onupgradeneeded({ target: { result: db } });
        if (request.onsuccess) request.onsuccess({ target: { result: db } });
      });
      return request;
    }
  };
}

(async function runStorageIntegration() {
  global.localStorage = createLocalStorage();
  global.indexedDB = createIndexedDb();
  var publishedBundle = require('../data/campaign-heroes.v1.json');
  var customEvan = {
    id: 1776627463516,
    campaignKey: 'evan',
    type: 'hero',
    name: 'Мой Еван',
    hpCur: 3,
    hpMax: 14,
    revision: 7,
    _updatedAt: 777
  };
  var fetchBundle = function() {
    return Promise.resolve({ ok: true, json: function() { return Promise.resolve(publishedBundle); } });
  };

  var initialSave = await store.persistCollection([customEvan]);
  assert.strictEqual(initialSave.ok, true);

  var firstLoad = await store.loadAndSeed([customEvan], { force: true, fetch: fetchBundle, now: 1000 });
  assert.strictEqual(firstLoad.characters.length, 5);
  assert.strictEqual(firstLoad.added.length, 4);
  assert.strictEqual(firstLoad.characters.find(function(character) {
    return character.campaignKey === 'evan';
  }).name, 'Мой Еван');

  var backupFromLocalStorage = JSON.parse(global.localStorage.getItem(store.config.backupKey));
  var backupFromIndexedDb = global.indexedDB.values.get(store.config.backupKey);
  assert.strictEqual(backupFromLocalStorage[0].name, 'Мой Еван');
  assert.strictEqual(JSON.parse(backupFromIndexedDb.indexedDB)[0].name, 'Мой Еван');
  assert.strictEqual(firstLoad.equipmentBackup.ok, true);
  var equipmentBackupFromLocalStorage = JSON.parse(global.localStorage.getItem(store.config.equipmentBackupKey));
  var equipmentBackupFromIndexedDb = global.indexedDB.values.get(store.config.equipmentBackupKey);
  assert.strictEqual(equipmentBackupFromLocalStorage[0].name, 'Мой Еван');
  assert.strictEqual(JSON.parse(equipmentBackupFromIndexedDb.indexedDB)[0].name, 'Мой Еван');

  var evan = firstLoad.characters.find(function(character) { return character.campaignKey === 'evan'; });
  evan.hpCur = 2;
  evan.revision = 8;
  evan._updatedAt = 2000;
  await store.persistCollection(firstLoad.characters);
  var secondLoad = await store.loadAndSeed(firstLoad.characters, { force: true, fetch: fetchBundle, now: 3000 });
  assert.strictEqual(secondLoad.added.length, 0);
  assert.strictEqual(secondLoad.characters.find(function(character) {
    return character.campaignKey === 'evan';
  }).hpCur, 2);

  var melissa = secondLoad.characters.find(function(character) { return character.campaignKey === 'melissa'; });
  assert.strictEqual(store.markStarterHeroDeleted(melissa), true);
  var withoutMelissa = secondLoad.characters.filter(function(character) { return character.campaignKey !== 'melissa'; });
  await store.persistCollection(withoutMelissa);
  var thirdLoad = await store.loadAndSeed(withoutMelissa, { force: true, fetch: fetchBundle, now: 4000 });
  assert.strictEqual(thirdLoad.characters.some(function(character) {
    return character.campaignKey === 'melissa';
  }), false);
  assert.strictEqual(thirdLoad.characters.length, 4);

  var availableBackup = await store.getMigrationBackup();
  assert.strictEqual(availableBackup.exists, true);
  assert.strictEqual(availableBackup.characters.length, 1);
  assert.strictEqual(availableBackup.characters[0].name, 'Мой Еван');
  var availableEquipmentBackup = await store.getEquipmentMigrationBackup();
  assert.strictEqual(availableEquipmentBackup.exists, true);
  assert.strictEqual(availableEquipmentBackup.characters.length, 1);
  assert.strictEqual(availableEquipmentBackup.characters[0].name, 'Мой Еван');

  var restored = await store.restoreMigrationBackup();
  assert.strictEqual(restored.ok, true);
  assert.strictEqual(restored.characters.length, 1);
  assert.strictEqual(restored.characters[0].name, 'Мой Еван');
  assert.ok(global.localStorage.getItem(store.config.restoreSafetyKey));
  assert.ok(global.indexedDB.values.get(store.config.restoreSafetyKey));
  assert.strictEqual(JSON.parse(global.localStorage.getItem(store.config.collectionKey))[0].name, 'Мой Еван');
  var firstRestoreSafety = global.localStorage.getItem(store.config.restoreSafetyKey);
  await store.persistCollection([{ id: 'later', name: 'Более позднее состояние' }]);
  assert.strictEqual((await store.restoreMigrationBackup()).ok, true);
  assert.strictEqual(global.localStorage.getItem(store.config.restoreSafetyKey), firstRestoreSafety);
  await store.persistCollection([{ id:'after-equipment-migration', name:'Состояние после миграции' }]);
  var restoredEquipment = await store.restoreEquipmentMigrationBackup();
  assert.strictEqual(restoredEquipment.ok, true);
  assert.strictEqual(restoredEquipment.characters.length, 1);
  assert.strictEqual(restoredEquipment.characters[0].name, 'Мой Еван');
  assert.strictEqual(global.localStorage.getItem(store.config.restoreSafetyKey), firstRestoreSafety);
  assert.ok(global.localStorage.getItem(store.config.equipmentRestoreSafetyKey));
  assert.ok(global.indexedDB.values.get(store.config.equipmentRestoreSafetyKey));

  var pagehideSave = store.persistCollectionBestEffort([{ id: 'pagehide', name: 'Сохранён синхронно' }]);
  assert.strictEqual(pagehideSave.ok, true);
  assert.strictEqual(JSON.parse(global.localStorage.getItem(store.config.collectionKey))[0].id, 'pagehide');
  var confirmedPagehide = await store.readConfirmedCharacter('pagehide', '');
  assert.strictEqual(confirmedPagehide.name, 'Сохранён синхронно');
  confirmedPagehide.name = 'Изменение копии';
  assert.strictEqual((await store.readConfirmedCharacter('pagehide', '')).name, 'Сохранён синхронно');
  assert.strictEqual(await store.readConfirmedCharacter('missing', ''), null);

  await store.persistCollection([
    { id:'atomic-a', name:'A', hpCur:5, _updatedAt:5000 },
    { id:'atomic-b', name:'B unchanged', hpCur:9, _updatedAt:5000 }
  ]);
  var atomicSave = await store.saveCharacter('atomic-a', {
    id:'atomic-a', name:'A', hpCur:4, revision:2, _updatedAt:5100
  }, [
    { id:'atomic-a', name:'A', hpCur:4, revision:2, _updatedAt:5100 },
    { id:'atomic-b', name:'B unchanged', hpCur:9, _updatedAt:5000 }
  ]);
  assert.strictEqual(atomicSave.ok, true);
  assert.strictEqual(atomicSave.character.hpCur, 4);
  var afterAtomic = JSON.parse(global.localStorage.getItem(store.config.collectionKey));
  assert.strictEqual(afterAtomic.find(function(character) { return character.id === 'atomic-a'; }).hpCur, 4);
  assert.strictEqual(afterAtomic.find(function(character) { return character.id === 'atomic-b'; }).name, 'B unchanged');

  console.log('character-store tests passed');
})().catch(function(error) {
  console.error(error);
  process.exitCode = 1;
});
