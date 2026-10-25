const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const e=JSON.parse(fs.readFileSync('story-content/esteros/episode-1-food-search-v1.json')).episode;
const roots=[];
function element(tag){return {tag,children:[],style:{setProperty(k,v){this[k]=v;}},listeners:{},append(...c){this.children.push(...c);},appendChild(c){this.children.push(c);},setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.listeners[k]=v;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},remove(){this.removed=true;},focus(){}};}
let locale='ru';const context={window:{ZargotaI18n:{getLocale:()=>locale}},document:{createElement:element,createElementNS:(_,t)=>element(t),body:{append(d){roots.push(d);}}}};
vm.createContext(context);vm.runInContext(fs.readFileSync('story-travel-map.js','utf8'),context);
const map=e.storyItems.find(i=>i.itemId==='esteros-mothers-map').travelMap;
const api=context.window.ZargotaStoryTravelMap,shore=map.destinations.find(d=>d.id==='food-shore').sceneId;
for(const lang of ['ru','uk']){
 locale=lang;let calls=0;
 api.open(map,e.scenes,()=>{calls++;return true;},false,{currentSceneId:shore,flags:{}});
 const dialog=roots.at(-1),board=dialog.children[1];
 assert.equal(board.children.filter(c=>c['data-marker']==='search').length,0,'Locked before plan');
 api.refresh({'food-planned':true});
 const search=board.children.filter(c=>c['data-marker']==='search'&&!c.removed);
 assert.equal(search.length,3);search.forEach(b=>assert.equal(b.children.at(-1).textContent,'?'));
 const here=board.children.find(c=>c['data-current']==='true');assert.ok(here);
 here.onclick();assert.equal(calls,0,'Current scene must never open a travel dialogue');
 assert.match(dialog.children[2].textContent,lang==='ru'?/Вы здесь/:/Ви тут/);
 search[0].onclick();assert.equal(calls,1);assert.ok(dialog.open,'Inspection stays over map');
 api.close();
}
const actorContext={window:{}};vm.runInNewContext(fs.readFileSync('story-actors.js','utf8'),actorContext);
const actors=actorContext.window.ZargotaStoryActors,opening=e.nodes.find(n=>n.id==='dialog-1');
const first=actors.portrait(e,opening),second=actors.portrait(e,{...opening,...opening.slides[0]});assert.notEqual(first.portrait,second.portrait);
for(const n of e.nodes.filter(n=>n.speaker==='esteros-child-thoughts'))for(const page of [n,...n.slides||[]]){
 if(page.emotion)assert.ok(e.speakers[n.speaker].emotions[page.emotion],page.emotion);
 assert.ok(fs.existsSync(actors.portrait(e,{...n,...page}).portrait));
}
for(const r of e.scenes)for(const t of r.scene.tokens||[])if(t.id===e.heroTokenId){assert.equal(t.size,80);assert.notEqual(t.renderMode,'sprite');assert.ok(!t.image.includes('walking-draft'));}
for(const id of ['moss','quiet','reeds','bay']){const n=e.nodes.find(n=>n.id==='esteros-map-'+id);assert.ok(n.textUk);assert.ok(!n.text.includes('Мамины маленькие крыши'));}
vm.runInContext(fs.readFileSync('story-environment.js','utf8'),context);
for(const mode of ['current','surf']){
 const host=element('div');context.window.ZargotaStoryEnvironment.render({decorations:[{id:'water',kind:'water',waterMode:mode,x:40,y:60,size:500,height:140,rotation:35,duration:7}]},host);
 const water=host.children[0].children[0];assert.match(water.className,new RegExp('is-'+mode));assert.equal(water.children.length,2);assert.equal(water.style.width,'500px');assert.equal(water.style.height,'140px');assert.match(water.style.transform,/rotate\(35deg\)/);
 for(const img of water.children)assert.ok(fs.existsSync(img.src));assert.ok(water.children[0].src.includes('water-'+mode));
 assert.equal(water.style['--half-period'],'-3.5s');
}
console.log('PASS: RU/UK markers and unlock, self-travel blocked, real portrait changes, original tokens, both water modes.');
