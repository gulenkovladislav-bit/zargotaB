const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const context={window:{}};vm.runInNewContext(fs.readFileSync('story-timeline.js','utf8'),context);const api=context.window.ZargotaStoryTimeline;
const a={id:'a',kind:'image',at:0,duration:10,motion:'zoom',amplitude:.1},b={...a,id:'b',at:10},c={...a,id:'c',at:20},s={cues:[a,b,c]};
assert.equal(api.camera(s,a,10),api.camera(s,b,10));assert.equal(api.camera(s,b,20),api.camera(s,c,20));assert.equal(api.camera(s,b,15),'scale(1.1500000000000001)');
const later=api.camera(s,c,25);api.camera(s,a,1);assert.equal(api.camera(s,c,25),later,'Seeking is deterministic');
b.restartMotion=true;assert.equal(api.camera(s,b,10),'scale(1)');delete b.restartMotion;b.at=11;assert.equal(api.camera(s,b,11),'scale(1)');
let count=0,prevented=0;function key(editable,repeat=false){return{code:'Space',repeat,target:{closest:()=>editable},preventDefault(){prevented++;},stopPropagation(){}};}
assert.equal(api.spaceToggle(key(true),()=>count++),false);api.spaceToggle(key(false),()=>count++);api.spaceToggle(key(false,true),()=>count++);assert.equal(count,1);assert.equal(prevented,2);
console.log('PASS: zoom continuity, seek determinism, explicit reset, gaps and Space keyboard guards');
