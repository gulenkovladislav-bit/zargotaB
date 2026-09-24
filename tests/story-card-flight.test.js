const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../story-card-game.js'),'utf8'),css=fs.readFileSync(require.resolve('../story-card-game.css'),'utf8');
let flight,landing,unhidden=0;
function element(){return {style:{setProperty(k,v){this[k]=v;}},classList:{remove(){}},setAttribute(){},appendChild(c){this.child=c;},addEventListener(_,fn){this.end=fn;},remove(){this.removed=true;}};}
const view={offsetWidth:100,offsetHeight:150,getBoundingClientRect:()=>({left:200,top:300,width:100,height:150}),cloneNode:element,classList:{remove(){unhidden++;}}};
const ctx={closed:false,dealTimers:[],w:{getComputedStyle:()=>({rotate:'none'}),matchMedia:()=>({matches:false})},el:element,table:{getBoundingClientRect:()=>({left:10,top:20}),appendChild(c){flight=c;}},setTimeout(fn){landing=fn;return 1;}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('    function flyDealtCard('),source.indexOf('    function runDeal(')),ctx);
ctx.flyDealtCard(view,{left:700,top:40,width:80,height:120});
assert.equal(unhidden,0,'destination stays hidden during flight');
assert.equal(flight.style.left,'190px');assert.equal(flight.style.top,'280px');
assert.equal(flight.style['--flight-x'],'490px');assert.equal(flight.style['--flight-y'],'-275px');
assert.equal(flight.style['--flight-angle'],'0deg');assert.equal(flight.style['--flight-scale-x'],.8);
flight.end({target:flight});landing();assert.equal(unhidden,1);assert(flight.removed);
assert(css.includes('.zg-deal-flight{position:absolute;z-index:20;'));
assert(css.includes('@keyframes zg-whole-card-flight'));
console.log('Whole-card flight: table overlay, deck origin, hidden destination, valid angle and idempotent landing passed. No browser test.');
