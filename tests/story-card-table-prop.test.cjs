const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
let now=0,next=1,plays=0,paused=0,cancelled=0,muted=false,reduced=false;const timers=new Map(),animations=[];
class Element{constructor(tag){this.tag=tag;this.children=[];this.attributes={};}append(...a){this.children.push(...a);}setAttribute(k,v){this.attributes[k]=v;}remove(){this.removed=true;}animate(frames,options){animations.push({frames,options});return{cancel(){cancelled++;}};}}
class Audio{constructor(src){this.src=src;}play(){plays++;return Promise.resolve();}pause(){paused++;}load(){}removeAttribute(k){delete this[k];}}
const w={matchMedia:()=>({matches:reduced})},context={window:w,document:{createElement:t=>new Element(t)},Audio,setTimeout(fn,ms){const id=next++;timers.set(id,{at:now+ms,fn});return id;},clearTimeout:id=>timers.delete(id)};vm.createContext(context);vm.runInContext(fs.readFileSync('story-card-table-prop.js','utf8'),context);
const advance=ms=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now&&timers.has(id)){timers.delete(id);t.fn();}};
const create=w.ZargotaCardTableProp.create;assert.equal(create({},()=>true),null);assert.equal(create({prop:'cat'},()=>true),null);
let prop=create({prop:'gear',durationMs:1800},()=>!muted);assert.equal(plays,0);prop.element.onclick();assert.equal(plays,1);assert.equal(animations.length,1);assert.match(animations[0].frames[1].transform,/720/);prop.element.onclick();assert.equal(plays,1,'Click spam cannot overlap');
advance(2000);assert.equal(plays,6);assert.equal(prop.element.attributes['aria-busy'],'false');assert.ok(paused>0);
muted=true;prop.element.onclick();advance(2000);assert.equal(plays,6,'Muted spin is silent');assert.equal(animations.length,2,'Muted spin still animates');
muted=false;prop.element.onclick();assert.equal(plays,7);muted=true;prop.stopAudio();advance(2000);assert.equal(plays,7,'Mute cancels pending sounds');
prop.dispose();assert.equal(timers.size,0);assert.equal(prop.element.onclick,null);assert.ok(cancelled);prop.dispose();
reduced=true;prop=create({prop:'gear'},()=>false);prop.element.onclick();assert.equal(animations.at(-1).frames[1].transform,undefined,'Reduced motion avoids spinning');prop.dispose();assert.equal(timers.size,0);
const [oldFile,newFile]=process.argv.slice(2);
if(oldFile&&newFile){const before=JSON.parse(fs.readFileSync(oldFile)).episode,after=JSON.parse(fs.readFileSync(newFile)).episode;
 assert.deepEqual(after.nodes,before.nodes);assert.deepEqual(after.storyItems,before.storyItems);assert.deepEqual(after.minigames.towerClaw,before.minigames.towerClaw);
 const a=after.minigames.towerClawTables.find(t=>t.tableId==='engineering'),b=before.minigames.towerClawTables.find(t=>t.tableId==='engineering');assert.deepEqual({...a,tableVisual:undefined},{...b,tableVisual:undefined});assert.equal(a.tableVisual.prop,'gear');
 for(const key of ['background','propImage','propSound'])assert.ok(fs.existsSync(a.tableVisual[key]));
 const digests=new Set();for(const i of [0,3,4,5]){const id='campus26-engineering-person-'+i,s=after.speakers[id+'-speaker'];assert.notEqual(s.portrait,before.speakers[id+'-speaker'].portrait);const data=fs.readFileSync(s.portrait);digests.add(crypto.createHash('sha256').update(data).digest('hex'));assert.equal(after.scenes.find(s=>s.id==='scene-evan-v25-engineering').scene.tokens.find(t=>t.id===id).image,s.portrait);}assert.equal(digests.size,4);
 for(const s of before.scenes)if(s.id!=='scene-evan-v25-engineering')assert.deepEqual(after.scenes.find(v=>v.id===s.id),s);
}
console.log('Table prop: activation-only audio, rotation, repeat guard, mute, disposal, reduced motion; v28 images and old game/content preservation passed.');
