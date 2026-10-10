const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),rules=require('../story-card-game-core.js');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};}
 append(...nodes){nodes.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parent=this;return n;}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this.attributes[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}focus(){}
 querySelector(tag){return this.children.flatMap(n=>[n,...n.all()]).find(n=>n.tag===tag)||null;}all(){return this.children.flatMap(n=>[n,...n.all()]);}
}
const ctx={window:{matchMedia:()=>({matches:true})},document:{createElement:tag=>new Element(tag)},Set,Math};vm.createContext(ctx);vm.runInContext(fs.readFileSync('story-card-events.js','utf8'),ctx);const api=ctx.window.ZargotaCardEvents;
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
let resume,stopped=0,resumed=0;const cleared=[];const pauseCtx={storyCheckpoint(){},canGiveGuest(){},giveGuest(){},mountStoryTools(){},canPurchase(){},purchase(){},awardCount:null,canTopUp(){},topUp(){},w:{ZargotaCardEvents:{dialogue(p,n,m,a,finish){resume=finish;return ()=>{};}}},options:{character:{inventoryItems:[]}},project:{},modal:{querySelector:()=>null},director:{flags:{}},canGift(){},gift(){},storyAction(){},storyBusy:false,closed:false,table:{inert:false},timeout:1,linkTimer:2,nextDealTimer:3,payoutTimer:4,countFrame:5,clearTimeout:id=>cleared.push(id),cancelAnimationFrame:id=>cleared.push(id),stopStorySound(){stopped++;}};
vm.createContext(pauseCtx);vm.runInContext(source.slice(source.indexOf('    function runStory('),source.indexOf('    function canContinue(')),pauseCtx);pauseCtx.runStory({id:'event'},()=>resumed++);assert(pauseCtx.storyBusy);assert(pauseCtx.table.inert);assert.deepEqual(cleared,[1,2,3,4,5]);resume();assert(!pauseCtx.storyBusy);assert(!pauseCtx.table.inert);assert.equal(resumed,1);assert.equal(stopped,1);pauseCtx.closed=true;resume();assert.equal(resumed,1);
// Five seats, unique physical cards, bounded action loops and conservation.
for(let n=0;n<250;n++){const g=rules.create({players:5,stacks:[17,7,6,4,3]});let steps=0;while(!g.done&&steps++<200){const legal=rules.legal(g);assert(rules.act(g,legal.includes('raise')&&Math.random()<.2?'raise':'call',1));}assert(g.done);assert.equal(g.players.length,5);assert.equal(g.players.reduce((sum,p)=>sum+p.stack,0),37);assert.equal(new Set(g.players.flatMap(p=>p.hand).concat(g.board,g.deck).map(c=>c.id)).size,40);}
for(const n of project.nodes.filter(n=>n.id.startsWith('card-story-'))){for(const page of [n,...n.slides]){assert(page.text&&page.textUk);assert(page.text.length<220);if(page.emotion)assert(project.speakers[page.speaker].emotions[page.emotion],page.speaker+':'+page.emotion);}for(const l of n.links)assert(project.nodes.some(n=>n.id===l.to));}
assert(source.includes('if(awaitingEntry||storyBusy||dealing&&!initialDeal)return;'));assert(source.includes('if(closed||storyBusy||game.done||dealing)return;'));assert(source.includes('if(storyStop)storyStop();stopStorySound();'));
console.log('Card stories: event gating/once/repeat, dialogue pages/choices/cancel, portraits, no-repeat replies, gifts and 250 five-seat games passed. No browser or audio playback test.');

