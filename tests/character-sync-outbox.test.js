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
