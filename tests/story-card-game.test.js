const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const rules=require('../story-card-game-core.js');
function hand(ranks,color){return ranks.map((rank,i)=>({rank,color:color==null?i%2:color,id:i}));}
const cases=[[1,3,5,7,9,10],[2,2,4,6,8,10],[2,2,4,4,8,10],[1,3,5,7,9,10],[2,2,2,5,8,10],[2,2,4,4,8,8],[2,2,2,5,5,10],[1,2,3,4,5,6],[2,2,2,2,8,10],[2,2,2,5,5,5],[2,2,2,2,8,8]];
cases.forEach((r,i)=>assert.equal(rules.six(hand(r,i===3?0:null)).type,i));
cases.forEach((r,i)=>{
 const result=rules.six(hand(r,i===3?0:null)),cards=rules.combinationCards(result);
 assert.equal(cards.length,[1,2,4,6,3,6,5,6,4,6,6][i]);
 assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
 assert.ok(cards.every(c=>result.cards.includes(c)));
});
assert.deepEqual(rules.combinationCards(rules.six(hand([2,2,4,6,8,10]))).map(c=>c.id),[0,1]);
assert.deepEqual(rules.combinationCards(null),[]);
// User-reported screenshot: Pen's IV/V complete the board's IV/V/VII pairs.
const penResult=rules.best(hand([4,5,1,9,4,7,7,5]));
assert.equal(penResult.type,5);
assert.deepEqual(rules.combinationGroups(penResult).map(g=>g.map(c=>c.rank)),[[7,7],[5,5],[4,4]]);
cases.forEach((r,i)=>{const result=rules.six(hand(r,i===3?0:null));const grouped=rules.combinationGroups(result).flat();assert.equal(grouped.length,6);assert.equal(new Set(grouped.map(c=>c.id)).size,6);assert.ok(grouped.every(c=>result.cards.includes(c)));});
const revealGame=rules.create({players:4});
assert.deepEqual(rules.showdown(revealGame),[]);
rules.act(revealGame,'fold');
while(!revealGame.done)rules.act(revealGame,'call');
assert.deepEqual(rules.showdown(revealGame),[1,2,3]);
const foldGame=rules.create({players:2});rules.act(foldGame,'fold');
assert.deepEqual(rules.showdown(foldGame),[]);
assert.equal(rules.best(hand([2,2,2,2,8,8,9,10])).type,10);
assert.equal(rules.best(hand([1,2,3,4,5,6,7,10])).score[1],7);
assert.equal(rules.six(hand([1,2,3,4,5,6],0)).type,14);
assert.ok(rules.compare(rules.six(hand([4,4,1,3,7,9])).score,rules.six(hand([3,3,6,7,8,10])).score)>0);
assert.equal(new Set(rules.deck().map(c=>c.id)).size,40);
let seed=12345;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let trial=0;trial<1000;trial++){
 const g=rules.create({stack:5},random);let moves=0;
 while(!g.done){assert.ok(++moves<80);assert.ok(rules.act(g,rules.npc(g,random,'bold')));assert.equal(g.players.reduce((sum,p)=>sum+p.stack,0)+g.pot,20);g.players.forEach(p=>assert.ok(p.stack>=0));}
 assert.equal(g.players.reduce((sum,p)=>sum+p.stack,0),20);
 assert.equal(rules.act(g,'raise'),false);
 const seen=g.board.concat(...g.players.map(p=>p.hand));assert.equal(new Set(seen.map(c=>c.id)).size,seen.length);
}
const context={window:{},console};vm.runInNewContext(fs.readFileSync(require.resolve('../story-card-game.js'),'utf8'),context);
const ui=context.window.ZargotaCardGame;
ui.combos.forEach((_,type)=>{
 const examples=ui.exampleCards(type);assert.equal(examples.length,6);
 assert.equal(rules.six(examples).type,type,'help example matches its category');
 examples.forEach(c=>assert.ok(fs.existsSync(ui.cardPath(c))));
});
assert.equal(ui.match({},'x'),false);
assert.equal(ui.match({minigames:{towerClaw:{enabled:false,afterNodeId:'x'}}},'x'),false);
assert.equal(ui.match({minigames:{towerClaw:{enabled:true,afterNodeId:'x'}}},'x'),true);
rules.deck().forEach(c=>assert.ok(fs.existsSync(ui.cardPath(c)),ui.cardPath(c)));
console.log('Card minigame: legacy cases and all 15 help examples, 1000 simulated games, conservation, gating, and 20 art paths passed.');
const playerSource=fs.readFileSync(require.resolve('../story-player.js'),'utf8');
const hookSource=playerSource.slice(playerSource.indexOf('  var cardGameStop=null;'),playerSource.indexOf('  function resolveInteraction('));
let resumed=0,opened=0,onResult;
const hook={sound:false,w:{ZargotaCardGame:{match:ui.match,config:ui.config,open:(_p,_c,cb)=>{opened++;onResult=cb;return()=>{};}}},data:{minigames:{towerClaw:{enabled:false,afterNodeId:'test'}}},current:{id:'test'},state:{flags:{}},sequenceBusy:false,finishNodeActions:fn=>fn()};
vm.createContext(hook);vm.runInContext(hookSource,hook);
hook.finishNode(()=>resumed++);assert.equal(resumed,1);assert.equal(opened,0);
hook.data.minigames.towerClaw.enabled=true;hook.finishNode(()=>resumed++);assert.equal(opened,1);assert.equal(resumed,1);assert.equal(hook.sequenceBusy,true);
hook.finishNode(()=>resumed++);assert.equal(opened,1);
onResult({status:'completed',won:true,delta:3});assert.equal(resumed,2);assert.equal(hook.sequenceBusy,false);assert.equal(hook.state.flags.cardGameWon,true);
hook.finishNode(()=>resumed++);onResult({status:'cancelled',won:false,delta:0});assert.equal(resumed,3);assert.equal(hook.state.flags.cardGameWon,false);
console.log('Story hook: disabled skip, enabled pause, duplicate guard, completion and cancellation passed.');
assert.ok(ui.observation('bold','raise',false).includes('ждёт реакции'));
assert.ok(ui.observation('cautious','call',true).includes('После паса'));
assert.ok(!ui.observation.toString().includes('.hand'));
assert.ok(!ui.observation.toString().includes('.result'));
console.log('Observations use public actions/style, not private hands or results.');
