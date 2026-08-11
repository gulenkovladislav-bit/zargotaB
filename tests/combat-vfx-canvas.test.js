const assert = require('assert');
const runtimeModule = require('../combat-vfx-runtime.js');
const canvasModule = require('../combat-vfx-canvas.js');

let clock = 0;
let frames = [];
let frameId = 0;
let visibilityListener = null;
const context = {
  globalAlpha:1,globalCompositeOperation:'source-over',fillStyle:'',strokeStyle:'',lineWidth:1,
  setTransform(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},
  beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},closePath(){},fill(){},stroke(){},
  arc(){},fillRect(){},setLineDash(){}
};
const fakeCanvas = () => ({
  className:'',style:{},dataset:{},width:0,height:0,parentNode:null,
  setAttribute(){},getContext(){return context;},remove(){this.parentNode=null;}
});
const documentRef = {hidden:false,createElement(tag){assert.strictEqual(tag,'canvas');return fakeCanvas();},addEventListener(type,listener){if(type==='visibilitychange')visibilityListener=listener;}};
const host = {
  clientWidth:640,clientHeight:320,firstChild:null,
  insertBefore(node){node.parentNode=this;this.firstChild=node;}
};
const runtime = runtimeModule.createRuntime({now:() => clock});
const engine = canvasModule.createEngine({
  runtime,document:documentRef,now:() => clock,
  requestFrame(callback){const id=++frameId;frames.push({id,callback});return id;},
  cancelFrame(id){frames=frames.filter(frame => frame.id!==id);}
});

const arrow = runtime.begin({id:'arrow-1',family:'ranged',ts:0},'projectile',{quality:'balanced'});
const fire = runtime.begin({id:'fire-1',family:'spell',ts:0},'fire',{quality:'balanced',durationMs:1900});
assert.strictEqual(engine.play(arrow,host),true);
assert.strictEqual(engine.play(fire,host),true);
assert.match(require('fs').readFileSync(require('path').join(__dirname,'..','combat-vfx-canvas.js'),'utf8'), /key==='slash'\|\|key==='critical'\|\|key==='miss'[\s\S]*quadraticCurveTo[\s\S]*key==='block'/, 'weapon misses, criticals and blocks retain distinct Canvas silhouettes');
assert.strictEqual(frames.length,1,'all effects share one pending RAF');
assert.strictEqual(engine.snapshot().activeEffects,2);
assert.strictEqual(engine.snapshot().createdEffects,2);
assert.strictEqual(runtime.snapshot().activeRafLoops,1);
assert.strictEqual(engine.canvas().dataset.dpr,'1','balanced DPR is safely clamped in a non-browser test');

documentRef.hidden=true;
visibilityListener();
assert.strictEqual(frames.length,0,'hiding the tab cancels its pending Canvas RAF immediately');
assert.strictEqual(engine.snapshot().activeEffects,0);
assert.strictEqual(runtime.snapshot().activeVfx,0);
assert.strictEqual(runtime.snapshot().activeRafLoops,0);
documentRef.hidden=false;

const arrowRestarted = runtime.begin({id:'arrow-2',family:'ranged',ts:0},'projectile',{quality:'balanced'});
const fireRestarted = runtime.begin({id:'fire-2',family:'spell',ts:0},'fire',{quality:'balanced',durationMs:1900});
assert.strictEqual(engine.play(arrowRestarted,host),true);
assert.strictEqual(engine.play(fireRestarted,host),true);

clock=500;
frames.shift().callback(clock);
assert.strictEqual(frames.length,1,'active effects schedule one next frame');
assert.strictEqual(engine.snapshot().drawFrames,1);

clock=1600;
frames.shift().callback(clock);
assert.strictEqual(frames.length,1,'event-derived duration keeps the shared frame alive');
clock=2000;
frames.shift().callback(clock);
assert.strictEqual(frames.length,0);
assert.strictEqual(engine.snapshot().activeEffects,0);
assert.strictEqual(engine.snapshot().completed,2);
assert.strictEqual(engine.snapshot().poolSize,2);
assert.strictEqual(runtime.snapshot().activeRafLoops,0);

