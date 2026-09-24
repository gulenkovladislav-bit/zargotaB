const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let now=0,serial=0,wakes=0;const timers=new Map(),window={};
const ctx={window,Date:{now:()=>now},setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('story-card-events.js','utf8'),ctx);
function tick(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}
const nodes=[{id:'arrive',cardEvent:{enabled:true,phase:'board',boardCount:3,round:2,delaySeconds:2}},{id:'notice',cardEvent:{enabled:true,phase:'guestAppeared',delaySeconds:3}},{id:'later',cardEvent:{enabled:true,phase:'afterEvent',afterEventId:'notice',delaySeconds:1}}];
const d=window.ZargotaCardEvents.director({nodes},{},()=>wakes++),context={round:2,board:3};
assert.equal(d.next(context),null);assert.equal(timers.size,1);d.next(context);assert.equal(timers.size,1);
tick(2000);assert.equal(wakes,1);assert.equal(d.next({...context,board:5}).id,'arrive');assert.equal(d.next(context),null);
d.signal('guestAppeared');assert.equal(d.next(context),null);tick(2999);assert.equal(d.next(context),null);tick(1);assert.equal(d.next(context).id,'notice');
assert.equal(d.next(context),null);d.complete('notice');assert.equal(d.next(context),null);tick(1000);assert.equal(d.next(context).id,'later');assert.equal(d.next(context),null);
const other=window.ZargotaCardEvents.director({nodes:[{id:'wait',cardEvent:{enabled:true,phase:'roundStart',delaySeconds:10}}]},{},()=>wakes++);other.next({round:1,roundStart:true});const count=wakes;other.dispose();tick(20000);assert.equal(wakes,count);assert.equal(other.next({round:1,roundStart:true}),null);
console.log('Card timers: delayed stage, guest appearance, dialogue completion, single scheduling, once and disposal passed.');
