const assert=require('node:assert/strict');
const rules=require('../story-card-game-core.js');
const game=rules.create({stacks:[20,14,27,9]});
assert.equal(rules.raiseLimit(game),20);
for(const amount of [0,-1,1.5,21,NaN,Infinity,'2']){
  const before=JSON.stringify(game);
  assert.equal(rules.act(game,'raise',amount),false);
  assert.equal(JSON.stringify(game),before,'invalid amount must not mutate the game');
}
assert(rules.act(game,'raise',7));
assert.equal(game.pot,7);assert.equal(game.players[0].stack,13);
assert.equal(rules.raiseLimit(game),7);
for(let i=0;i<3;i++)assert(rules.act(game,'call'));
assert.equal(game.pot,28);assert.equal(rules.raiseLimit(game),13);
let seed=42;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let session=0;session<100;session++){
  let stacks=[20,14,27,9];
  for(let deal=0;deal<10;deal++){
    const g=rules.create({stacks},random);let actions=0;
    while(!g.done){
      const choices=rules.legal(g),action=choices[Math.floor(random()*choices.length)];
      assert(rules.act(g,action,action==='raise'?1+Math.floor(random()*rules.raiseLimit(g)):undefined));
      assert.equal(g.pot+g.players.reduce((n,p)=>n+p.stack,0),70);
      assert(g.players.every(p=>p.stack>=0&&Number.isInteger(p.stack)));
      assert(++actions<100);
    }
    stacks=g.players.map(p=>p.stack);assert.equal(stacks.reduce((a,b)=>a+b,0),70);
  }
}
assert.equal(rules.create({stacks:[0,5,0,0]}).done,true);
assert.equal(rules.create({stacks:[0,5,3,0]}).turn,1);
console.log('Variable bets: atomic validation, affordable caps, 1000 consecutive deals, unequal bankrolls, busted seats and money conservation passed.');
