const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const dialogs=[],sounds=[];function el(tag){return {tag,children:[],events:{},append(...a){this.children.push(...a);},setAttribute(k,v){this[k]=v;},addEventListener(k,f){this.events[k]=f;},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},remove(){this.removed=true;},focus(){this.focused=true;}};}
const focus={isConnected:true,focus(){}},window={},ctx={window,document:{activeElement:focus,createElement:el,body:{append(d){dialogs.push(d);}}},Audio:function(src){this.src=src;sounds.push(this);this.play=()=>Promise.resolve();this.pause=()=>{};}};vm.createContext(ctx);for(const p of ['story-items.js','story-secrets.js'])vm.runInContext(fs.readFileSync(p,'utf8'),ctx);
const api=window.ZargotaStorySecrets,data={storyItems:[{itemId:'coin',name:'Медная монета',nameUk:'Мідна монета',image:'coin.png',stackable:true},{itemId:'key',name:'Ключ',nameUk:'Ключ',stackable:false}]},state={character:{inventoryItems:[]}},token={id:'one',pickup:{itemId:'coin',qty:3}};
const initial=JSON.stringify(data),result=api.collect(data,state,'street',token);assert.equal(result.ok,true);assert.equal(state.character.inventoryItems[0].qty,3);assert.equal(state.character.inventoryItems[0].storyUnread,true);
assert.equal(api.collect(data,state,'street',token).ok,false);assert.equal(state.character.inventoryItems[0].qty,3);
assert.equal(api.collect(data,state,'yard',token).ok,true);assert.equal(state.character.inventoryItems[0].qty,6);
assert.equal(api.collect(data,state,'street',{id:'bad',pickup:{itemId:'missing',qty:1}}).ok,false);assert.equal(state.consumed['street:bad'],undefined);
for(const qty of [0,-1,1.5,1000,Infinity])assert.equal(api.collect(data,state,'street',{id:'bad',pickup:{itemId:'coin',qty}}).ok,false);
assert.equal(api.collect(data,state,'street',{id:'key1',pickup:{itemId:'key',qty:8}}).qty,1);assert.equal(api.collect(data,state,'street',{id:'key2',pickup:{itemId:'key',qty:1}}).reason,'owned');assert.equal(state.consumed['street:key2'],undefined);
const restored=JSON.parse(JSON.stringify(state));assert.equal(api.collect(data,restored,'street',token).ok,false);assert.equal(JSON.stringify(data),initial);
let finished=0;api.show(result,{},false,()=>finished++);assert.equal(dialogs.at(-1).open,true);assert.equal(sounds.length,0);api.close();assert.equal(finished,1);
api.show(result,{volume:.3},true,()=>finished++);assert.equal(sounds.length,1);assert.equal(sounds[0].volume,.3);let stopped=false;dialogs.at(-1).events.keydown({stopPropagation(){stopped=true;}});assert.ok(stopped);api.close();assert.equal(finished,2);
api.show(result,{sound:false},true);assert.equal(sounds.length,1);api.close();
const p=fs.readFileSync('story-player.js','utf8');assert.ok(p.includes('if(token.pickup||token.sound'));assert.ok(p.includes('if(item.pickup){pickupSecret(item);return;}consumeObject(item)'));assert.ok(p.includes('if(w.ZargotaStorySecrets)w.ZargotaStorySecrets.close()'));
assert.ok(fs.existsSync('assets/stories/cards/tower-claw/audio/candidates-v2/rpg/handleCoins2.mp3'));
console.log('PASS: secret awards, quantity validation, no duplicates/reentry, unique items, state roundtrip, modal dismissal and mute (mock DOM/audio).');
