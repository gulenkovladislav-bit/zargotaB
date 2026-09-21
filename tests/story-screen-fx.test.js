const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let reduced=false;const context={window:{},matchMedia:()=>({matches:reduced})};vm.runInNewContext(fs.readFileSync('story-screen-fx.js','utf8'),context);const api=context.window.ZargotaStoryScreenFx;
assert.equal(api.config({damage:2}).type,'damage');assert.equal(api.config({damage:2,screenFx:{type:'none'}}).type,'none');assert.equal(api.config({screenFx:{intensity:9,durationMs:0}}).intensity,1);assert.equal(api.config({screenFx:{durationMs:0}}).durationMs,300);
let calls=0,canceled=false;const img={animate(frames,opts){calls++;assert.equal(opts.iterations,1);assert.ok(frames.length>=2);assert.equal(opts.fill,'forwards');assert.equal(opts.duration,5000);return{cancel(){canceled=true;}};}};
for(const type of ['gaze','pan','approach']){canceled=false;api.motion(img,{type,durationMs:5000}) ();assert.ok(canceled);}
assert.equal(calls,3);reduced=true;api.motion(img,{type:'gaze',durationMs:5000})();assert.equal(calls,3);console.log('Screen FX: defaults, limits, explicit off, finite motion presets, cancellation and reduced-motion passed');
reduced=false;let loops=0;
for(const type of ['gaze','pan','approach','retreat','rise','drift']){let stopped=false;const stop=api.motion({animate(frames,opts){assert.equal(opts.iterations,Infinity);assert.equal(opts.direction,'alternate');assert.equal(opts.easing,'ease-in-out');assert.equal(opts.duration,8000);assert.ok(frames.every(f=>!f.transform.includes('NaN')));loops++;return{cancel(){stopped=true;}};}},{type,loop:true,durationMs:8000});stop();assert.ok(stopped);}
assert.equal(loops,6);console.log('Loop motion: all six presets alternate smoothly, use seconds converted to milliseconds and cancel cleanly.');
const fxSource=fs.readFileSync('story-screen-fx.js','utf8'),playerSource=fs.readFileSync('story-player.js','utf8');
assert.ok(fxSource.includes('stopMotion=motion(img,node.imageMotion)'));
assert.ok(fxSource.includes('stop=motion(img,draft.imageMotion)'));
assert.ok(playerSource.includes('imageMotionStop=w.ZargotaStoryScreenFx.motion(art,node.imageMotion)'));
const contained={style:{},animate(frames,opts){assert.equal(opts.duration,2000);assert.equal(opts.iterations,Infinity);assert.notEqual(frames[0].transform,frames[1].transform);return{cancel(){}};}};
api.frame(contained,{imageFit:'contain',imageZoom:1});
api.motion(contained,{type:'pan',intensity:.85,durationMs:2000,loop:true})();
assert.equal(contained.style.objectFit,'contain');assert.equal(contained.style.scale,'1');
console.log('Contain frame: motion stays enabled in player, preview and framing; frame settings preserved.');
