const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('story-player.js','utf8');
const handler=source.slice(source.indexOf('function activateObject(item)'),source.indexOf('  function pickupSecret(token)'));
function run(item,interaction,options={}){
 const calls=[];const ctx={data:{entryId:'main',interactions:{object:interaction}},state:{character:{inventoryItems:[]}},environment:{play(s){calls.push(['sound',s]);if(options.fail)throw Error('audio');}},resolveInteraction:i=>options.completed?null:i,consumeObject:()=>calls.push(['consume']),startDialogue:id=>calls.push(['dialogue',id]),changeScene:(id,entry)=>calls.push(['travel',id,entry]),showInspection:()=>calls.push(['inspect']),pickupSecret:()=>calls.push(['pickup']),hint:()=>calls.push(['hint']),local:()=>'',t:a=>a,console:{warn(){}}};
 vm.createContext(ctx);vm.runInContext(handler,ctx);ctx.activateObject(Object.assign({id:'object'},item));return calls;
}
assert.deepEqual(run({sound:'paper.mp3'},{entryId:'talk'}),[['consume'],['sound','paper.mp3'],['dialogue','talk']]);
assert.deepEqual(run({sound:'paper.mp3'},{main:true}).at(-1),['dialogue','main']);
assert.deepEqual(run({sound:'paper.mp3',entryId:'direct'},{entryId:'other'}).at(-1),['dialogue','direct']);
assert.deepEqual(run({sound:'paper.mp3'},{entryId:'talk'},{fail:true}).at(-1),['dialogue','talk']);
assert.ok(!run({sound:'paper.mp3'},{entryId:'talk'},{completed:true}).some(c=>c[0]==='dialogue'));
assert.deepEqual(run({enabled:false,sound:'paper.mp3'},{entryId:'talk'}),[]);
assert.deepEqual(run({requiresEquippedItem:'coat',sound:'paper.mp3'},{entryId:'talk'}),[['hint']]);
assert.deepEqual(run({sceneId:'shop',sound:'paper.mp3'},{entryId:'talk'}).at(-1),['travel','shop','talk']);
assert.deepEqual(run({inspectImage:'map.png',sound:'paper.mp3'},null).at(-1),['inspect']);
console.log('PASS activation: sound + mapped/direct/main dialogue, replay rules, failed audio, equipment gate, travel and inspection.');
