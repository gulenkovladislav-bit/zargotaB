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
function FakeAudioContext() {
  this.currentTime = 0;
  this.state = 'running';
  this.destination = {};
  this.sampleRate = 44100;
}
FakeAudioContext.prototype.createGain = function(){return connectable({gain:audioParam(1)});};
FakeAudioContext.prototype.createDynamicsCompressor = function(){return connectable({threshold:audioParam(),knee:audioParam(),ratio:audioParam(),attack:audioParam(),release:audioParam()});};
FakeAudioContext.prototype.createOscillator = function(){return connectable({frequency:audioParam(),start(){},stop(){}});};
FakeAudioContext.prototype.createBuffer = function(){return{getChannelData(){return new Float32Array(8);}};};
FakeAudioContext.prototype.createBufferSource = function(){return connectable({start(){},stop(){}});};
FakeAudioContext.prototype.createBiquadFilter = function(){return connectable({frequency:audioParam(),Q:audioParam()});};
FakeAudioContext.prototype.resume = function(){return Promise.resolve();};

const played = [];
class FakeAudio {
  constructor(src){this.src=src;this.currentTime=0;this.volume=1;this.preload='';}
  play(){played.push(this.src);return Promise.resolve();}
  pause(){}
}

const fakeWindow = {
  AudioContext:FakeAudioContext,
  Audio:FakeAudio,
  addEventListener(){},
  removeEventListener(){}
};

vm.runInNewContext(source, {
  window:fakeWindow,
  document:{hidden:false,addEventListener(){},querySelectorAll(){return[];},getElementById(){return null;}},
  location:{protocol:'file:'},
  localStorage:{getItem(){return null;},setItem(){}},
  Math,Number,String,Object,Array,Promise,Error,Float32Array,
  setTimeout,clearTimeout,
  fetch(){throw new Error('file mode must not call fetch');}
});

fakeWindow.ZargotaSound.combatDiceRoll();
fakeWindow.ZargotaSound.combatDamageImpact('physical', false, false);

setImmediate(() => {
  assert.deepStrictEqual(played, [
    'audio/vtt-actions/dice-roll.mp3',
    'audio/vtt-actions/hit-body-soft.mp3'
  ], 'file:// Workshop plays the bundled custom roll and damage MP3 files');
  const diagnostics = fakeWindow.ZargotaSound.diagnostics();
  assert.strictEqual(diagnostics.plays, 2, 'both local MP3 samples start successfully');
  assert.strictEqual(diagnostics.lastError, '', 'file transport does not leave a fetch error');
  console.log('file audio MP3 transport passed');
});
