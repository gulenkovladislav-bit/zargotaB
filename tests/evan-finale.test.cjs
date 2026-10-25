const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const file=process.argv[2];assert.ok(file,'Pass the prepared episode envelope');
const e=JSON.parse(fs.readFileSync(file)).episode,P='evan-finale-',nodes=new Map(e.nodes.map(n=>[n.id,n]));
const w={},ctx=vm.createContext({window:w,console,setTimeout,clearTimeout});
for(const f of ['story-quests.js','story-sidequests.js','story-player.js','story-travel-map.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const rules=w.ZargotaStoryRules,side=w.ZargotaStorySideQuests,q=w.ZargotaStoryQuests;
assert.equal(nodes.size,e.nodes.length,'Unique node IDs');
for(const n of e.nodes.filter(n=>n.id.startsWith(P))){
 for(const p of [n,...n.slides||[]]){assert.ok(p.text&&p.textUk,n.id);assert.ok(!/[\uFFFD]/.test(p.text+p.textUk));assert.ok(e.speakers[p.speaker],p.speaker);if(p.emotion)assert.ok(e.speakers[p.speaker].emotions[p.emotion],p.emotion);}
 for(const l of n.links||[]){assert.ok(l.label&&l.labelUk);assert.ok(rules.validDestination(e,l),n.id+' -> '+l.to);}
}
const checklist=e.quests.find(q=>q.id===P+'campus-checklist');
function permutations(a){return a.length?a.flatMap((x,i)=>permutations(a.filter((_,j)=>i!==j)).map(t=>[x,...t])):[[]];}
const code=fs.readFileSync('story-player.js','utf8'),milestoneFn=code.slice(code.indexOf('  function checkDialogueMilestones(){'),code.indexOf('  function openTravelMap('));
for(const fallback of [false,true])for(const order of permutations(checklist.steps.map(s=>s.nodeId))){
 let starts=[];const state={quests:{active:'evan-v25-campus',done:[]},flags:{},character:{inventoryItems:[]},completedDialogues:{}};
 const env=vm.createContext({state,current:null,sequenceBusy:false,introRunning:false,data:e,startDialogue:id=>starts.push(id)});vm.runInContext(milestoneFn,env);
 side.complete(e,state,'evan-v25-arrival');
 env.checkDialogueMilestones();assert.equal(starts.length,0);
 for(let i=0;i<order.length;i++){let id=order[i];if(fallback&&id==='evan-campus-aspiration-lesson')id=P+'lesson-without-folder';side.complete(e,state,id);state.flags[nodes.get(id).afterEffect]=true;env.checkDialogueMilestones();assert.equal(starts.length,i===3?1:0);}
 assert.ok(side.status(state,checklist.id).done);env.checkDialogueMilestones();assert.equal(starts.length,1,'Do not replay milestone');
}
const map=e.storyItems.find(i=>i.itemId==='evan-university-booklet').travelMap;
assert.equal(w.ZargotaStoryTravelMap.destinations(map,e.scenes,{}).length,4);
assert.equal(w.ZargotaStoryTravelMap.destinations(map,e.scenes,{[P+'can-depart']:true}).length,5);
const f=code.slice(code.indexOf('  function openTravelMap('),code.indexOf('  function start(project,'));
let called=0,go;const mapState={character:{inventoryItems:[{itemId:'evan-university-booklet',qty:1,travelMap:map}]},flags:{'evan-v25-arrived':true},sceneId:map.allowedScenes[0]};
const mapCtx=vm.createContext({state:mapState,root:{classList:{contains:()=>true},focus(){}},current:null,sequenceBusy:false,introRunning:false,cardGameStop:null,sceneFadeStop:null,data:e,frame:0,sound:false,t:a=>a,hint(){},cancelAnimationFrame(){},settleWalk(){},changeScene(){called++;return true;},w:{ZargotaStoryActors:{close(){}},ZargotaStoryTravelMap:{open(m,s,g,sound,options){go=g;assert.equal(options.flags,mapState.flags);return true;}}}});vm.runInContext(f,mapCtx);mapCtx.openTravelMap('evan-university-booklet');assert.equal(go(map.destinations.at(-1)),false);assert.equal(called,0);mapState.flags[P+'can-depart']=true;assert.equal(go(map.destinations.at(-1)),true);assert.equal(called,1);
// Every ordered choice of two different faculties reaches the finale, with either guild decision.
for(const first of nodes.get(P+'choose').links)for(const second of nodes.get(first.to).links.filter(l=>l.to.startsWith(P+'pair-')))for(const guild of [true,false]){
 const run={flags:{},character:{inventoryItems:[]},quests:{active:P+'plans-quest',done:[]}};
 function take(id,l){const result=rules.choose(e,run,id,l.id);assert.ok(result);return result.to;}
 let id=take(P+'choose',first);id=take(id,second);id=take(id,nodes.get(id).links[0]);
 assert.equal(Object.keys(run.flags).filter(f=>f.startsWith(P+'applied-')).length,1);
 const pair=Object.keys(run.flags).find(f=>f.startsWith(P+'applied-')).slice((P+'applied-').length).split('-');assert.equal(new Set(pair).size,2);
 id=take(id,nodes.get(id).links[guild?0:1]);id=take(id,nodes.get(id).links[0]);assert.equal(id,P+'plans');q.complete(e,run.quests,id);id=take(id,nodes.get(id).links[0]);assert.equal(id,P+'results');
 const guildLink=nodes.get(id).links[1];assert.equal(!!rules.choose(e,run,id,guildLink.id),guild);
 id=P+'letters';while(nodes.get(id).links.length){id=take(id,nodes.get(id).links[0]);}assert.equal(id,P+'end');q.complete(e,run.quests,id);assert.equal(run.quests.active,'');assert.ok(nodes.get(id).complete);
}
for(const id of ['scene-evan-evening-room','scene-evan-results']){const s=e.scenes.find(r=>r.id===id).scene;assert.equal(s.story.arrivalFade.color,'black');assert.equal(s.story.wagonRide,false);assert.ok(s.story.zones.every(z=>z.blocked||z.occlusion));assert.ok(fs.existsSync(s.layers[0].image));}
console.log('PASS: 48 campus orders, 24 application paths, gated map, bilingual pages, emotions, final quest chain.');
