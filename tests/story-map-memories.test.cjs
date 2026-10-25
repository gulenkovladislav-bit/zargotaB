const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const content=JSON.parse(fs.readFileSync('story-content/esteros/mothers-map-v1.json'));
const roots=[];
function element(tag){return {tag,children:[],style:{},listeners:{},append(...c){this.children.push(...c);},setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.listeners[k]=v;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},remove(){},focus(){}};}
let locale='ru';
const w={ZargotaI18n:{getLocale:()=>locale}};
const ctx={window:w,document:{createElement:element,createElementNS:(_,t)=>element(t),body:{append(d){roots.push(d);}}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('story-travel-map.js','utf8'),ctx);
const api=w.ZargotaStoryTravelMap,map=content.item.travelMap;
for(const lang of ['ru','uk']){
 locale=lang;let selected;
 assert.equal(api.open(map,[],p=>{selected=p.nodeId;return true;}),true);
 const modal=roots.at(-1);
 assert.equal(modal.children[1].children[0].src,lang==='uk'?map.imageUk:map.image);
 assert.equal(modal.children[1].children.length,14);
 modal.children[1].children[1].onclick();
 assert.equal(selected,'esteros-map-bridge');assert.equal(modal.open,true);assert.equal(api.isOpen(map),true);api.close();assert.equal(modal.open,false);
}
const source=fs.readFileSync('story-player.js','utf8');
const fn=source.slice(source.indexOf('  function openTravelMap('),source.indexOf('  function start(project'));
let started=[],opened=0,moved=0,choose;
const state={character:{inventoryItems:[content.item]},flags:{},completedDialogues:{},sceneId:'shore'};
const guard={state,root:{classList:{contains:()=>true},focus(){}},current:null,sequenceBusy:false,introRunning:false,cardGameStop:null,sceneFadeStop:null,data:{nodes:content.nodes,scenes:[]},frame:0,sound:false,t:a=>a,hint(){},cancelAnimationFrame(){},settleWalk(){},startDialogue(id){assert.ok(opened>0,'Map must already be open before narration');started.push(id);},changeScene(){moved++;},w:{ZargotaStoryActors:{close(){}},ZargotaStoryTravelMap:{isOpen:()=>false,close(){},open(m,s,go){opened++;choose=go;return true;}}}};
vm.createContext(guard);vm.runInContext(fn,guard);
assert.equal(guard.openTravelMap(content.item.itemId),true);
assert.deepEqual(started,['esteros-map-memory']);assert.equal(opened,1);
state.completedDialogues['esteros-map-memory']=true;
guard.openTravelMap(content.item.itemId);assert.equal(opened,2);
choose(map.destinations[0]);assert.equal(started.at(-1),'esteros-map-bridge');assert.equal(moved,0);
assert.equal(choose({nodeId:'missing'}),false);
guard.current={};assert.equal(guard.openTravelMap(content.item.itemId),false);
for(const p of map.destinations)assert.ok(content.nodes.some(n=>n.id===p.nodeId));
for(const n of content.nodes)for(const page of [n,...n.slides])assert.ok(page.text&&page.textUk);
console.log('PASS: RU/UK art, 13 points, first-open memory, repeat opening, no teleport, missing node and dialogue guards.');
