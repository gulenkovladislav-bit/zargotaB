const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parent=this;return n;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}querySelector(tag){return this.all().find(n=>n.tag===tag)||null;}
 querySelectorAll(selector){return this.all().filter(n=>selector.split(',').some(s=>s[0]==='.'?(n.className||'').split(' ').includes(s.slice(1)):n.tag===s));}
}
let editCalls=0,saveCard,uk=false;
const w={ZargotaI18n:{getLocale:()=>uk?'uk':'ru'},ZargotaCardGame:{edit(project,save,host){editCalls++;saveCard=save;host.appendChild(new Element('settings'));}}};
const ctx={window:w,document:{createElement:t=>new Element(t)}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('story-minigames.js','utf8'),ctx);
const project={minigames:{towerClaw:{enabled:false,stacks:[20,4,6,7]},future:{enabled:true,custom:17}}},original=JSON.stringify(project),host=new Element('main');
w.ZargotaMinigames.edit(project,fn=>fn(project),host);assert.equal(editCalls,1);assert.equal(JSON.stringify(project),original);assert.equal(host.querySelector('strong').textContent,'Башня и коготь');assert.equal(host.querySelector('small').textContent,'Выключена');
saveCard(p=>p.minigames.towerClaw.enabled=true);assert.equal(host.querySelector('small').textContent,'Включена в эпизоде');assert.equal(project.minigames.future.custom,17);
let futureCalls=0;w.ZargotaMinigames.register({id:'future',name:'Другая',nameUk:'Інша',description:'Игра',descriptionUk:'Гра',edit(){futureCalls++;}});
uk=true;w.ZargotaMinigames.edit(project,fn=>fn(project),host);assert.equal(host.children.length,1);const entries=host.querySelectorAll('.zg-minigame-entry');assert.equal(entries.length,2);assert.equal(entries[0].querySelector('strong').textContent,'Вежа та кіготь');entries[1].onclick();assert.equal(futureCalls,1);assert.equal(entries[1].attributes['aria-pressed'],'true');assert.equal(entries[0].attributes['aria-pressed'],'false');assert.deepEqual(project.minigames.towerClaw.stacks,[20,4,6,7]);
console.log('Minigame catalogue: registration, selection, RU/UK, status refresh, cleanup and existing config preservation passed.');
