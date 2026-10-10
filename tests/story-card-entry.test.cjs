const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('story-card-game.js','utf8');
class Element{constructor(tag,cls,text){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.classList={add(){},remove(){}};}append(...items){this.children.push(...items);}appendChild(item){this.append(item);}setAttribute(){}focus(){}remove(){this.removed=true;}querySelector(s){return s;}querySelectorAll(){return [];}}
let charged=0,exits=0,deals=0;const flights=[],timers=[];
const c={closed:false,nextDealTimer:0,timeout:0,game:undefined,people:[{name:'Hero'},{name:'NPC'}],roundNumber:1,ante:2,table:new Element(),modal:new Element(),el:(...a)=>new Element(...a),btn:(label,fn)=>Object.assign(new Element('button','',label),{click:fn}),t:ru=>ru,clearTimeout(){},setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},dealTimers:[],coinSounds:{play(){}},flyCoins(...args){flights.push(args);},runDeal(){deals++;},finish(){exits++;},dealRound(){charged++;}};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('    var awaitingEntry=false;'),source.indexOf('    function dealRound(){')),c);
c.start();assert.equal(charged,0);assert.equal(c.table.inert,true);assert.equal(c.modal.children.length,1);c.start();assert.equal(c.modal.children.length,1);
let invitation=c.modal.children[0];invitation.children.at(-2).click();invitation.children.at(-2).click();assert.equal(charged,1);assert.equal(c.table.inert,false);assert(invitation.removed);
c.start();c.modal.children.at(-1).children.at(-1).click();assert.equal(charged,1);assert.equal(exits,1);
c.game={players:[{contributed:2},{contributed:0},{contributed:2}]};c.collectAntes();assert.equal(deals,0);timers.sort((a,b)=>a.ms-b.ms).forEach(t=>t.fn());assert.equal(flights.length,2);assert.deepEqual(flights.map(f=>f[2]),[2,2]);assert.equal(deals,1);assert(flights[0][0].includes('seat-0'));assert(flights[1][0].includes('seat-2'));
c.ante=0;c.collectAntes();assert.equal(deals,2);assert.equal(flights.length,2);
c.ante=1;c.closed=true;timers.length=0;c.collectAntes();timers.forEach(t=>t.fn());assert.equal(deals,2);assert.equal(flights.length,2);
assert(!source.includes("el('span','zg-card-ante'"));
console.log('PASS entry: no charge before consent, one acceptance, decline without charge, only paid participants animate before dealing, free hand and cancellation.');
