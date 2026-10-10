const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const w={},ctx=vm.createContext({window:w});
for(const f of ['story-location-dialogues.js','story-quest-actions.js','story-items.js','story-secrets.js','story-test-tools.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const project={activeSceneId:'a',startSceneId:'a',scene:{tokens:[]},nodes:[{id:'n1',editorSceneId:'a',beforeWorldActions:[{type:'giveItem',itemId:'coin',qty:2,actionId:'award'}]},{id:'n2',editorSceneId:'b'}],quests:[{id:'q1',dialogueId:'n1',nextId:'q2',flag:'ready'},{id:'q2',dialogueId:'n2'},{id:'cross',dialogueIds:['n1','n2']}],storyItems:[{itemId:'coin',stackable:true}]};
const snapshot=JSON.stringify(project),state={sceneId:'a',flags:{},quests:{active:'q1',done:[]},character:{inventoryItems:[]}};
const p=w.ZargotaStoryTestTools.plan(project,state,{tokens:[]});
assert.deepEqual(Array.from(p.quests,q=>q.id),['q1']);assert.equal(p.rewards.length,1);
assert.equal(w.ZargotaStoryTestTools.complete(project,state,p.quests).length,1);
assert.equal(state.quests.active,'q2');assert.equal(state.flags.ready,true);
assert.equal(w.ZargotaStoryTestTools.complete(project,state,p.quests).length,0);
assert.equal(w.ZargotaStoryTestTools.give(project,state,p.rewards[0]),true);
assert.equal(w.ZargotaStoryTestTools.give(project,state,p.rewards[0]),false);
assert.equal(state.character.inventoryItems[0].qty,2);assert.equal(state.receivedItemActions.award,true);
assert.equal(JSON.stringify(project),snapshot);
assert.match(fs.readFileSync('story-editor.js','utf8'),/ZargotaStoryPlayer\.startTest\(data/);
assert.match(fs.readFileSync('story-player.js','utf8'),/var testing=testMode===true/);
assert.match(fs.readFileSync('story-player.js','utf8'),/start\(initialData,onExit,testing,liveTextSave\)/);
console.log('PASS test tools: scene scope, cross-location exclusion, quest progression, idempotent awards, source isolation and editor-only entry.');
const priorProject=JSON.parse(snapshot);
priorProject.scenes=[{id:'a',scene:{tokens:[{id:'stash',pickup:{itemId:'coin',qty:1}}]}},{id:'b',scene:{tokens:[]}},{id:'c',scene:{tokens:[]}}];
const priorSnapshot=JSON.stringify(priorProject),later={sceneId:'b',flags:{},character:{inventoryItems:[]}};
const previous=w.ZargotaStoryTestTools.previousLocations(priorProject,later);
assert.deepEqual(Array.from(previous,x=>x.scene.id),['a']);
const stash=previous[0].rewards.find(r=>r.object);
assert.equal(stash.sceneId,'a');
assert.equal(w.ZargotaStoryTestTools.give(priorProject,later,stash),true);
assert.equal(w.ZargotaStoryTestTools.give(priorProject,later,stash),false);
assert.equal(later.sceneId,'b');assert.equal(later.consumed['a:stash'],true);assert.equal(later.consumed['b:stash'],undefined);
assert.equal(w.ZargotaStoryTestTools.previousLocations(priorProject,{sceneId:'a'}).length,0);
assert.equal(w.ZargotaStoryTestTools.previousLocations(priorProject,{sceneId:'missing'}).length,0);
assert.equal(JSON.stringify(priorProject),priorSnapshot);
console.log('PASS previous rewards: earlier scenes only, correct pickup source, no duplicates or episode mutation.');
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.events={};this.checked=false;}
 appendChild(e){if(e.parentNode)e.parentNode.children=e.parentNode.children.filter(x=>x!==e);e.parentNode=this;this.children.push(e);return e;}
 append(...es){es.forEach(e=>this.appendChild(e));}
 prepend(e){this.appendChild(e);this.children.unshift(this.children.pop());}
 insertBefore(e,target){this.appendChild(e);this.children.pop();const i=this.children.indexOf(target);this.children.splice(i<0?this.children.length:i,0,e);}
 get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1];}
 replaceChildren(){this.children=[];}
 querySelector(){return null;}
 setAttribute(){}
 addEventListener(name,fn){this.events[name]=fn;}
}
ctx.document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
const root=new Element('root'),uiState={sceneId:'b',flags:{},character:{inventoryItems:[]}};
const uiScene={tokens:[{id:'one',pickup:{itemId:'coin'}},{id:'two',pickup:{itemId:'coin'}}]};
w.ZargotaStoryTestTools.mount(root,{enabled:true,get:()=>({data:priorProject,state:uiState,scene:uiScene}),busy:()=>false,refresh:()=>{},reset:()=>{}});
const host=root.children[0];host.open=true;host.events.toggle();
function walk(e){return [e,...(e.children||[]).flatMap(walk)];}
const inputs=walk(host).filter(e=>e.tagName==='input');
assert.equal(inputs.length,5);
inputs[0].checked=true;inputs[0].onchange();assert.equal(inputs[1].checked,true);assert.equal(inputs[2].checked,true);
inputs[1].checked=false;inputs[1].events.change();assert.equal(inputs[0].checked,false);assert.equal(inputs[0].indeterminate,true);
inputs[3].checked=true;inputs[3].onchange();assert.equal(inputs[4].checked,true);
const grant=walk(host).find(e=>e.tagName==='button'&&e.textContent==='Выдать предметы выбранных локаций');
grant.onclick();assert.equal(uiState.character.inventoryItems[0].qty,3);grant.onclick();assert.equal(uiState.character.inventoryItems[0].qty,3);
console.log('PASS panel controls: select all, mixed checkbox state, previous locations grant and repeat safety.');
