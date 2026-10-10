const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const base='assets/stories/audio/';
for(const name of ['freesound_community-2-horse-carriage-41976.mp3','yodguard-coin-collect-3-540190.mp3','mixkit-paper-slide-1530.wav'])assert(fs.statSync(base+name).size>1000);
const actor=fs.readFileSync('story-actors.js','utf8');
const inspect=actor.slice(actor.indexOf('  function inspectItem('),actor.indexOf('  function showCharacter('));
function runInspect(item,allowed){let sounds=[],listeners={};const element=()=>({classList:{add(){}},append(){},showModal(){},focus(){},remove(){},addEventListener(k,f){listeners[k]=f;}});const context={item,el:element,btn:element,t:a=>a,local:(o,k)=>o[k],document:{body:{appendChild(){}}},w:{},bagSoundAllowed:()=>allowed,Audio:function(path){sounds.push(path);this.play=()=>Promise.resolve();this.pause=()=>{};}};vm.runInNewContext(inspect+';inspectItem(item,null);',context);listeners.close();return sounds;}
assert.deepEqual(runInspect({itemId:'evan-draft-folder'},true),[base+'mixkit-paper-slide-1530.wav']);
assert.deepEqual(runInspect({itemId:'evan-draft-folder'},false),[]);
assert.deepEqual(runInspect({itemId:'other'},true),[]);
const traffic=fs.readFileSync('story-traffic.js','utf8');
const sound=traffic.slice(traffic.indexOf(' function sound('),traffic.indexOf(' var world='));
function runTraffic(path,enabled){let played=[];const ctx={s:{motion:{kind:'cart',sound:path}},p:{x:50,y:50},soundEnabled:enabled,soundVolume:1,listener:{x:50,y:50},scene:{},mixer:null,clamp:(v,a,b,f)=>v==null?f:Math.max(a,Math.min(b,v)),Audio:function(src){played.push(src);this.paused=false;}};vm.runInNewContext(sound+';sound(s,p,1,10);',ctx);return played;}
assert.deepEqual(runTraffic('assets/stories/Evan/traffic/horse-wagon-438194.mp3',true),[base+'freesound_community-2-horse-carriage-41976.mp3']);
assert.deepEqual(runTraffic('custom.mp3',true),['custom.mp3']);
assert.deepEqual(runTraffic('custom.mp3',false),[]);
console.log('PASS approved audio files, drawing inspection and mute, carriage legacy routing and custom preservation');
