'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'gm-cues.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'gm-cues.css'), 'utf8');
const network = fs.readFileSync(path.join(root, 'zargota-network.js'), 'utf8');

assert.match(html, /gm-cues\.css\?v=/, 'the cue stylesheet must be loaded');
assert.match(html, /gm-cues\.js\?v=/, 'the cue runtime must be loaded');
assert.match(html, /class="zg-scene-publish zg-gm-cue-button"[^>]+onclick="zgCueToggle\(\)"/, 'the GM toolbar needs a cue-library button');

assert.match(ui, /zargota_gm_cue_presets_v1/, 'GM presets must use a dedicated persistent library');
assert.match(ui, /id=\"zg-cue-message\"/, 'the message field must not reuse the composer container id');
assert.match(ui, /selectedTargets/, 'the composer must keep a multi-recipient selection');
assert.match(ui, /zgCueTargetsAll/, 'the composer must provide an all-player shortcut');
assert.match(ui, /imageSrc/, 'image content must be supported');
assert.match(ui, /audioSrc/, 'audio content must be supported');
const normalizeAudioStart = ui.indexOf('  function normalizeAudioSource(');
const normalizeAudioEnd = ui.indexOf('  function blankDraft(', normalizeAudioStart);
assert.ok(normalizeAudioStart >= 0 && normalizeAudioEnd > normalizeAudioStart, 'the cue UI must normalize browser-specific audio MIME labels');
const normalizeAudioContext = {};
vm.runInNewContext(ui.slice(normalizeAudioStart, normalizeAudioEnd), normalizeAudioContext);
assert.strictEqual(normalizeAudioContext.normalizeAudioSource('data:video/mp4;base64,AAAA'), 'data:audio/mp4;base64,AAAA', 'MP4 audio labelled as video must remain sendable');
assert.strictEqual(normalizeAudioContext.normalizeAudioSource('data:audio/ogg;base64,BBBB'), 'data:audio/ogg;base64,BBBB', 'valid audio MIME labels must remain unchanged');
assert.match(ui, /audioSrc:normalizeAudioSource\(value\.audioSrc\)/, 'saved presets must migrate the browser-specific MP4 label when loaded');
assert.match(ui, /draft\.audioSrc=normalizeAudioSource\(data\)/, 'new MP4 audio uploads must be normalized immediately');
assert.match(ui, /accept="[^"]*video\/mp4/, 'the file chooser must accept MP4 containers exposed as video by the browser');
assert.match(ui, /play\(\).*catch/, 'blocked autoplay must be handled');
assert.match(ui, /zg-cue-audio-fallback/, 'blocked audio must have a custom retry control');
assert.match(ui, /sessionStorage\.setItem\(SEEN_KEY/, 'cue playback must be claimed exactly once per tab');
assert.match(ui, /recipientUids\.map\(String\)\.indexOf/, 'player playback must be filtered by recipient UID');
assert.doesNotMatch(ui, /\b(?:alert|confirm|prompt)\s*\(/, 'native browser dialogs are forbidden');

assert.match(network, /gmBroadcastCue:\s*function\s*\(recipientUids, value\)/, 'the room API must expose GM cue broadcasting');
assert.match(network, /session\.role!==['"]master['"]/, 'only the GM may broadcast a cue');
assert.match(network, /member&&member\.role===['"]player['"]/, 'recipients must resolve to room players');
assert.match(network, /cueEvent:event/, 'the room must receive a single shared cue event');
assert.match(network, /recipientUids:targets/, 'the event must retain its explicit audience');
assert.match(network, /cue-image-large/, 'image payloads need a size guard');
assert.match(network, /cue-audio-large/, 'audio payloads need a size guard');
assert.match(network, /audioSrc=String\(value\.audioSrc\|\|''\)\.trim\(\)\.replace\(\/\^data:video\\\/mp4/, 'the network boundary must normalize existing MP4 audio presets before validation');

const broadcastStart = network.indexOf('    gmBroadcastCue: function');
const broadcastEnd = network.indexOf('\n    configurePendingCombatDamage:', broadcastStart);
assert.ok(broadcastStart >= 0 && broadcastEnd > broadcastStart, 'the real cue broadcaster must be extractable for a transport regression test');
const broadcastSource = network.slice(broadcastStart, broadcastEnd).trim().replace(/,$/, '');
let networkWrite = null;
const room = {masterUid:'gm-1',members:{'player-1':{role:'player'}}};
const broadcastContext = {
  result:null,
  tabCanWrite:function(){return true;},
  roomError:function(message,code){var error=new Error(message);error.code=code;return error;},
  ensureReady:function(){return Promise.resolve({uid:'gm-1'});},
  readSession:function(){return{code:'ROOM',role:'master'};},
  readRoom:function(){return Promise.resolve(room);},
  now:function(){return 1000;},
  firebase:{update:function(path,value){networkWrite={path:path,value:value};return Promise.resolve();}},
  roomRef:function(code){return'rooms/'+code;},
  refreshRoom:function(){return Promise.resolve(room);},
  currentRoom:room,
  api:{getSnapshot:function(){return{room:room};}},
  friendlyFirebaseError:function(error){return error;}
};
vm.runInNewContext('result=({'+broadcastSource+'})', broadcastContext);
const receiveStart = ui.indexOf('  function claimEvent(');
const receiveEnd = ui.indexOf('  w.zgCueSend=', receiveStart);
assert.ok(receiveStart >= 0 && receiveEnd > receiveStart, 'the player cue receiver must be extractable for a delivery regression test');
let seenStorage = '[]';
const receivedEvents = [];
const receiveContext = {
  snapshot:null,
  sessionStorage:{
    getItem:function(){return seenStorage;},
    setItem:function(key,value){seenStorage=value;}
  },
  SEEN_KEY:'cue-seen-test',
  Date:{now:function(){return 1100;}},
  showOverlay:function(event,preview){receivedEvents.push({event:event,preview:preview});}
};
vm.runInNewContext(ui.slice(receiveStart, receiveEnd), receiveContext);

assert.match(css, /\.zg-cue-panel/, 'the custom cue composer must be styled');
assert.match(css, /\.zg-cue-player-overlay/, 'the player presentation overlay must be styled');
assert.match(css, /%3C\/svg%3E\"\);min-width:/, 'the toolbar icon data URL must close before the remaining cue styles');
assert.match(css, /@media\(max-width:680px\)/, 'the composer must have a compact layout');

broadcastContext.result.gmBroadcastCue(['player-1'], {
  name:'MP4 cue',
  audioSrc:'data:video/mp4;base64,AAAAIGZ0eXBpc29t',
  durationMs:8000
}).then(function(){
  assert.ok(networkWrite, 'the MP4 cue must reach the Firebase update boundary');
  assert.strictEqual(networkWrite.path, 'rooms/ROOM');
  assert.strictEqual(networkWrite.value.cueEvent.audioSrc, 'data:audio/mp4;base64,AAAAIGZ0eXBpc29t', 'the event delivered to players must contain the normalized audio MIME');
  assert.deepStrictEqual(Array.from(networkWrite.value.cueEvent.recipientUids), ['player-1'], 'the selected recipient must survive transport');
  receiveContext.sync({room:{cueEvent:networkWrite.value.cueEvent},session:{role:'player',uid:'player-1'}});
  receiveContext.sync({room:{cueEvent:networkWrite.value.cueEvent},session:{role:'player',uid:'player-1'}});
  receiveContext.sync({room:{cueEvent:networkWrite.value.cueEvent},session:{role:'player',uid:'other-player'}});
  assert.strictEqual(receivedEvents.length, 1, 'the selected player must display the event exactly once and other players must not display it');
  assert.strictEqual(receivedEvents[0].event.audioSrc, 'data:audio/mp4;base64,AAAAIGZ0eXBpc29t');
  console.log('gm-cues.test.js: all assertions passed');
}).catch(function(error){
  console.error(error);
  process.exitCode=1;
});
