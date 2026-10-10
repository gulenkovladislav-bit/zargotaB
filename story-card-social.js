(function(w){
 'use strict';
 // Presentation only: this module never changes hands, bets or wallets.
 function chatter(director,options){
  const queue=[],used=new Set(),budgets={},resultRounds=new Set(),richSeen=new Set();let serial=0,lastAction=-100;
  function offer(speaker,event,round){
   const key=round+':'+speaker+':'+event;if(used.has(key))return false;
   const reply=director.reaction(speaker,event);if(!reply)return false;
   used.add(key);queue.push(Object.assign({},reply,{id:'card-social-'+round+'-'+(++serial),speaker,showPortrait:true,slides:reply.slides||[],links:[]}));return true;
  }
  return {
   action(c){
    const cap=Math.max(0,Math.min(4,options.actionRepliesPerRound??2));
    if((budgets[c.round]||0)>=cap||c.move-lastAction<2)return;
    const paid=c.after.contributed-c.beforeContributed;if(paid<=0)return;
    const event=paid>=c.beforeStack?'allin':c.action==='raise'||c.action==='allin'?'raise':c.after.stack>0&&c.after.stack<=2?'lowMoney':null;
    if(event&&offer(c.speaker,event,c.round)){budgets[c.round]=(budgets[c.round]||0)+1;lastAction=c.move;}
   },results(c){
    if(resultRounds.has(c.round))return;resultRounds.add(c.round);
    const candidates=c.winners.filter(i=>c.starts[i]>0&&c.players[i].stack>c.starts[i]),winner=candidates[(c.round-1)%Math.max(1,candidates.length)];
    if(winner!=null){const p=c.players[winner],net=p.stack-c.starts[winner];
     const rich=!richSeen.has(c.ids[winner])&&p.stack>=Math.max(12,(options.stacks?.[winner]||c.starts[winner])*2);
     if(rich)richSeen.add(c.ids[winner]);
     const event=rich?'rich':net>=Math.max(5,c.starts[winner])?'bigWin':'win';
     if(!offer(c.ids[winner],event,c.round))offer(c.ids[winner],'win',c.round);
    }
    // One loser responds, not a procession of four speeches after every hand.
    const losers=c.ids.map((id,i)=>i).filter(i=>c.starts[i]>0&&c.players[i].stack<c.starts[i]);
    const loser=losers.includes(0)?0:losers[(c.round-1)%Math.max(1,losers.length)];
    if(loser!=null)offer(c.ids[loser],c.players[loser].stack>0&&c.players[loser].stack<=2?'lowMoney':'loss',c.round);
   },take(){return queue.shift()||null;},clear(){queue.length=0;}
  };
 }
 function effects(root,ids){
  const active=new Set();
  function target(id){const i=ids.indexOf(id);return (i>=0&&root.querySelector('.seat-'+i+' .zg-card-token'))||Array.from(root.querySelectorAll('.zg-card-guest')).find(n=>n.dataset.speakerId===id)?.querySelector('img');}
  function play(action){
   if(action.kind==='returnCard'){Array.from(active).forEach(stop=>stop());return Promise.resolve();}
   const source=target(action.from),dest=target(action.to);if(!source||!dest)return Promise.resolve();
   if(w.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!dest.animate)return Promise.resolve();
   return new Promise(resolve=>{
    let ended=false;const animations=[],nodes=[];
    function finish(){if(ended)return;ended=true;animations.forEach(a=>a.cancel());nodes.forEach(n=>n.remove());active.delete(finish);resolve();}
    active.add(finish);
    const a=source.getBoundingClientRect(),b=dest.getBoundingClientRect(),r=root.getBoundingClientRect();
    if(action.kind==='stone'||action.kind==='coin'){
     const stone=document.createElement('span');stone.className=action.kind==='coin'?'zg-card-story-pebble is-copper':'zg-card-story-pebble';stone.setAttribute('aria-hidden','true');stone.style.left=(a.left+a.width/2-r.left)+'px';stone.style.top=(a.top+a.height/2-r.top)+'px';root.appendChild(stone);nodes.push(stone);
     const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2;
     const flight=stone.animate([{transform:'translate(0,0) rotate(0deg)'},{transform:'translate('+dx*.5+'px,'+(dy*.5-75)+'px) rotate(170deg)',offset:.5},{transform:'translate('+dx+'px,'+dy+'px) rotate(340deg)'}],{duration:900,easing:'linear',fill:'forwards'});animations.push(flight);
     flight.finished.then(()=>{if(ended)return;stone.remove();const hit=dest.animate([{transform:'translateX(0)'},{transform:'translateX(7px)'},{transform:'translateX(-5px)'},{transform:'translateX(0)'}],{duration:330});animations.push(hit);hit.finished.then(finish,finish);},finish);
    }else{
     const card=root.querySelector('.seat-'+ids.indexOf(action.to)+' .zg-card-hand .zg-card');
     if(!card){finish();return;}
     const rect=card.getBoundingClientRect(),dx=a.left+a.width/2-rect.left-rect.width/2,dy=a.top+a.height*.8-rect.top-rect.height/2;
     const slide=card.animate([{transform:'translate(0,0)'},{transform:'translate('+dx*.85+'px,'+dy*.85+'px) rotate(8deg)',offset:.72},{transform:'translate('+dx*.85+'px,'+dy*.85+'px) rotate(8deg)'}],{duration:2800,easing:'ease-in-out',fill:'forwards'});
     animations.push(slide);slide.finished.then(resolve,finish);

    }
   });
  }
  return {play,stop(){Array.from(active).forEach(stop=>stop());}};
 }
 w.ZargotaCardSocial={chatter,effects};
})(window);
