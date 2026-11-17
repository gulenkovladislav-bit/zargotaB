'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../persistent-character-core');
const source=fs.readFileSync(path.join(__dirname,'../persistent-characters.js'),'utf8');
const views=fs.readFileSync(path.join(__dirname,'../persistent-account-views.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

// A small DOM fixture for exercising event routes and persistence boundaries.
// Layout, native focus and browser animations are checked separately in Edge.
function mount({role='visitor',available=true,online=true,pending=false,loginGate=null,storeGate=null,locale='ru'}={}){
  const nodes=new Map(),events={},windowEvents={},pages=[],sheets=[],windows=[],writes=[];
  let authUid='player-1',logins=0,logouts=0,starts=0,storeWrites=0;
  const watchers=new Map();
  const hero={id:42,name:'Assigned hero',hpCur:12,hpMax:14};
  const packet={characterJson:JSON.stringify(hero),revision:1};
  const entry={localId:42,remoteId:42,allowed:true,role:'player',base:packet};
  if(pending)entry.pending={character:hero,operationId:'unsent-edit',expectedRevision:1};
  let saved={enabled:role!=='visitor',activeUid:authUid,identities:{[authUid]:{role}},accounts:{[authUid]:{mine:entry}}};
  function matches(el,selector){
    return selector.split(',').some(raw=>{
      const s=raw.trim();
      if(s.startsWith('#'))return el.id===s.slice(1);
      const tag=s.match(/^[a-z]+/i);if(tag&&el.tagName.toLowerCase()!==tag[0].toLowerCase())return false;
      const cls=s.match(/\.([\w-]+)/);if(cls&&!el.classList.contains(cls[1]))return false;
      const attrs=[...s.matchAll(/\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
      return attrs.every(m=>el.getAttribute(m[1])!==null&&(m[2]===undefined||el.getAttribute(m[1])===m[2]));
    });
  }
  function make(tag='div'){
    const localEvents={},attributes={},classes=new Set();
    const el={tagName:tag.toUpperCase(),children:[],dataset:{},style:{},disabled:false,open:false,parentNode:null,
      classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},contains:v=>classes.has(v),toggle(v,force){const on=force===undefined?!classes.has(v):force;on?classes.add(v):classes.delete(v);return on;}},
      addEventListener:(name,fn)=>(localEvents[name]||=[]).push(fn),
      setAttribute(k,v){attributes[k]=String(v);if(k==='id')this.id=v;if(k==='class')String(v).split(/\s+/).forEach(x=>classes.add(x));if(k==='value')this.value=String(v);if(k==='type')this.type=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);},
      getAttribute(k){return k==='id'?this.id||null:attributes[k]??null;},
      appendChild(child){child.parentNode=this;this.children.push(child);if(child.id)nodes.set(child.id,child);return child;},
      remove(){nodes.delete(this.id);if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);},
      contains(other){return this===other||this.children.some(c=>c.contains(other));},
      matches(s){return matches(this,s);},closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null;},
      querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);},
      querySelector(s){return this.querySelectorAll(s)[0]||null;},
      showModal(){this.open=true;windows.push(this);},close(){this.open=false;(localEvents.close||[]).forEach(fn=>fn());},focus(){document.activeElement=this;},
      getBoundingClientRect:()=>({top:0,bottom:36,left:300,right:350,width:50,height:36})
    };
    let html='';
    Object.defineProperty(el,'innerHTML',{get:()=>html,set(value){html=String(value);this.children=[];const stack=[this];for(const m of html.matchAll(/<(\/?)([\w-]+)([^>]*)>/g)){if(m[1]){if(stack.length>1)stack.pop();continue;}const child=make(m[2]);for(const a of m[3].matchAll(/([\w-]+)(?:="([^"]*)"|'([^']*)'|=([^\s>]+))?/g))child.setAttribute(a[1],a[2]??a[3]??a[4]??'');stack.at(-1).appendChild(child);if(!['input','img','br','hr'].includes(m[2]))stack.push(child);}this.textContent=html.replace(/<[^>]*>/g,'');}});
    return el;
  }
  const body=make('body');
  const document={body,activeElement:null,addEventListener:(n,fn)=>(events[n]||=[]).push(fn),getElementById:id=>nodes.get(id)||null,querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),createElement:make};
  const api={
    uid:()=>authUid,
    login:async code=>{logins++;assert.equal(code,'player-code');if(loginGate)await loginGate;authUid='player-1';return {sheetId:'mine'};},
    logout:async()=>{logouts++;authUid=null;},account:async()=>({role:authUid?'player':'visitor'}),
    list:async()=>authUid?{mine:'player'}:{},meta:async()=>({playerUid:'player-1'}),read:async()=>packet,
    watch:(sid,callback)=>{watchers.set(sid,callback);return()=>watchers.delete(sid);},watchMeta:()=>()=>{},watchLastSeen:()=>()=>{},presence:()=>()=>{}
  };
  const w={characters:[hero],ZargotaPersistentCore:core,ZargotaI18n:{getLocale:()=>locale},
    ZargotaPersistentCache:{read:async()=>saved,write:async value=>{saved=JSON.parse(JSON.stringify(value));writes.push(saved);}},
    ZargotaPersistentTransport:{available:()=>available,start:async()=>{starts++;return api;}},
    ZargotaCharacterStore:{saveCharacter:async()=>{storeWrites++;if(storeGate)await storeGate;return {ok:true};}},ZargotaRooms:{getSnapshot:()=>({session:null})},
    addEventListener:(n,fn)=>(windowEvents[n]||=[]).push(fn),matchMedia:()=>({matches:true}),
    showPage:p=>pages.push(p),showCharView(){},openCharSheet:id=>sheets.push(id),renderCharList(){},crypto:require('node:crypto').webcrypto
  };
  const context={window:w,document,navigator:{onLine:online},localStorage:{getItem:()=>null},setTimeout,clearTimeout,URL,URLSearchParams,location:{href:'https://example.test/'},requestAnimationFrame:fn=>fn(),matchMedia:w.matchMedia};
  vm.runInNewContext(views,context);vm.runInNewContext(source,context);
  async function click(action){const button=make('button');button.setAttribute('data-pc-action',action);const ev={target:button,preventDefault(){},stopPropagation(){}};(events.click||[]).forEach(fn=>fn(ev));await tick();await tick();return button;}
  async function submit(){const form=document.getElementById('pc-login-form');assert.ok(form,'login is a real form');const ev={target:form,preventDefault(){},stopPropagation(){}};(events.submit||[]).forEach(fn=>fn(ev));await tick();return ev;}
  return {w,api,document,pages,sheets,windows,writes,click,submit,logins:()=>logins,logouts:()=>logouts,starts:()=>starts,saved:()=>saved,entry,storeWrites:()=>storeWrites,
    async receive(packet){watchers.get('mine')(packet);await tick();},
    async externalAuth(uid){authUid=uid;(windowEvents['zargota:persistent-auth-change']||[]).forEach(fn=>fn({detail:{uid}}));await tick();},
    async ready(){await tick();},async setCode(){await click('menu');document.getElementById('persistent-login-code').value='player-code';}};
}

test('remembered player reaches the assigned sheet without requesting the code again',async()=>{
  const f=mount({role:'player',online:false});await f.ready();await f.click('own-sheet');
  assert.deepEqual(f.sheets,[42]);assert.equal(f.logins(),0);assert.equal(f.windows.length,0);
});

test('unavailable login tells the truth and never offers a working code submit',async()=>{
  for(const locale of ['ru','uk']){
    const f=mount({available:false,locale});await f.ready();await f.click('menu');
    const dialog=f.document.getElementById('persistent-character-dialog');
    assert.match(dialog.textContent,locale==='ru'?/ещё не включён/:/ще не ввімкнено/);
    const submit=dialog.querySelector('[data-pc-action="login"]');assert.ok(!submit||submit.disabled||submit.getAttribute('disabled')!==null);
    assert.equal(f.starts(),0);assert.equal(f.logins(),0);
  }
});

test('Enter submission has a single in-flight login and opens the sheet when complete',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const f=mount({loginGate:gate});await f.ready();await f.setCode();
  await f.submit();await f.submit();
  assert.equal(f.logins(),1,'repeated Enter must not create two authentication requests');
  release();await tick();await tick();
  assert.deepEqual(f.sheets,[42]);assert.equal(f.w.ZargotaPersistentCharacters.status().account.role,'player');
});

test('logout signs out and opening settings cannot silently restore the prior account',async()=>{
  const f=mount({role:'player'});await f.ready();await f.click('leave');
  assert.equal(f.logouts(),1);assert.equal(f.w.ZargotaPersistentCharacters.status().enabled,false);
  await f.w.ZargotaPersistentCharacters.settings();
  assert.equal(f.w.ZargotaPersistentCharacters.status().account.role,'visitor');
  assert.ok(f.document.getElementById('persistent-login-code'));
  assert.equal(f.logins(),0);
  assert.ok(f.saved().accounts['player-1'].mine,'local sheet backup survives logout');
});

test('logout refuses to abandon an unsent character edit',async()=>{
  const f=mount({role:'player',pending:true});await f.ready();await f.click('leave');
  assert.equal(f.logouts(),0);assert.equal(f.w.ZargotaPersistentCharacters.status().enabled,true);
  assert.equal(f.w.ZargotaPersistentCharacters.status().records.mine.pending.operationId,'unsent-edit');
});


test('account changes in another tab suspend this tab without discarding its draft',async()=>{
  const f=mount({role:'player',pending:true});await f.ready();
  await f.externalAuth('different-player');
  const current=f.w.ZargotaPersistentCharacters.status();
  assert.equal(current.enabled,false);assert.equal(current.account.role,'visitor');
  assert.equal(f.saved().accounts['player-1'].mine.pending.operationId,'unsent-edit');
  await f.w.ZargotaPersistentCharacters.settings();
  assert.equal(f.starts(),0,'opening settings after identity change must not reconnect implicitly');
  assert.ok(f.document.getElementById('persistent-login-code'));
});


test('a sheet update already waiting for local storage cannot repaint after identity changes',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const f=mount({role:'player',storeGate:gate});await f.ready();
  await f.w.ZargotaPersistentCharacters.start();
  await f.receive({characterJson:JSON.stringify({id:42,name:'Old identity late update',hpCur:1,hpMax:14}),revision:2});
  assert.equal(f.storeWrites(),1,'incoming snapshot is waiting on local persistence');
  await f.externalAuth('different-player');release();await tick();await tick();
  assert.equal(f.w.ZargotaPersistentCharacters.status().enabled,false);
  assert.equal(f.w.characters[0].name,'Assigned hero','old async completion must not replace the new identity display');
});


