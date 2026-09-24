const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parent=this;return n;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}focus(){}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}querySelector(tag){return this.all().find(n=>n.tag===tag)||null;}
}
const w={},context={window:w,document:{createElement:t=>new Element(t)}};vm.createContext(context);
for(const file of ['story-card-events.js','story-card-social.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const p=JSON.parse(fs.readFileSync('story-content/evan/episode-1-courtyard-v19.json')).episode,c=p.minigames.towerClaw,ids=[p.playerSpeakerId,...c.opponents,c.guestSpeakerId],E=ids[0],T=ids[1],P=ids[2],F=ids[3],M=ids[4];
assert.equal(T,'evan-friend-tarin');assert.equal(F,'evan-port-feltser');assert.deepEqual(c.stacks,[20,4,6,7]);assert.deepEqual(c.styles,['cautious','balanced','bold']);
let total=0;for(const [id,events] of Object.entries(c.replies))for(const rows of Object.values(events)){assert.equal(rows.length,3);for(const row of rows){total++;assert(row.text&&row.textUk);assert(row.text.length<100&&row.textUk.length<100);assert(p.speakers[id].emotions[row.emotion]);}}
assert.equal(total,105);
for(const n of p.nodes.filter(n=>n.id.startsWith('card-social-'))){for(const page of [n,...n.slides]){assert(page.text&&page.textUk);assert(page.text.length<180);assert(p.speakers[page.speaker].emotions[page.emotion]);}for(const link of n.links)assert(p.nodes.some(n=>n.id===link.to));if(n.cardAction){assert(ids.includes(n.cardAction.from));assert(ids.includes(n.cardAction.to));}}
const memory={},d=w.ZargotaCardEvents.director(p,memory);
const cycle=Array.from({length:3},()=>d.reaction(F,'win',()=>0).text);assert.equal(new Set(cycle).size,3);
const d2=w.ZargotaCardEvents.director(p,memory);assert.notEqual(d2.reaction(F,'win',()=>0).text,cycle.at(-1));
assert.equal(d.next({intro:true,round:1,visit:1}).id,'card-story-intro');assert.equal(d.next({intro:true,round:1,visit:1}),null);
const visit2=w.ZargotaCardEvents.director(p,memory);assert.equal(visit2.next({intro:true,round:1,visit:2}).id,'card-social-return-a');assert.equal(visit2.next({intro:true,round:1,visit:2}),null);
assert.equal(w.ZargotaCardEvents.director(p,memory).next({intro:true,round:1,visit:3}).id,'card-social-return-b');
const scenes={...p,nodes:p.nodes.filter(n=>n.id.startsWith('card-social-'))},s=w.ZargotaCardEvents.director(scenes,memory);s.flags.guestPlaying=true;s.flags.guestJoined=true;
const ctx={round:4,board:3,participants:ids,visit:2};assert.equal(s.next(ctx).id,'card-social-reach-a');assert.equal(s.next(ctx),null);
assert.equal(s.next({...ctx,round:6}).id,'card-social-reach-b');assert.equal(s.next({...ctx,round:5}).id,'card-social-stone');
s.remember('noStones');const again=w.ZargotaCardEvents.director(scenes,memory);again.flags.guestJoined=true;assert.equal(again.next({...ctx,round:5}),null);
const absent=w.ZargotaCardEvents.director(scenes,{});absent.flags.guestJoined=true;assert.equal(absent.next({...ctx,round:5,participants:[E,T,P,F]}),null);
const talk=w.ZargotaCardSocial.chatter(d,c);
function action(move,action,beforeStack,paid,stack){talk.action({round:1,move,speaker:F,action,beforeStack,beforeContributed:0,after:{contributed:paid,stack}});return talk.take();}
const capped=action(1,'allin',20,5,15);assert.equal(capped.speaker,F); // capped wager is raise, not a falsely empty wallet
assert(c.replies[F].raise.some(r=>r.text===capped.text));
assert.equal(action(2,'raise',15,3,12),null); // cooldown
const all=action(3,'allin',12,12,0);assert(c.replies[F].allin.some(r=>r.text===all.text));
assert.equal(action(5,'raise',10,5,5),null); // per-round budget
const richTalk=w.ZargotaCardSocial.chatter(d,c);richTalk.results({round:2,ids,starts:[20,4,6,7,3],players:[{stack:10},{stack:2},{stack:5},{stack:23},{stack:0}],winners:[3]});const rich=richTalk.take();assert(c.replies[F].rich.some(r=>r.text===rich.text));assert.equal(richTalk.take().speaker,E);assert.equal(richTalk.take(),null);
richTalk.results({round:2,ids,starts:[20,4,6,7,3],players:[],winners:[]});assert.equal(richTalk.take(),null);
const free=w.ZargotaCardSocial.chatter(d,c);free.results({round:1,ids,starts:[20,4,6,7,3],players:[20,4,6,7,3].map(stack=>({stack})),winners:[3]});assert.equal(free.take(),null); // no boasts about coins when everyone checked a zero bank
const source=fs.readFileSync('story-card-game.js','utf8'),gift={ids,options:c,guestJoined:true,game:{done:true,paid:3,players:[{stack:8},{stack:4},{stack:6},{stack:7},{stack:0}]},revealComplete:true,payoutCollected:false,director:{flags:{guestBroke:true}}};vm.createContext(gift);vm.runInContext(source.slice(source.indexOf('    function canTopUp('),source.indexOf('    function storyAction(')),gift);
assert(!gift.topUp(1));gift.payoutCollected=true;assert(!gift.topUp(8));assert(!gift.topUp(-1));assert(gift.topUp(1));assert.equal(gift.game.players[0].stack,7);assert.equal(gift.game.players[4].stack,1);assert(!gift.topUp(1));
async function asynchronous(){
 const host=new Element('div');let release,done=0;
 const stop=w.ZargotaCardEvents.dialogue(p,{id:'async',speaker:M,text:'After',links:[]},host,{flags:{},action:()=>new Promise(r=>release=r)},()=>done++);
 assert.equal(host.querySelector('section').hidden,true);assert.equal(host.querySelector('p'),null);release();await Promise.resolve();assert.equal(host.querySelector('p').textContent,'After');host.querySelector('button').onclick();assert.equal(done,1);stop();
 const stop2=w.ZargotaCardEvents.dialogue(p,{id:'async2',text:'After',links:[]},host,{flags:{},action:()=>new Promise(r=>release=r)},()=>done++);stop2();release();await Promise.resolve();assert.equal(host.children.length,0);assert.equal(done,1);
 // Execute flight and hit completion through the Web Animations contract, without a browser.
 const log=[];Element.prototype.animate=function(frames,options){log.push({tag:this.tag,frames,options});return {finished:Promise.resolve(),cancel(){}};};
 const root=new Element('dialog'),from=new Element('portrait'),to=new Element('portrait');from.getBoundingClientRect=()=>({left:100,top:100,width:50,height:50});to.getBoundingClientRect=()=>({left:300,top:300,width:50,height:50});root.getBoundingClientRect=()=>({left:0,top:0});root.querySelector=selector=>selector.includes('seat-3')?from:selector.includes('seat-4')?to:null;
 const fx=w.ZargotaCardSocial.effects(root,ids);await fx.play({kind:'stone',from:F,to:M});assert.equal(log[0].options.duration,900);assert.equal(log[1].tag,'portrait');assert.equal(root.children.length,0);
 const inFlight=fx.play({kind:'stone',from:F,to:M});fx.stop();await inFlight;assert.equal(root.children.length,0);
 // A spectator is a valid visual target before being seated or funded.
 const guest=new Element('aside');guest.dataset={speakerId:M};guest.querySelector=()=>to;root.querySelectorAll=()=>[guest];const observerFx=w.ZargotaCardSocial.effects(root,ids.filter(id=>id!==M));const beforeGuest=log.length;await observerFx.play({kind:'stone',from:F,to:M});assert.equal(log.length,beforeGuest+2);assert.equal(root.children.length,0);
 const count=log.length;w.matchMedia=()=>({matches:true});await fx.play({kind:'stone',from:F,to:M});assert.equal(log.length,count);
 console.log('Social cards: 105 bilingual/emotion variants, rotation across visits, event gates, rate limits, contextual bets, atomic gifts, animation lifecycle and cancellation passed.');
}
asynchronous().catch(e=>{console.error(e);process.exitCode=1;});
