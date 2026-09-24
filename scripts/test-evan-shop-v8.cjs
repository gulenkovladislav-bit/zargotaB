const assert=require('node:assert/strict');
const a=require('../story-content/evan/episode-1-courtyard-v7.json').episode,b=require('../story-content/evan/episode-1-courtyard-v8.json').episode;
assert.deepEqual(a.scenes,b.scenes);assert.deepEqual(a.quests,b.quests);
const get=id=>b.nodes.find(n=>n.id===id);
assert.deepEqual(get('evan-shop-arrival').beforeWorldActions,[]);
assert.equal(get('evan-breakfast').links[0].to,'evan-shop-door-view');
assert.equal(get('evan-shop-door-view').cameraEvent.y,68);
assert.equal(get('evan-shop-door-view').links[0].to,'evan-shop-open');
for(const [ids,expected]of [
 [['evan-money-ask','evan-money-1'],1],
 [['evan-money-ask','evan-money-quiz','evan-coin-right','evan-coin-platinum','evan-money-5'],5],
 [['evan-money-ask','evan-money-quiz','evan-coin-guess','evan-money-1'],1],
 [['evan-money-ask','evan-money-quiz','evan-coin-right','evan-coin-help','evan-money-1'],1],
 [['evan-money-ask','evan-money-10'],0]]){
 let reward=0;ids.forEach((id,i)=>{const n=get(id);if(i)assert(get(ids[i-1]).links.some(l=>l.to===id));for(const action of n.afterWorldActions||[])if(action.type==='giveItem')reward+=action.qty;});assert.equal(reward,expected);
}
for(const id of ['evan-money-1','evan-money-5']){assert.equal(get(id).afterWorldActions[0].actionId,'evan-pocket-money');assert.equal(get(id).repeatWhen,'evan-money-received');assert.equal(get(id).repeatId,'evan-money-reminder');}
console.log('PASS: reward branches 1/5/1/1/0, repeat guards, camera lead-in, unchanged scene layouts and quests');
