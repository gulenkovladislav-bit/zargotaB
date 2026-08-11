'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('(function(w) {', html.indexOf('//  ZARGOTA SOUND ENGINE v2'));
const end = html.indexOf('})(window);', start) + '})(window);'.length;
const source = html.slice(start, end);
assert.ok(start >= 0 && end > start, 'sound engine remains extractable');

function audioParam(value) {
  return {value:value || 0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}};
}
function connectable(extra) {
  return Object.assign({connect(){return this;}}, extra || {});
}

let contexts = 0;
let resumes = 0;
function FakeAudioContext() {
  contexts += 1;
  this.currentTime = 0;
  this.state = 'suspended';
  this.destination = {};
}
FakeAudioContext.prototype.createGain = function(){return connectable({gain:audioParam(1)});};
FakeAudioContext.prototype.createDynamicsCompressor = function(){return connectable({threshold:audioParam(),knee:audioParam(),ratio:audioParam(),attack:audioParam(),release:audioParam()});};
FakeAudioContext.prototype.createOscillator = function(){return connectable({frequency:audioParam(),start(){},stop(){}});};
FakeAudioContext.prototype.createBuffer = function(){return{getChannelData(){return new Float32Array(8);}};};
FakeAudioContext.prototype.createBufferSource = function(){return connectable({start(){},stop(){}});};
FakeAudioContext.prototype.createBiquadFilter = function(){return connectable({frequency:audioParam(),Q:audioParam()});};
FakeAudioContext.prototype.resume = function(){resumes += 1;this.state = 'running';return Promise.resolve();};

const listeners = {};
const removed = [];
const writes = [];
const fakeWindow = {
  AudioContext:FakeAudioContext,
  addEventListener(type, listener){listeners[type]=listener;},
  removeEventListener(type, listener){removed.push(type);if(listeners[type]===listener)delete listeners[type];}
};
const localStorageRef = {
  getItem(key){assert.strictEqual(key, 'zargota_sound_muted');return '1';},
  setItem(key, value){writes.push([key,value]);}
};

vm.runInNewContext(source, {
  window:fakeWindow,
  document:{hidden:false,addEventListener(){},querySelectorAll(){return[];}},
  localStorage:localStorageRef,
  Math,Number,String,Object,Array,Promise,Error,Float32Array,
  setTimeout,clearTimeout,fetch:undefined
});

assert.strictEqual(fakeWindow.ZargotaSound.isMuted(), true, 'saved mute is restored before any sound starts');
assert.strictEqual(contexts, 0, 'a muted page does not create AudioContext eagerly');
assert.strictEqual(typeof listeners.pointerdown, 'function', 'the first pointer gesture can unlock audio');
assert.strictEqual(typeof listeners.keydown, 'function', 'keyboard interaction can unlock audio');
assert.strictEqual(typeof listeners.touchstart, 'function', 'touch interaction can unlock audio');

assert.strictEqual(fakeWindow.ZargotaSound.toggleMute(), false, 'the user can unmute the saved state');
assert.deepStrictEqual(writes, [['zargota_sound_muted','0']], 'unmute is persisted under the established key');
listeners.pointerdown();
assert.strictEqual(contexts, 1, 'the first interaction creates exactly one AudioContext');
assert.strictEqual(resumes, 1, 'a suspended AudioContext is resumed by the first interaction');
assert.deepStrictEqual(removed.sort(), ['keydown','pointerdown','touchstart'], 'unlock listeners remove themselves after a successful user gesture');
assert.strictEqual(fakeWindow.ZargotaSound.diagnostics().muted, false, 'diagnostics expose the effective mute state');
assert.strictEqual(fakeWindow.ZargotaSound.diagnostics().contextState, 'running', 'diagnostics expose the unlocked AudioContext state');

assert.match(html, /id="zg-sound-settings"/, 'VTT settings expose a persistent sound section');
assert.match(html, /onclick="zgSoundSettingsToggle\(\)"/, 'the sound section can clear a saved mute');
assert.match(html, /onclick="zgSoundSettingsTest\(\)"/, 'the sound section provides a user-gesture playback test');
assert.match(source, /w\.zgSoundSettingsTest=function\(\)\{if\(Sound\.isMuted\(\)\)Sound\.toggleMute\(\);Sound\.diceResult\(12,20\)/, 'the test button unmutes and unlocks audio in the same gesture');

console.log('sound mute persistence and first-interaction unlock passed');
