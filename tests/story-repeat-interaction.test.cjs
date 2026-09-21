const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('story-player.js','utf8');
const helper=source.slice(source.indexOf('  function resolveInteraction('),source.indexOf('  function blinkScene('));
test('repeat unlocks only after completion flag; marker disappears without disabling NPC',()=>{
 const c={w:{},data:{nodes:[{id:'main',repeatWhen:'done',repeatId:'repeat'},{id:'repeat'}],interactions:{npc:{entryId:'main',marker:'?'}}},state:{flags:{}},removed:0};
 c.root={querySelectorAll:()=>[{dataset:{tokenId:'npc'},querySelector:()=>({remove:()=>c.removed++})}]};vm.createContext(c);vm.runInContext(helper,c);
 assert.equal(c.resolveInteraction(c.data.interactions.npc).entryId,'main');c.refreshInteractionMarkers();assert.equal(c.removed,0);
 c.state.flags.done=true;for(let i=0;i<3;i++){const r=c.resolveInteraction(c.data.interactions.npc);assert.equal(r.entryId,'repeat');assert.equal(r.markerVisible,false);}c.refreshInteractionMarkers();assert.equal(c.removed,1);assert.equal(c.data.interactions.npc.entryId,'main');
 c.data.nodes.pop();assert.equal(c.resolveInteraction(c.data.interactions.npc).entryId,'main');
});
test('simple replay modes route the next NPC interaction after a completed conversation',()=>{
 const c={w:{},data:{nodes:[{id:'main',replayMode:'same'},{id:'repeat'}],interactions:{npc:{entryId:'main',marker:'?'}}},state:{flags:{},completedDialogues:{main:true}},removed:0};
 c.root={querySelectorAll:()=>[{dataset:{tokenId:'npc'},querySelector:()=>({remove:()=>c.removed++})}]};vm.createContext(c);vm.runInContext(helper,c);
 assert.equal(c.resolveInteraction(c.data.interactions.npc).entryId,'main','same mode repeats the original dialogue');
 c.data.nodes[0].replayMode='once';assert.equal(c.resolveInteraction(c.data.interactions.npc),null,'once mode disables later dialogue starts');c.refreshInteractionMarkers();assert.equal(c.removed,1,'once mode removes the interaction marker');
 c.data.nodes[0].replayMode='alternate';c.data.nodes[0].repeatId='repeat';const alternate=c.resolveInteraction(c.data.interactions.npc);assert.equal(alternate.entryId,'repeat');assert.equal(alternate.markerVisible,false);
 c.data.nodes.pop();assert.equal(c.resolveInteraction(c.data.interactions.npc),null,'deleted alternate target does not replay the original by mistake');
});
test('editor exposes replay mode and the player records natural conversation completion',()=>{
 const editor=fs.readFileSync('story-editor.js','utf8');
 assert.match(editor,/Повторное взаимодействие/);assert.match(editor,/Повторна взаємодія/);
 assert.match(editor,/Повторять этот диалог/);assert.match(editor,/Больше не запускать/);assert.match(editor,/Запускать другой диалог/);
 assert.match(source,/state\.completedDialogues\[conversationEntryId\]=true/);
 assert.match(source,/if\(active\)startDialogue/,'a disabled repeat cannot start an empty dialogue');
});
test('tabaxi fragment has two choices, both endings complete it, and repeat has no loop to main',()=>{
 const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('story-fragments.js','utf8'),c);
 const base=require('../output/fragment-import/tabaxi-hunter.json');const data={activeSceneId:'scene-mtyz77jf-j2h3',scene:{},scenes:[{id:'scene-mtyz77jf-j2h3',scene:{}}],nodes:base.nodes,speakers:Object.fromEntries(base.nodes.map(n=>[n.speaker,{name:n.speaker}]))};
 const result=c.window.ZargotaStoryFragments.compile(data,fs.readFileSync('output/fragment-import/tabaxi-revision.json','utf8')).next;
 assert.equal(result.nodes.find(n=>n.id==='tabaxi-home-choice').links.length,2);
 for(const id of ['tabaxi-home-hunt-10','tabaxi-home-goodbye'])assert.equal(result.nodes.find(n=>n.id===id).afterEffect,'tabaxi-conversation-done');
 assert.equal(result.nodes.find(n=>n.id==='tabaxi-home-repeat').links.length,0);
});