const musicCommands=[],scopes=[];
const musical={nodes:[{id:'music',text:'First',musicEvent:{action:'play',sound:'first'},afterPageActions:[{type:'music',musicEvent:{action:'play',sound:'after-page'}}],slides:[{text:'Second',musicEvent:{action:'stop'}}],afterWorldActions:[{type:'music',musicEvent:{action:'play',sound:'after-node'}}],links:[]}]};
const musicHost=new Element('div');
api.dialogue(musical,musical.nodes[0],musicHost,{action(){},flags:{},music:e=>musicCommands.push(e.sound||e.action),stopMusicScope:s=>scopes.push(s)},()=>{});
assert.deepEqual(musicCommands,['first','after-page']);musicHost.querySelector('button').onclick();assert.deepEqual(musicCommands,['first','after-page','stop']);musicHost.querySelector('button').onclick();assert.deepEqual(musicCommands,['first','after-page','stop','after-node']);assert.deepEqual(scopes,['dialogue']);
console.log('PASS card music: page start, after page, after node and dialogue scope cleanup.');
// Generated in-game replies retain the exact source row and table for live editing.
Element.prototype.removeAttribute=function(k){delete this.attributes[k];};
let locale='uk';ctx.window.ZargotaI18n={getLocale:()=>locale};
const replyProject={nodes:[],minigames:{towerClaw:{tableId:'campus',replies:{pen:{raise:[{text:'Original',textUk:'Оригінал'},{text:'Other',textUk:'Інша'}]}}}}};
const stored={minigames:{towerClaw:{replies:{pen:{raise:[{text:'Yard',textUk:'Двір'}]}}},towerClawTables:[JSON.parse(JSON.stringify(replyProject.minigames.towerClaw))]}};
const generated=api.director(replyProject).reaction('pen','raise',()=>0);assert.equal(generated.cardReplySource.index,0);assert.equal(generated.cardReplySource.tableId,'campus');
const generatedNode=Object.assign({},generated,{id:'temporary-social',speaker:'pen',slides:[],links:[]});let saves=0;
const endReply=api.dialogue(replyProject,generatedNode,host,{flags:{},action(){},textEditing:{enabled:()=>true,save(edit){const target=api.replyTarget(stored,edit.cardReplySource);assert.equal(target[edit.field],edit.expected);target[edit.field]=edit.value;saves++;return true;}}},()=>{});
const line=host.all().find(e=>e.className==='zg-story-line');line.onclick();assert.equal(line.contentEditable,'plaintext-only');line.innerText='Виправлена реакція';line.onblur();assert.equal(saves,1);assert.equal(stored.minigames.towerClawTables[0].replies.pen.raise[0].textUk,'Виправлена реакція');assert.equal(replyProject.minigames.towerClaw.replies.pen.raise[0].textUk,'Виправлена реакція');assert.equal(stored.minigames.towerClaw.replies.pen.raise[0].textUk,'Двір');assert.equal(stored.minigames.towerClawTables[0].replies.pen.raise[0].text,'Original');
line.onclick();line.innerText='Друга правка';line.onblur();assert.equal(saves,2);endReply();
assert.equal(api.replyTarget(stored,{tableId:'missing',speaker:'pen',event:'raise',index:0}),null);
console.log('PASS live in-game reactions: editable generated reply, repeated saves, exact table/row, RU preservation and no cross-table changes.');
// A generic continuation is not a decision even when the node is marked choice.
for(const [label,expected] of [['Далі',false],['Далее',false],['Поставить две монеты',true]]){
 const p={nodes:[{id:'a',kind:'choice',text:'Text',textUk:'Текст',links:[{to:'b',label,labelUk:label}]},{id:'b',text:'End',links:[]}]};
 const stop=api.dialogue(p,p.nodes[0],host,{flags:{},action(){}},()=>{});
 const answers=host.all().find(e=>(e.className||'').startsWith('zg-story-answers'));
 assert.equal(answers.className.includes('is-single-advance'),!expected,label);stop();
}
const mid={nodes:[{id:'a',kind:'choice',text:'First',slides:[{text:'Last'}],links:[]}]};const stopMid=api.dialogue(mid,mid.nodes[0],host,{flags:{},action(){}},()=>{});assert(host.all().find(e=>(e.className||'').startsWith('zg-story-answers')).className.includes('is-single-advance'));stopMid();
console.log('PASS continuation: RU/UK next uses arrow; real single choice preserved; intermediate pages use normal continuation.');
// Keyboard focus must never land on an advance button hidden by the typewriter.
Element.prototype.focus=function(){ctx.document.activeElement=this;};
Element.prototype.click=function(){this.onclick?.();};
Element.prototype.querySelectorAll=function(selector){return selector==='.zg-story-answers button'?this.all().filter(e=>(e.className||'').startsWith('zg-story-answers')).flatMap(e=>e.children.filter(b=>b.tag==='button')):[];};
const keyboardHost=new Element('div'),listeners=new Map();
keyboardHost.addEventListener=(name,fn,capture)=>{assert.equal(capture,name==='keydown'?true:undefined);listeners.set(name,fn);};
keyboardHost.removeEventListener=(name,fn,capture)=>{assert.equal(capture,name==='keydown'?true:undefined);assert.equal(listeners.get(name),fn);listeners.delete(name);};
let tick=null;ctx.setInterval=fn=>{tick=fn;return 1;};ctx.clearInterval=()=>{tick=null;};
ctx.window.matchMedia=()=>({matches:false});
const keyboardProject={nodes:[{id:'keyboard',text:'First',slides:[{text:'Second'},{text:'Third'}],links:[]}]};
let keyboardFinished=0;
const cancelKeyboard=api.dialogue(keyboardProject,keyboardProject.nodes[0],keyboardHost,{flags:{},action(){}},()=>keyboardFinished++);
const skin=keyboardHost.children[0],keyboardLine=()=>keyboardHost.all().find(e=>e.className==='zg-story-line');
const press=(extra={})=>{const e={key:' ',target:ctx.document.activeElement,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};listeners.get('keydown')(e);return e;};
assert.equal(ctx.document.activeElement,skin);
assert(press().prevented);assert.equal(keyboardLine().textContent,'First'); // reveal only
press();assert.equal(keyboardLine().textContent,'');assert.equal(ctx.document.activeElement,skin); // next page, stable focus
press({repeat:true});assert.equal(keyboardLine().textContent,''); // held space cannot skip pages
press();assert.equal(keyboardLine().textContent,'Second');
const inputEvent=press({target:{closest:()=>true}});assert(!inputEvent.prevented);assert.equal(keyboardLine().textContent,'Second');
keyboardLine().onclick();assert.equal(keyboardLine().textContent,'');assert.equal(ctx.document.activeElement,skin); // pointer continuation
press();assert.equal(keyboardLine().textContent,'Third');press();assert.equal(keyboardFinished,1);assert.equal(listeners.size,0);cancelKeyboard();
// Editing consumes spaces as text; commit restores dialogue keyboard focus.
ctx.window.matchMedia=()=>({matches:true});
const editProject={nodes:[{id:'edit-keyboard',text:'Original',textUk:'Оригінал',slides:[{text:'Next'}],links:[]}]};
const endKeyboardEdit=api.dialogue(editProject,editProject.nodes[0],keyboardHost,{flags:{},action(){},textEditing:{enabled:()=>true,save:()=>true}},()=>{});
keyboardLine().onclick();keyboardLine().innerText='Оригінал';const typing=press();assert(!typing.prevented);assert(typing.stopped);
press({key:'Enter',ctrlKey:true});assert.equal(ctx.document.activeElement,keyboardHost.children[0]);press();assert.equal(keyboardLine().textContent,'Next');endKeyboardEdit();assert.equal(listeners.size,0);
console.log('PASS keyboard: reveal/advance, stable focus, pointer continuation, held space, inputs, editing commit and listener cleanup.');
// Review an already chosen answer without replaying payment or entry actions.
let paidChoices=0,entryActions=0,labelSave;
const reviewProject={nodes:[{id:'choice-origin',text:'Choose',textUk:'Обери',links:[{id:'gift',to:'choice-result',label:'Give',labelUk:'Дати',cardGiveGuest:1}]},{id:'choice-result',text:'Result',textUk:'Результат',links:[]}]};
const endReview=api.dialogue(reviewProject,reviewProject.nodes[0],keyboardHost,{flags:{},action(){entryActions++;},canGiveGuest:()=>paidChoices===0,giveGuest:()=>{paidChoices++;return true;},textEditing:{enabled:()=>true,save(edit){labelSave=edit;return true;}}},()=>{});
const byClass=cls=>keyboardHost.all().find(e=>e.className===cls);
const answers=()=>keyboardHost.all().find(e=>(e.className||'').startsWith('zg-story-answers'));
answers().children[0].click();assert.equal(paidChoices,1);assert.equal(entryActions,2);
byClass('zg-card-edit-nav').children[0].click();assert.equal(keyboardLine().textContent,'Обери');assert.equal(answers().children.length,1);
answers().children[0].click();assert.equal(paidChoices,1);assert.equal(entryActions,2);
byClass('zg-card-choice-pencil').onclick({stopPropagation(){}});
const form=byClass('zg-card-choice-editor');form.children[0].value='Дати монету';form.children[1].onclick();assert.equal(labelSave.nodeId,'choice-origin');assert.equal(labelSave.linkId,'gift');assert.equal(labelSave.field,'labelUk');assert.equal(labelSave.expected,'Дати');assert.equal(reviewProject.nodes[0].links[0].labelUk,'Дати монету');assert.equal(reviewProject.nodes[0].links[0].label,'Give');
byClass('zg-card-edit-nav').children.at(-1).click();assert.equal(keyboardLine().textContent,'Результат');assert.equal(paidChoices,1);assert.equal(entryActions,2);endReview();
console.log('PASS review: return after choice, edit exact localized label, preserve RU, no duplicate payment/action, return to live page.');
// Re-selecting a historical answer restores its pre-choice state first.
let balance=10,pending=0;const retryFlags={};
const retryProject={nodes:[{id:'retry',text:'Choose',textUk:'Обери',links:[{id:'three',to:'paid',label:'3',cardGift:3,effect:'three'},{id:'one',to:'paid',label:'1',cardGift:1,effect:'one'},{id:'watch',to:'watch',label:'Watch'}]},{id:'paid',text:'Paid',links:[]},{id:'watch',text:'Watch',links:[]}]};
const stopRetry=api.dialogue(retryProject,retryProject.nodes[0],keyboardHost,{flags:retryFlags,action(){},textEditing:{enabled:()=>true},canGift:n=>pending===0&&balance>n,gift:n=>{if(pending||balance<=n)return false;balance-=n;pending=n;return true;},checkpoint(){const b=balance,p=pending,f={...retryFlags};return ()=>{balance=b;pending=p;Object.keys(retryFlags).forEach(k=>delete retryFlags[k]);Object.assign(retryFlags,f);};}},()=>{});
answers().children[0].click();assert.equal(balance,7);assert.equal(pending,3);assert(retryFlags.three);
byClass('zg-card-edit-nav').children[0].click();answers().children[1].click();assert.equal(balance,9);assert.equal(pending,1);assert(!retryFlags.three);assert(retryFlags.one);
byClass('zg-card-edit-nav').children[0].click();answers().children[2].click();assert.equal(balance,10);assert.equal(pending,0);assert.deepEqual(retryFlags,{});assert.equal(keyboardLine().textContent,'Watch');stopRetry();
ctx.clearTimeout=clearTimeout;ctx.setTimeout=setTimeout;
const restoreMemory={flags:{existing:true}},restoreDirector=api.director({nodes:[]},restoreMemory);const rollback=restoreDirector.checkpoint();restoreDirector.remember('abandoned');restoreDirector.complete('abandoned-node');rollback();assert(!restoreDirector.flags.abandoned);assert(!restoreMemory.flags.abandoned);assert(restoreDirector.flags.existing);restoreDirector.dispose();
console.log('PASS re-selection: gift 3 -> gift 1 -> watch restores money, pending guest and branch flags; remembered effects roll back.');