test('explicit logout wins over a code login started before leaving the account',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const f=mount({role:'player',loginGate:gate});await f.ready();await f.setCode();
  await f.submit();assert.equal(f.logins(),1);
  await f.click('close');await f.w.ZargotaPersistentCharacters.logout();
  assert.equal(f.w.ZargotaPersistentCharacters.status().enabled,false);
  release();await tick();await tick();
  assert.equal(f.w.ZargotaPersistentCharacters.status().enabled,false,'a cancelled login cannot restore a signed-out account');
});


test('the gear switches from accounts to general settings, with no duplicate general tab',async()=>{
  const f=mount({role:'admin',online:false});await f.ready();
  const panel=f.document.createElement('section');panel.id='zg-net-monitor-panel';f.document.body.appendChild(panel);
  const gear=f.document.createElement('button');gear.id='zg-net-monitor-btn';f.document.body.appendChild(gear);
  const oldTabs=f.document.createElement('nav');oldTabs.id='pc-control-tabs';panel.appendChild(oldTabs);
  const app=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const toggle=app.match(/  w\.zgSessionMonitorToggle=function\(ev,force\)\{[^\n]+/)[0];
  vm.runInNewContext(toggle,{w:f.w,el:id=>f.document.getElementById(id)});
  const event={currentTarget:gear,preventDefault(){},stopPropagation(){}};
  panel.classList.add('open','pc-players-open');
  f.w.zgSessionMonitorToggle(event);
  assert(panel.classList.contains('open'),'gear switches content rather than closing accounts');
  assert(!panel.classList.contains('pc-players-open'));
  assert.equal(f.document.getElementById('pc-control-tabs'),null);
  f.w.zgSessionMonitorToggle(event);assert(!panel.classList.contains('open'),'second gear click still closes settings');
  panel.classList.add('pc-players-open');f.w.zgSessionMonitorToggle(null,true);
  assert(panel.classList.contains('pc-players-open'),'opening accounts keeps its dedicated content');
  f.w.zgSessionMonitorToggle(null,false);f.w.zgSessionMonitorToggle(event);
  assert(panel.classList.contains('open'));assert(!panel.classList.contains('pc-players-open'),'gear never reopens stale accounts');
  assert(!source.includes("button('control-general'"),'no General button is generated for accounts');
});

test('typing during a rebase is preserved, then unrelated server fields apply after save',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const f=mount({role:'player',online:false,storeGate:gate});await f.ready();await f.w.ZargotaPersistentCharacters.start();
 f.w.characters[0].notes='Local draft';f.w.ZargotaPersistentCharacters.saved(f.w.characters,{});
 await f.receive({characterJson:JSON.stringify({id:42,name:'Assigned hero',hpCur:12,hpMax:14,biography:'Server history',family:[{id:'parent',name:'Parent'}]}),revision:2});
 f.w.characters[0].notes='New typing during IndexedDB write';f.w.ZargotaPersistentCharacters.beforeSave();
 release();await tick();await tick();
 assert.equal(f.w.characters[0].biography,undefined,'must defer while local input is being saved');
 assert.equal(f.w.characters[0].notes,'New typing during IndexedDB write');
 f.w.ZargotaPersistentCharacters.saved(f.w.characters,{});await tick();await tick();
 assert.equal(f.w.characters[0].biography,'Server history');
 assert.equal(f.w.characters[0].notes,'New typing during IndexedDB write');
 const e=f.w.ZargotaPersistentCharacters.status().records.mine;
 assert.equal(e.base.revision,2);assert.equal(e.pending.expectedRevision,2);assert.equal(e.conflict,false);
});

