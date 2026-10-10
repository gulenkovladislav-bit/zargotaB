const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../story-graph.js'),'utf8');
const handlers={},canvas={clientWidth:1000,clientHeight:700,clientLeft:2,clientTop:2,scrollLeft:1200,scrollTop:800,getBoundingClientRect:()=>({left:130,top:90}),addEventListener:(name,fn)=>handlers[name]=fn};
const w={ZargotaStoryGraph:{scale:1}},stage={style:{}},slider={},label={};
const segment=source.slice(source.indexOf('var anchor=null;'),source.indexOf('bar.append(slider,label'));
vm.runInNewContext(segment,{canvas,w,stage,slider,label});
for(const next of [.8,.4,.07,.6,1.5]){
 handlers.pointermove({clientX:332,clientY:242});
 const beforeX=(canvas.scrollLeft+200)/w.ZargotaStoryGraph.scale,beforeY=(canvas.scrollTop+150)/w.ZargotaStoryGraph.scale;
 slider.oninput.call({value:next});
 assert.ok(Math.abs((canvas.scrollLeft+200)/w.ZargotaStoryGraph.scale-beforeX)<1e-8);
 assert.ok(Math.abs((canvas.scrollTop+150)/w.ZargotaStoryGraph.scale-beforeY)<1e-8);
}
assert.match(source,/e\.preventDefault\(\);rememberPointer\(e\);zoom\(/);
slider.oninput.call({value:.001});assert.equal(w.ZargotaStoryGraph.scale,.07);
slider.oninput.call({value:8});assert.equal(w.ZargotaStoryGraph.scale,1.5);
console.log('PASS: cursor anchored zoom in/out, canvas offset/borders, slider anchor and limits');
