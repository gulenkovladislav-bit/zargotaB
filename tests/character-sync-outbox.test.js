'use strict';

var assert = require('assert');

function createLocalStorage() {
  var values = new Map();
  return {
    getItem: function(key) { return values.has(key) ? values.get(key) : null; },
    setItem: function(key, value) { values.set(key, String(value)); },
    removeItem: function(key) { values.delete(key); }
  };
}

global.localStorage = createLocalStorage();
var outbox = require('../character-sync-outbox.js');

assert.strictEqual(
  outbox.contentSignature({ id:'hero', hpCur:10, revision:1, updatedAt:100, updatedBy:'a' }),
  outbox.contentSignature({ updatedBy:'b', updatedAt:200, revision:9, hpCur:10, id:'hero' })
);
assert.notStrictEqual(
  outbox.contentSignature({ id:'hero', hpCur:10 }),
  outbox.contentSignature({ id:'hero', hpCur:9 })
);

var first = outbox.enqueue({
  roomCode:'ROOM1',
  uid:'user1',
  characterId:'hero1',
  campaignKey:'evan',
  revision:2,
  baseRoomRevision:1,
  baseRoomSignature:'base-one',
  snapshot:{ id:'hero1', hpCur:10, revision:2, portrait:'data:image/png;base64,large', item:{ image:'blob:large' } },
  updatedAt:100
});
assert.strictEqual(first.ok, true);
assert.strictEqual(outbox.read().length, 1);
assert.strictEqual(first.entry.snapshot.portrait, '');
assert.strictEqual(first.entry.snapshot.item.image, '');
assert.ok(first.entry.operationId);
assert.strictEqual(first.entry.snapshot.syncOperationId, first.entry.operationId);
assert.strictEqual(
  outbox.contentSignature(first.entry.snapshot),
  outbox.contentSignature(Object.assign({}, first.entry.snapshot, { syncOperationId:'another-operation' }))
);

var second = outbox.enqueue({
  roomCode:'ROOM1',
  uid:'user1',
  characterId:'hero1',
  campaignKey:'evan',
  revision:3,
  baseRoomRevision:99,
  baseRoomSignature:'must-not-replace-original-base',
  snapshot:{ id:'hero1', hpCur:9, revision:3 },
  updatedAt:200
});
assert.strictEqual(second.entry.id, first.entry.id);
assert.strictEqual(outbox.read().length, 1);
assert.strictEqual(second.entry.baseRoomSignature, 'base-one');
assert.strictEqual(second.entry.baseRoomRevision, 1);
assert.strictEqual(second.entry.snapshot.hpCur, 9);
assert.notStrictEqual(second.entry.operationId, first.entry.operationId);

var duplicate = outbox.enqueue({
  roomCode:'ROOM1',
  uid:'user1',
  characterId:'hero1',
  campaignKey:'evan',
  revision:3,
  snapshot:{ id:'hero1', hpCur:9, revision:3 },
  updatedAt:201
});
assert.strictEqual(duplicate.entry.operationId, second.entry.operationId);
assert.strictEqual(outbox.matchesApplied(duplicate.entry, Object.assign({}, duplicate.entry.snapshot)), true);
assert.strictEqual(outbox.matchesApplied(duplicate.entry, { id:'hero1', hpCur:9, revision:99 }), true);
assert.strictEqual(outbox.matchesApplied(duplicate.entry, { id:'hero1', hpCur:8, revision:99 }), false);

assert.strictEqual(outbox.markAttempt(first.entry.id), true);
assert.strictEqual(outbox.peek({ roomCode:'ROOM1', uid:'user1', characterId:'hero1' }).attempts, 1);
assert.strictEqual(outbox.rebase(first.entry.id, 'base-two', 4), true);
assert.strictEqual(outbox.peek({ roomCode:'ROOM1', uid:'user1', characterId:'hero1' }).baseRoomSignature, 'base-two');

assert.strictEqual(outbox.recordConflict(duplicate.entry, {
  id:'hero1', hpCur:8, revision:4, portrait:'data:image/png;base64,room'
}), true);
var savedConflict = outbox.readConflicts()[0];
assert.strictEqual(savedConflict.localSnapshot.hpCur, 9);
assert.strictEqual(savedConflict.roomSnapshot.hpCur, 8);
assert.strictEqual(savedConflict.roomSnapshot.portrait, '');
assert.strictEqual(savedConflict.localRevision, 3);
assert.strictEqual(savedConflict.roomRevision, 4);
assert.strictEqual(outbox.recordConflict(duplicate.entry, {
  id:'hero1', hpCur:8, revision:4, portrait:'data:image/png;base64,another-copy'
}), true);
assert.strictEqual(outbox.readConflicts().length, 1);

