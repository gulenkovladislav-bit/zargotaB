const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'../story-content/evan'),out=JSON.parse(fs.readFileSync(path.join(dir,'episode-1-courtyard-v19.json'))),e=out.episode;
for(const v of [20,21])for(const op of JSON.parse(fs.readFileSync(path.join(dir,`courtyard-v${v}-patch.json`))).operations){if(op.collection){const list=e[op.collection],i=list.findIndex(n=>n.id===op.id);assert.deepEqual(i<0?null:list[i],op.before);if(i<0)list.push(op.after);else list[i]=op.after;}else{assert.deepEqual(e[op.property],op.before);e[op.property]=op.after;}}
const base=structuredClone(e);
for(const n of e.nodes){
 if(n.id==='evan-exchange-leave'){n.links=[{...n.links[0],to:'',label:'Пойду искать размен',labelUk:'Піду шукати розмін'}];delete n.links[0].sceneId;}
 if(['evan-yard-safe','evan-yard-risk'].includes(n.id))n.beforeWorldActions=[...(n.beforeWorldActions||[]),{type:'projectile',targetId:'evan-yard-stones',offsetX:n.id==='evan-yard-risk'?12:0,offsetY:n.id==='evan-yard-risk'?7:0,durationMs:900}];
 if(/^card-v21-offer-(feltser|pen)$/.test(n.id)){
  const offer=e.minigames.towerClaw.itemStakes.find(o=>o.speakerId===n.speaker),item=e.storyItems?.find(i=>i.itemId===offer.itemId);
  Object.assign(n,n.slides[0]);n.slides=[];n.kind='choice';n.offeredItemId=offer.itemId;
  n.links[0].label='Купить за {{stake:'+offer.speakerId+'}} медных';n.links[0].labelUk='Купити за {{stake:'+offer.speakerId+'}} мідних';n.links[1].label='Нет';n.links[1].labelUk='Ні';
 }
}
const patch={format:'zargota-guarded-content-patch',base:'episode-1-courtyard-v21.json',operations:[]};
for(const n of e.nodes){const before=base.nodes.find(x=>x.id===n.id);if(JSON.stringify(n)!==JSON.stringify(before))patch.operations.push({collection:'nodes',id:n.id,before,after:n});}
fs.writeFileSync(path.join(dir,'episode-1-courtyard-v22.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(dir,'courtyard-v22-patch.json'),JSON.stringify(patch,null,2)+'\n');
console.log('v22: '+patch.operations.length+' guarded node changes; no live storage writes');
