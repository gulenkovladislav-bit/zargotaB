const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(){
 const events={},frames=new Map();let id=0,enabled=true,moves=[];
 const doc={hidden:false,activeElement:null,addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]};
 const win={addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k],requestAnimationFrame:f=>{frames.set(++id,f);return id;},cancelAnimationFrame:i=>frames.delete(i)};
 vm.runInNewContext(fs.readFileSync('story-camera.js','utf8'),{window:win,document:doc});
 const control=win.ZargotaStoryCamera.keyboard({enabled:()=>enabled,move:(x,y)=>moves.push([x,y])});
 return {events,doc,moves,frames,control,disable:()=>enabled=false,step(t){const jobs=[...frames.values()];frames.clear();jobs.forEach(f=>f(t));},key(code,extra={}){let prevented=false;events.keydown({code,preventDefault:()=>prevented=true,...extra});return prevented;}};
}
test('smooth pan, diagonal normalization and release settle',()=>{
 const a=setup();assert.equal(a.key('KeyD'),true);a.step(16);a.step(32);assert.ok(a.moves[1][0]<a.moves[0][0]);assert.ok(a.moves[0][1]===0);
 a.events.keyup({code:'KeyD'});for(let t=48;t<2000;t+=16)a.step(t);assert.equal(a.frames.size,0);
 const b=setup();b.key('KeyD');b.key('KeyW');b.step(16);assert.ok(b.moves[0][0]<0&&b.moves[0][1]>0);assert.ok(Math.abs(Math.hypot(...b.moves[0])-Math.abs(a.moves[0][0]))<1e-8);
});
test('fields, modifiers, disabled state and lost focus never keep panning',()=>{
 const a=setup();assert.equal(a.key('KeyW',{target:{closest:()=>true}}),false);assert.equal(a.key('KeyW',{ctrlKey:true}),false);assert.equal(a.frames.size,0);
 a.key('KeyW');a.events.blur();assert.equal(a.frames.size,0);
 a.key('KeyS');a.disable();a.step(16);assert.equal(a.moves.length,0);assert.equal(a.frames.size,0);
 a.control.dispose();assert.equal(a.events.keydown,undefined);
});
test('camera stays within world bounds',()=>{
 const w={};vm.runInNewContext(fs.readFileSync('story-camera.js','utf8'),{window:w});const c=w.ZargotaStoryCamera.layout(1000,800,1000,800,2,99999,-99999);assert.equal(c.x,500);assert.equal(c.y,-400);
});