var inventoryBase = {
  id:'inventory-hero',
  hpCur:10,
  revision:4,
  inventoryItems:[{ itemId:'item-1', name:'Ключ', qty:1 }],
  equipItems:[]
};
var inventoryQueued = outbox.enqueue({
  roomCode:'INVROOM',
  uid:'inventory-user',
  characterId:'inventory-hero',
  revision:5,
  reason:'inventory-quantity',
  baseRoomRevision:4,
  baseRoomSignature:outbox.contentSignature(inventoryBase),
  changedFields:['inventoryItems','equipItems'],
  baseFieldSignatures:{
    inventoryItems:outbox.fieldSignature(inventoryBase.inventoryItems),
    equipItems:outbox.fieldSignature(inventoryBase.equipItems)
  },
  snapshot:Object.assign({}, inventoryBase, {
    revision:5,
    inventoryItems:[{ itemId:'item-1', name:'Ключ', qty:2 }]
  }),
  updatedAt:250
});
assert.deepStrictEqual(inventoryQueued.entry.changedFields, ['inventoryItems','equipItems']);
var hpChangedInRoom = Object.assign({}, inventoryBase, { hpCur:9, revision:5 });
var inventoryMerge = outbox.mergeChangedFields(inventoryQueued.entry.id, hpChangedInRoom);
assert.strictEqual(inventoryMerge.ok, true);
assert.strictEqual(inventoryMerge.entry.snapshot.hpCur, 9);
assert.strictEqual(inventoryMerge.entry.snapshot.inventoryItems[0].qty, 2);
assert.strictEqual(inventoryMerge.entry.baseRoomSignature, outbox.contentSignature(hpChangedInRoom));

var inventoryConflictBase = Object.assign({}, inventoryBase, { id:'inventory-conflict' });
var inventoryConflict = outbox.enqueue({
  roomCode:'INVROOM2',
  uid:'inventory-user',
  characterId:'inventory-conflict',
  revision:5,
  reason:'inventory-update',
  baseRoomSignature:outbox.contentSignature(inventoryConflictBase),
  changedFields:['inventoryItems','equipItems'],
  baseFieldSignatures:{
    inventoryItems:outbox.fieldSignature(inventoryConflictBase.inventoryItems),
    equipItems:outbox.fieldSignature(inventoryConflictBase.equipItems)
  },
  snapshot:Object.assign({}, inventoryConflictBase, {
    inventoryItems:[{ itemId:'item-1', name:'Ключ', qty:2 }]
  }),
  updatedAt:260
});
var sameFieldChangedInRoom = Object.assign({}, inventoryConflictBase, {
  revision:5,
  inventoryItems:[{ itemId:'item-1', name:'Ключ', qty:3 }]
});
var refusedMerge = outbox.mergeChangedFields(inventoryConflict.entry.id, sameFieldChangedInRoom);
assert.strictEqual(refusedMerge.ok, false);
assert.strictEqual(refusedMerge.conflict, true);
assert.strictEqual(refusedMerge.field, 'inventoryItems');
assert.strictEqual(
  outbox.peek({ roomCode:'INVROOM2', uid:'inventory-user', characterId:'inventory-conflict' }).snapshot.inventoryItems[0].qty,
  2
);

var fullEditAfterInventory = outbox.enqueue({
  roomCode:'INVROOM2',
  uid:'inventory-user',
  characterId:'inventory-conflict',
  revision:6,
  reason:'edit',
  changedFields:[],
  snapshot:Object.assign({}, inventoryConflictBase, { hpCur:8, revision:6 }),
  updatedAt:270
});
assert.deepStrictEqual(fullEditAfterInventory.entry.changedFields, []);

var journalBase = [{ journalId:'journal-base', title:'До', text:'Старая запись', updatedAt:10 }];
var journalQueued = outbox.enqueue({
  roomCode:'JOURNAL',
  uid:'journal-user',
  characterId:'journal-hero',
  revision:2,
  reason:'journal-update',
  baseRoomSignature:outbox.contentSignature({ journalEntries:journalBase }),
  changedFields:['journalEntries'],
  baseFieldSignatures:{ journalEntries:outbox.fieldSignature(journalBase) },
  baseFieldValues:{ journalEntries:journalBase },
  snapshot:{ id:'journal-hero', revision:2, journalEntries:[{ journalId:'journal-base', title:'После', text:'Новая запись', updatedAt:20 }] },
  updatedAt:20
});
assert.strictEqual(journalQueued.ok, true);
assert.deepStrictEqual(journalQueued.entry.changedFields, ['journalEntries']);
assert.strictEqual(journalQueued.entry.inventoryOperations, null);

