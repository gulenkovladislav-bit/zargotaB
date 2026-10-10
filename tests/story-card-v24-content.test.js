const fs=require('node:fs'),assert=require('node:assert/strict');
const e=require('../story-content/evan/episode-1-milo-v24.json').episode;
const patch=require('../story-content/evan/milo-v24-patch.json');
for(const id of ['card-v21-offer-pen','card-v21-offer-feltser']){
 const n=e.nodes.find(n=>n.id===id);assert.equal(n.slides.length,0);assert.equal(n.links.length,2);assert.ok(n.links.some(l=>l.cardPurchase));assert.ok(n.links.some(l=>!l.cardPurchase));assert.match(n.text,/stake:/);assert.ok(e.storyItems.find(i=>i.itemId===n.offeredItemId)?.image);
}
for(const op of patch.operations)for(const p of [op.after,...op.after.slides||[]]){
 assert.ok(p.text&&p.textUk,op.id);if(p.emotion)assert.ok(e.speakers[p.speaker]?.emotions?.[p.emotion],op.id+': '+p.emotion);
}
const stone=e.nodes.find(n=>n.id==='card-social-stone');assert.equal(stone.cardAction.kind,'stone');assert.equal(stone.cardAction.from,'evan-port-feltser');assert.equal(stone.cardAction.to,'evan-yard-milo');assert.equal(stone.cardEvent.once,true);
assert.equal(e.nodes.find(n=>n.id==='card-story-stones').cardAction.sound,'stones');
assert.ok(fs.existsSync('assets/stories/Evan/objects/milo-pebbles-v1.png'));
assert.equal(e.nodes.find(n=>n.id==='evan-exchange-leave').links[0].sceneId,undefined);
console.log('v24: immediate purchase choices, RU/UK, emotion IDs, one-shot throw, stone sound and exchange route passed.');
