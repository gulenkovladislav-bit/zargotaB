const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('story-timeline-editor.js','utf8');
let handlers={},draft={duration:20,audioTrimStart:0,audioTrimEnd:20},updates=0;
const context={draft,length:{},selected:'',dragging:false,Number,Math,copy:x=>JSON.parse(JSON.stringify(x)),t:a=>a,el:()=>({dataset:{},style:{}}),inspect(){},update(){updates++;},control:{audio:{duration:40},pause(){},set(){},seek(){}}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function bindClip('),source.indexOf('  function update()')),context);
function item(){return{style:{},addEventListener(k,f){handlers[k]=f;},setPointerCapture(){}};}
function drag(c,edge,delta,audio=false){const i=item();context.bindClip(i,c,10,audio);i.onpointerdown({button:0,target:{dataset:{edge}},clientX:0,pointerId:1});i.onpointermove({clientX:delta*10});i.onpointerup();return c;}
assert.deepEqual(drag({at:3,duration:4},'right',2),{at:3,duration:6});
assert.deepEqual(drag({at:3,duration:4},'left',2),{at:5,duration:2});
assert.deepEqual(drag({at:3,duration:4},undefined,2),{at:5,duration:4});
assert.equal(drag({at:3,duration:4},'right',-20).duration,.05);
drag({at:0,duration:20},'left',4,true);assert.equal(draft.audioTrimStart,4);assert.equal(draft.duration,16);
drag({at:0,duration:16},'right',-2,true);assert.equal(draft.audioTrimEnd,18);assert.equal(draft.duration,14);assert(updates>=6);
class Audio{constructor(){this.currentTime=0;this.duration=40;this.paused=true;}pause(){this.paused=true;}load(){}removeAttribute(){}}
const runtime={window:{},Audio,requestAnimationFrame(){},cancelAnimationFrame(){}};vm.createContext(runtime);vm.runInContext(fs.readFileSync('story-timeline.js','utf8'),runtime);const api=runtime.window.ZargotaStoryTimeline;
for(let time=0;time<4;time+=.1){const p=api.imagePair({src:'',altSrc:'only.png',at:0,fps:2},time);assert.equal(p.first,'only.png');assert.equal(p.second,'only.png');assert.equal(p.mix,0);}
assert.equal(api.imagePair({src:'a',altSrc:'b',at:0,fps:2},.25).mix,.5);
const c=api.transport({...draft,audio:'x',cues:[]},{},{render(){}});c.seek(3);assert.equal(c.audio.currentTime,7);assert.equal(c.now(),3);c.seek(100);assert.equal(c.audio.currentTime,18);
assert.equal(JSON.parse(JSON.stringify(draft)).audioTrimStart,4);
console.log('PASS: resize/move handlers, minimum duration, audio trim/seek, serialization and single-frame flicker regression');