var itemBaseCharacter = {
  id:'item-merge-hero',
  hpCur:10,
  revision:3,
  inventoryItems:[{ itemId:'item-a', name:'Ключ', qty:1 }],
  equipItems:[]
};
var itemLocalCharacter = Object.assign({}, itemBaseCharacter, {
  revision:4,
  inventoryItems:[
    { itemId:'item-a', name:'Ключ', qty:2 },
    { itemId:'item-c', name:'Факел', qty:1 }
  ]
});
var itemOperations = outbox.createInventoryOperations(itemBaseCharacter, itemLocalCharacter, ['inventoryItems','equipItems']);
assert.strictEqual(itemOperations.length, 2);
assert.strictEqual(itemOperations.some(function(operation) { return operation.type === 'update' && operation.itemId === 'item-a'; }), true);
assert.strictEqual(itemOperations.some(function(operation) { return operation.type === 'add' && operation.itemId === 'item-c'; }), true);
var roomWithIndependentGmItem = Object.assign({}, itemBaseCharacter, {
  hpCur:9,
  revision:4,
  inventoryItems:[
    { itemId:'item-a', name:'Ключ', qty:1 },
    { itemId:'item-b', name:'Дар мастера', qty:1 }
  ]
});
var itemMergeResult = outbox.applyInventoryOperations(roomWithIndependentGmItem, itemOperations, {
  revision:4,
  updatedAt:300,
  updatedBy:'player',
  source:'inventory-update',
  operationId:'inventory-op-1'
});
assert.strictEqual(itemMergeResult.ok, true);
assert.strictEqual(itemMergeResult.character.hpCur, 9);
assert.strictEqual(itemMergeResult.character.inventoryItems.length, 3);
assert.strictEqual(itemMergeResult.character.inventoryItems.filter(function(item) { return item.itemId === 'item-a'; })[0].qty, 2);
assert.strictEqual(itemMergeResult.character.inventoryItems.some(function(item) { return item.itemId === 'item-b'; }), true);
assert.strictEqual(itemMergeResult.character.inventoryItems.some(function(item) { return item.itemId === 'item-c'; }), true);
assert.strictEqual(itemMergeResult.character.syncOperationId, 'inventory-op-1');

var fullInventoryResult = outbox.applyInventoryOperations(
  {revision:1,inventoryItems:Array.from({length:80},function(_,index){return{itemId:'full-'+index,name:'Предмет'};})},
  [{type:'add',field:'inventoryItems',itemId:'overflow',item:{itemId:'overflow',name:'Лишний'}}],
  {revision:2}
);
assert.strictEqual(fullInventoryResult.ok, false);
assert.strictEqual(fullInventoryResult.error, 'inventory-full');

