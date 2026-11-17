'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function source(name){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+10);assert.ok(start>=0&&end>start,name);return html.slice(start,end);}
const calls=[];let result={ok:true},resolveSave;
const c={id:1,coins:{gold:5},hpCur:10,hpMax:20,tempEffects:[],effectHistory:[],skills:[],mastery:[]};
const ctx={console:{error(){}},characters:[c],window:{},document:{getElementById(){return null;}},setTimeout,clearTimeout,
 ensureCharacterEquipBases(){},applyCharacterEquipmentBonuses(){},ensureTempFields(){},calcArenaEquipBonus(){return{};},
 ensurePreparedSpellsForCharacter(c){return c.preparedSpells||(c.preparedSpells={folio:[],kodex:[],obrad:[]});},
 readTempHpTotal(c){return c.tempEffects.reduce((sum,e)=>sum+(e.type==='hp'?parseInt(e.value)||0:0),0);},
 renderCharSheet(){},charRefreshInventoryPanel(){},showToast(){},rerenderSpellDetailPreservingScroll(){}};
ctx.window.ZargotaSound=Object.fromEntries(['coinChange','spellLearned','characterDamage'].map(k=>[k,()=>calls.push(k)]));
ctx.window.ZargotaCharacterStore={prepareCollectionForSave(){return{changedIds:['1']};},persistCollection(){return result==='pending'?new Promise(r=>{resolveSave=r;}):Promise.resolve(result);}};
vm.createContext(ctx);
['saveChars','setCoin','addCoin','updateCoin','changeHP','updateSimpleField','toggleSpellLearned'].forEach(n=>vm.runInContext(source(n),ctx));
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 await ctx.setCoin(1,'gold',6);assert.deepEqual(calls.splice(0),['coinChange']);
 await ctx.setCoin(1,'gold',6);assert.deepEqual(calls,[],'same value is silent');
 ctx.addCoin(1,'gold',-20);await settle();assert.deepEqual(calls.splice(0),['coinChange']);
 ctx.addCoin(1,'gold',-1);await settle();assert.deepEqual(calls,[],'zero clamp is silent');
 result='pending';const pending=ctx.setCoin(1,'gold',2);assert.deepEqual(calls,[],'no cue before persistence');resolveSave({ok:true});await pending;assert.deepEqual(calls.splice(0),['coinChange']);
 result={ok:false};await ctx.setCoin(1,'gold',3);assert.deepEqual(calls,[],'failed save is silent');result={ok:true};
 await ctx.saveChars();await ctx.saveChars({reason:'sync'});assert.deepEqual(calls,[],'generic saves and synchronization stay silent');
 ctx.changeHP(1,-1);await settle();assert.deepEqual(calls.splice(0),['characterDamage']);
 c.tempEffects=[{id:'shield',type:'hp',value:'+2'}];ctx.changeHP(1,-1);await settle();assert.equal(c.hpCur,9);assert.deepEqual(calls.splice(0),['characterDamage'],'temporary HP absorption is damage too');
 ctx.changeHP(1,1);await settle();assert.deepEqual(calls,[],'healing never plays damage');
 c.hpCur=0;c.tempEffects=[];ctx.changeHP(1,-1);await settle();assert.deepEqual(calls,[],'damage at zero with no shield is silent');
 c.hpCur=10;ctx.updateSimpleField(1,'hpCur',8);await settle();assert.deepEqual(calls.splice(0),['characterDamage']);
 ctx.updateSimpleField(1,'hpCur',8);await settle();assert.deepEqual(calls,[]);
 ctx.toggleSpellLearned(1,'test');await settle();assert.deepEqual(calls.splice(0),['spellLearned']);
 ctx.toggleSpellLearned(1,'test');await settle();assert.deepEqual(calls,[],'forgetting is silent');
 result={ok:false};ctx.toggleSpellLearned(1,'test');await settle();assert.deepEqual(calls,[],'failed learning save is silent');
 console.log('PASS: coin changes, actual HP loss including shields, study, delayed/failed saves and no-op/sync silence');
})().catch(e=>{console.error(e);process.exitCode=1;});
