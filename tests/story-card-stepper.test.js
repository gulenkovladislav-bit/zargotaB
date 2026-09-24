const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../story-card-game.js'),'utf8');
let panel,sounds=0,stake;
function el(tag,className){return {tag,className,children:[],setAttribute(k,v){this[k]=v;},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},focus(){},remove(){}};}
const ctx={el,t:a=>a,btn:(label,onclick)=>Object.assign(el('button'),{textContent:label,onclick}),table:{querySelector:()=>null,appendChild(p){panel=p;}},rules:{raiseLimit:()=>5},game:{players:[{stack:7}]},cost:2,coinPile:amount=>({amount}),coinSounds:{play(){sounds++;}},moneySerial:0,move:(_,n)=>{stake=n;},raise:{focus(){}}};
vm.createContext(ctx);const from=source.indexOf("          if(table.querySelector('.zg-raise-picker'))return;");const to=source.indexOf('});raise.disabled=',from);
vm.runInContext('(function(){'+source.slice(from,to)+'})();',ctx);
const stepper=panel.children.find(c=>c.className==='zg-raise-stepper'),[minus,input,plus]=stepper.children,preview=panel.children.find(c=>c.className==='zg-raise-preview'),confirm=panel.children[4];
assert.equal(sounds,0);plus.onclick();assert.equal(Number(input.value),3);assert.equal(sounds,1);assert.equal(preview.children[0].amount,3);
minus.onclick();assert.equal(Number(input.value),2);assert.equal(sounds,2);
input.value=5;input.oninput();assert(plus.disabled);confirm.onclick();assert.equal(stake,5);
input.value=1;input.oninput();assert(minus.disabled);
for(const value of ['',0,6,1.5]){input.value=value;input.oninput();assert(confirm.disabled);}
assert.equal(sounds,2,'redrawing preview does not play sound');
panel.children.find(c=>c.className==='zg-all-in').onclick();assert.equal(Number(input.value),5);assert(confirm.textContent.includes('7'));assert(!confirm.disabled);confirm.onclick();assert.equal(stake,5,'all-in increment plus call cost consumes exactly own stack');
console.log('Raise stepper: plus/minus sound, coin preview, exact entry, limits and invalid input passed. No browser test.');