var itemOperationEntry = outbox.enqueue({
  roomCode:'ITEMOPS',
  uid:'item-user',
  characterId:'item-merge-hero',
  revision:4,
  reason:'inventory-update',
  baseRoomRevision:3,
  baseRoomSignature:outbox.contentSignature(itemBaseCharacter),
  changedFields:['inventoryItems','equipItems'],
  baseFieldSignatures:{
    inventoryItems:outbox.fieldSignature(itemBaseCharacter.inventoryItems),
    equipItems:outbox.fieldSignature(itemBaseCharacter.equipItems)
  },
  baseFieldValues:{
    inventoryItems:[{ itemId:'item-a', name:'Ключ', qty:1, image:'data:image/png;base64,heavy' }],
    equipItems:[]
  },
  snapshot:itemLocalCharacter,
  updatedAt:280
});
assert.strictEqual(Array.isArray(itemOperationEntry.entry.inventoryOperations), true);
assert.strictEqual(itemOperationEntry.entry.inventoryOperations.length, 2);
assert.strictEqual(itemOperationEntry.entry.baseFieldValues.inventoryItems[0].image, '');
assert.strictEqual(outbox.diagnostics().some(function(row) {
  return row.id === itemOperationEntry.entry.id && row.inventoryOperationCount === 2;
}), true);
var coalescedItemEntry = outbox.enqueue({
  roomCode:'ITEMOPS',
  uid:'item-user',
  characterId:'item-merge-hero',
  revision:5,
  reason:'inventory-add',
  changedFields:['inventoryItems','equipItems'],
  baseFieldValues:{
    inventoryItems:itemBaseCharacter.inventoryItems,
    equipItems:[]
  },
  snapshot:Object.assign({}, itemLocalCharacter, {
    revision:5,
    inventoryItems:[
      { itemId:'item-a', name:'Ключ', qty:3 },
      { itemId:'item-c', name:'Факел', qty:1 },
      { itemId:'item-d', name:'Верёвка', qty:1 }
    ]
  }),
  updatedAt:290
});
assert.strictEqual(coalescedItemEntry.entry.inventoryOperations.length, 3);
var acknowledgedRoomCharacter = Object.assign({}, itemBaseCharacter, {
  revision:5,
  inventoryItems:[
    { itemId:'item-a', name:'Ключ', qty:2 },
    { itemId:'item-c', name:'Факел', qty:1 }
  ]
});
assert.strictEqual(outbox.rebase(
  coalescedItemEntry.entry.id,
  outbox.contentSignature(acknowledgedRoomCharacter),
  5,
  acknowledgedRoomCharacter
), true);
var rebasedItemEntry = outbox.peek({ roomCode:'ITEMOPS', uid:'item-user', characterId:'item-merge-hero' });
assert.strictEqual(rebasedItemEntry.inventoryOperations.length, 2);
assert.strictEqual(rebasedItemEntry.inventoryOperations.some(function(operation) {
  return operation.type === 'add' && operation.itemId === 'item-c';
}), false);
assert.strictEqual(rebasedItemEntry.inventoryOperations.some(function(operation) {
  return operation.type === 'add' && operation.itemId === 'item-d';
}), true);

var sameItemChangedResult = outbox.applyInventoryOperations(Object.assign({}, itemBaseCharacter, {
  inventoryItems:[{ itemId:'item-a', name:'Ключ', qty:3 }]
}), itemOperations, { operationId:'inventory-op-2' });
assert.strictEqual(sameItemChangedResult.ok, false);
assert.strictEqual(sameItemChangedResult.conflict, true);
assert.strictEqual(sameItemChangedResult.itemId, 'item-a');

var removeOperations = outbox.createInventoryOperations(itemBaseCharacter, Object.assign({}, itemBaseCharacter, {
  inventoryItems:[]
}), ['inventoryItems','equipItems']);
var removeMergeResult = outbox.applyInventoryOperations(roomWithIndependentGmItem, removeOperations, {
  operationId:'inventory-op-3'
});
assert.strictEqual(removeMergeResult.ok, true);
assert.strictEqual(removeMergeResult.character.inventoryItems.length, 1);
assert.strictEqual(removeMergeResult.character.inventoryItems[0].itemId, 'item-b');
assert.strictEqual(
  outbox.createInventoryOperations(
    { inventoryItems:[{ name:'legacy without id' }], equipItems:[] },
    { inventoryItems:[], equipItems:[] },
    ['inventoryItems','equipItems']
  ),
  null
);

for (var conflictIndex = 0; conflictIndex < 12; conflictIndex += 1) {
  assert.strictEqual(outbox.recordConflict(duplicate.entry, {
    id:'hero1', hpCur:conflictIndex, revision:5 + conflictIndex
  }), true);
}
assert.strictEqual(outbox.readConflicts().length, outbox.config.maxConflicts);

for (var i = 0; i < 25; i += 1) {
  outbox.enqueue({
    roomCode:'ROOM' + i,
    uid:'user' + i,
    characterId:'hero' + i,
    revision:i,
    snapshot:{ id:'hero' + i, hpCur:i },
    updatedAt:300 + i
  });
}
assert.strictEqual(outbox.read().length, outbox.config.maxEntries);
assert.strictEqual(outbox.diagnostics().every(function(row) { return row.snapshot === undefined; }), true);
assert.strictEqual(outbox.diagnostics().every(function(row) { return typeof row.operationId === 'string'; }), true);

var latest = outbox.read()[outbox.read().length - 1];
assert.strictEqual(outbox.remove(latest.id), true);
assert.strictEqual(outbox.read().some(function(row) { return row.id === latest.id; }), false);

console.log('character sync outbox tests passed');
