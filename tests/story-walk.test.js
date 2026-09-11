const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const marks=[],world={appendChild(e){marks.push(e)},querySelectorAll(){return marks}};
const context={window:{},document:{createElement(){return {style:{setProperty(){}},setAttribute(){},addEventListener(){},remove(){}}}}};vm.runInNewContext(fs.readFileSync('story-walk.js','utf8'),context);
const api=context.window.ZargotaStoryWalk;
for(const speed of [1,4,20]){marks.length=0;const token={style:{width:'64'},classList:{add(){},remove(){}}};let previous=0;for(let time=0;time<3000;time+=16){api.update(token,world,{}, {x:time/1000*speed,y:50},time,false);assert(marks.length-previous<=1);previous=marks.length;assert(Math.abs(parseFloat(token.style.rotate)||0)<=1.6);}assert(marks.length>0&&marks.length<=10);marks.forEach((m,i)=>{if(i)assert.notEqual(m.className,marks[i-1].className)});api.stop(token);assert.equal(token.style.rotate,'0deg');}
console.log('Walking: single alternating prints, bounded cadence at three speeds, stop reset passed');
