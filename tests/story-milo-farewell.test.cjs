const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const w={};vm.runInNewContext(fs.readFileSync('story-card-events.js','utf8'),{window:w,Date,Map,Set,setTimeout,clearTimeout});
const project={nodes:[{id:'milo',cardEvent:{enabled:true,phase:'roundStart',once:true,oncePerEpisode:true}},{id:'visit',cardEvent:{enabled:true,phase:'intro',once:true}}]},memory={};
let d=w.ZargotaCardEvents.director(project,memory);const round={round:2,roundStart:true};assert.equal(d.next(round).id,'milo');d.complete('milo');d.dispose();d=w.ZargotaCardEvents.director(project,memory);assert.equal(d.next(round),null);assert.equal(d.next({round:1,intro:true}).id,'visit');d.dispose();d=w.ZargotaCardEvents.director(project,memory);assert.equal(d.next({round:1,intro:true}).id,'visit');d.dispose();
const source=fs.readFileSync('story-card-game.js','utf8');const c={options:{farewellNodeId:'bye',guestSpeakerId:'milo',guestGraceHands:3,guestLoanHands:2},game:{done:true,paid:5,players:[{stack:5},{stack:10},{stack:0}]},ids:['hero','npc','milo'],guestJoined:true,guestPending:0,ante:1,revealComplete:true,payoutCollecting:false,payoutCollected:false,guestProtectedHands:1,guestLoans:0};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('    function canContinue()'),source.indexOf('    function continueSession()')),c);
assert.equal(c.shouldEndStorySession(),false,'wait for pot');c.payoutCollected=true;assert.equal(c.shouldEndStorySession(),false,'eligible loan keeps Milo');c.guestLoans=2;assert.equal(c.shouldEndStorySession(),true,'exhausted aid ends table');c.game.players[2].stack=1;assert.equal(c.shouldEndStorySession(),false,'funded Milo stays');c.game.players[0].stack=0;assert.equal(c.shouldEndStorySession(),true,'hero broke ends table');c.revealComplete=false;assert.equal(c.shouldEndStorySession(),false,'wait for reveal');
const finishCtx={closed:false,endingStory:false,storyBusy:false,project:{nodes:[{id:'bye'}]},options:{farewellNodeId:'bye'},storyMemory:{},timeout:0,nextDealTimer:0,clearTimeout(){},stopDeal(){},modal:{querySelector(){return null;}},calls:0,ended:0,runStory(n,cb){this.unused=0;finishCtx.calls++;finishCtx.resume=cb;},completeSession(){finishCtx.ended++;}};vm.createContext(finishCtx);vm.runInContext(source.slice(source.indexOf('    function finish(){'),source.indexOf('    function completeSession(){')),finishCtx);finishCtx.finish();finishCtx.finish();assert.equal(finishCtx.calls,1);finishCtx.resume();assert.equal(finishCtx.ended,1);assert(finishCtx.storyMemory.farewellDone);
vm.runInNewContext(fs.readFileSync('story-items.js','utf8'),{window:w});const character={inventoryItems:[{itemId:'coin',qty:2},{itemId:'coin',qty:4},{itemId:'coat',qty:1}]};assert(w.ZargotaStoryItems.spend(character,'coin',5));assert.equal(character.inventoryItems.find(i=>i.itemId==='coin').qty,1);const before=JSON.stringify(character);assert(!w.ZargotaStoryItems.spend(character,'coin',5));assert.equal(JSON.stringify(character),before);assert(!w.ZargotaStoryItems.spend(character,'coin',-1));
console.log('PASS farewell: persisted one-shot events, payout-before-exit, assistance, hero bankruptcy, no duplicate finale, atomic donation.');
// Test actual player choices, including payment and duplicate prevention.
vm.runInNewContext(fs.readFileSync('story-player.js','utf8'),{window:w});
const rules=w.ZargotaStoryRules;
const sceneProject={nodes:[{id:'talk',links:[{id:'give',to:'thanks',spendItemId:'coin',spendItemQty:5,unless:'donated',effect:'donated'}]},{id:'thanks',links:[]}]};
const run={flags:{},character:{inventoryItems:[{itemId:'coin',qty:6}]}};
assert(rules.choose(sceneProject,run,'talk','give'));assert.equal(run.character.inventoryItems[0].qty,1);assert.equal(rules.choose(sceneProject,run,'talk','give'),null);assert.equal(run.character.inventoryItems[0].qty,1);
if(process.argv[2]){
 const e=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).episode;
 const state={flags:{},character:{inventoryItems:[{itemId:'evan-copper-coin',qty:6}]}};
 assert(rules.choose(e,state,'milo-shelter-talk','shelter-one'));assert.equal(state.character.inventoryItems[0].qty,6,'offering one costs nothing');
 assert(rules.choose(e,state,'milo-shelter-one','shelter-five'));assert.equal(state.character.inventoryItems[0].qty,1);assert.equal(rules.choose(e,state,'milo-shelter-talk','shelter-five'),null);
 assert(rules.choose(e,{flags:{},character:{}},'milo-yard-exit','yard-exit-street'));
 assert.equal(rules.choose(e,{flags:{'evan-courtyard-locked':true},character:{}},'milo-yard-exit','yard-exit-street'),null);
 const done={flags:{'evan-card-table-finished':true},character:{}};assert(rules.choose(e,done,'milo-yard-exit','yard-exit-wagon'));
 assert.equal(e.nodes.find(n=>n.id==='evan-yard-finish').links.length,1);
 console.log('PASS latest export: refused one coin, paid five once, courtyard lock, final wagon route.');
}
