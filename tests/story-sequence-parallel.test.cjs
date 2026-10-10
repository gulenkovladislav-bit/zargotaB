const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let time=0,nextId=0,frames=new Map();const window={ZargotaStoryWalk:{stop(){},update(){}}};
vm.runInNewContext(fs.readFileSync('story-sequence.js','utf8'),{window,performance:{now:()=>time},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frames.set(++nextId,fn);return nextId;},cancelAnimationFrame:id=>frames.delete(id)});
const scene={tokens:[{id:'tess',x:83,y:43},{id:'milo',x:78,y:44}]},els={tess:{style:{}},milo:{style:{}}},world={querySelector:q=>els[q.match(/"(.*?)"/)[1]]};let done=0;
const actions=[{parallel:[{tokenId:'tess',points:[[110,43]],durationMs:4200,hide:true},{tokenId:'milo',points:[[105,44]],durationMs:4200,hide:true}]}];
function tick(t){time=t;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(t));}
window.ZargotaStorySequence.run(actions,scene,world,()=>done++);tick(2100);assert.equal(scene.tokens[0].x,96.5);assert.equal(scene.tokens[1].x,91.5);assert.equal(done,0);tick(4200);assert.equal(done,1);assert(scene.tokens.every(t=>t.visible===false));
window.ZargotaStorySequence.run(actions,scene,world,()=>done++);window.ZargotaStorySequence.cancel();tick(9000);assert.equal(done,1);assert.equal(frames.size,0);
console.log('PASS simultaneous departure, completion once, both hidden and cancellation.');
