const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const w={},ctx=vm.createContext({window:w});for(const f of ['story-quest-actions.js','story-quests.js','story-environment.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const d=JSON.parse(fs.readFileSync(process.argv[2]||'/private/tmp/episode-mutloww8-sapc-exchange-fixed.json')).episode;
const street=d.scenes.find(r=>r.id==='scene-mu7f8tk1-6m4a'),yard='scene-evan-green-courtyard',arrival=street.scene.story.arrivals[yard],gate=street.scene.story.zones.find(z=>z.id==='evan-green-entrance');
assert.equal(w.ZargotaStoryEnvironment.contains(gate,arrival),false,'arrival must not bounce immediately back');
assert.equal(w.ZargotaStoryEnvironment.blockedZone(street.scene.story.zones,arrival,{x:gate.x,y:gate.y},{}),null,'gate must be reachable through the fence opening');
const questState={active:'evan-yard-meet-quest',done:[]};assert.equal(w.ZargotaStoryQuests.gatedScene(d,street.scene,street.id,questState).story.zones.find(z=>z.id===gate.id).enabled,false);
w.ZargotaStoryQuestActions.run(d.nodes.find(n=>n.id==='evan-exchange-leave').afterWorldActions,{state:questState,records:d.scenes,redraw(){}},()=>{});
assert.equal(w.ZargotaStoryQuests.gatedScene(d,street.scene,street.id,questState).story.zones.find(z=>z.id===gate.id).enabled,true);
const q=d.quests.find(q=>q.id===questState.active),run={sceneId:street.id,flags:{'evan-exchange-errand':true}};
assert.equal(w.ZargotaStoryQuests.display(q,run).title,'Разменять серебро');run.sceneId=yard;assert.equal(w.ZargotaStoryQuests.display(q,run).title,q.title);
if(process.argv[3]){const original=JSON.parse(fs.readFileSync(process.argv[3])).episode;assert.equal(original.nodes.length,d.nodes.length);for(const n of original.nodes){const patched=structuredClone(d.nodes.find(x=>x.id===n.id));if(n.id==='evan-exchange-leave'){patched.afterWorldActions=patched.afterWorldActions.filter(a=>a.actionId!=='exchange-keep-return-open');if(!n.afterWorldActions)delete patched.afterWorldActions;}assert.deepEqual(patched,n,'authored node preserved: '+n.id);}}
console.log('PASS exchange route: no immediate bounce, walkable gate, independent test return, contextual objective, authored nodes preserved.');
