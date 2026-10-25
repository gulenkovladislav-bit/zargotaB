const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const e=load('story-content/esteros/episode-1-food-search-v1.json').episode;
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'story-esteros-resolve-core.js'),'utf8'),ctx);
const core=ctx.window.ZargotaEsterosResolveCore,cfg=e.presentation.esterosResolve,run={};
assert.equal(core.current(run,cfg).hope,3);
assert.equal(core.apply(run,cfg,{id:'bodies',type:'fatalism'}).to,2);
assert.equal(core.apply(run,cfg,{id:'bodies',type:'fatalism'}),null);
assert.equal(core.apply(run,cfg,{id:'food',type:'hope'}).to,3);
const restored=JSON.parse(JSON.stringify(run));assert.equal(core.apply(restored,cfg,{id:'food',type:'hope'}),null);
for(let i=0;i<10;i++)core.apply(run,cfg,{id:'up'+i,type:'hope'});assert.equal(run.esterosResolve.hope,6);
for(let i=0;i<10;i++)core.apply(run,cfg,{id:'down'+i,type:'fatalism'});assert.equal(run.esterosResolve.hope,0);
assert.equal(core.apply(run,cfg,{id:'return',type:'hope'}).to,1);
assert.equal(core.apply(run,{enabled:false},{id:'disabled',type:'hope'}),null);
assert.equal(core.apply(run,cfg,{id:'bad',type:'unknown'}),null);
const nodes=new Map(e.nodes.map(n=>[n.id,n])),scenes=new Map(e.scenes.map(s=>[s.id,s.scene]));
assert.equal(nodes.size,e.nodes.length);assert.equal(scenes.size,e.scenes.length);
for(const n of e.nodes.filter(n=>n.id.startsWith('food-'))){
 assert.ok(n.text&&n.textUk,n.id);for(const p of n.slides||[])assert.ok(p.text&&p.textUk,n.id);
 for(const l of n.links){if(l.to)assert.ok(nodes.has(l.to),l.to);if(l.sceneId)assert.ok(scenes.has(l.sceneId),l.sceneId);if(l.label)assert.ok(l.labelUk);}
 for(const r of n.repeatRoutes||[])assert.ok(nodes.has(r.to));
}
for(const scene of [...scenes.values()].filter(s=>s.layers?.some(l=>l.image.includes('esteros-food-v1')))){
 assert.ok(scene.story.walkable.length>3);for(const t of scene.tokens){if(t.entryId)assert.ok(nodes.has(t.entryId),t.entryId);if(t.image)assert.ok(fs.existsSync(path.join(root,t.image)));}
 for(const l of scene.layers)assert.ok(fs.existsSync(path.join(root,l.image)),l.image);
}
const map=e.storyItems.find(i=>i.itemId==='esteros-mothers-map');
assert.deepEqual(e.player.inventoryItems.find(i=>i.itemId===map.itemId),map);
assert.equal(map.travelMap.destinations.filter(d=>d.id.startsWith('food-')).length,4);
for(const d of map.travelMap.destinations)assert.ok(nodes.has(d.nodeId),d.nodeId);
for(const id of ['food-roots-take','food-eggs-take']){
 const n=nodes.get(id),action=n.afterWorldActions[0];assert.ok(action.actionId);assert.equal(n.repeatRoutes[0].requires,n.afterEffect);assert.ok(e.storyItems.find(i=>i.itemId===action.itemId));
 assert.equal(n.resolveEvent.id,'esteros-provisions-for-home');
}
vm.runInNewContext(fs.readFileSync(path.join(root,'story-quests.js'),'utf8'),ctx);
const q=ctx.window.ZargotaStoryQuests;
for(const ending of ['food-roots-take','food-eggs-take']){const state=q.create(e);q.enter(e,state,e.quests.find(q=>q.id==='food-search').startSceneId);assert.equal(state.active,'food-search');assert.ok(q.complete(e,state,ending));assert.equal(state.active,'food-return');assert.equal(q.complete(e,state,ending),null);assert.ok(q.complete(e,state,'food-home'));assert.equal(state.active,'');}
const src=fs.readFileSync(path.join(root,'story-player.js'),'utf8');assert.ok(src.includes('ZargotaEsterosResolveCore?.apply'));assert.ok(src.includes('if(resolveStop){resolveStop();resolveStop=null;}'));
console.log('PASS: RU/UK graph, assets, map gates, both food routes, one-time rewards, resolve saturation/reversal and serialization.');
