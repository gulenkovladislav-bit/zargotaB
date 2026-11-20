const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../character-status-operations');
const D=require('../functions/character-domain');
const def={key:'bleed',label:'Кровотечение',icon:'✦',color:'#c02020',startOfTurnEffect:'damage',startOfTurnValue:1};
const options={unit:'rounds',duration:3,id:12345};
test('same sheet shape, ticking fields, timed duration and validated save',()=>{
  const c={id:1,name:'Test',hpCur:8,hpMax:10};const result=S.apply(c,def,options);
  assert.equal(result.changed,true);assert.equal(c.tempEffects[0].tickValue,-1);assert.equal(c.tempEffects[0].remaining,3);
  const server=D.initial({id:1,name:'Test',hpCur:8,hpMax:10},'gm','player','test',1);
  assert.ok(D.commit(server,'gm',{character:c,expectedRevision:1,operationId:'test-status-operation'},2));
  assert.equal(S.create(def,{unit:'hours',duration:2}).remainingMins,120);
  assert.throws(()=>S.create(def,{unit:'rounds',duration:-1}));
});
test('bleed increments its existing stack, does not duplicate or reset elapsed duration',()=>{
  const c={};S.apply(c,def,options);c.tempEffects[0].remaining=1;const result=S.apply(c,def,options);
  assert.equal(c.tempEffects.length,1);assert.equal(c.tempEffects[0].remaining,1);assert.equal(c.tempEffects[0].stacks,2);
  assert.equal(S.undo(c,result.receipt).changed,true);assert.equal(c.tempEffects[0].stacks,1);
});
test('repeat ordinary statuses are no-ops, including legacy flags',()=>{
  const fear={...def,key:'fear'};const c={};S.apply(c,fear,options);
  assert.equal(S.apply(c,fear,options).reason,'already-active');assert.equal(c.tempEffects.length,1);
  assert.equal(S.apply({statuses:['fear']},fear,options).changed,false);
});
test('undo preserves other effects and refuses to erase later player changes',()=>{
  const c={notes:'keep',tempEffects:[{id:7,type:'hp',value:'+5'}]};const result=S.apply(c,def,options);
  c.inventoryItems=[{id:77,name:'new'}];c.tempEffects[1].remaining=2;
  assert.equal(S.undo(c,result.receipt).changed,false);
  c.tempEffects[1].remaining=3;assert.equal(S.undo(c,result.receipt).changed,true);
  assert.deepEqual(c.tempEffects,[{id:7,type:'hp',value:'+5'}]);assert.equal(c.inventoryItems[0].id,77);assert.equal(c.notes,'keep');
});
test('legacy bleeding and invalid duplicate collections are handled without hiding existing data',()=>{
  const c={statuses:['bleed']};S.apply(c,def,options);assert.equal(c.tempEffects[0].stacks,2);
  c.tempEffects.push({...c.tempEffects[0],id:9});assert.equal(S.apply(c,def,options).reason,'duplicate-existing');
  assert.equal(c.tempEffects.length,2);
});
