const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const e=JSON.parse(fs.readFileSync(process.argv[2]||'story-content/evan/episode-1-university-v25.json')).episode;
const item=e.storyItems.find(i=>i.itemId==='evan-university-booklet'),before=JSON.stringify(item);
const roots=[];
function element(tag){return {tag,children:[],style:{},listeners:{},append(...x){this.children.push(...x);},setAttribute(k,v){this[k]=v;},addEventListener(k,f){this.listeners[k]=f;},showModal(){this.open=true;},focus(){this.focused=true;},close(){this.open=false;this.listeners.close?.();},remove(){this.removed=true;}};}
const trigger={isConnected:true,focus(){this.focused=true;}},window={ZargotaI18n:{getLocale:()=> 'ru'}};
const ctx={window,document:{activeElement:trigger,createElement:element,createElementNS:(ns,tag)=>element(tag),body:{append(d){roots.push(d);}}},console,setTimeout,clearTimeout};vm.createContext(ctx);
for(const file of ['story-travel-map.js','story-items.js','story-quests.js','story-player.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const api=window.ZargotaStoryTravelMap;
assert.equal(api.destinations(item.travelMap,e.scenes).length,4);
assert.equal(api.destinations({destinations:[{sceneId:'bad',x:0,y:0,width:10,height:10}]},e.scenes).length,0);
assert.equal(api.destinations({destinations:[{...item.travelMap.destinations[0],width:101}]},e.scenes).length,0);
for(const place of item.travelMap.destinations){let travel;
 assert.equal(api.open(item.travelMap,e.scenes,d=>{travel=d.sceneId;return true;}),true);
 const modal=roots.at(-1),buttons=modal.children[1].children.slice(1);assert.equal(buttons.length,4);
 const b=buttons.find(b=>b['aria-label']===place.name);assert.equal(b.style.clipPath,undefined,'label must not be polygon-clipped');assert.equal(b.children[0].tag,'svg');assert.equal(b.children[1].textContent,place.name);b.onfocus();assert.equal(modal.children[2].textContent,place.name);b.onclick();assert.equal(travel,place.sceneId);assert.ok(modal.removed);
}
api.open(item.travelMap,e.scenes,()=>false);roots.at(-1).children[1].children[1].onclick();assert.equal(roots.at(-1).open,true);api.close();assert.equal(trigger.focused,true);
api.open(item.travelMap,e.scenes,()=>true);let stopped=false;roots.at(-1).listeners.keydown({stopPropagation(){stopped=true;}});assert.ok(stopped);api.close();assert.equal(JSON.stringify(item),before);
let c={inventoryItems:[]};window.ZargotaStoryItems.award(c,item,1,false);window.ZargotaStoryItems.award(c,item,1,false);assert.equal(c.inventoryItems.length,1);assert.equal(c.inventoryItems[0].qty,1);
const rules=window.ZargotaStoryRules;
const nodes=e.nodes.filter(n=>n.id.startsWith('evan-v25-'));
for(const n of nodes){assert.ok(n.text&&n.textUk);assert.ok(n.title&&n.titleUk);for(const p of [n,...n.slides]){assert.ok(p.text&&p.textUk);assert.ok(e.speakers[p.speaker]);if(p.emotion)assert.ok(e.speakers[p.speaker].emotions[p.emotion]);}for(const l of n.links){assert.ok(l.label&&l.labelUk);assert.ok(rules.validDestination(e,l),l.to);}}
assert.equal(e.nodes.find(n=>n.id==='evan-exchange-leave').links[0].sceneId,undefined,'Exchange remains non-teleporting');
for(const d of item.travelMap.destinations){const s=e.scenes.find(s=>s.id===d.sceneId).scene,door=s.tokens.find(t=>t.id.endsWith('-door'));assert.ok(rules.pathAllowed({x:s.story.spawnX,y:s.story.spawnY},{x:door.x,y:door.y},s.story.walkable),'Reachable '+d.id);}
const q=window.ZargotaStoryQuests,run={active:'evan-yard-game-quest',done:[]};q.complete(e,run,'evan-yard-finish');assert.equal(run.active,'evan-yard-game-quest');q.complete(e,run,'evan-v25-depart');assert.equal(run.active,'evan-yard-papers-quest');q.complete(e,run,'evan-v25-boarding');q.complete(e,run,'evan-v25-arrival');assert.equal(run.active,'evan-v25-campus');
const player=fs.readFileSync('story-player.js','utf8'),fn=player.slice(player.indexOf('  function openTravelMap('),player.indexOf('  function start(project,callback)'));
const state={character:c,flags:{},sceneId:'street'};let opened=0,travelled=0;
const guard={state,root:{classList:{contains:()=>true},focus(){}},current:null,sequenceBusy:false,introRunning:false,cardGameStop:null,sceneFadeStop:null,data:e,frame:0,t:a=>a,hint(){},cancelAnimationFrame(){},settleWalk(){},changeScene(){travelled++;return true;},w:{ZargotaStoryActors:{close(){}},ZargotaStoryTravelMap:{open(m,scenes,go){opened++;return go(m.destinations[0]);}}}};vm.createContext(guard);vm.runInContext(fn,guard);
assert.equal(guard.openTravelMap(item.itemId),false);state.flags['evan-v25-arrived']=true;assert.equal(guard.openTravelMap(item.itemId),false);state.sceneId=item.travelMap.allowedScenes[0];assert.equal(guard.openTravelMap(item.itemId),true);assert.equal(travelled,1);guard.current={id:'dialogue'};assert.equal(guard.openTravelMap(item.itemId),false);assert.equal(opened,1);
for(const record of e.scenes.filter(s=>s.id.startsWith('scene-evan-v25')||s.id==='scene-mu7f8xuw-u6wn'))assert.ok(fs.existsSync(record.scene.layers[0].image));
console.log('PASS: map UI mock, four routes, invalid destinations, dialogue/location guards, unique booklet, bilingual content, quest progression and walkable approaches.');
