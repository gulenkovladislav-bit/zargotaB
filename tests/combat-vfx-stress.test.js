'use strict';

const assert = require('assert');
const runtimeModule = require('../combat-vfx-runtime.js');
const canvasModule = require('../combat-vfx-canvas.js');

let clock = 0;
let frames = [];
let frameId = 0;
const context = {
  globalAlpha:1,globalCompositeOperation:'source-over',fillStyle:'',strokeStyle:'',lineWidth:1,
  setTransform(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},beginPath(){},
  moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},fill(){},stroke(){},arc(){},fillRect(){},setLineDash(){}
};
const documentRef = {createElement(){return {className:'',style:{},dataset:{},width:0,height:0,parentNode:null,setAttribute(){},getContext(){return context;},remove(){this.parentNode=null;}};}};
const host = {clientWidth:960,clientHeight:540,firstChild:null,insertBefore(node){node.parentNode=this;this.firstChild=node;}};
const runtime = runtimeModule.createRuntime({now:() => clock});
const engine = canvasModule.createEngine({
  runtime,document:documentRef,now:() => clock,
  requestFrame(callback){const id=++frameId;frames.push({id,callback});return id;},
  cancelFrame(id){frames=frames.filter(frame => frame.id!==id);}
});

function begin(id, preset) {
  const handle = runtime.begin({id,ts:clock,family:preset==='projectile'?'ranged':'weapon'},preset,{quality:'balanced',durationMs:100});
  assert.ok(handle);
  assert.strictEqual(engine.play(handle,host),true);
  return handle;
}

function finishFrame(handles) {
  assert.strictEqual(frames.length,1,'all active effects share one RAF wakeup');
  clock += 101;
  frames.shift().callback(clock);
  handles.forEach(handle => runtime.finish(handle,'complete'));
  assert.strictEqual(frames.length,0,'renderer sleeps after the last effect');
}

const warm = [];
for (let index=0; index<8; index++) warm.push(begin(`warm-${index}`,index%2?'projectile':'slash'));
finishFrame(warm);
assert.strictEqual(engine.snapshot().createdEffects,8);
assert.strictEqual(runtime.snapshot().createdHandles,8);

for (let index=0; index<100; index++) {
  const handle = begin(`stress-${index}`,index%3===0?'projectile':index%3===1?'critical':'slash');
  finishFrame([handle]);
}

const canvas = engine.snapshot();
const metrics = runtime.snapshot();
assert.strictEqual(canvas.plays,108);
assert.strictEqual(canvas.createdEffects,8,'effect records stop allocating after the warm pool');
assert.strictEqual(canvas.reusedEffects,100);
assert.strictEqual(canvas.activeEffects,0);
assert.strictEqual(canvas.poolSize,8);
assert.strictEqual(canvas.maxEffects,8);
assert.strictEqual(canvas.rafActive,false);
assert.strictEqual(metrics.createdHandles,8,'runtime handles stop allocating after warm-up');
assert.strictEqual(metrics.reusedHandles,100);
assert.strictEqual(metrics.activeVfx,0);
assert.strictEqual(metrics.activeParticles,0);
assert.strictEqual(metrics.activeProjectiles,0);
assert.strictEqual(metrics.activeRafLoops,0);
assert.strictEqual(metrics.maxActiveRafLoops,1);

console.log('combat VFX 100-impact stress passed');
