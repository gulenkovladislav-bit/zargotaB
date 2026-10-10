const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const [beforePath,afterPath]=process.argv.slice(2);assert.ok(beforePath&&afterPath,'Pass v26 and v27 exports');
const before=JSON.parse(fs.readFileSync(beforePath)).episode,p=JSON.parse(fs.readFileSync(afterPath)).episode;
const copy=v=>JSON.parse(JSON.stringify(v));
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.style={};}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parent=this;return n;}prepend(n){this.children.unshift(n);n.parent=this;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}querySelectorAll(s){return this.all().filter(n=>s.split(',').some(x=>x[0]==='.'?(n.className||'').split(' ').includes(x.slice(1)):n.tag===x));}
}
const w={},ctx={window:w,document:{createElement:t=>new Element(t)},setTimeout,clearTimeout};vm.createContext(ctx);
for(const file of ['story-items.js','story-card-economy.js','story-card-game-core.js','story-card-events.js','story-card-game.js','story-player.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const econ=w.ZargotaCardEconomy,game=w.ZargotaCardGame,rules=w.ZargotaStoryRules;
assert.deepEqual(p.minigames.towerClaw,before.minigames.towerClaw,'Old game config preserved');
for(const n of before.nodes)assert.deepEqual(p.nodes.find(v=>v.id===n.id),n,'Existing node preserved: '+n.id);
for(const s of before.scenes)if(s.id!=='scene-evan-v25-engineering')assert.deepEqual(p.scenes.find(v=>v.id===s.id),s);
const nodes=p.nodes.filter(n=>n.id.startsWith('campus27-')),skins=p.storyItems.filter(i=>i.cardSkin);
assert.equal(skins.length,3);assert.equal(new Set(p.nodes.map(n=>n.id)).size,p.nodes.length);
for(const n of nodes){assert.ok(n.text&&n.textUk&&p.speakers[n.speaker]);for(const l of n.links){assert.ok(l.label&&l.labelUk);assert.ok(p.nodes.some(n=>n.id===l.to));}if(n.image)assert.ok(fs.existsSync(n.image));}
for(const i of skins){assert.ok(fs.existsSync(i.image));assert.equal(i.image,i.cardSkin.image);assert.equal(i.stackable,false);}
const run=cash=>({flags:{},character:{inventoryItems:[{itemId:'evan-copper-coin',qty:cash},{itemId:'evan-silver-coin',qty:5}]}});
let state=run(15);
for(const skin of skins){const n=nodes.find(n=>n.links.some(l=>l.exchangeGiveId===skin.itemId)),l=n.links.find(l=>l.exchangeGiveId===skin.itemId),cash=econ.count(state.character,'evan-copper-coin');
 assert.ok(rules.choose(p,state,n.id,l.id));assert.equal(econ.count(state.character,'evan-copper-coin'),cash-5);assert.equal(econ.count(state.character,skin.itemId),1);
 assert.equal(rules.choose(p,state,n.id,l.id),null);assert.equal(econ.count(state.character,'evan-copper-coin'),cash-5);
 const poor=run(4),snapshot=JSON.stringify(poor);assert.equal(rules.choose(p,poor,n.id,l.id),null);assert.equal(JSON.stringify(poor),snapshot);
 const afterReload=copy(state);afterReload.flags={};assert.equal(w.ZargotaStoryItems.exchange(p,afterReload,l),false,'Owned unique item cannot debit again even if flag is absent');
 assert.equal(game.cardPath({rank:skin.cardSkin.rank,color:0},state.character),skin.image);assert.notEqual(game.cardPath({rank:skin.cardSkin.rank,color:1},state.character),skin.image);
 assert.notEqual(game.cardPath({rank:skin.cardSkin.rank,color:0},run(0).character),skin.image);
}
assert.equal(econ.count(state.character,'evan-silver-coin'),5);
const table=p.minigames.towerClawTables[0];assert.ok(game.match(p,table.afterNodeId));assert.equal(game.config(p,table.afterNodeId).tableId,'engineering');assert.equal(game.config(p,p.minigames.towerClaw.afterNodeId).tableId,undefined);
assert.equal(game.match({...p,minigames:{...p.minigames,towerClawTables:[{...table,enabled:false}]}},table.afterNodeId),false);
state=run(20);let wallet=econ.begin(p,state),oldIds=[p.playerSpeakerId,...p.minigames.towerClaw.opponents];wallet.finish(null,oldIds);const oldMemory=copy(state.cardWallets);
const campus={...p,minigames:{...p.minigames,towerClaw:table}},ids=[p.playerSpeakerId,...table.opponents];wallet=econ.begin(campus,state);assert.deepEqual(Array.from(wallet.stacks),[20,45,18,24]);
wallet.finish(null,ids);wallet.finish(null,ids);assert.equal(econ.count(state.character,'evan-copper-coin'),20);assert.deepEqual(copy(state.cardWallets),oldMemory);
wallet=econ.begin(campus,state);wallet.finish({done:true,players:[{stack:25},{stack:40},{stack:18},{stack:24}]},ids);wallet=econ.begin(campus,state);assert.deepEqual(Array.from(wallet.stacks),[25,40,18,24]);wallet.finish(null,ids);
const eventProject={nodes:[{id:'old',cardEvent:{enabled:true,phase:'roundStart'}},{id:'new',cardEvent:{enabled:true,phase:'roundStart',tableId:'engineering'}}],minigames:{towerClaw:table}};
let director=w.ZargotaCardEvents.director(eventProject);assert.equal(director.next({round:1,roundStart:true}).id,'new');assert.equal(director.next({round:1,roundStart:true}),null);director.dispose();
eventProject.minigames.towerClaw={};director=w.ZargotaCardEvents.director(eventProject);assert.equal(director.next({round:1,roundStart:true}).id,'old');director.dispose();
const rng=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),core=w.ZargotaCardRules,g=core.create({players:4},rng(9)),altered=copy(g);
altered.deck.reverse();altered.players.slice(1).forEach(p=>p.hand=[{rank:10,color:1,id:'fake'},{rank:10,color:1,id:'other'}]);assert.equal(core.npc(g,rng(8),'expert'),core.npc(altered,rng(8),'expert'),'Expert cannot see hidden cards');
for(let seed=1;seed<=12;seed++){const random=rng(seed),g=core.create({players:4,stacks:[20,45,18,24]},random);let turns=0;while(!g.done&&turns++<300){const action=core.npc(g,random,g.turn===1?'expert':'balanced');assert.ok(core.act(g,action,action==='raise'?1:undefined));}assert.ok(g.done);assert.equal(g.players.reduce((n,p)=>n+p.stack,0),107);}
// Exercise actual editor handlers against a saved copy, including non-config event edits.
const edited=copy(p),originalConfig=copy(edited.minigames.towerClaw),host=new Element('main');w.ZargotaCardGame.edit(edited,fn=>fn(edited),host);
let picker=host.querySelectorAll('select').find(s=>s.attributes['aria-label']==='Карточный стол');picker.value='engineering';picker.onchange();
const label=host.querySelectorAll('label').find(l=>l.children[0]?.textContent==='Манера соперника 1'),style=label.querySelector('select');assert.equal(style.value,'expert');style.value='cautious';style.onchange();assert.equal(edited.minigames.towerClawTables[0].styles[0],'cautious');assert.deepEqual(edited.minigames.towerClaw,originalConfig);
const newEvent=host.querySelectorAll('button').find(b=>b.textContent==='＋ Новое событие');newEvent.onclick();assert.equal(edited.nodes.at(-1).cardEvent.tableId,'engineering');assert.equal(edited.minigames.towerClawTables[0].tableId,'engineering');assert.deepEqual(edited.minigames.towerClaw,originalConfig);
console.log('v27 passed: additive export, bilingual graph/art, 3 atomic purchases, duplicate/insufficient funds, rank-only skins, independent tables/wallets/events/editor, hidden-card-independent expert and 12 conserved games.');
