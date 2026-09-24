(function (root) {
  'use strict';
  // Independent, deterministic rules. Never reads or writes story inventory/storage.
  function deck(random) {
    var cards=[]; for(var rank=1;rank<=10;rank++)for(var color=0;color<2;color++)for(var copy=0;copy<2;copy++)cards.push({id:rank+'-'+color+'-'+copy,rank:rank,color:color});
    random=random||Math.random; for(var i=cards.length-1;i>0;i--){var j=Math.floor(random()*(i+1)),c=cards[i];cards[i]=cards[j];cards[j]=c;}return cards;
  }
  function compare(a,b){for(var i=0;i<Math.max(a.length,b.length);i++){var d=(a[i]||0)-(b[i]||0);if(d)return d;}return 0;}
  // Stable category IDs; strength order follows availability in eight drawn cards.
  var order=[0,1,2,3,4,11,5,6,12,7,13,8,9,14,10];
  function strength(type){return order.indexOf(type);}
  function six(cards){
    var counts={};cards.forEach(function(c){counts[c.rank]=(counts[c.rank]||0)+1;});
    var groups=Object.keys(counts).map(function(r){return {rank:+r,n:counts[r]};}).sort(function(a,b){return b.n-a.n||b.rank-a.rank;});
    var sorted=cards.map(function(c){return c.rank;}).sort(function(a,b){return b-a;});
    var n=groups.map(function(g){return g.n;}),flush=cards.length===6&&cards.every(function(c){return c.color===cards[0].color;}),straight=groups.length===6&&sorted[0]-sorted[5]===5;
    var type=n[0]===4&&n[1]===2?10:n[0]===3&&n[1]===3?9:n[0]===4?8:straight?7:n[0]===3&&n[1]===2?6:n[0]===2&&n[1]===2&&n[2]===2?5:n[0]===3?4:flush?3:n[0]===2&&n[1]===2?2:n[0]===2?1:0;
    var result={type:type,score:[strength(type)].concat(type===3||type===7||type===0?sorted:groups.map(function(g){return g.rank;})),cards:cards.slice()};
    function offer(id,tie,core){var candidate={type:id,score:[strength(id)].concat(tie),cards:cards.slice(),core:core};if(compare(candidate.score,result.score)>0)result=candidate;}
    function run(length,color){for(var high=10;high>=length;high--){var core=[];for(var rank=high;rank>high-length;rank--){var found=cards.find(function(c){return c.rank===rank&&(color==null||c.color===color);});if(!found)break;core.push(found);}if(core.length===length)return core;}return null;}
    var five=run(5,null);if(five){var rest=cards.filter(function(c){return !five.includes(c);}),high=five[0].rank;offer(11,[high].concat(rest.map(function(c){return c.rank;})),five);if(rest.some(function(c){return five.some(function(v){return v.rank===c.rank;});}))offer(12,[high,rest[0].rank],cards.slice());}
    for(var color=0;color<2;color++){var same=run(5,color),sixSame=run(6,color);if(same)offer(13,[same[0].rank].concat(cards.filter(function(c){return !same.includes(c);}).map(function(c){return c.rank;})),same);if(sixSame)offer(14,[sixSame[0].rank],sixSame);}
    return result;
  }
  function best(cards){
    if(cards.length<6||cards.length>8)throw new Error('Expected 6–8 cards');
    var result=null;function pick(start,hand){if(hand.length===6){var next=six(hand);if(!result||compare(next.score,result.score)>0)result=next;return;}for(var i=start;i<=cards.length-(6-hand.length);i++)pick(i+1,hand.concat(cards[i]));}pick(0,[]);return result;
  }
  function combinationCards(result){
    if(!result)return[];if(result.core)return result.core.slice();var cards=result.cards,counts={};cards.forEach(function(c){counts[c.rank]=(counts[c.rank]||0)+1;});
    if(result.type===0)return[cards.reduce(function(a,b){return a.rank>=b.rank?a:b;})];
    if(result.type===3||result.type===7)return cards.slice();
    return cards.filter(function(c){var n=counts[c.rank];return result.type===8?n===4:result.type===4?n===3:n>=2;});
  }
  function visibleBest(cards){if(cards.length<2||cards.length>8)throw new Error('Expected 2–8 visible cards');return cards.length<6?six(cards):best(cards);}
  function showdown(game){return game.done&&game.players.filter(function(p){return !p.folded;}).length>1?game.players.map(function(p,i){return !p.folded&&p.result?i:-1;}).filter(function(i){return i>=0;}):[];}
  function combinationGroups(result){
    if(!result)return[];
    var sorted=result.cards.slice().sort(function(a,b){return b.rank-a.rank;});
    if(result.core){var rest=sorted.filter(function(c){return !result.core.includes(c);});return rest.length?[result.core.slice(),rest]:[result.core.slice()];}
    if(result.type===3||result.type===7)return[sorted];
    var groups=[];sorted.forEach(function(c){var group=groups.find(function(g){return g[0].rank===c.rank;});if(group)group.push(c);else groups.push([c]);});
    return groups.sort(function(a,b){return b.length-a.length||b[0].rank-a[0].rank;});
  }
  function create(options,random){
    options=options||{};var count=Math.max(2,Math.min(5,Math.floor(Number(options.players)||4))),stack=Math.max(5,Math.min(1000,Math.floor(Number(options.stack)||20)));
    var game={deck:deck(random),players:[],board:[],round:0,pot:0,target:0,pending:[],turn:0,raised:false,done:false,winners:[],paid:0};
    for(var i=0;i<count;i++){var supplied=options.stacks&&options.stacks[i],money=Number.isFinite(supplied)?Math.max(0,Math.min(100000,Math.floor(supplied))):stack;game.players.push({hand:[game.deck.pop(),game.deck.pop()],stack:money,bet:0,contributed:0,folded:money===0});}
    game.pending=active(game);game.turn=game.pending[0];if(game.pending.length<2){game.done=true;game.winners=game.pending.slice();game.turn=-1;}return game;
  }
  function active(game){return game.players.map(function(p,i){return p.folded?-1:i;}).filter(function(i){return i>=0;});}
  function funded(game){return active(game).filter(function(i){return game.players[i].stack>0;});}
  function raiseLimit(game){
    if(game.done)return 0;
    var p=game.players[game.turn],opponents=funded(game).filter(function(i){return i!==game.turn;});
    if(!opponents.length)return 0;
    var coverage=Math.max.apply(null,opponents.map(function(i){var rival=game.players[i];return rival.contributed+rival.stack;}));
    return Math.max(0,Math.min(p.stack,coverage-p.contributed)+p.bet-game.target);
  }
  function legal(game){if(game.done)return[];var out=['fold','call'],p=game.players[game.turn];if(raiseLimit(game)>0)out.push('raise');if(p.stack>0&&(p.stack+p.bet<=game.target||raiseLimit(game)>0))out.push('allin');return out;}
  function settle(game){
    game.done=true;var alive=active(game),top=null;
    alive.forEach(function(i){var p=game.players[i];p.result=game.board.length===6?best(p.hand.concat(game.board)):null;var score=p.result?p.result.score:[0];var cmp=top?compare(score,top):1;if(cmp>0){top=score;game.winners=[i];}else if(cmp===0)game.winners.push(i);});
    game.payouts=game.players.map(function(){return 0;});game.pots=[];
    var levels=Array.from(new Set(game.players.map(function(p){return p.contributed;}).filter(function(n){return n>0;}))).sort(function(a,b){return a-b;}),previous=0,won=[];
    levels.forEach(function(level){var contributors=game.players.map(function(p,i){return p.contributed>=level?i:-1;}).filter(function(i){return i>=0;}),amount=(level-previous)*contributors.length;previous=level;
      if(contributors.length===1){game.payouts[contributors[0]]+=amount;game.pots.push({amount:amount,winners:contributors,refund:true});return;}
      var eligible=contributors.filter(function(i){return !game.players[i].folded;}),winners=[],score=null;
      eligible.forEach(function(i){var value=game.players[i].result?game.players[i].result.score:[0],cmp=score?compare(value,score):1;if(cmp>0){score=value;winners=[i];}else if(cmp===0)winners.push(i);});
      if(!winners.length)throw new Error('Pot without eligible player');
      winners.forEach(function(i,n){game.payouts[i]+=Math.floor(amount/winners.length)+(n<amount%winners.length?1:0);if(!won.includes(i))won.push(i);});game.pots.push({amount:amount,winners:winners});
    });
    if(won.length)game.winners=won;game.players.forEach(function(p,i){p.stack+=game.payouts[i];});game.paid=game.pot;game.pot=0;game.turn=-1;
  }
  function act(game,action,amount){
    if(legal(game).indexOf(action)<0)return false;
    if(action==='raise'){amount=amount==null?1:amount;if(!Number.isSafeInteger(amount)||amount<1||amount>raiseLimit(game))return false;}
    var index=game.turn,p=game.players[index],beforeStack=p.stack,beforeBet=p.bet;if(action==='fold')p.folded=true;
    else {var target=action==='allin'?Math.min(p.bet+p.stack,game.target+raiseLimit(game)):action==='raise'?game.target+amount:game.target;if(target>game.target){game.target=target;game.raised=true;game.pending=funded(game).filter(function(i){return i!==index;});}var cost=Math.min(p.stack,game.target-p.bet);p.stack-=cost;p.bet+=cost;p.contributed+=cost;game.pot+=cost;}
    if(action!=='fold')p.lastBet={round:game.round,added:beforeStack-p.stack,previous:beforeBet,total:p.bet,target:game.target,remaining:p.stack};
    game.pending=game.pending.filter(function(i){return i!==index&&!game.players[i].folded&&game.players[i].stack>0;});
    if(active(game).length===1){settle(game);return true;}
    var remaining=funded(game);if(remaining.length===1&&game.players[remaining[0]].bet>=game.target)game.pending=[];
    while(!game.pending.length){
      if(game.round===3){settle(game);return true;}
      var draw=[3,2,1][game.round++];while(draw--)game.board.push(game.deck.pop());
      game.target=0;game.raised=false;game.players.forEach(function(p){p.bet=0;});game.pending=funded(game);if(game.pending.length<2)game.pending=[];
    }
    game.turn=game.pending[0];return true;
  }
  function npc(game,random,style){
    random=random||Math.random;var p=game.players[game.turn],visible=p.hand.concat(game.board),counts={};visible.forEach(function(c){counts[c.rank]=(counts[c.rank]||0)+1;});
    var strong=Object.keys(counts).some(function(r){return counts[r]>=2;}),r=random();
    // Only own hand + revealed board; no knowledge of hidden cards or future draws.
    if(game.target>p.bet&&!strong&&r<(style==='cautious'?.4:.14))return 'fold';
    if(legal(game).includes('raise')&&(strong||style==='bold')&&r<.35)return 'raise';return 'call';
  }
  var api={visibleBest:visibleBest,order:order,strength:strength,deck:deck,compare:compare,six:six,best:best,combinationCards:combinationCards,combinationGroups:combinationGroups,showdown:showdown,create:create,legal:legal,act:act,npc:npc,raiseLimit:raiseLimit};
  root.ZargotaCardRules=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
