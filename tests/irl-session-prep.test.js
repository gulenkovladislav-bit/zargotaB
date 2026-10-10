'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'), source=html.match(/<script>\s*(\(function\(w\)\{\s*var ACTIVE_KEY='zg_irl_session_v1'[\s\S]*?\}\)\(window\);)\s*<\/script>/)[1];
const storage=new Map();
function boot(){
 const c={Date,JSON,Number,console,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},document:{readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},body:{classList:{toggle(){}}}},characters:[{id:'v',campaignKey:'vrotik',name:'Вротик',hpMax:20,hpCur:18,stats:{str:{base:2,cur:2}},statuses:['poison'],statusEffects:[{key:'blind'}],tempEffects:[{type:'status',key:'sleep'},{type:'bonus',key:'other'}]}]};
 c.window=c;
 vm.runInNewContext(read('js/irl-name-catalog.js'),c);
 vm.runInNewContext(source.replace('})(window);','w.testProjection=irlSessionCharacter;w.testStatuses=irlStatuses;})(window);'),c);
 vm.runInNewContext(read('js/irl-morelesye-data.js'),c);vm.runInNewContext(read('js/irl-session-prep.js'),c);
 return c;
}
let c=boot();c.zgIrlSessionStart();
const pack=JSON.parse(read('story-content/irl/morelesye-session.json'));
assert.deepEqual(JSON.parse(JSON.stringify(c.ZG_MORELESYE_PACK)),pack,'browser bundle matches canonical bilingual pack');
assert.equal(pack.npc.length,21);assert.equal(pack.encounters.length,19);
const ids=[...pack.npc,...pack.encounters].map(x=>x.id);assert.equal(new Set(ids).size,ids.length);
for(const item of [...pack.npc,...pack.encounters,...pack.briefing]){
 assert.ok(item.source);for(const value of Object.values(item))if(value&&typeof value==='object')assert.ok(value.ru&&value.uk,'every prose field is bilingual');
}
let s=c.zgIrlSessionRead();assert.equal(s.data.tableWorkspace.scenes.length,3);assert.equal(s.data.tableWorkspace.events.length,19);
s.data.tableWorkspace.scenes.push({id:'my-scene',name:'My notes',gmNotes:{important:'Keep me'},npcIds:[]});s.data.tableWorkspace.activeSceneId='my-scene';s.data.tableWorkspace.events[0].summary='My edit';
c.zgIrlSessionSaveData('tableWorkspace',s.data.tableWorkspace);c.zgIrlSessionSaveData('unrelated',{keep:true});
c.zgIrlPrepareSession();s=c.zgIrlSessionRead();assert.equal(s.data.tableWorkspace.scenes.length,4);assert.equal(s.data.tableWorkspace.activeSceneId,'my-scene');assert.equal(s.data.tableWorkspace.events[0].summary,'My edit');assert.equal(s.data.unrelated.keep,true);
const base=JSON.stringify(c.characters[0]);
assert.equal(c.zgIrlCharacterValue('vrotik','str','7'),true);assert.equal(c.zgIrlCharacterValue('vrotik','hpMax','12'),true);c.zgIrlCharacterValue('vrotik','ac','16');
assert.equal(c.zgIrlCharacterValue('vrotik','str','NaN'),false);assert.equal(c.zgIrlCharacterValue('vrotik','hpMax','0'),false);assert.equal(c.zgIrlCharacterValue('vrotik','str',''),false);assert.equal(c.zgIrlCharacterValue('vrotik','__proto__','1'),false);
c.zgIrlCharacterStatusRemove('vrotik','blind');c.zgIrlCharacterStatusRemove('vrotik','sleep');c.zgIrlCharacterStatusAdd('vrotik','','Мокрый','3 раунда');c.zgIrlCharacterStatusAdd('vrotik','poison','','2 часа');
let projected=c.testProjection(c.characters[0],'vrotik');assert.equal(projected.stats.str.cur,7);assert.equal(projected.stats.str.base,2);assert.equal(projected.ac,16);assert.equal(projected.hpMax,12);assert.equal(projected.tempEffects.length,1);assert.equal(projected.tempEffects[0].type,'bonus');assert.equal(c.testStatuses(projected).length,2);
assert.equal(JSON.stringify(c.characters[0]),base,'session edits never mutate original character');
c=boot();projected=c.testProjection(c.characters[0],'vrotik');assert.equal(projected.stats.str.cur,7,'stats survive reload');assert.equal(c.testStatuses(projected).length,2,'status changes survive reload');
c.zgIrlCharacterStatusRemove('vrotik','irl-custom-мокрый');assert.equal(c.testStatuses(c.testProjection(c.characters[0],'vrotik')).length,1);
c.zgIrlCharactersRefresh();assert.equal(c.testProjection(c.characters[0],'vrotik').stats.str.cur,2,'explicit refresh restores source');assert.equal(c.testStatuses(c.testProjection(c.characters[0],'vrotik')).length,3);
console.log('IRL preparation: bilingual pack, additive seeding, edits, statuses, reload and registry preservation passed');
