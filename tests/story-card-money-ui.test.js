const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../story-card-game.js'),'utf8');
function el(tag,className,textContent){return {tag,className,textContent,children:[],style:{},setAttribute(k,v){this[k]=v;},append(...nodes){this.children.push(...nodes);},appendChild(node){this.children.push(node);}};}
const ctx={el};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  function coinPile('),source.indexOf('  function eventAudio(')),ctx);
for(const amount of [0,1,2,3,9,20,36,37,100,100000]){
  const pile=ctx.coinPile(amount,'Copper',true);
  assert.equal(pile['aria-label'],'Copper: '+amount);
  assert.equal(pile.children[1].textContent,'Copper: '+amount);
  assert(pile.children[0].children.length<=36,'bounded art count');
  assert.equal(pile.children[0].children.filter(c=>c.className==='zg-copper-coin').length,Math.min(amount,36),'small piles match their exact amount');
  assert.equal(pile.title,undefined,'no duplicate native tooltip');
  assert(pile.className.includes('is-hero-money'));
}
let scheduled,played=0,flights=0,renders=0,pulses=0;
const bank={};Object.assign(ctx,{game:{done:true,paid:20,winners:[0,2]},revealComplete:true,payoutCollected:false,payoutCollecting:false,closed:false,roundNumber:1,render(){renders++;},coinSounds:{play(){played++;}},flyCoins(){flights++;},table:{querySelector(){return {classList:{add(){pulses++;}}};}},setTimeout(fn){scheduled=fn;return 1;}});
vm.runInContext(source.slice(source.indexOf('    function collectBank('),source.indexOf('    function turnSound(')),ctx);
ctx.collectBank();ctx.collectBank();assert.equal(played,1);assert.equal(flights,2);assert.equal(renders,1);assert.equal(ctx.payoutCollected,false);
scheduled();assert.equal(ctx.payoutCollected,true);assert.equal(renders,2);assert.equal(pulses,2);
ctx.collectBank();assert.equal(played,1,'cannot collect twice');
console.log('Money UI: bounded coin piles, accessible exact totals, deferred visual payout, tied winners and double-collection guard passed. No browser test.');
