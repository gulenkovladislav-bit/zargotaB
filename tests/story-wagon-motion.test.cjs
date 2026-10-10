const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');let id=0,queue=new Map(),listener;const mq={matches:false,addEventListener:(t,f)=>listener=f,removeEventListener:()=>listener=null};const w={matchMedia:()=>mq,requestAnimationFrame:f=>{queue.set(++id,f);return id;},cancelAnimationFrame:i=>queue.delete(i)};
vm.runInNewContext(fs.readFileSync('story-wagon-motion.js','utf8'),{window:w,document:{hidden:false},Math});const api=w.ZargotaStoryWagonMotion,world={style:{removeProperty(k){delete this[k];}}};
api.mount(world,true);assert.equal(queue.size,1);api.mount(world,true);assert.equal(queue.size,1,'render does not restart motion');
function tick(t){const entries=[...queue];queue.clear();entries.forEach(([,f])=>f(t));}
tick(0);tick(16);assert.match(world.style.translate,/px$/);mq.matches=true;listener();assert.equal(queue.size,0);assert.equal(world.style.translate,undefined);mq.matches=false;listener();assert.equal(queue.size,1);api.stop(world);assert.equal(queue.size,0);assert.equal(listener,null);
const bump={start:2,duration:.6,height:2};let before=api.sample(0,bump);
for(let t=.001;t<10;t+=.001){const v=api.sample(t,bump);assert(Math.abs(v.y-before.y)<.04,'no discontinuity at bump or rebound');assert(Math.abs(v.y)<3);before=v;}
console.log('PASS continuous bounded motion, stable mount, reduced motion, cleanup.');
