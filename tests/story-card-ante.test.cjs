const assert=require('node:assert/strict'),r=require('../story-card-game-core.js');
for(const ante of [1,2,5]){
 const g=r.create({players:4,stacks:[20,20,20,20],ante,requireHero:true});
 assert.equal(g.pot,4*ante);assert.equal(g.target,0);assert.deepEqual(g.players.map(p=>p.stack),Array(4).fill(20-ante));assert(g.players.every(p=>p.bet===0&&p.contributed===ante));
 r.act(g,'fold');assert.equal(g.players[0].stack,20-ante);while(!g.done)r.act(g,'call');assert.equal(g.players.reduce((s,p)=>s+p.stack,0),80);assert.equal(g.players[0].stack,20-ante);
 const exit=r.create({players:4,stacks:[20,20,20,20],ante});r.act(exit,'raise',3);r.leave(exit,0);assert(exit.done);assert.equal(exit.players[0].stack,20-ante-3);assert.equal(exit.players.reduce((s,p)=>s+p.stack,0),80);
}
const short=r.create({players:4,stacks:[10,1,2,10],ante:2});assert(short.players[1].folded);assert.equal(short.players[1].stack,1);assert.equal(short.players[2].stack,0);assert(!short.players[2].folded);while(!short.done)r.act(short,'call');assert.equal(short.players.reduce((s,p)=>s+p.stack,0),23);
const noHero=r.create({players:3,stacks:[1,10,10],ante:2,requireHero:true});assert(noHero.done);assert.equal(noHero.pot,0);assert.deepEqual(noHero.players.map(p=>p.stack),[1,10,10]);
const exact=r.create({players:2,stacks:[2,2],ante:2});assert(exact.done);assert.equal(exact.board.length,6);assert.equal(exact.players.reduce((s,p)=>s+p.stack,0),4);
const free=r.create({players:2,stacks:[10,10],ante:0});assert.equal(free.pot,0);r.act(free,'fold');assert.equal(free.players[0].stack,10);
for(let n=0;n<300;n++){const stacks=[1+n%6,2+n%7,5+n%8,12],g=r.create({players:4,stacks,ante:1+n%3});let turns=0;while(!g.done&&turns++<300){const a=r.npc(g,Math.random,'bold');r.act(g,a,a==='raise'?1:undefined);}assert(g.done);assert.equal(g.players.reduce((s,p)=>s+p.stack,0),stacks.reduce((a,b)=>a+b,0));}
console.log('PASS ante: 1/2/5, fold, leave after raise, insufficient funds, exact all-in, no charge without hero, free mode, 300 conserved-money games.');
const fs=require('node:fs'),vm=require('node:vm'),window={};vm.runInNewContext(fs.readFileSync('story-card-economy.js','utf8'),{window});
const project={playerSpeakerId:'hero',storyItems:[{itemId:'copper'}],minigames:{towerClaw:{realMoney:true,currencyItemId:'copper',opponents:['npc'],stacks:[10,10],ante:2}}};
const run={character:{inventoryItems:[{itemId:'copper',qty:10}]}};
const wallet=window.ZargotaCardEconomy.begin(project,run),paid=r.create({players:2,stacks:wallet.stacks,ante:2});r.leave(paid,0);wallet.finish(paid,['hero','npc']);assert.equal(window.ZargotaCardEconomy.count(run.character,'copper'),8);assert.equal(run.cardWallets.players.npc,12);wallet.finish(paid,['hero','npc']);assert.equal(window.ZargotaCardEconomy.count(run.character,'copper'),8);
console.log('PASS wallet: voluntary exit loses the ante once; rival receives the bank; repeated cleanup cannot duplicate money.');
for(let n=0;n<150;n++){
 const g=r.create({players:4,stacks:[30,4,6,7],ante:1});let turns=0;
 while(!g.done&&turns++<200){if(g.turn===0){r.act(g,'raise',Math.min(3,r.raiseLimit(g)))||r.act(g,'call');}else{const decision=r.openingMove(g,'allin',100,2);r.act(g,decision.action,decision.amount);}}
 assert(g.done);for(const p of g.players.slice(1)){assert(p.contributed<=3);assert(p.stack>=1);}
}
console.log('PASS opening NPC cap: 150 hands against aggressive hero; total contribution <= ante + 2; no NPC eliminated.');
const gameSource=fs.readFileSync('story-card-game.js','utf8');
const transfer={Number,guestVisible:true,guestJoined:false,guestPending:0,options:{guestSpeakerId:'milo'},ids:['hero','milo'],game:{done:false,players:[{stack:5},{stack:2}]},decorateStory(){},table:{querySelector:()=>null}};
vm.createContext(transfer);vm.runInContext(gameSource.slice(gameSource.indexOf('    function canGiveGuest('),gameSource.indexOf('    function canTopUp(')),transfer);
assert(transfer.giveGuest(1));assert.equal(transfer.guestPending,1);assert.equal(transfer.game.players[0].stack,4);
assert(transfer.giveGuest(1));assert.equal(transfer.guestPending,2);
transfer.guestJoined=true;assert(transfer.giveGuest(1));assert.equal(transfer.game.players[1].stack,3);assert.equal(transfer.game.players[0].stack,2);assert(!transfer.giveGuest(2));assert(!transfer.giveGuest(-1));
console.log('PASS support/throw transfer: pending guest and seated guest receive exactly one copper; no overspend.');
