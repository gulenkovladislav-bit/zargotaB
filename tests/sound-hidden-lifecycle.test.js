'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('(function(w) {', html.indexOf('//  ZARGOTA SOUND ENGINE v2'));
const end = html.indexOf('})(window);', start) + '})(window);'.length;
const source = html.slice(start, end);

const listeners = {};
const oscillators = [];
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
}
FakeAudioContext.prototype.createGain = function(){return connectable({gain:audioParam(1)});};
FakeAudioContext.prototype.createDynamicsCompressor = function(){return connectable({threshold:audioParam(),knee:audioParam(),ratio:audioParam(),attack:audioParam(),release:audioParam()});};
FakeAudioContext.prototype.createOscillator = function(){
  const oscillator = connectable({frequency:audioParam(),start(){this.started=true;},stop(at){(this.stopCalls||(this.stopCalls=[])).push(at);}});
  oscillators.push(oscillator);return oscillator;
};
FakeAudioContext.prototype.createBuffer = function(){return{getChannelData(){return new Float32Array(8);}};};
FakeAudioContext.prototype.createBufferSource = function(){return connectable({start(){},stop(){}});};
FakeAudioContext.prototype.createBiquadFilter = function(){return connectable({frequency:audioParam(),Q:audioParam()});};
FakeAudioContext.prototype.resume = function(){};

const documentRef = {
  hidden:false,
  addEventListener(type, listener){listeners[type]=listener;}
};
const fakeWindow = {AudioContext:FakeAudioContext,addEventListener(){},removeEventListener(){}};
vm.runInNewContext(source, {
  window:fakeWindow,document:documentRef,
  localStorage:{getItem(){return null;},setItem(){}},
  Math,Number,String,Object,Array,Promise,Error,Float32Array,
  setTimeout,clearTimeout,fetch:undefined
});

fakeWindow.ZargotaSound.buttonTap();
assert.strictEqual(oscillators.length,1);
assert.strictEqual(fakeWindow.ZargotaSound.diagnostics().activeNodes,1);

documentRef.hidden=true;
listeners.visibilitychange();
assert.strictEqual(fakeWindow.ZargotaSound.diagnostics().activeNodes,0);
assert.strictEqual(fakeWindow.ZargotaSound.diagnostics().hiddenStops,1);
assert.strictEqual(oscillators[0].stopCalls.length,2,'scheduled envelope stop plus immediate hidden-tab stop');

fakeWindow.ZargotaSound.buttonTap();
assert.strictEqual(oscillators.length,1,'hidden tabs cannot create another oscillator');

console.log('sound hidden-tab lifecycle passed');
