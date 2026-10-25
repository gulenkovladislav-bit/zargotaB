const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('story-player.js','utf8');
const ctx={scene:{story:{firstVisitDialogueId:'intro'}},state:{completedDialogues:{}},data:{nodes:[{id:'intro'}]}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function firstVisitDialogue('),source.indexOf('  function changeScene(')),ctx);
assert.equal(ctx.firstVisitDialogue(),'intro');ctx.state.completedDialogues.intro=true;assert.equal(ctx.firstVisitDialogue(),'');ctx.state.completedDialogues={};ctx.data.nodes=[];assert.equal(ctx.firstVisitDialogue(),'');ctx.scene.story={};assert.equal(ctx.firstVisitDialogue(),'');
assert(source.includes('entryId||(!preserveSequence&&firstVisitDialogue())'));
assert(source.includes('else if(firstVisitDialogue())startDialogue(firstVisitDialogue())'));
console.log('PASS first visit: initial entry, completed revisit, missing node, unconfigured scene, explicit entry and sequence priority, location-test hook.');
