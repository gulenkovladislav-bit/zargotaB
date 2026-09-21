const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const images=[];
class Context{
 constructor(){this.ops=[];this.globalAlpha=1;}
 fillRect(){this.ops=[];}
 save(){} restore(){} translate(){} scale(){}
 drawImage(image){this.ops.push({source:image.src||JSON.parse(JSON.stringify(image.ctx.ops)),alpha:this.globalAlpha});}
}
class Element{
 constructor(){this.children=[];this.style={};this.dataset={};this.clientWidth=1920;this.ctx=new Context();}
 append(...xs){this.children.push(...xs);} appendChild(x){this.append(x);} prepend(x){this.children.unshift(x);} replaceChildren(...xs){this.children=xs;}
 getContext(){return this.ctx;}
}
class Image{constructor(){this.naturalWidth=1920;this.naturalHeight=1080;images.push(this);}set src(v){this.value=v;}get src(){return this.value;}}
const ctx={window:{},Image,document:{createElement:()=>new Element()}};
vm.runInNewContext(fs.readFileSync('story-timeline.js','utf8'),ctx);
const api=ctx.window.ZargotaStoryTimeline,view=api.stage(new Element(),{scene:{layers:[{image:'map'}]}});
const a={id:'a',kind:'image',src:'first',altSrc:'second',at:0,duration:5,pairTiming:{firstHold:1,secondHold:1,fade:1,loop:false}},b={id:'b',kind:'image',src:'next',at:5,duration:4,fade:1},s={cues:[a,b]};
function loaded(){for(const image of [...images])image.onload?.();}
function sources(ops){return ops.flatMap(o=>typeof o.source==='string'?[o.source]:sources(o.source));}
view.render(s,5);loaded();const canvas=view.box.children[0];
assert.deepEqual(sources(canvas.ctx.ops).slice(-2),['first','second'],'Outgoing pair retains its second frame');
const snapshot=JSON.stringify(canvas.ctx.ops);view.render(s,5.4);
assert.equal(JSON.stringify(canvas.ctx.ops),snapshot,'Retain the complete frame until the incoming asset is ready');
loaded();assert(sources(canvas.ctx.ops).includes('next'));
const count=images.length;for(let i=0;i<120;i++)view.render(s,5.2+i/240);
assert.equal(images.length,count,'Repeated RAF does not reload originals');
view.render(s,2);loaded();view.render(s,5);assert(sources(canvas.ctx.ops).includes('second'),'Backward seek remains deterministic');
view.render(s,6.5);assert.deepEqual(sources(canvas.ctx.ops).slice(-1),['next']);
assert.equal(canvas.width,1920);assert.equal(canvas.height,1080);
assert.equal(view.box.children.filter(x=>x.className==='zg-timeline-surface').length,1);
view.box.clientWidth=4000;view.render(s,6.5);assert.equal(canvas.width,2560,'Large viewports do not allocate unbounded textures');assert.equal(canvas.height,1440);
const stable=JSON.stringify(canvas.ctx.ops),future={cues:[{id:'future',kind:'image',at:0,duration:10,src:'slow'}]};
view.render(future,2);assert.equal(JSON.stringify(canvas.ctx.ops),stable);
view.render(s,6.5);loaded();assert(!sources(canvas.ctx.ops).includes('slow'),'A late image completion cannot restore a stale seek');
for(let i=0;i<14;i++){view.render({cues:[{id:'cache',kind:'image',at:0,duration:10,src:'cache-'+i}]},1);loaded();}
assert(images.filter(i=>i.onload).length<=8,'Decoded image cache is bounded');
view.dispose();assert(images.every(i=>i.onload===null),'Dispose releases pending image callbacks');
console.log('PASS: atomic single-surface frames, decode wait, outgoing pair, repeated RAF, backwards seek, dimensions and cleanup');
