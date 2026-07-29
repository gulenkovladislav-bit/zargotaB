'use strict';

var assert = require('assert');

var memory = Object.create(null);
global.localStorage = {
  getItem:function (key) { return Object.prototype.hasOwnProperty.call(memory,key) ? memory[key] : null; },
  setItem:function (key,value) { memory[key]=String(value); },
  removeItem:function (key) { delete memory[key]; }
};

var outbox = require('../gameplay-operation-outbox.js');
var key = outbox.config.storageKey;

var ability = outbox.enqueue({
  type:'ability-request',
  operationId:'ability-1',
  roomCode:'ROOM1',
  uid:'player-1',
  role:'player',
  tabId:'tab-player',
  payload:{text:'Каст',speakerUid:'',details:{name:'Луч'}}
});
assert.strictEqual(ability.ok,true);
assert.strictEqual(outbox.read().length,1);

var duplicate = outbox.enqueue({
  type:'ability-request',
  operationId:'ability-1',
  roomCode:'ROOM1',
  uid:'player-1',
  role:'player',
  payload:{text:'Другой текст'}
});
assert.strictEqual(duplicate.ok,true);
assert.strictEqual(duplicate.duplicate,true);
assert.strictEqual(outbox.read().length,1);
assert.strictEqual(outbox.read()[0].payload.text,'Каст','same operation id must keep the original payload');

var delivery = outbox.enqueue({
  type:'gm-delivery',
  operationId:'delivery-1',
  roomCode:'ROOM1',
  uid:'master-1',
  role:'master',
  payload:{memberUids:['player-1'],value:{kind:'item',title:'Награда'}}
});
assert.strictEqual(delivery.ok,true);
assert.strictEqual(outbox.forSession({roomCode:'ROOM1',uid:'player-1',role:'player'}).length,1);
assert.strictEqual(outbox.forSession({roomCode:'ROOM1',uid:'master-1',role:'master'}).length,1);

for(var attempt=0;attempt<outbox.config.maxAttempts;attempt++)outbox.markAttempt('ability-1');
assert.strictEqual(outbox.forSession({roomCode:'ROOM1',uid:'player-1',role:'player'}).length,0,'attempt limit stops automatic retries');
outbox.markError('ability-1',new Error('offline'));
var abilityDiagnostic = outbox.diagnostics().filter(function(row){return row.operationId==='ability-1';})[0];
assert.strictEqual(abilityDiagnostic.attempts,outbox.config.maxAttempts);
assert.strictEqual(abilityDiagnostic.lastError,'offline');
assert.strictEqual(Object.prototype.hasOwnProperty.call(abilityDiagnostic,'payload'),false,'diagnostics must not expose operation payloads');
assert.strictEqual(abilityDiagnostic.tabId,'tab-player','diagnostics identify the tab that created the queued operation');

var tooLarge = outbox.enqueue({
  type:'gm-delivery',
  operationId:'delivery-large',
  roomCode:'ROOM1',
  uid:'master-1',
  role:'master',
  payload:{value:{image:new Array(outbox.config.maxOperationBytes+2).join('x')}}
});
assert.strictEqual(tooLarge.ok,false);
assert.strictEqual(tooLarge.error,'operation-too-large');

assert.strictEqual(outbox.remove('ability-1'),true);
assert.strictEqual(outbox.read().some(function(row){return row.operationId==='ability-1';}),false);

memory[key]='[]';
for(var index=0;index<outbox.config.maxEntries;index++){
  assert.strictEqual(outbox.enqueue({
    type:'ability-request',
    operationId:'limited-'+index,
    roomCode:'ROOM2',
    uid:'player-2',
    role:'player',
    payload:{text:'Каст '+index}
  }).ok,true);
}
var full = outbox.enqueue({
  type:'ability-request',
  operationId:'limited-overflow',
  roomCode:'ROOM2',
  uid:'player-2',
  role:'player',
  payload:{text:'Лишний'}
});
assert.strictEqual(full.ok,false);
assert.strictEqual(full.error,'queue-full');

console.log('gameplay operation outbox tests passed');
