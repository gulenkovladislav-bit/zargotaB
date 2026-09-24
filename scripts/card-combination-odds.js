// Reproducible availability and best-category frequencies, not win odds or NPC play.
const rules=require('../story-card-game-core');
const trials=Number(process.argv[2]||300000);let seed=42;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const available=Array(15).fill(0),best=Array(15).fill(0);
function categories(cards){
  const counts=Array(11).fill(0),colors=[0,0],masks=[0,0];let all=0;
  for(const c of cards){counts[c.rank]++;colors[c.color]++;masks[c.color]|=1<<(c.rank-1);all|=1<<(c.rank-1);}
  const g=counts.filter(Boolean).sort((a,b)=>b-a),has=(mask,length)=>{for(let a=0;a<=10-length;a++)if(((mask>>a)&((1<<length)-1))===(1<<length)-1)return true;return false;};
  let paired=false;for(let a=0;a<=5;a++)if(((all>>a)&31)===31&&[1,2,3,4,5].some(i=>counts[a+i]>=2))paired=true;
  return [true,g[0]>=2,g[1]>=2,Math.max(...colors)>=6,g[0]>=3,g[2]>=2,g[0]>=3&&g[1]>=2,has(all,6),g[0]>=4,g[1]>=3,g[0]>=4&&g[1]>=2,has(all,5),paired,masks.some(m=>has(m,5)),masks.some(m=>has(m,6))];
}
for(let i=0;i<trials;i++){
  const cards=rules.deck(random).slice(0,8),matches=categories(cards),winner=rules.order.filter(id=>matches[id]).at(-1);
  if(i<500&&rules.best(cards).type!==winner)throw new Error('Fast estimator differs from actual evaluator');
  matches.forEach((v,id)=>{if(v)available[id]++;});best[winner]++;
}
function choose(n,k){if(k<0||k>n)return 0;let value=1;for(let i=1;i<=k;i++)value=value*(n-i+1)/i;return Math.round(value);}
const total=choose(40,8),exact=Array(15).fill(0);
function rankCounts(rank,left,counts,weight){
  if(rank===10){if(left)return;const g=counts.slice().sort((a,b)=>b-a),runs=k=>{const out=[];for(let a=0;a<=10-k;a++)if(counts.slice(a,a+k).every(n=>n>0))out.push(a);return out;},five=runs(5);
    const conditions={0:true,1:g[0]>=2,2:g[1]>=2,4:g[0]>=3,5:g[2]>=2,6:g[0]>=3&&g[1]>=2,7:runs(6).length>0,8:g[0]>=4,9:g[1]>=3,10:g[0]>=4&&g[1]>=2,11:five.length>0,12:five.some(a=>counts.slice(a,a+5).some(n=>n>=2))};
    for(const [id,present]of Object.entries(conditions))if(present)exact[id]+=weight;return;
  }
  for(let n=0;n<=Math.min(4,left);n++)rankCounts(rank+1,left-n,counts.concat(n),weight*choose(4,n));
}
rankCounts(0,8,[],1);
for(let n=6;n<=8;n++)exact[3]+=2*choose(20,n)*choose(20,8-n);
// Inclusion-exclusion over consecutive rank/color windows. Each required group has two copies.
for(const [id,length]of [[13,5],[14,6]]){
  const events=[];for(let color=0;color<2;color++)for(let a=0;a<=10-length;a++)events.push(((1<<length)-1)<<(color*10+a));
  for(let subset=1;subset<(1<<events.length);subset++){let mask=0,size=0;for(let e=0;e<events.length;e++)if(subset>>e&1){mask|=events[e];size++;}let required=0;for(let b=mask;b;b&=b-1)required++;if(required>8)continue;let ways=0;
    for(let doubled=0;doubled<=8-required;doubled++)ways+=choose(required,doubled)*2**(required-doubled)*choose(40-2*required,8-required-doubled);
    exact[id]+=(size%2?1:-1)*ways;
  }
}
for(let i=1;i<rules.order.length;i++)if(exact[rules.order[i]]>exact[rules.order[i-1]])throw new Error('Strength is not ordered by exact availability');
console.log(JSON.stringify({seed:42,trials,draw:8,deck:40,totalEightCardHands:total,method:'Exact availability via rank multiplicities and inclusion-exclusion; overlapping categories. Best-category frequencies from uniform samples; first 500 checked against actual evaluator.',categories:rules.order.map(id=>({id,exactAvailabilityPercent:exact[id]/total*100,sampledAvailabilityPercent:available[id]/trials*100,bestPercent:best[id]/trials*100}))},null,2));
