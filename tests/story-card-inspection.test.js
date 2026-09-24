const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../story-card-game.js'),'utf8');
function el(tag,cls,text){return {tag,className:cls,textContent:text,children:[],style:{},offsetWidth:300,offsetHeight:200,setAttribute(){},appendChild(e){this.children.push(e);return e;},focus(){},querySelector(){return this.children.find(e=>e.tag==='button'&&!e.disabled);}};}
let panel;
const ctx={inspection:null,game:{done:false,players:[{folded:false},{folded:false}]},revealComplete:true,timeout:0,clearTimeout(){},el,t:a=>a,btn:(label,fn)=>Object.assign(el('button','',label),{onclick:fn}),people:[{name:'A'},{name:'B'}],lastActions:{},observation:()=> 'cached observation',revealed:()=>false,render(){},table:{querySelectorAll:()=>[],querySelector:()=>({getBoundingClientRect:()=>({left:500,top:400,width:100})}),getBoundingClientRect:()=>({left:0,top:0,width:1000}),appendChild(p){panel=p;}}};
ctx.payoutCollecting=false;
ctx.storyBusy=false;
ctx.dealing=false;
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('    function inspect(index){'),source.indexOf('    function catStatus(')),ctx);
ctx.inspect(0);assert.equal(ctx.inspection,null,'opening is free');assert.equal(panel.style.top,'188px');assert.equal(panel.style.left,'400px');
panel.children.find(e=>e.tag==='button').onclick();assert.equal(ctx.inspection.index,0);
ctx.inspect(1);const denied=panel.children.find(e=>e.tag==='button');assert(denied.disabled);denied.onclick();assert.equal(ctx.inspection.index,0,'guard also blocks repeated programmatic action');
ctx.inspect(0);assert(panel.children.some(e=>e.textContent==='cached observation'));
assert(/function start\(\)\{hiddenGuestCard=false;sounds.stop\(\);inspection=null;/.test(source),'reset only for a new deal');
console.log('Inspection: free open, one shared use per deal, cached result, portrait anchor and reset passed. No browser test.');
