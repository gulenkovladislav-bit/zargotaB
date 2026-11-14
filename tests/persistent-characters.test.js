'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../functions/character-domain'),C=require('../persistent-character-core');
const hero={id:7,campaignKey:'hero-seven',name:'Hero',stats:{str:{cur:1,base:1}},inventoryItems:[]};
const initial=()=>D.initial(hero,'master','player',D.code(),100);
const input=(character,expectedRevision=1,operationId='operation_001')=>({character,expectedRevision,operationId});
test('code has 128 random bits and normalizes whitespace and separators',()=>{
 const code=D.code();assert.match(D.normalizeCode(code),/^ZG[A-F0-9]{32}$/);assert.equal(D.normalizeCode(code.toLowerCase().replaceAll('-',' ')),D.normalizeCode(code));assert.notEqual(code,D.code());
});
test('only owner and assigned player can change a locked or shared sheet',()=>{
 for(const locked of [true,false]){const sheet=initial();sheet.meta.locked=locked;assert.throws(()=>D.commit(sheet,'stranger',input(hero),200),/access-denied/);assert.equal(D.role(sheet,'player'),'player');}
});
test('audit preserves exact before/after values and author for both directions',()=>{
 const before=initial(),next={...hero,stats:{str:{cur:4,base:1}},inventoryItems:[{itemId:'key',name:'Key',qty:2}]};
 const saved=D.commit(before,'player',input(next),200);assert.equal(saved.state.revision,2);assert.equal(saved.history['000000000002'].actorRole,'player');
 const delta=JSON.parse(saved.history['000000000002'].changesJson);assert.deepEqual(delta.find(c=>c.field==='stats').before.value,hero.stats);assert.deepEqual(delta.find(c=>c.field==='stats').after.value,next.stats);
 const granted=D.commit(saved,'master',input({...next,spellRefs:['card-1']},2,'operation_002'),300);assert.equal(granted.state.writerRole,'master');assert.equal(granted.state.revision,3);
 assert.deepEqual(granted.activity,{lastPlayerRevision:2,lastPlayerAt:200},'master edits retain unread player activity');
 assert.equal(before.state.revision,1,'does not mutate pretransaction snapshot');
});
test('simultaneous edits reject stale revisions; retry is idempotent and payload-bound',()=>{
 const next={...hero,hpCur:8},request=input(next),saved=D.commit(initial(),'player',request,200);
 assert.deepEqual(D.commit(saved,'player',request,300),saved);assert.throws(()=>D.commit(saved,'master',input({...hero,hpCur:9},1,'different_001'),300),/revision-conflict/);
 assert.throws(()=>D.commit(saved,'player',{...request,character:{...next,hpCur:3}},400),/operation-reused/);
});
test('immutable identity, invalid payloads, and metadata-only changes',()=>{
 assert.throws(()=>D.commit(initial(),'player',input({...hero,id:9}),200),/identity-change/);
 assert.throws(()=>D.clean(JSON.parse('{"id":1,"name":"x","__proto__":{}}')),/invalid-character/);
 assert.equal(D.commit(initial(),'player',input({...hero,revision:99,_updatedAt:777}),200).state.revision,1);
 assert.ok(C.same({...hero,stats:{str:{base:1,cur:1}}},hero));
});
test('remote content cannot inject markup, image attributes or handler identifiers',()=>{
 for(const patch of [{portrait:'x" onerror="alert(1)'},{notes:'<img src=x onerror=alert(1)>'},{notes:'<svg><script>alert(1)</script></svg>'},{notes:'<a href="java&#x73;cript:alert(1)">x</a>'},{inventoryItems:[{itemId:"x');alert(1)//"}]},{level:'<img src=x>'}])assert.throws(()=>D.clean({...hero,...patch}));
 assert.equal(D.clean({...hero,notes:'<b>Text</b><br><span style="color:#c09955">Word</span>'}).notes,'<b>Text</b><br><span style="color:#c09955">Word</span>');
});
test('all existing campaign heroes retain their supported art references and content',()=>{
 for(const hero of require('../data/campaign-heroes.v1.json').heroes)assert.equal(D.clean(hero).id,hero.id);
});
test('create and player save reject compound values in media and identifier fields',()=>{
 const injected='portrait.png" data-review="injected';
 const patches=[
  {portrait:[injected]},
  {skills:[{image:{src:injected}}]},
  {inventoryItems:[{imageThumb:injected}]},
  {inventoryItems:[{itemId:[injected]}]},
  {skills:{0:{name:'Unexpected shape'}}},
  {mastery:'Unexpected shape'}
 ];
 for(const patch of patches){
  const character={...hero,...patch};
  assert.throws(()=>D.initial(character,'master','player',D.code(),100));
  assert.throws(()=>D.commit(initial(),'player',input(character),200));
 }
});
test('optional art and older skill list entries survive a character save',()=>{
 for(const patch of [{portrait:null,skills:null},{skills:['Tracking'],mastery:[]},{skills:[{id:42,icon:'art:backpack'}],portrait:'images/portraits/hero.png'}]){
  const character={...hero,...patch};
  assert.deepEqual(D.clean(character),character);
 }
});
test('sheet updates cannot break out of an effect handler, inline color, or HP input',()=>{
  const effect={type:'status',statusKey:'poison',label:'Яд',duration:3,remaining:3,color:'#50c040',bg:'#50c04020'};
  const safe={...hero,tempEffects:[effect],speed:'7 м',baseSpeed:'30 фт',hpDelta:'2'};
  assert.deepEqual(D.clean(safe),safe);
  const attempts=[
    {tempEffects:[{...effect,statusKey:"x');void(0);//"}]},
    {tempEffects:[{...effect,statusKey:['poison']}]},
    {tempEffects:[{...effect,id:'delete window.localStorage'}]},
    {tempEffects:[{...effect,color:'#fff" onfocus="void(0)'}]},
    {tempEffects:[{...effect,bg:'red;position:fixed;inset:0'}]},
    {tempEffects:[{...effect,remaining:'<b>10</b>'}]},
    {hpDelta:'1" onfocus="void(0)'},
    {speed:'7 м" onfocus="void(0)'},
    {notes:'<img src=x onerror=void(0) '},
    {notes:'</textarea>'},
    {portrait:'images/test&NewLine;.png'}
  ];
  for(const patch of attempts){
    assert.throws(()=>D.initial({...hero,...patch},'master','player',D.code(),100));
    assert.throws(()=>D.commit(initial(),'player',input({...hero,...patch}),200));
  }
});
test('malformed collections and unbounded render loops are rejected with the sheet still intact',()=>{
  const unsafe=[
    {tempEffects:{0:{type:'status'}}},{inventoryItems:[null]},{notes:{key:'bad'}},
    {mastery:[{name:'x',cdMax:'99999999999999'}]},{stats:{str:{cur:[3]}}},
    {family:[{id:'root',parentId:'root'}]},
    {family:[{id:'one',parentId:'two'},{id:'two',parentId:'one'}]},
    {family:[{id:'one',name:'A'},{id:'one',parentId:'one'}]}
  ];
  const sheet=initial();
  for(const patch of unsafe)assert.throws(()=>D.commit(sheet,'player',input({...hero,...patch}),200));
  assert.equal(sheet.state.revision,1);
});
test('GM path and letters retain their author and content while the player edits their sheet',()=>{
  const gmLetter={journalId:'letter-1',updatedBy:'gm',text:'Сходи к маяку'};
  const note={journalId:'note-1',updatedBy:'local',text:'Я был у маяка'};
  const base={...hero,narrativePath:{title:'Путь светоча'},journalEntries:[gmLetter]};
  const sheet=D.initial(base,'master','player',D.code(),100);
  for(const patch of [{narrativePath:{title:'other'}},{journalEntries:[]},{journalEntries:[{...gmLetter,text:'new'}]},{journalEntries:[gmLetter,{...note,updatedBy:'gm'}]}]){
    assert.throws(()=>D.commit(sheet,'player',input({...base,...patch}),200),/access-denied/);
  }
  assert.throws(()=>D.commit(sheet,'player',input({...base,journalEntries:[{...note,journalId:gmLetter.journalId},gmLetter]}),200),/invalid-character/);
  assert.equal(D.commit(sheet,'player',input({...base,hpCur:8,journalEntries:[note,gmLetter]}),200).state.revision,2);
  assert.equal(D.commit(sheet,'master',input({...base,narrativePath:{title:'Новый путь'},journalEntries:[]}),200).state.revision,2);
});
function entry(){return {remoteId:7,remoteKey:'hero-seven',base:initial().state};}
test('typing while save is in flight queues the latest draft without changing retry payload',()=>{
 const e=entry();C.draft(e,{...hero,hpCur:8},()=> 'first_save_1');C.draft(e,{...hero,hpCur:6},()=> 'ignored');assert.equal(e.pending.character.hpCur,8);
 const packet=D.commit(initial(),'player',e.pending,200).state;C.acknowledged(e,packet,()=> 'next_save_2');assert.equal(e.pending.character.hpCur,6);assert.equal(e.pending.expectedRevision,2);
});
test('remote update never replaces focused input or a local outbox',()=>{
 const e=entry(),packet=D.commit(initial(),'master',input({...hero,hpCur:3}),200).state;
 assert.equal(C.incoming(e,packet,true),'deferred');assert.equal(e.base.revision,1);
 C.draft(e,{...hero,hpCur:5},()=> 'local_save_1');assert.equal(C.incoming(e,packet,false),'deferred');assert.equal(e.conflict,true);
});
test('own acknowledgements do not erase a newer conflicting server revision',()=>{
 const e=entry();C.draft(e,{...hero,hpCur:7},()=> 'local_save_1');const own=D.commit(initial(),'player',e.pending,200);
 const newer=D.commit(own,'master',input({...hero,hpCur:9},2,'master_save_2'),300).state;
 C.incoming(e,newer,false);C.acknowledged(e,own.state,()=> 'next');assert.equal(e.remote.revision,3);assert.equal(e.conflict,true);
});
test('reloaded outbox recognizes own snapshot and retries safely after lost response',()=>{
 const e=entry();C.draft(e,{...hero,hpCur:7},()=> 'local_save_1');const packet=D.commit(initial(),'player',e.pending,200).state;
 const restored=JSON.parse(JSON.stringify(e));assert.equal(C.incoming(restored,packet,false),'own');C.acknowledged(restored,packet,()=> 'next');assert.equal(restored.pending,null);assert.equal(restored.base.revision,2);
});
