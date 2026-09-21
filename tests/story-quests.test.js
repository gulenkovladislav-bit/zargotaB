const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={};for(const f of ['story-quests.js','story-location-dialogues.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),{window,Set,Map});
const q=window.ZargotaStoryQuests,d={initialQuestId:'one',quests:[{id:'one',dialogueId:'a',nextId:'two',reveal:{sceneId:'s',kind:'tokens',id:'t'}},{id:'two',dialogueId:'b'}]},state=q.create(d),scene={tokens:[{id:'t',visible:true}],story:{}};
assert.equal(q.gatedScene(d,scene,'s',state).tokens[0].visible,false);assert.equal(scene.tokens[0].visible,true);
assert.equal(q.complete(d,state,'b'),null);assert.equal(q.complete(d,state,'a').id,'one');assert.equal(state.active,'two');assert.equal(q.gatedScene(d,scene,'s',state).tokens[0].visible,true);assert.equal(q.complete(d,state,'a'),null);assert.equal(q.complete(d,state,'b').id,'two');assert.equal(state.active,'');
const project={entryId:'a',startSceneId:'first',scenes:[{id:'first',scene:{}},{id:'second',scene:{}}],nodes:[{id:'a',links:[{to:'b',sceneId:'second'}]},{id:'b'},{id:'c',editorSceneId:'second'}]},raw=JSON.stringify(project);
assert.equal(window.ZargotaStoryLocationDialogues.nodes(project,'first').map(n=>n.id).join(','),'a');assert.equal(window.ZargotaStoryLocationDialogues.nodes(project,'second').map(n=>n.id).join(','),'b,c');assert.equal(JSON.stringify(project),raw);
console.log('PASS: quest sequence, idempotence, non-mutating visibility and legacy scene membership.');
