const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const window={};const ctx={window};vm.createContext(ctx);for(const file of ['story-image-secrets.js','story-live-page-editor.js','story-items.js','story-secrets.js','story-dialogue-pages.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const api=window.ZargotaImageSecrets,row={id:'coin-a',x:25,y:70,size:5,pickup:{itemId:'coin',qty:2}};
assert(api.valid([row]));assert(!api.valid([row,row]));assert(!api.valid([{...row,x:101}]));assert(!api.valid([{...row,pickup:{itemId:'coin',qty:0}}]));
const g=api.geometry(1200,800,1600,900,'contain');assert.equal(g.x,0);assert.equal(g.y,62.5);assert.equal(g.height,675);const cover=api.geometry(1200,800,1600,900,'cover');assert(cover.x<0);assert.equal(cover.height,800);
const project={nodes:[{id:'n',image:'bench.png',text:'unchanged',slides:[{text:'next'}]}],storyItems:[{itemId:'coin',name:'coin',stackable:true}]};const edit={operation:'imageSecrets',nodeId:'n',pageIndex:0,expected:'[]',rows:[row]};assert(window.ZargotaLivePageEditor.apply(project,edit));assert.equal(project.nodes[0].text,'unchanged');assert(!window.ZargotaLivePageEditor.apply(project,edit),'stale edit rejected');row.x=99;assert.equal(project.nodes[0].imageSecrets[0].x,25,'copy stored');
const pages=window.ZargotaStoryPages.pages(project.nodes[0]);assert.equal(pages[1].imageSecrets[0].id,'coin-a');const state={character:{inventoryItems:[]}},secrets=window.ZargotaStorySecrets;
assert(secrets.collect(project,state,'dialogue-image',pages[0].imageSecrets[0]).ok);assert(!secrets.collect(project,state,'dialogue-image',pages[1].imageSecrets[0]).ok);assert.equal(state.character.inventoryItems[0].qty,2);const restored=JSON.parse(JSON.stringify(state));assert(!secrets.collect(project,restored,'dialogue-image',pages[0].imageSecrets[0]).ok);
assert(window.ZargotaLivePageEditor.apply(project,{...edit,pageIndex:1,rows:[],expected:'[]'}));assert.equal(project.nodes[1],undefined);assert.equal(window.ZargotaStoryPages.pages(project.nodes[0])[1].imageSecrets.length,0);
console.log('PASS image secrets: geometry, validated isolated persistence, conflicts, inherited pages, single collection and restored state.');
// Optional appearance fields remain compatible with older saved episodes.
for(const fields of [{scaleX:.25,scaleY:3,glow:false,particles:true},{scaleX:1.4,scaleY:.8}])assert(api.valid([{...row,...fields}]));
for(const fields of [{scaleX:0},{scaleY:4},{scaleX:'1'},{glow:'false'},{particles:1}])assert(!api.valid([{...row,...fields}]));
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.className='';this.classList={toggle:(name,on)=>{const names=new Set(this.className.split(' '));on?names.add(name):names.delete(name);this.className=[...names].join(' ');}};}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(){this.children=[];}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 setAttribute(){} addEventListener(){} showModal(){} close(){}
 querySelectorAll(selector){const matches=n=>selector.startsWith('.')?n.className?.split(' ').includes(selector.slice(1)):n.tag===selector;return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...(n.querySelectorAll?.(selector)||[])]);}
}
const document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),body:new Element('body')};ctx.document=document;
const sample={...row,x:20,image:'bench.png'};let saved;
api.edit(project,{image:'bench.png',imageSecrets:[sample]},rows=>{saved=JSON.parse(JSON.stringify(rows));return true;});
const dialog=document.body.children[0],inputs=dialog.querySelectorAll('input'),token=dialog.querySelectorAll('.zg-image-secret-token')[0];
assert.equal(inputs.length,6);
inputs[1].value='8';inputs[1].oninput();inputs[2].value='1.5';inputs[2].oninput();inputs[3].value='0.5';inputs[3].oninput();
assert.equal(token.style.width,'12%');assert.equal(token.style.aspectRatio,'3');
inputs[4].checked=false;inputs[4].onchange();inputs[5].checked=true;inputs[5].onchange();assert(!token.className.includes('has-glow'));assert(token.className.includes('has-particles'));
dialog.querySelectorAll('button').find(b=>b.textContent==='Сохранить').onclick();assert.equal(saved[0].scaleY,.5);assert.equal(saved[0].particles,true);assert.equal(saved[0].glow,false);assert.equal(sample.size,5,'editing does not mutate source before save');
dialog.querySelectorAll('button').find(b=>b.textContent==='Удалить предмет').onclick();assert.equal(dialog.querySelectorAll('.zg-image-secret-token').length,0);dialog.querySelectorAll('button').find(b=>b.textContent==='Сохранить').onclick();assert.equal(saved.length,0);
console.log('PASS image secret inspector: resize, proportions, independent effects, isolated save and deletion.');
