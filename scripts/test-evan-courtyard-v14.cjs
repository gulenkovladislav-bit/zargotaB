'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=v=>JSON.parse(fs.readFileSync(path.join(root,`story-content/evan/episode-1-courtyard-v${v}.json`))).episode;
const e=read(14),base=read(13),nodes=new Map(e.nodes.map(n=>[n.id,n]));
assert.equal(nodes.size,e.nodes.length);
function routes(id,seen=[]){assert(!seen.includes(id));const n=nodes.get(id);assert(n,id);const p=[...seen,id];return n.links.length?n.links.flatMap(l=>routes(l.to,p)):[p];}
const paths=routes('evan-green-rules');assert(paths.length>=4);
for(const p of paths){assert(p.includes('evan-milo-arrives'));assert.equal(p.at(-1),'evan-port-at-circle');assert.equal(p.filter(id=>['evan-port-one','evan-port-two','evan-port-free'].includes(id)).length,1);}
assert.deepEqual(e.player,base.player,'No starting inventory or money changes');
assert.deepEqual(e.quests,base.quests,'Quest boundaries preserved');
assert.deepEqual(e.interactions,base.interactions,'Entry points preserved');
assert.deepEqual(e.scene,base.scene,'Current scene preserved');
for(const s of base.scenes)if(s.id!=='scene-evan-green-courtyard')assert.deepEqual(e.scenes.find(r=>r.id===s.id),s);
assert.equal(nodes.get('evan-port-stake').links.find(l=>l.to==='evan-port-two').requiresItemQty,2);
assert.equal(nodes.get('evan-port-bargain').links.find(l=>l.to==='evan-port-one').requiresItemQty,1);
assert.equal(nodes.get('evan-port-at-circle').afterEffect,'evan-green-game-agreed');
let checked=0;
for(const id of new Set(paths.flat())){
 const n=nodes.get(id),before=base.nodes.find(v=>v.id===id);
 for(const key of ['links','beforeWorldActions','afterWorldActions','afterActions','afterEffect','repeatWhen','repeatId'])assert.deepEqual(n[key],before[key],`${id}: ${key} retained`);
 for(const p of [n,...n.slides]){
  assert(p.text&&p.textUk,`${id} bilingual`);assert(p.text.length<=240&&p.textUk.length<=240,`${id}: split long beat`);
  const actor=e.speakers[p.speaker];assert(actor,p.speaker);
  if(p.showPortrait){assert(actor.emotions[p.emotion],`${id}: unknown emotion ${p.emotion}`);assert(fs.existsSync(path.join(root,actor.emotions[p.emotion].portrait)));}
  if(p.image){assert(fs.existsSync(path.join(root,p.image)),p.image);assert.equal(p.imageFit,'contain');}
  if(p.speaker==='evan-yard-milo')assert(p.showPortrait);
  checked++;
 }
}
const milo=e.scenes.find(s=>s.id==='scene-evan-green-courtyard').scene.tokens.find(t=>t.id==='evan-milo-token');
assert.equal(milo.image,e.speakers['evan-yard-milo'].portrait);assert.equal(milo.visible,false);assert.notEqual(milo.type,'note');
assert.equal(Object.keys(e.speakers['evan-yard-milo'].emotions).length,6);
assert.deepEqual(e.storyItems.slice(0,base.storyItems.length),base.storyItems);
for(const id of ['evan-broken-counter','evan-lodestone-fragment']){const item=e.storyItems.find(i=>i.itemId===id);assert(item);assert(item.nameUk&&item.descriptionUk);for(const key of ['image','inspectImage'])assert(fs.existsSync(path.join(root,item[key])),item[key]);assert(!(e.player.inventoryItems||[]).some(i=>i.itemId===id));}
console.log(`PASS v14: ${checked} bilingual beats, all routes, portraits and item images; unrelated content and rewards unchanged`);