runtime.finish(arrowRestarted,'complete');
runtime.finish(fireRestarted,'complete');
const heal = runtime.begin({id:'heal-1',family:'heal',ts:clock},'heal',{quality:'low'});
assert.strictEqual(engine.play(heal,host),true);
assert.ok(engine.snapshot().reusedEffects>=1,'completed effect records are reused');
assert.strictEqual(heal.cancel('preview-cleanup'),true,'EffectHandle.cancel releases its bound Canvas effect');
assert.strictEqual(engine.snapshot().cancelled,3,'two hidden-tab cancellations plus the explicit preview cleanup are counted');
assert.strictEqual(frames.length,0,'cancelling the last effect stops the RAF');
assert.strictEqual(runtime.activeCount(),0);
assert.strictEqual(heal.cancel('duplicate'),false,'a cancelled Canvas handle stays idempotent');

const cappedRuntime = runtimeModule.createRuntime({now:() => clock});
const cappedEngine = canvasModule.createEngine({
  runtime:cappedRuntime,document:documentRef,now:() => clock,maxConcurrent:2,
  requestFrame(callback){const id=++frameId;frames.push({id,callback});return id;},
  cancelFrame(id){frames=frames.filter(frame => frame.id!==id);}
});
const movement = cappedRuntime.begin({id:'cap-move',family:'movement',ts:clock},'movement',{quality:'low'});
const cleanse = cappedRuntime.begin({id:'cap-cleanse',family:'heal',ts:clock},'cleanse',{quality:'low'});
const critical = cappedRuntime.begin({id:'cap-critical',family:'weapon',ts:clock},'critical',{quality:'low'});
const extraMovement = cappedRuntime.begin({id:'cap-extra-move',family:'movement',ts:clock},'movement',{quality:'low'});
assert.strictEqual(cappedEngine.play(movement,host),true);
assert.strictEqual(cappedEngine.play(cleanse,host),true);
assert.strictEqual(cappedEngine.play(critical,host),true,'important impact replaces cosmetic movement at capacity');
assert.strictEqual(cappedEngine.play(extraMovement,host),false,'cosmetic effect is dropped when only higher-priority effects remain');
assert.strictEqual(cappedEngine.snapshot().activeEffects,2);
assert.strictEqual(cappedEngine.snapshot().capacityDrops,2);
assert.strictEqual(cappedRuntime.snapshot().activeVfx,2,'dropped handles are completed immediately');
cappedEngine.clear('test-cleanup');
cappedRuntime.finish(cleanse,'test-cleanup');
cappedRuntime.finish(critical,'test-cleanup');
assert.strictEqual(cappedRuntime.snapshot().activeVfx,0);

const hiddenRuntime = runtimeModule.createRuntime({now:() => clock});
const hiddenDocument = {hidden:true,createElement(){throw new Error('hidden tabs must not allocate a Canvas');}};
const hiddenEngine = canvasModule.createEngine({
  runtime:hiddenRuntime,document:hiddenDocument,now:() => clock,
  requestFrame(){throw new Error('hidden tabs must not schedule RAF');}
});
const hiddenFire = hiddenRuntime.begin({id:'hidden-fire',family:'spell',ts:clock},'fire',{quality:'high'});
assert.strictEqual(hiddenEngine.play(hiddenFire,host),true,'hidden cosmetic FX is consumed without triggering a DOM fallback');
assert.strictEqual(hiddenEngine.snapshot().hiddenDrops,1);
assert.strictEqual(hiddenEngine.snapshot().activeEffects,0);
assert.strictEqual(hiddenEngine.snapshot().rafActive,false);
assert.strictEqual(hiddenRuntime.snapshot().activeRafLoops,0);
assert.strictEqual(hiddenRuntime.finish(hiddenFire,'complete'),true,'the shared cleanup lane can close a skipped hidden-tab handle');

console.log('combat VFX canvas passed');
