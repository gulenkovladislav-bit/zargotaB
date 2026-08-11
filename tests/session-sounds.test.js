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
  sessionSoundState:{roomCode:'',ready:false,combatActive:false,round:0,turnKey:'',ownAction:'',masterRequests:{}},
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

calls.length = 0;
context.sessionSoundState = {roomCode:'',ready:false,combatActive:false,round:0,turnKey:'',ownAction:'',masterRequests:{}};
var masterBase = {session:{uid:'gm',role:'master',code:'ROOM-2'},room:{code:'ROOM-2',members:{gm:{}},combat:{active:false}}};
context.syncSessionSounds(masterBase);
var masterPending = {session:masterBase.session,room:{code:'ROOM-2',members:{gm:{},'player-b':{actionRequest:{id:'request-b',status:'pending'}}},combat:{active:false}}};
context.syncSessionSounds(masterPending);
context.syncSessionSounds(masterPending);
assert.deepStrictEqual(calls, ['request'], 'the GM hears each pending request only once');
assert.match(html, /AUDIO_TAG: PLACEHOLDER_ACTION_REQUEST_PLAYER/, 'player placeholder remains easy to replace');
assert.match(html, /AUDIO_TAG: PLACEHOLDER_ACTION_REQUEST_GM/, 'GM placeholder remains easy to replace');

console.log('session sound routing passed');
