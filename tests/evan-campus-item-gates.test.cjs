const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const e=JSON.parse(fs.readFileSync(process.argv[2])).episode,window={};vm.runInNewContext(fs.readFileSync('story-player.js','utf8'),{window});const rules=window.ZargotaStoryRules;
for(const id of ['campus-talk-engineering-drawing','campus-talk-engineering-repair','campus-talk-magic-practice','evan-leor-hello','evan-leor-learning','evan-leor-faculties']){
 const n=e.nodes.find(n=>n.id===id),l=n.links.find(l=>l.requiresItemId);assert(l);
 for(const qty of [0,1]){const state={flags:{},character:{inventoryItems:[{itemId:l.requiresItemId,qty}]}};const before=JSON.stringify(state.character);assert.equal(!!rules.choose(e,state,id,l.id),qty>0);assert.equal(JSON.stringify(state.character),before);}
}
const n=e.nodes.find(n=>n.id==='campus-item-schemes'),l=n.links.find(l=>l.requires);
for(const seen of [false,true]){const state={flags:{'evan-discussed-drafts-leor':seen},character:{inventoryItems:[]}};assert.equal(!!rules.choose(e,state,n.id,l.id),seen);}
console.log('PASS runtime choices: missing items block, present items allow without spending, Leor comment gated by heard flag.');
