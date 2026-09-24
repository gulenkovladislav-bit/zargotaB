const fs=require('node:fs'),assert=require('node:assert/strict');
const e=JSON.parse(fs.readFileSync('story-content/evan/episode-1-courtyard-v13.json')).episode;
const base=JSON.parse(fs.readFileSync('story-content/evan/episode-1-courtyard-v12.json')).episode;
const nodes=new Map(e.nodes.map(n=>[n.id,n]));
function routes(id,path=[]){assert(!path.includes(id),'Cycle');const n=nodes.get(id);assert(n,id);const next=[...path,id];return n.links.length?n.links.flatMap(l=>routes(l.to,next)):[next];}
const paths=routes('evan-green-rules');assert(paths.length>=4);
for(const p of paths){assert(p.includes('evan-milo-arrives'));assert.equal(p.at(-1),'evan-port-at-circle');assert.equal(p.filter(x=>['evan-port-one','evan-port-two','evan-port-free'].includes(x)).length,1);assert(!p.includes('evan-yard-finish'));}
assert.equal(nodes.get('evan-port-at-circle').afterEffect,'evan-green-game-agreed');
assert.equal(e.quests.find(q=>q.id==='evan-yard-meet-quest').dialogueId,'evan-port-at-circle');
assert.equal(e.interactions['evan-yard-stones'].entryId,'evan-port-wait');
for(const p of new Set(paths.flat())){const n=nodes.get(p);for(const a of [...(n.beforeWorldActions||[]),...(n.afterWorldActions||[])])assert.equal(a.type,'move');for(const page of [n,...n.slides]){assert(page.textUk);assert(page.text.length<240);assert(page.textUk.length<240);}}
assert.deepEqual(e.player,base.player);assert.deepEqual(e.storyItems,base.storyItems);
for(const id of ['scene-mu7f8nxa','scene-mu7f8nxa-i2uj','scene-mu7f8tk1-6m4a'])assert.deepEqual(e.scenes.find(s=>s.id===id),base.scenes.find(s=>s.id===id));
for(const id of ['evan-port-feltser','evan-port-pen'])assert.equal(Object.keys(e.speakers[id].emotions).length,7);
assert.equal(e.speakers['evan-yard-milo'].portrait,'');
assert(nodes.get('evan-yard-greet').repeatWhen==='evan-green-game-agreed');
assert.equal(nodes.get('evan-port-stake').links.find(l=>l.to==='evan-port-two').requiresItemQty,2);
assert.equal(nodes.get('evan-port-bargain').links.find(l=>l.to==='evan-port-one').requiresItemQty,1);
console.log('PASS: all pregame routes include Milo; 2/1/no stake; no money/item mutation; meet quest cutoff; untouched other scenes');
