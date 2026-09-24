const assert=require('node:assert/strict'),r=require('../story-card-game-core');
const hand=(ranks,colors)=>ranks.map((rank,i)=>({id:String(i),rank,color:colors?colors[i]:i%2}));
const fixtures=[
 [11,[2,3,4,5,6,10],null,5],
 [12,[2,3,4,5,6,4],null,6],
 [13,[2,3,4,5,6,10],[0,0,0,0,0,1],5],
 [14,[2,3,4,5,6,7],[1,1,1,1,1,1],6],
 [6,[3,3,3,7,7,10],null,5]
];
for(const [type,ranks,colors,size]of fixtures){const result=r.six(hand(ranks,colors));assert.equal(result.type,type);assert.equal(r.combinationCards(result).length,size);assert.equal(new Set(r.combinationGroups(result).flat().map(c=>c.id)).size,6);}
assert.equal(r.order.length,15);assert.equal(new Set(r.order).size,15);
assert(r.compare(r.six(hand([3,4,5,6,7,1])).score,r.six(hand([2,3,4,5,6,10])).score)>0,'straight high card beats unrelated kicker');
assert.equal(r.six(hand([1,2,3,4,4,10])).type,1,'duplicate is not a fifth consecutive rank');
assert.equal(r.six(hand([7,8,9,10,1,3])).type,0,'no rank wrap');
assert.equal(r.six(hand([6,1,3,5,8,10])).type,0,'Hero card does not act as a wild card');
const c=hand([1,2,3,4,5,6,7,10]);assert.equal(r.best(c).type,7);assert.equal(r.best(c).score[1],7);
assert(r.strength(14)<r.strength(10),'exact availability: kingdom slightly rarer than six-card straight flush');
assert(r.strength(6)<r.strength(12),'exact availability: paired run slightly rarer than full house');
console.log('15 categories: five-card runs, paired run, straight flushes, core highlights, kickers and Hero clarification passed.');
