'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=require('../story-content/evan/episode-1-courtyard-v15.json').episode;
const e=require('../story-content/evan/episode-1-courtyard-v16.json').episode;
const nodes=new Map(e.nodes.map(n=>[n.id,n]));assert.equal(nodes.size,e.nodes.length);
assert.deepEqual(e.scenes,base.scenes);assert.deepEqual(e.scene,base.scene);
assert.deepEqual(e.player,base.player);assert.deepEqual(e.storyItems,base.storyItems);assert.deepEqual(e.speakers,base.speakers);
for(const n of e.nodes){for(const l of n.links||[])assert(nodes.has(l.to),`${n.id} -> ${l.to}`);}
assert(!nodes.get('evan-green-rules').beforeWorldActions);
assert.equal(nodes.get('evan-port-arrival').beforeWorldActions.length,2);
for(const id of ['evan-yard-safe','evan-yard-risk'])assert.equal(nodes.get(id).links[0].to,'evan-port-arrival');
assert.deepEqual(e.minigames.towerClaw.opponents,['evan-port-feltser','evan-port-pen','evan-yard-milo']);
assert.equal(e.minigames.towerClaw.enabled,true);
assert.equal(e.minigames.towerClaw.afterNodeId,'evan-port-at-circle');
assert.equal(nodes.get('evan-port-at-circle').links[0].to,'evan-yard-finish');
const paths=[];
function walk(id,ids=[]){assert(!ids.includes(id),'unexpected pregame cycle');const next=[...ids,id];if(id==='evan-port-at-circle'){paths.push(next);return;}for(const l of nodes.get(id).links||[])walk(l.to,next);}
walk('evan-green-rules');assert(paths.length>=6);
for(const p of paths){assert(p.includes('evan-yard-game'));assert(p.includes('evan-port-arrival'));assert(p.includes('evan-milo-arrives'));assert.equal(p.filter(id=>['evan-port-one','evan-port-two','evan-port-free'].includes(id)).length,1);}
const patch=require('../story-content/evan/courtyard-v16-patch.json');
for(const op of patch.operations){if(op.collection){assert.deepEqual(base[op.collection].find(n=>n.id===op.id)||null,op.before);}else assert.deepEqual(base[op.property]||null,op.before);}
for(const op of patch.operations.filter(o=>o.collection==='nodes')){
 const n=op.after;
 for(const p of [n,...n.slides]){assert(p.text&&p.textUk);assert(p.text.length<=240&&p.textUk.length<=240,n.id);const s=e.speakers[p.speaker];assert(s);if(p.showPortrait){assert(s.emotions[p.emotion],n.id+' '+p.emotion);assert(fs.existsSync(decodeURI(s.emotions[p.emotion].portrait)));}if(p.image)assert(fs.existsSync(p.image));}
 assert(!JSON.stringify(n).includes('giveItem'),'no alpha payouts');
 for(const l of n.links){assert(l.label&&l.labelUk);if(l.to==='evan-port-two')assert.equal(l.requiresItemQty,2);if(['evan-port-bargain','evan-port-one'].includes(l.to))assert.equal(l.requiresItemQty,1);}
}
for(const qty of [0,1,2]){const available=nodes.get('evan-port-stake').links.filter(l=>!l.requiresItemId||l.requiresItemQty<=qty);assert(available.some(l=>l.to==='evan-port-free'));assert.equal(available.some(l=>l.to==='evan-port-two'),qty>=2);}
console.log(`v16: ${paths.length} routes reach minigame; bilingual pages, portraits, money gates, guards and unrelated content preserved.`);
