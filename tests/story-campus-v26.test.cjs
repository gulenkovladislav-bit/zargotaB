const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const [source,result]=process.argv.slice(2);assert.ok(source&&result,'Pass v25 and v26 exports');
const before=JSON.parse(fs.readFileSync(source)).episode,e=JSON.parse(fs.readFileSync(result)).episode,w={};vm.runInNewContext(fs.readFileSync('story-player.js','utf8'),{window:w});
for(const n of before.nodes)assert.deepEqual(e.nodes.find(x=>x.id===n.id),n);
for(const k of ['player','minigames','quests','storyItems','intro','startSceneId','activeSceneId','scene'])assert.deepEqual(e[k],before[k]);
for(const [id,s]of Object.entries(before.speakers))assert.deepEqual(e.speakers[id],s);
for(const [id,i]of Object.entries(before.interactions))assert.deepEqual(e.interactions[id],i);
assert.equal(new Set(e.nodes.map(n=>n.id)).size,e.nodes.length);
for(const key of ['magic','engineering','botany','military']){
 const r=e.scenes.find(s=>s.id==='scene-evan-v25-'+key),tokens=r.scene.tokens.filter(t=>t.id.startsWith('campus26-'));
 assert.equal(tokens.filter(t=>t.type==='note').length,5);assert.equal(tokens.filter(t=>t.type!=='note').length,8);
 assert.equal(new Set(tokens.filter(t=>t.image).map(t=>t.image)).size,8,'Distinct appearances within '+key);
 for(const t of tokens){assert.ok(w.ZargotaStoryRules.pathAllowed({x:r.scene.story.spawnX,y:r.scene.story.spawnY},t,r.scene.story.walkable),'Reach '+t.id);const node=e.nodes.find(n=>n.id===e.interactions[t.id].entryId);assert.ok(node);assert.equal(node.editorSceneId,r.id);if(t.image){assert.ok(fs.existsSync(decodeURIComponent(t.image)));assert.ok(!t.image.includes('silhouette'));}}
 const original=before.scenes.find(s=>s.id===r.id);assert.deepEqual({...r,scene:{...r.scene,tokens:original.scene.tokens}},original);
}
for(const r of before.scenes.filter(s=>!s.id.match(/v25-(magic|engineering|botany|military)$/)))assert.deepEqual(e.scenes.find(s=>s.id===r.id),r);
for(const n of e.nodes.filter(n=>n.id.startsWith('campus26-'))){assert.ok(n.title&&n.titleUk);assert.equal(n.links.length,0);for(const p of [n,...n.slides]){assert.ok(p.text&&p.textUk);assert.ok(p.text.length<230&&p.textUk.length<230);assert.ok(e.speakers[p.speaker]);if(p.emotion)assert.ok(e.speakers[p.speaker].emotions[p.emotion]);}assert.ok(!n.afterWorldActions);}
console.log('PASS: 20 bilingual inspections; 32 visible NPCs with 8 distinct appearances per courtyard; assets, emotions, reachable positions; all prior nodes/settings/scenes preserved.');
