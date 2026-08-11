'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.resolve(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var delivery = fs.readFileSync(path.join(root, 'gm-delivery.js'), 'utf8');

[
  'turn-start-medieval-war.mp3',
  'round-start-warrior-kick.mp3',
  'gm-action-request-paper.mp3',
  'gm-action-approved-pencil.mp3',
  'status-cleanse-holy.mp3',
  'map-ping.mp3',
  'item-reward-bag.mp3'
].forEach(function (file) {
  assert.match(html, new RegExp('audio/vtt-actions/' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
assert.match(html, /w\.ZargotaSound\.mapPing\(\)/);
assert.match(html, /!event\.statusEnabled&&w\.ZargotaSound\.statusCleanse/);
assert.match(html, /event\.removedStatus&&w\.ZargotaSound&&w\.ZargotaSound\.statusCleanse/);
assert.match(delivery, /delivery\.kind === 'item'.*w\.ZargotaSound\.itemReward/);
assert.match(delivery, /w\.ZargotaSound\.playerDeliveryReceived/, 'non-item cards use the dedicated player receipt cue');
assert.match(delivery, /!queued && w\.ZargotaSound && w\.ZargotaSound\.gmDeliverySent/, 'the GM hears confirmation only after a room write, not while an offline send is queued');
assert.match(html, /gmDeliverySent:'audio\/vtt-actions\/gm-action-approved-pencil\.mp3'/, 'GM delivery confirmation uses the existing pencil stroke');
assert.match(html, /playerDeliveryReceivedPlaceholder:'audio\/vtt-actions\/gm-action-request-paper\.mp3'/, 'player delivery receipt temporarily reuses the verified paper sample');
assert.match(html, /AUDIO_TAG: PLACEHOLDER_GM_DELIVERY_RECEIVED_PLAYER/, 'the player receipt placeholder remains easy to replace with a custom sound');

var start = html.indexOf('  function syncSessionSounds(snapshot){');
var end = html.indexOf('  function render(snapshot){', start);
assert.ok(start >= 0 && end > start, 'session sound router must remain extractable');

var calls = [];
var context = {
  Math:Math,
  Number:Number,
  String:String,
  Object:Object,
  Array:Array,
  sessionSoundState:{roomCode:'',ready:false,combatActive:false,round:0,turnKey:'',ownAction:'',ownMovement:'',masterRequests:{}},
  w:{ZargotaSound:{
    turn:function(){calls.push('turn');},
    round:function(){calls.push('round');},
    playerActionRequest:function(){calls.push('submitted');},
    gmActionRequest:function(){calls.push('request');},
    actionResolved:function(accepted){calls.push(accepted?'approved':'rejected');}
  }}
};
vm.runInNewContext(html.slice(start, end), context);

function playerSnapshot(round, turnUid, request) {
  return {
    session:{uid:'player-a',role:'player',code:'ROOM'},
    room:{code:'ROOM',members:{'player-a':{actionRequest:request || null}},combat:{active:true,round:round,turnIndex:0,order:[{key:'turn-' + turnUid,uid:turnUid,name:turnUid}]}}
  };
}

context.syncSessionSounds(playerSnapshot(1, 'player-a'));
assert.deepStrictEqual(calls, [], 'joining an existing combat must not replay its sound');
assert.match(html.slice(start, end), /sessionSoundState\.masterRequests=pendingRequests/, 'resolved requests must be pruned from the sound router state');
context.syncSessionSounds(playerSnapshot(1, 'player-b'));
context.syncSessionSounds(playerSnapshot(1, 'player-a'));
assert.deepStrictEqual(calls, ['turn'], 'only the player receiving the turn hears the personal cue');
context.syncSessionSounds(playerSnapshot(2, 'player-a'));
assert.deepStrictEqual(calls, ['turn','round'], 'a new round has one cue instead of stacking round and turn');
context.syncSessionSounds(playerSnapshot(2, 'player-a', {id:'request-a',status:'pending'}));
context.syncSessionSounds(playerSnapshot(2, 'player-a', {id:'request-a',status:'approved'}));
context.syncSessionSounds(playerSnapshot(2, 'player-a', {id:'request-a',status:'approved'}));
assert.deepStrictEqual(calls, ['turn','round','submitted','approved'], 'the sender hears one submission cue and one later resolution cue');
context.syncSessionSounds(playerSnapshot(2, 'player-a', {id:'request-muted',status:'pending'}));
context.syncSessionSounds(playerSnapshot(2, 'player-a', {id:'request-muted',status:'rejected',notifyPlayer:false}));
assert.deepStrictEqual(calls, ['turn','round','submitted','approved','submitted'], 'a GM-muted final decision must not leak a result sound to the player');

var movementBase = playerSnapshot(2, 'player-a', {id:'request-muted',status:'rejected',notifyPlayer:false});
movementBase.room.members['player-a'].movementRequest = {id:'move-a',status:'pending'};
context.syncSessionSounds(movementBase);
movementBase.room.members['player-a'].movementRequest = {id:'move-a',status:'approved'};
context.syncSessionSounds(movementBase);
assert.deepStrictEqual(calls.slice(-2), ['submitted','approved'], 'movement requests reuse the same paper submission and resolution cues');

calls.length = 0;
context.sessionSoundState = {roomCode:'',ready:false,combatActive:false,round:0,turnKey:'',ownAction:'',ownMovement:'',masterRequests:{}};
var masterBase = {session:{uid:'gm',role:'master',code:'ROOM-2'},room:{code:'ROOM-2',members:{gm:{}},combat:{active:false}}};
context.syncSessionSounds(masterBase);
var masterPending = {session:masterBase.session,room:{code:'ROOM-2',members:{gm:{},'player-b':{actionRequest:{id:'request-b',status:'pending'}}},combat:{active:false}}};
context.syncSessionSounds(masterPending);
context.syncSessionSounds(masterPending);
assert.deepStrictEqual(calls, ['request'], 'the GM hears each pending request only once');
var masterMovePending = {session:masterBase.session,room:{code:'ROOM-2',members:{gm:{},'player-b':{actionRequest:{id:'request-b',status:'pending'},movementRequest:{id:'move-b',status:'pending'}}},combat:{active:false}}};
context.syncSessionSounds(masterMovePending);
context.syncSessionSounds(masterMovePending);
assert.deepStrictEqual(calls, ['request','request'], 'the GM hears a movement request once through the same paper cue');
assert.match(html, /AUDIO_TAG: PLACEHOLDER_ACTION_REQUEST_PLAYER/, 'player placeholder remains easy to replace');
assert.match(html, /AUDIO_TAG: PLACEHOLDER_ACTION_REQUEST_GM/, 'GM placeholder remains easy to replace');

console.log('session sound routing passed');
