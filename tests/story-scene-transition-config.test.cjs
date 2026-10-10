const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('story-player.js','utf8');const code=source.slice(source.indexOf('  function blinkScene('),source.indexOf('  var introProgress='));
(async()=>{for(const color of ['white','black']){let mask,committed=0,finished=0;
function element(tag,cls,text){return {style:{},textContent:text||'',setAttribute(){},removeAttribute(){},appendChild(){},remove(){},animate(){return {finished:Promise.resolve(),cancel(){}};}};}
const ctx={element,local:(o,k)=>o[k]||'',root:{appendChild:v=>mask=v,querySelectorAll:()=>[]},w:{matchMedia:()=>({matches:false})},setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout(){},sceneFadeStop:null};vm.createContext(ctx);vm.runInContext(code,ctx);ctx.blinkScene(()=>committed++,()=>finished++,{color,text:'Later',holdSeconds:1});for(let i=0;i<30;i++)await Promise.resolve();assert.equal(mask.style.background,color==='white'?'#fff':'#050807');assert.equal(committed,1);assert.equal(finished,1);assert.equal(ctx.sceneFadeStop,null);}
console.log('PASS black/white scene transitions commit and complete once, cleanup input lock.');})();