test('server update during an outgoing save rebases only after its response and retries at new revision',async()=>{
 const f=mount({role:'player'});await f.ready();await f.w.ZargotaPersistentCharacters.start();
 const packet={characterJson:JSON.stringify({id:42,name:'Assigned hero',hpCur:12,hpMax:14,biography:'Server history'}),revision:2};
 let release,started;const gate=new Promise(resolve=>release=resolve),began=new Promise(resolve=>started=resolve),calls=[];
 f.api.read=async()=>packet;
 f.api.call=async req=>{calls.push(req);if(calls.length===1){started();await gate;throw Error('revision-conflict');}return {state:{characterJson:JSON.stringify(req.character),revision:3,operationId:req.operationId}};};
 f.w.characters[0].notes='Local note';f.w.ZargotaPersistentCharacters.saved(f.w.characters,{});
 await began;await f.receive(packet);
 assert.equal(f.w.ZargotaPersistentCharacters.status().records.mine.pending.expectedRevision,1,'do not replace in-flight operation');
 release();await new Promise(resolve=>setTimeout(resolve,800));
 assert.equal(calls.length,2);assert.equal(calls[1].expectedRevision,2);assert.notEqual(calls[1].operationId,calls[0].operationId);
 assert.equal(calls[1].character.biography,'Server history');assert.equal(calls[1].character.notes,'Local note');
 const e=f.w.ZargotaPersistentCharacters.status().records.mine;
 assert.equal(e.base.revision,3);assert.equal(e.pending,null);assert.equal(e.conflict,false);
});
