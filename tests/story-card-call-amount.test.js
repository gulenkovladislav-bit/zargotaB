const assert=require('node:assert/strict'),r=require('../story-card-game-core.js');
const g=r.create({players:3,stacks:[20,50,50]});
assert(r.act(g,'allin'));assert(r.act(g,'call'));
assert.deepEqual(g.players[1].lastBet,{round:0,added:20,previous:0,total:20,target:20,remaining:30});
const h=r.create({players:3,stacks:[50,50,50]});
assert(r.act(h,'raise',8));assert(r.act(h,'raise',12));assert(r.act(h,'call'));assert(r.act(h,'call'));
assert.deepEqual(h.players[0].lastBet,{round:0,added:12,previous:8,total:20,target:20,remaining:30});
const short=r.create({players:3,stacks:[20,12,50]});r.act(short,'allin');r.act(short,'call');
assert.equal(short.players[1].lastBet.added,12);assert.equal(short.players[1].stack,0);
let seed=17;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let n=0;n<2000;n++){const game=r.create({stacks:[20,50,12,70]},random);while(!game.done){const actor=game.turn,actions=r.legal(game),action=actions[Math.floor(random()*actions.length)];r.act(game,action,action==='raise'?1+Math.floor(random()*r.raiseLimit(game)):undefined);if(action!=='fold'){const b=game.players[actor].lastBet;assert(b.total>=b.target||b.remaining===0,'only an exhausted stack may undercall');}}}
console.log('Call amounts: full 20, additional 12 after 8, short-stack all-in and 2000 simulated hands passed.');
