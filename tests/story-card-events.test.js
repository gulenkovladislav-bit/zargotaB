const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),rules=require('../story-card-game-core.js');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parent=this;return n;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}focus(){}
 querySelector(tag){return this.children.flatMap(n=>[n,...n.all()]).find(n=>n.tag===tag)||null;}all(){return this.children.flatMap(n=>[n,...n.all()]);}
}
const ctx={window:{},document:{createElement:tag=>new Element(tag)},Set,Math};vm.createContext(ctx);vm.runInContext(fs.readFileSync('story-card-events.js','utf8'),ctx);const api=ctx.window.ZargotaCardEvents;
// Reconstruct the approved snapshot from its guarded patch; the optional full export may be moved by the user.
const project=JSON.parse(fs.readFileSync('story-content/evan/episode-1-courtyard-v17.json')).episode;
for(const op of JSON.parse(fs.readFileSync('story-content/evan/courtyard-v18-patch.json')).operations){if(op.collection){const rows=project[op.collection],i=rows.findIndex(n=>n.id===op.id);assert.deepEqual(i<0?null:rows[i],op.before);if(i<0)rows.push(op.after);else rows[i]=op.after;}else{assert.deepEqual(project[op.property],op.before);project[op.property]=op.after;}}
const d=api.director(project);
assert.equal(d.next({intro:true,round:1,board:0}).id,'card-story-intro');assert(!d.next({intro:true,round:1,board:0}));
assert(!d.next({round:1,board:3}));assert.equal(d.next({round:2,roundStart:true,board:0}).id,'card-story-milo-enter');assert(!d.next({round:2,roundStart:true,board:0}));
assert.equal(d.next({round:2,board:3}).id,'card-story-milo-noticed');assert(!d.next({round:3,board:3}));d.flags.guestJoined=true;
assert.equal(d.next({round:3,board:3}).id,'card-story-crunch');assert(!d.next({round:3,board:4}));assert.equal(d.next({round:3,board:5}).id,'card-story-card-missing');assert(!d.next({round:3,board:6}));
for(const id of Object.keys(project.minigames.towerClaw.replies))for(const event of ['win','loss']){let previous;for(let n=0;n<10;n++){const r=d.reaction(id,event,()=>0);assert(r.text&&r.textUk);assert.notEqual(r,previous);previous=r;}}
const repeat=api.director({nodes:[{id:'end',cardEvent:{enabled:true,phase:'roundEnd',round:0,once:false}}]});assert(repeat.next({round:1,roundEnd:true}));assert(!repeat.next({round:1,roundEnd:true}));assert(repeat.next({round:2,roundEnd:true}));
let gifts=0,actions=0,finished=0;const host=new Element('div');
const tiny={speakers:{a:{name:'A',nameUk:'A',portrait:'base.png',emotions:{happy:{portrait:'happy.png'}}}},nodes:[{id:'a',speaker:'a',emotion:'happy',text:'First',textUk:'Перша',slides:[{speaker:'a',text:'Second',textUk:'Друга'}],cardAction:{kind:'stones'},links:[{to:'b',label:'Give',labelUk:'Дати',cardGift:1}]},{id:'b',speaker:'a',text:'Thanks',textUk:'Дякую',links:[]}]};
api.dialogue(tiny,tiny.nodes[0],host,{flags:{},canGift:()=>true,gift:()=>{gifts++;return true;},action:()=>actions++},()=>finished++);
assert.equal(host.querySelector('img').src,'happy.png');host.querySelector('button').onclick();assert.equal(actions,1);host.querySelector('button').onclick();assert.equal(gifts,1);host.querySelector('button').onclick();assert.equal(finished,1);assert.equal(host.children.length,0);
const cancel=api.dialogue(tiny,tiny.nodes[0],host,{flags:{},canGift:()=>false,gift:()=>{throw Error('must not transfer');},action(){}},()=>finished++);cancel();assert.equal(finished,1);assert.equal(host.children.length,0);
// Exercise the actual gift implementation without UI or inventing money.
const source=fs.readFileSync('story-card-game.js','utf8'),giftCtx={guestVisible:true,guestJoined:false,guestPending:0,guestStones:true,options:{guestSpeakerId:'milo'},ids:['e','f','p','t'],game:{done:false,players:[{stack:20}]},decorateStory(){},table:{querySelector:()=>null},Number};vm.createContext(giftCtx);
vm.runInContext(source.slice(source.indexOf('    function canGift('),source.indexOf('    function storyAction(')),giftCtx);
assert(!giftCtx.gift(20));assert(!giftCtx.gift(-1));assert(giftCtx.gift(3));assert.equal(giftCtx.game.players[0].stack,17);assert.equal(giftCtx.guestPending,3);assert(!giftCtx.gift(3));assert.equal(giftCtx.game.players[0].stack+giftCtx.guestPending,20);
// Actual pause/resume handler cancels every gameplay clock and locks the table.
let resume,stopped=0,resumed=0;const cleared=[];const pauseCtx={canPurchase(){},purchase(){},awardCount:null,canTopUp(){},topUp(){},w:{ZargotaCardEvents:{dialogue(p,n,m,a,finish){resume=finish;return ()=>{};}}},project:{},modal:{},director:{flags:{}},canGift(){},gift(){},storyAction(){},storyBusy:false,closed:false,table:{inert:false},timeout:1,linkTimer:2,nextDealTimer:3,payoutTimer:4,countFrame:5,clearTimeout:id=>cleared.push(id),cancelAnimationFrame:id=>cleared.push(id),stopStorySound(){stopped++;}};
vm.createContext(pauseCtx);vm.runInContext(source.slice(source.indexOf('    function runStory('),source.indexOf('    function canContinue(')),pauseCtx);pauseCtx.runStory({id:'event'},()=>resumed++);assert(pauseCtx.storyBusy);assert(pauseCtx.table.inert);assert.deepEqual(cleared,[1,2,3,4,5]);resume();assert(!pauseCtx.storyBusy);assert(!pauseCtx.table.inert);assert.equal(resumed,1);assert.equal(stopped,1);pauseCtx.closed=true;resume();assert.equal(resumed,1);
// Five seats, unique physical cards, bounded action loops and conservation.
for(let n=0;n<250;n++){const g=rules.create({players:5,stacks:[17,7,6,4,3]});let steps=0;while(!g.done&&steps++<200){const legal=rules.legal(g);assert(rules.act(g,legal.includes('raise')&&Math.random()<.2?'raise':'call',1));}assert(g.done);assert.equal(g.players.length,5);assert.equal(g.players.reduce((sum,p)=>sum+p.stack,0),37);assert.equal(new Set(g.players.flatMap(p=>p.hand).concat(g.board,g.deck).map(c=>c.id)).size,40);}
for(const n of project.nodes.filter(n=>n.id.startsWith('card-story-'))){for(const page of [n,...n.slides]){assert(page.text&&page.textUk);assert(page.text.length<220);if(page.emotion)assert(project.speakers[page.speaker].emotions[page.emotion],page.speaker+':'+page.emotion);}for(const l of n.links)assert(project.nodes.some(n=>n.id===l.to));}
assert(source.includes('if(storyBusy||dealing&&!initialDeal)return;'));assert(source.includes('if(closed||storyBusy||game.done||dealing)return;'));assert(source.includes('if(storyStop)storyStop();stopStorySound();'));
console.log('Card stories: event gating/once/repeat, dialogue pages/choices/cancel, portraits, no-repeat replies, gifts and 250 five-seat games passed. No browser or audio playback test.');
