const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('story-player.js','utf8');
const start=src.indexOf('  function available('),end=src.indexOf('  function interactionRadius(',start);
const ctx={};vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
const run=(qty)=>({flags:{met:true},character:{inventoryItems:[{itemId:'silver',qty}]}});
for(const qty of [0,1,2,5]){assert.equal(ctx.available({requiresItemId:'silver',requiresItemQty:2},run(qty)),qty>=2);}
assert.equal(ctx.available({requiresItemId:'silver'},run(1)),true);
assert.equal(ctx.available({requiresItemId:'silver'},run(0)),false);
assert.equal(ctx.available({requiresItemId:'silver'},{}),false);
assert.equal(ctx.available({requires:'missing',requiresItemId:'silver'},run(5)),false);
assert.equal(ctx.available({requires:'met',requiresItemId:'silver'},run(1)),true);
for(const qty of [-1,1.5,'bad',Infinity])assert.equal(ctx.available({requiresItemId:'silver',requiresItemQty:qty},run(5)),false);
assert.equal(ctx.available({requiresItemId:'silver',requiresItemQty:2},{character:{inventoryItems:[{itemId:'silver'},{itemId:'silver',qty:1}]}}),true);
const state=run(2),before=JSON.stringify(state),project={nodes:[{id:'start',links:[{id:'bet',to:'end',requiresItemId:'silver',requiresItemQty:2}]},{id:'end'}]};
assert.equal(ctx.choose(project,state,'start','bet').to,'end');assert.equal(JSON.stringify(state),before);
assert.equal(ctx.choose(project,run(1),'start','bet'),null);
const editor=fs.readFileSync('story-editor.js','utf8');assert(editor.includes("['requiresItemId',t("));assert(editor.includes("['requiresItemQty',t("));
console.log('PASS: inventory choices, quantities, existing flags, choose recheck, no debit, editable fields');
