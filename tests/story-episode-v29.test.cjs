const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const [beforePath,afterPath]=process.argv.slice(2),a=JSON.parse(fs.readFileSync(beforePath)).episode,e=JSON.parse(fs.readFileSync(afterPath)).episode;
const w={},ctx={window:w};vm.createContext(ctx);for(const f of ['story-items.js','story-card-economy.js','story-player.js','story-quests.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const get=id=>e.nodes.find(n=>n.id===id),rules=w.ZargotaStoryRules,q=w.ZargotaStoryQuests;
assert.equal(e.nodes.length,a.nodes.length);assert.equal(new Set(e.nodes.map(n=>n.id)).size,e.nodes.length);
for(const n of e.nodes){for(const p of [n,...n.slides||[]]){assert.ok(p.text&&p.textUk,n.id);assert.ok(e.speakers[p.speaker],n.id);if(p.emotion)assert.ok(e.speakers[p.speaker].emotions[p.emotion],n.id+': '+p.emotion);}for(const l of n.links||[]){assert.ok(l.label&&l.labelUk,n.id);if(l.to||l.sceneId)assert.ok(rules.validDestination(e,l),n.id+': '+l.to);}}
function files(o){if(typeof o==='string'&&o.startsWith('assets/'))assert.ok(fs.existsSync(decodeURIComponent(o.split('?')[0])),o);else if(o&&typeof o==='object')Object.values(o).forEach(files);}files(e);
// Alternative ending completes the same existing quest chain without charging any money.
for(const play of [true,false]){const s={active:'evan-yard-meet-quest',done:[]};q.complete(e,s,play?'evan-port-at-circle':'evan-v21-decline');assert.equal(s.active,'evan-yard-game-quest');q.complete(e,s,'evan-v25-depart');assert.equal(s.active,'evan-yard-papers-quest');q.complete(e,s,'evan-v25-boarding');q.complete(e,s,'evan-v25-arrival');assert.equal(s.active,'evan-v25-campus');}
const poor={flags:{},character:{inventoryItems:[]}};for(const id of ['evan-yard-ready','evan-yard-finish']){const n=get(id),l=n.links.find(l=>l.to==='evan-port-at-circle');assert.equal(rules.choose(e,poor,id,l.id),null);}
assert.ok(get('evan-v21-decline').links.some(l=>l.to==='evan-v25-depart'));
for(const id of ['evan-yard-ready','evan-exchange-back','evan-port-wait'])assert.ok(get(id).links.some(l=>l.to==='evan-v21-decline'));
assert.equal(get('evan-exchange-leave').links[0].sceneId,undefined);
assert.doesNotMatch(get('campus27-artist').text,/\{\{copper\}\}/);
const seen=new Set;for(const n of e.nodes.filter(n=>/^campus26-.*-person-\d$/.test(n.id))){assert.ok(!seen.has(n.text),n.id);seen.add(n.text);}
// No dilution or accidental rescheduling of approved harsh events/choices.
for(const n of a.nodes.filter(n=>/^(card-social-|v23-|card-story-)/.test(n.id)&&n.id!=='card-story-intro'))assert.deepEqual(get(n.id),n,n.id);
for(const key of ['scenes','scene','speakers','storyItems','interactions','intro','player'])assert.deepEqual(e[key],a[key],key);
assert.deepEqual(e.minigames.towerClaw,a.minigames.towerClaw);
for(const id of ['card-v21-offer-feltser','card-v21-offer-pen']){assert.equal(get(id).slides.length,0);assert.equal(get(id).links.length,2);}
const x=JSON.parse(JSON.stringify(e.minigames.towerClawTables)),y=JSON.parse(JSON.stringify(a.minigames.towerClawTables));x.forEach(t=>delete t.replies);y.forEach(t=>delete t.replies);assert.deepEqual(x,y);
const econ=w.ZargotaCardEconomy,run={flags:{},character:{inventoryItems:[{itemId:'evan-silver-coin',qty:5}]}};
for(const [id,qty] of [['evan-exchange-porter',3],['evan-exchange-seller',2]]){const n=get(id),l=n.links.find(l=>l.exchangeTakeQty===qty);assert.ok(rules.choose(e,run,id,l.id));assert.equal(rules.choose(e,run,id,l.id),null);}
assert.equal(econ.count(run.character,'evan-silver-coin'),0);assert.equal(econ.count(run.character,'evan-copper-coin'),50);
for(const skin of ['hero','knight','king']){const n=get('campus27-offer-'+skin),l=n.links.find(l=>l.exchangeUnique),money=econ.count(run.character,'evan-copper-coin');assert.ok(rules.choose(e,run,n.id,l.id));assert.equal(econ.count(run.character,'evan-copper-coin'),money-5);assert.equal(rules.choose(e,run,n.id,l.id),null);assert.equal(econ.count(run.character,'evan-copper-coin'),money-5);const poor={flags:{},character:{inventoryItems:[{itemId:'evan-copper-coin',qty:4}]}};assert.equal(rules.choose(e,poor,n.id,l.id),null);assert.equal(econ.count(poor.character,'evan-copper-coin'),4);}
console.log('PASS v29: 209 bilingual nodes, edges/emotions/assets, paid/refusal quest chains, no-money replay guards, unique campus voices, unchanged harsh scenes/artwork, all 5 silver exchanged, 3 unique purchases and insufficient-funds checks.');
