(function(w){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v)),integer=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
 function count(character,id){return (character?.inventoryItems||[]).filter(i=>i.itemId===id).reduce((n,i)=>n+integer(i.qty??1),0);}
 function setMoney(project,character,id,amount){
  const item=(project.storyItems||[]).concat(project.player?.inventoryItems||[]).find(i=>i.itemId===id);
  if(!item)throw Error('Missing currency: '+id);
  character.inventoryItems=(character.inventoryItems||[]).filter(i=>i.itemId!==id);
  if(amount>0)character.inventoryItems.push({...copy(item),qty:integer(amount),equipped:false});
 }
 function begin(project,run){
  const c=project.minigames?.towerClaw||{};if(!c.realMoney)return null;
  const currency=c.currencyItemId||'evan-copper-coin',cash=count(run.character,currency);if(!cash)return null;
  const memory=run.cardWallets||(run.cardWallets={players:{},sold:{},fundingUsed:false});
  if(memory.open)return null;
  const buyIn=Math.min(100000,cash),ids=[project.playerSpeakerId,...(c.opponents||[]).slice(0,3)],stacks=[buyIn];
  ids.slice(1).forEach((id,i)=>{if(memory.players[id]==null)memory.players[id]=integer(c.stacks?.[i+1]??20);stacks.push(memory.players[id]);});
  const sponsor=c.sponsor||{},seat=ids.indexOf(sponsor.playerId),contribution=integer(sponsor.amount);let funded=false;
  if(!memory.fundingUsed&&seat>0&&contribution){stacks[seat]+=contribution;memory.fundingUsed=true;funded=true;}
  const stake=seat>0?stacks[seat]:0;
  setMoney(project,run.character,currency,cash-buyIn);memory.open=true;let ended=false;
  function sell(game,players,id){
   const offer=(c.itemStakes||[]).find(o=>o.speakerId===id),index=players.indexOf(id),price=integer(offer?.value);
   const item=offer&&(project.storyItems||[]).find(i=>i.itemId===offer.itemId);
   if(ended||!game.done||index<1||game.players[index].stack!==0||!item||!price||memory.sold[offer.itemId]||game.players[0].stack<=price)return false;
   if(count(run.character,offer.itemId)>0)return false;
   game.players[0].stack-=price;game.players[index].stack+=price;memory.sold[offer.itemId]=true;
   run.character.inventoryItems.push({...copy(item),qty:1,equipped:false,storyUnread:true});return true;
  }
  return {stacks,sold:memory.sold,sell,finish(game,players,pending=0){
   if(ended)return;ended=true;memory.open=false;
   const balances=game?game.players.map(p=>integer(p.stack)+(game.done?0:integer(p.contributed))):stacks.slice();
   setMoney(project,run.character,currency,count(run.character,currency)+balances[0]);
   players.slice(1).forEach((id,i)=>memory.players[id]=balances[i+1]||0);
   if(pending&&c.guestSpeakerId)memory.players[c.guestSpeakerId]=pending;
   if(funded){const end=memory.players[sponsor.playerId]||0,profit=Math.max(0,end-stake),share=Math.max(0,Math.min(1,Number(sponsor.profitShare??.5)));
    const returned=end>=stake?contribution+Math.floor(profit*share):Math.floor(end*contribution/stake);
    memory.players[sponsor.playerId]=end-returned;memory.sponsorReturn=returned;memory.sponsorProfit=Math.max(0,returned-contribution);
    if(!game)memory.fundingUsed=false;
   }
  }};
 }
 function format(text,project,run){const c=project.minigames?.towerClaw||{},values={silver:count(run?.character,'evan-silver-coin'),copper:count(run?.character,c.currencyItemId||'evan-copper-coin'),lidaContribution:integer(c.sponsor?.amount),tarinStake:integer(c.stacks?.[1])+integer(c.sponsor?.amount),lidaReturn:run?.cardWallets?.sponsorReturn||0};return String(text||'').replace(/\{\{(silver|copper|lidaContribution|tarinStake|lidaReturn)\}\}/g,(_,key)=>values[key]);}
 w.ZargotaCardEconomy={begin,count,format};
})(window);
