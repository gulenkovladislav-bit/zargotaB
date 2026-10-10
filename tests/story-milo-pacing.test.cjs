const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const window={};vm.runInNewContext(fs.readFileSync('story-card-events.js','utf8'),{window,setTimeout,clearTimeout});
const director=window.ZargotaCardEvents.director({nodes:[{id:'reach',cardEvent:{enabled:true,phase:'roundStart',minRound:4,once:true}},{id:'eat',cardEvent:{enabled:true,phase:'board',boardCount:3,minRound:5,afterRoundEvent:'reach',once:true}}]});
assert.equal(director.next({round:5,roundStart:true,board:0}).id,'reach');director.complete('reach');assert.equal(director.next({round:5,board:3}),null);assert.equal(director.next({round:6,board:3}).id,'eat');assert.equal(director.next({round:7,board:3}),null);director.dispose();
const source=fs.readFileSync('story-card-game.js','utf8'),a=source.indexOf('if(guestJoined&&options.guestGraceHands'),b=source.indexOf('game=rules.create',a),snippet=source.slice(a,b);
const c={guestJoined:true,options:{guestGraceHands:3,guestLoanHands:2,guestSpeakerId:'m'},guestProtectedHands:0,guestLoans:0,ids:['hero','donor','m'],ante:1,stacks:[10,8,1],director:{flags:{}}};vm.createContext(c);
vm.runInContext(snippet,c);assert.deepEqual(c.stacks,[10,7,2]);assert.equal(c.guestLoans,1);assert.equal(c.guestProtectedHands,1);
c.stacks[2]=0;vm.runInContext(snippet,c);assert.deepEqual(c.stacks,[10,5,2]);assert.equal(c.guestLoans,2);c.stacks[2]=0;vm.runInContext(snippet,c);assert.equal(c.stacks[2],0);vm.runInContext(snippet,c);assert.equal(c.guestProtectedHands,4);assert.equal(c.stacks[1],5);
console.log('PASS Milo pacing: later hand required, once-only eating, conserved finite donor support, grace expires.');
