const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const rules=require('../equipment-rules.js');
const source=fs.readFileSync('story-actors.js','utf8');
const handler=source.split('\n').find(l=>l.includes('function act(action){var result=mutate(c,'));
function run(item,action){let sounds=[],saved,errors=0;const ctx={c:{inventoryItems:[item]},item,index:0,mutate:rules.applyCreatureInventory,Date,t:(a)=>a,notice(){errors++;},save(c){saved=c;},showCharacter(){},Audio:function(path){sounds.push(path);this.play=()=>Promise.resolve();}};vm.createContext(ctx);vm.runInContext(handler+';act('+JSON.stringify(action)+');',ctx);return{sounds,saved,errors};}
let r=run({itemId:'charm',qty:1,useSound:'chime.mp3'},'use');assert.deepEqual(r.sounds,['chime.mp3']);assert.equal(r.saved.inventoryItems[0].qty,1);
r=run({itemId:'charm',charges:0,useSound:'chime.mp3'},'use');assert.equal(r.sounds.length,0);assert.equal(r.errors,1);
r=run({itemId:'charm',charges:2,useSound:'chime.mp3'},'use');assert.equal(r.saved.inventoryItems[0].charges,1);assert.equal(r.sounds.length,1);
r=run({itemId:'cloak',equipSound:'cloth.mp3',useSound:'chime.mp3'},'equip');assert.deepEqual(r.sounds,['cloth.mp3']);
r=run({itemId:'cloak',equipped:true,equipSound:'cloth.mp3'},'equip');assert.equal(r.sounds.length,0);
console.log('PASS: actual bag handler plays use sound once on success, preserves reusable item, spends charges, stays silent on failure/removal');
