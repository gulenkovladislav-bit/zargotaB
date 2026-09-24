const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parent=this;return n;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}querySelectorAll(s){return this.all().filter(n=>s.split(',').some(x=>x[0]==='.'?(n.className||'').split(' ').includes(x.slice(1)):n.tag===x));}
}
let opened,uk=false;const w={ZargotaI18n:{getLocale:()=>uk?'uk':'ru'},zgStoryEditorSelectDialogue:id=>opened=id},ctx={window:w,document:{createElement:t=>new Element(t)}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('story-card-events.js','utf8'),ctx);
const source=fs.readFileSync('story-card-game.js','utf8');vm.runInContext(source.slice(source.indexOf('  function seatChange('),source.indexOf('  function edit(')),ctx);
const original={opponents:['t','p','f'],styles:['cautious','balanced','bold'],stacks:[20,4,6,7]},snapshot=JSON.stringify(original),swapped=ctx.seatChange(original,0,'f');
assert.equal(JSON.stringify(original),snapshot);assert.equal(JSON.stringify(swapped),JSON.stringify({opponents:['f','p','t'],styles:['bold','balanced','cautious'],stacks:[20,7,6,4]}));
const project={activeSceneId:'yard',playerSpeakerId:'e',speakers:{e:{name:'Эван',nameUk:'Еван'},f:{name:'Фельцер',nameUk:'Фельцер'}},nodes:[{id:'existing',title:'Диалог',titleUk:'Діалог',text:'Не менять',links:[],cardAction:{kind:'example'}}],minigames:{future:{custom:17}}};
const saved=JSON.parse(JSON.stringify(project)),host=new Element('main');w.ZargotaCardEvents.editList(project,host,fn=>fn(saved));
const button=text=>host.querySelectorAll('button').find(n=>n.textContent===text);
assert.equal(host.querySelector('details').open,undefined);host.querySelector('select').value='existing';button('Привязать диалог').onclick();
assert.equal(saved.nodes[0].cardEvent.enabled,true);assert.equal(saved.nodes[0].text,'Не менять');assert.equal(saved.nodes[0].cardAction.kind,'example');
button('Текст, страницы и ответы ↗').onclick();assert.equal(opened,'existing');
button('＋ Новое событие').onclick();assert.equal(saved.nodes.length,2);assert.equal(saved.nodes[1].cardEvent.enabled,false);assert.equal(saved.nodes[1].editorSceneId,'yard');assert.ok(saved.nodes[1].titleUk);assert.equal(opened,saved.nodes[1].id);assert.equal(saved.minigames.future.custom,17);
uk=true;const translated=new Element('main');w.ZargotaCardEvents.editList(project,translated,fn=>fn(saved));assert.equal(translated.querySelector('summary').textContent,'Події під час гри');
console.log('Card editor settings: collapsed events, binding, safe creation, navigation callback, RU/UK and wallet/style seat swaps passed.');
