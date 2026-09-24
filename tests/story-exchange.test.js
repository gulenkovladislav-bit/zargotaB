const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{}};vm.createContext(ctx);
for(const file of ['story-items.js','story-player.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const e=JSON.parse(fs.readFileSync('story-content/evan/episode-1-courtyard-v17.json')).episode,rules=ctx.window.ZargotaStoryRules;
const make=n=>({flags:{},character:{inventoryItems:[{itemId:'evan-silver-coin',qty:n},{itemId:'keepsake',qty:1}]}});
const amount=(s,id)=>s.character.inventoryItems.filter(i=>i.itemId===id).reduce((n,i)=>n+i.qty,0);
function trade(s,who,n){const node=e.nodes.find(n=>n.id==='evan-exchange-'+who),l=node.links.find(l=>l.exchangeTakeQty===n);return rules.choose(e,s,node.id,l.id);}
const s=make(5);assert(trade(s,'porter',1));assert(trade(s,'porter',2));assert(!trade(s,'porter',1));assert(trade(s,'seller',2));
assert.equal(amount(s,'evan-silver-coin'),0);assert.equal(amount(s,'evan-copper-coin'),50);assert.equal(amount(s,'keepsake'),1);
const one=make(1);assert(!trade(one,'porter',2));assert(trade(one,'porter',1));assert(!trade(one,'seller',1));assert.equal(amount(one,'evan-copper-coin'),10);
const partial=make(5);assert(trade(partial,'seller',1));const saved=JSON.parse(JSON.stringify(partial));assert(trade(saved,'seller',1));assert(!trade(saved,'seller',1));
const no=make(0),before=JSON.stringify(no);assert(!trade(no,'porter',1));assert.equal(JSON.stringify(no),before);
const invalid=structuredClone(e);invalid.nodes=invalid.nodes.filter(n=>n.id!=='evan-exchange-porter-done');const p=make(5),choice=e.nodes.find(n=>n.id==='evan-exchange-porter').links[0];assert.equal(rules.choose(invalid,p,'evan-exchange-porter',choice.id),null);assert.equal(amount(p,'evan-silver-coin'),5);
for(const n of e.nodes.filter(n=>n.id.startsWith('evan-exchange-'))){for(const page of [n,...n.slides]){assert(page.text&&page.textUk);assert(e.speakers[page.speaker]);}for(const l of n.links){assert(e.nodes.some(n=>n.id===l.to));assert(l.label&&l.labelUk);}}
assert.equal(e.scenes[2].scene.tokens.filter(t=>t.ambientMotion?.enabled&&e.interactions[t.id]?.entryId.startsWith('evan-exchange-')).length,4);
assert(e.scenes[2].scene.tokens.filter(t=>e.interactions[t.id]?.entryId.startsWith('evan-exchange-')).every(t=>t.dialogueInteractive));
assert(fs.readFileSync('story-traffic.js','utf8').includes("token.dialogueInteractive?'auto':'none'"));
console.log('Exchange: 5 silver to 50 copper, partial/repeated trades, finite NPC stock, insufficient funds, atomic failures, dialogue links/locales passed. No browser import/test.');
