const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const window={ZargotaStorySequence:{cancel(){}}};vm.runInNewContext(fs.readFileSync('story-quest-actions.js','utf8'),{window,setTimeout,clearTimeout});
const api=window.ZargotaStoryQuestActions,action={type:'giveItem',showPickup:true,itemId:'gift'};let next,done=0,shows=0,grants=0;
const ctx={state:{},giveItem(){grants++;return {received:true,item:{itemId:'gift'},qty:1};},presentItem(r,a,callback){shows++;next=callback;return ()=>callback();}};
api.run([action],ctx,()=>done++);assert.equal(done,0);assert.equal(shows,1);assert.equal(grants,1);next();assert.equal(done,1);
ctx.giveItem=()=>({received:false});api.run([action],ctx,()=>done++);assert.equal(shows,1);assert.equal(done,2);
ctx.giveItem=()=>({received:true});const stop=api.run([action],ctx,()=>done++);stop();next();assert.equal(done,2,'Cancellation cannot continue dialogue');
console.log('PASS item reveal waits, skips duplicate rewards, and cancels safely');
