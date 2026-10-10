const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let played=0,paused=0,src='',modal;
function el(){return {style:{},append(){},setAttribute(){},addEventListener(k,f){this[k]=f;},showModal(){modal=this;},focus(){},remove(){},close(){this.closeHandler?.();}};}
const context={window:{},document:{createElement:el,createElementNS:()=>el(),body:{append(){}},activeElement:null},Audio:class{constructor(path){src=path;}play(){played++;return Promise.resolve();}pause(){paused++;}}};
vm.runInNewContext(fs.readFileSync('story-travel-map.js','utf8'),context);
const api=context.window.ZargotaStoryTravelMap,map={image:'map.png',destinations:[{sceneId:'a',x:0,y:0,width:10,height:10}]},scenes=[{id:'a'}];
assert.equal(api.open(map,scenes,()=>true,false),true);assert.equal(played,0);
assert.equal(api.open(map,scenes,()=>true,true),true);assert.equal(played,1);
assert.equal(src,'assets/stories/audio/mixkit-paper-slide-1530.wav');assert.ok(fs.statSync(src).size>44);
modal.close();assert.equal(paused,1);
assert.equal(api.open({},scenes,()=>true,true),false);assert.equal(played,1);
console.log('PASS map sound: approved WAV, mute, invalid map and close cleanup.');
