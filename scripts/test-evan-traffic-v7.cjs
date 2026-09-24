// Source-level regression checks; not a browser or audible-playback test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const before=require('../story-content/evan/episode-1-courtyard-v6.json').episode;
const after=require('../story-content/evan/episode-1-courtyard-v7.json').episode;
assert.deepEqual(after.nodes,before.nodes);
for(let i=0;i<2;i++)assert.deepEqual(after.scenes[i],before.scenes[i]);
const window={};vm.runInNewContext(fs.readFileSync('story-quests.js','utf8'),{window});
const street=after.scenes.find(s=>s.id==='scene-mu7f8tk1-6m4a');
for(const active of ['evan-walk-quest','evan-yard-papers-quest']){
 const view=window.ZargotaStoryQuests.gatedScene(after,street.scene,street.id,{active,done:[]});
 const gate=view.tokens.find(t=>t.id==='evan-green-entrance');
 assert.notEqual(gate.visible,false);assert.notEqual(gate.enabled,false);
 assert(after.scenes.some(s=>s.id===gate.sceneId));
}
assert.equal(street.scene.story.walkable,undefined);
assert.equal(after.scenes.find(s=>s.id==='scene-evan-green-courtyard').scene.story.walkable,undefined);
let tick;const audios=[];class Audio{constructor(src){this.src=src;this.paused=true;audios.push(this);}play(){this.paused=false;}pause(){this.paused=true;}removeAttribute(){}load(){}}
const image={style:{}},el={isConnected:true,dataset:{tokenId:'cart'},style:{},closest:()=>null,querySelector:()=>image,setAttribute(){}};
const world={isConnected:true,closest:()=>null,querySelectorAll:selector=>selector==='[data-token-id]'?[el]:[]};
window.matchMedia=()=>({matches:false});
vm.runInNewContext(fs.readFileSync('story-traffic.js','utf8'),{window,document:{hidden:false},Audio,requestAnimationFrame:fn=>(tick=fn,1),cancelAnimationFrame(){}});
const traffic=window.ZargotaStoryTraffic.create();traffic.setSound(true);traffic.position({x:50,y:50});
traffic.mount({boardWidth:24,boardHeight:16,trafficTokens:[{id:'cart',size:80,bakedFrame:true,ambientMotion:{enabled:true,kind:'cart',random:false,mode:'pingpong',duration:40,trails:false,points:[[50,50],[60,50]],sound:'cart.mp3',soundRadius:5}}]},world,'street');
tick(100);assert.equal(audios.length,1);assert(audios[0].volume>0);assert.equal(el.style.height,(80*2/3)+'px');
traffic.position({x:0,y:0});tick(200);assert(audios[0].paused);
traffic.position({x:50,y:50});tick(300);assert(!audios[0].paused);
const held=el.style.left;el.dataset.storyHailedUntil='1000';tick(400);assert.equal(el.style.left,held);assert(audios[0].paused);tick(1100);assert.notEqual(el.style.left,held);
traffic.setSound(false);assert(audios[0].paused);traffic.dispose();
console.log('PASS: entrance visibility, destination, unrestricted new maps, preserved room/shop, traffic attenuation and mute lifecycle');
