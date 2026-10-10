const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parent=this;return n;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}focus(){}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}querySelector(tag){return this.all().find(n=>n.tag===tag)||null;}
}
let applied=0,fitted=0,finished=0,resize;
const w={addEventListener(k,fn){resize=fn;},removeEventListener(k,fn){assert.equal(fn,resize);resize=null;},ZargotaStoryPresentation:{resolve(p,page){return {shape:page.emotion};},apply(root,pane,s,style){applied++;assert(root.className.includes('zg-story-player'));assert.equal(pane.className,'zg-story-dialogue');assert(pane.all().some(n=>n.className==='zg-story-speaker-frame'));assert.equal(style.shape,'happy');}},ZargotaStoryDialogueLayout:{fit(){fitted++;}}};
let tick=null;const context={window:w,document:{createElement:tag=>new Element(tag)},setInterval(fn){tick=fn;return 1;},clearInterval(){tick=null;}};vm.createContext(context);vm.runInContext(fs.readFileSync('story-card-events.js','utf8'),context);
const p={speakers:{f:{name:'F',portrait:'base',emotions:{happy:{portrait:'happy'}}}},nodes:[]},node={id:'n',speaker:'f',emotion:'happy',text:'Text',slides:[{speaker:'f',emotion:'happy',text:'Next'}]},host=new Element('div');
const cancel=w.ZargotaCardEvents.dialogue(p,node,host,{action(){},flags:{}},()=>finished++);
assert.equal(host.querySelector('img').src,'happy');assert.equal(applied,1);resize();assert.equal(fitted,2);
assert.equal(host.querySelector('p').textContent,'');tick();assert.equal(host.querySelector('p').textContent,'T');
host.querySelector('button').onclick();assert.equal(host.querySelector('p').textContent,'Text');assert.equal(applied,1);assert.equal(tick,null);
host.querySelector('button').onclick();assert.equal(applied,2);host.querySelector('button').onclick();assert.equal(host.querySelector('p').textContent,'Next');host.querySelector('button').onclick();assert.equal(finished,1);assert.equal(host.children.length,0);assert.equal(resize,null);assert.equal(tick,null);
cancel();assert.equal(finished,1);
const stopTyping=w.ZargotaCardEvents.dialogue(p,node,host,{action(){},flags:{}},()=>finished++);assert(tick);stopTyping();assert.equal(tick,null);assert.equal(host.children.length,0);assert.equal(finished,1);
assert(!fs.readFileSync('story-card-game.css','utf8').includes('.zg-card-dialogue>img'));
console.log('Shared dialogue skin: portrait/emotion, presentation and layout delegation, pages, finish and resize cleanup passed.');
