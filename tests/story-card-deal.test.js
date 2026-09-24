const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../story-card-game.js'),'utf8'),ctx={};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function dealSequence('),source.indexOf('  function config(')),ctx);
const plan=ctx.dealSequence(Array.from({length:4},()=>({folded:false})));
assert.deepEqual(JSON.parse(JSON.stringify(plan)),[{board:0},{board:1},{board:2},...Array.from({length:2},(_,card)=>Array.from({length:4},(_,seat)=>({seat,card}))).flat()]);
const fewer=ctx.dealSequence([{folded:false},{folded:true},{folded:false}]);
assert.equal(fewer.length,7);assert(fewer.every(s=>s.seat!==1));
let jobs=[],sounds=0,rendered=0,turns=0;
function node(){return {children:[],classList:{add(){},remove(){}},style:{setProperty(){}},getBoundingClientRect:()=>({left:10,top:20,width:50,height:80})};}
const board=node();board.children=[node(),node(),node()];const hand=node();hand.children=[node(),node()];
Object.assign(ctx,{game:{players:[{folded:false},{folded:false}],turn:0},roundNumber:1,closed:false,dealing:true,soundEnabled:true,dealTimers:[],dealSounds:null,table:{classList:{remove(){}},querySelector(s){return s.includes('deck')?node():s.includes('board')?board:hand;}},eventAudio:()=>({play(){sounds++;},stop(){}}),setTimeout(fn,delay){jobs.push({fn,delay});return jobs.length;},clearTimeout(){},turnSound(){turns++;},render(){rendered++;}});
ctx.table.querySelectorAll=()=>[];
vm.runInContext(source.slice(source.indexOf('    function stopDeal('),source.indexOf('    function flyCoins(')),ctx);
ctx.flyDealtCard=()=>{};
ctx.runDeal();assert.equal(jobs.length,8);assert.equal(sounds,0);
for(let i=0;i<7;i++){assert.equal(jobs[i].delay,300+i*380);jobs[i].fn();assert.equal(sounds,i+1);assert.equal(ctx.dealing,true);}
jobs[7].fn();assert.equal(ctx.dealing,false);assert.equal(rendered,1);assert.equal(turns,1);
jobs=[];ctx.dealing=true;ctx.runDeal();ctx.closed=true;jobs.forEach(j=>j.fn());assert.equal(sounds,7,'exit suppresses pending sounds');
assert(source.includes('if(storyBusy||dealing&&!initialDeal)return;'),'redraw must not restart or reveal pending cards');
assert(source.includes('if(closed||storyBusy||game.done||dealing)return;'),'block actions during dealing or dialogue');
assert(fs.existsSync('assets/stories/cards/tower-claw/audio/candidates-v2/casino/card-slide-4.mp3'));
for(const slots of [[3,4],[5]]){
  board.children=Array.from({length:6},node);jobs=[];ctx.closed=false;ctx.dealing=true;let flights=[];
  ctx.flyDealtCard=(view,deck,reveal)=>flights.push({slot:board.children.indexOf(view),reveal});
  ctx.runDeal(slots.map(board=>({board,reveal:true})));
  assert.equal(jobs.length,slots.length+1);
  jobs.slice(0,-1).forEach(job=>job.fn());
  assert.deepEqual(flights,slots.map(slot=>({slot,reveal:true})));
  assert.equal(ctx.dealing,true,'turn stays locked until landing and reveal complete');
  jobs.at(-1).fn();assert.equal(ctx.dealing,false);
}
console.log('Deal: three table cards, two round-robin laps, eliminated seats skipped, timed audio, turn lock and exit guards passed. No browser test.');
