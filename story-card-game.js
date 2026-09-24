(function(w){
  'use strict';
  var base='assets/stories/cards/tower-claw/',active=null;
  var art=[['peasant','skeleton'],['militiaman','imp'],['bandit','ghoul'],['guard','treant'],['warrior','ogre'],['hero','vampire'],['knight','werewolf'],['sorceress','necromancer'],['baron','demon'],['king','lich']];
  var names=[['Крестьянин','Селянин','Скелет','Скелет'],['Ополченец','Ополченець','Бес','Біс'],['Разбойник','Розбійник','Гуль','Гуль'],['Стражник','Вартовий','Трент','Трент'],['Воитель','Воїн','Огр','Огр'],['Герой','Герой','Вампир','Вампір'],['Рыцарь','Лицар','Оборотень','Перевертень'],['Волшебница','Чарівниця','Некромант','Некромант'],['Барон','Барон','Демон','Демон'],['Король','Король','Лич','Ліч']];
  var combos=[['Старшая карта','Старша карта','Нет другой комбинации — сравниваем старшие ранги','Немає іншої комбінації — порівнюємо старші ранги'],['Дуэт','Дует','Пара: 2 одного ранга','Пара: 2 одного рангу'],['Два дуэта','Два дуети','Две пары: 2 + 2','Дві пари: 2 + 2'],['Династия','Династія','Флеш: 6 одного цвета','Флеш: 6 одного кольору'],['Отряд','Загін','Тройка: 3 одного ранга','Трійка: 3 одного рангу'],['Три дуэта','Три дуети','Три пары: 2 + 2 + 2','Три пари: 2 + 2 + 2'],['Дружина','Дружина','Фулл-хаус: 3 + 2 + 1','Фул-хаус: 3 + 2 + 1'],['Великий строй','Великий стрій','6 рангов подряд','6 рангів поспіль'],['Крепость','Фортеця','Каре: 4 одного ранга','Каре: 4 одного рангу'],['Войско','Військо','Две тройки: 3 + 3','Дві трійки: 3 + 3'],['Королевство','Королівство','Каре и пара: 4 + 2','Каре та пара: 4 + 2'],['Строй','Стрій','5 рангов подряд + свободная карта','5 рангів поспіль + вільна карта'],['Строй с дуэтом','Стрій з дуетом','5 рангов подряд + повтор одного из них','5 рангів поспіль + повтор одного з них'],['Единый строй','Єдиний стрій','5 рангов подряд одного цвета','5 рангів поспіль одного кольору'],['Великая династия','Велика династія','6 рангов подряд одного цвета','6 рангів поспіль одного кольору']];
  function uk(){return !!(w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk');}
  function t(a,b){return uk()?b:a;}function local(v,key){return uk()&&v[key+'Uk']||v[key]||'';}
  function el(tag,cls,text){var e=document.createElement(tag);e.className=cls||'';if(text!=null)e.textContent=text;return e;}
  function btn(text,fn){var b=el('button','',text);b.type='button';b.onclick=fn;return b;}
  function cardName(c){return names[c.rank-1][c.color*2+(uk()?1:0)];}
  function cardPath(c){var version=c.rank===3||c.color===1&&c.rank<=2?2:1;return base+art[c.rank-1][c.color]+'-rank-'+String(c.rank).padStart(2,'0')+'-v'+version+'.png';}
  function card(c,face,animate){
    var box=el('div','zg-card'+(!face?' is-back':'')+(animate?' is-dealt':'')),surface=el('div','zg-card-art'),img=el('img');
    img.src=face?cardPath(c):base+'approved-frame-sheet-v1.png';img.alt=face?cardName(c)+' · '+c.rank:t('Закрытая карта','Закрита карта');img.draggable=false;surface.appendChild(img);
    if(face){var name=el('span','zg-card-name',cardName(c));name.style.setProperty('--name-size',Math.min(14,104/cardName(c).length)+'cqw');surface.appendChild(name);}
    box.appendChild(surface);
    surface.addEventListener('animationend',function(event){if(event.animationName==='zg-card-deal'){box.classList.remove('is-dealt');box.style.animationDelay='';}});
    return box;
  }
  function exampleCards(type){
    var ranks=[[1,3,5,7,9,10],[2,2,4,6,8,10],[2,2,4,4,8,10],[1,3,5,7,9,10],[2,2,2,5,8,10],[2,2,4,4,8,8],[2,2,2,5,5,10],[1,2,3,4,5,6],[2,2,2,2,8,10],[2,2,2,5,5,5],[2,2,2,2,8,8],[2,3,4,5,6,10],[2,3,4,5,6,4],[2,3,4,5,6,10],[2,3,4,5,6,7]][type];
    return ranks.map(function(rank,i){return {id:'example-'+type+'-'+i,rank:rank,color:type===3||type===14||type===13&&i<5?0:i%2};});
  }
  function dealSequence(players){
    var steps=[{board:0},{board:1},{board:2}];
    for(var lap=0;lap<2;lap++)players.forEach(function(p,index){if(!p.folded)steps.push({seat:index,card:lap});});
    return steps;
  }
  function config(project){return project.minigames&&project.minigames.towerClaw||{};}
  function coinPile(amount,label,always){
    var pile=el('div','zg-money-pile'+(always?' is-hero-money':''));pile.tabIndex=0;pile.setAttribute('aria-label',label+': '+amount);
    var art=el('div','zg-money-art'),count=Math.max(0,Math.min(36,Math.floor(amount)));art.setAttribute('aria-hidden','true');
    for(var i=0;i<count;i++){var coin=el('i','zg-copper-coin','✦');coin.style.left=(27+(i*17%31))+'%';coin.style.bottom=(8+Math.floor(i/6)*3+(i*7%6))+'px';coin.style.rotate=((i*37%34)-17)+'deg';art.appendChild(coin);}
    if(!count)art.appendChild(el('span','zg-empty-purse','—'));pile.append(art,el('span','zg-money-amount',label+': '+amount));return pile;
  }
  function eventAudio(enabled){
    var current=null,seen=new Set();
    function stop(){if(current){current.pause();current.onended=current.onerror=null;current.removeAttribute('src');current.load();current=null;}}
    return {stop:stop,play:function(name,key){
      if(seen.has(key))return;seen.add(key);if(!enabled())return;stop();
      var sound=new Audio(base+'audio/'+(name==='deal'?'candidates-v2/casino/card-slide-4.mp3':name==='coins'?'candidates-v2/rpg/handleCoins2.mp3':name==='bank'?'candidates-v2/bank-coins.mp3':'approved/'+name+'.mp3'));current=sound;sound.volume=.5;
      sound.onended=sound.onerror=function(){if(current===sound)stop();};
      try{var pending=sound.play();if(pending&&pending.catch)pending.catch(function(){if(current===sound)stop();});}catch(e){stop();}
    }};
  }
  function match(project,nodeId){var c=config(project);return c.enabled===true&&!!c.afterNodeId&&c.afterNodeId===nodeId;}
  function observation(style,action,folded){
    if(folded)return t('После паса плечи расслабились. Теперь наблюдает за остальными.','Після пасу плечі розслабилися. Тепер спостерігає за іншими.');
    if(action==='raise')return t('Повысил ставку и ждёт реакции остальных. Уверенный жест — но он ещё ничего не доказывает.','Підвищив ставку й чекає на реакцію інших. Упевнений жест — але він ще нічого не доводить.');
    if(action==='call')return t('Остался в игре без лишних слов. По одному этому решению его карты не понять.','Залишився у грі без зайвих слів. За одним цим рішенням його карти не вгадати.');
    return style==='bold'?t('Держится вызывающе, словно заранее уверен в себе. Возможно, это просто манера играть.','Тримається зухвало, ніби заздалегідь упевнений у собі. Можливо, це просто манера грати.'):style==='cautious'?t('Не торопится, внимательно следит за столом. Осторожность не обязательно означает слабую руку.','Не квапиться, уважно стежить за столом. Обережність не обов’язково означає слабку руку.'):t('Пока держится спокойно. Стоит посмотреть, как он поведёт себя после следующей ставки.','Поки тримається спокійно. Варто подивитися, як він поведеться після наступної ставки.');
  }
  function open(project,options,done){
    if(active)active();options=options||config(project);var rules=w.ZargotaCardRules,closed=false,timeout=0,focus=document.activeElement;
    var wallet=options.wallet;
    var modal=el('dialog','zg-card-game'),table=el('div','zg-card-table'),game,previousBoard=0,reactions={},roundNumber=1,sessionDelta=0;
    var dealing=false,dealTimers=[],dealSounds=null;
    var initialDeal=true,lastActions={},lastPot=0,wasDone=false,purr=null,soundEnabled=options.soundEnabled!==false;
    var revealOrder=[],revealCursor=-1,revealComplete=true,resultFocus=-1,announcementKey='',inspection=null;
    var sounds=eventAudio(function(){return soundEnabled&&!closed;}),turnSerial=0,linkTimer=0,nextDealTimer=0;
    var storyMemory=options.storyMemory||{},visit=(Number(storyMemory.visits)||0)+1;storyMemory.visits=visit;
    var director=w.ZargotaCardEvents?w.ZargotaCardEvents.director(project,storyMemory,function(){if(!closed&&game)render();}):null,storyBusy=false,storyStop=null,storyAudio=null,crunchContext=null,guestVisible=!!options.guestBalance,guestStones=false,guestPending=options.guestBalance||0,guestJoined=false,hiddenGuestCard=false,outcomeRound=0,suppressStory=false,guestArrivedAt=0;
    var social=director&&options.socialReplies&&w.ZargotaCardSocial?w.ZargotaCardSocial.chatter(director,options):null,storyFx=null,moveSerial=0,roundStacks=[];
    function eventContext(){var context={round:roundNumber,visit:visit,roundStart:!!game&&!game.done&&game.board.length===0,board:game?game.board.length:0,roundEnd:!!game&&game.done&&revealComplete&&(payoutCollected||game.paid===0),participants:ids||[]};var guest=game&&guestJoined&&game.players[ids.indexOf(options.guestSpeakerId)];if(director){director.flags.guestBroke=!!guest&&guest.stack===0;director.flags.guestPlaying=!!guest&&!guest.folded&&!game.done;}if(director&&game)(options.itemStakes||[]).forEach(function(o){var i=ids.indexOf(o.speakerId);director.flags['broke:'+o.speakerId]=i>0&&game.players[i].stack===0;});return context;}
    function stopStorySound(){if(storyAudio){storyAudio.pause();storyAudio.removeAttribute('src');storyAudio.load();storyAudio=null;}if(crunchContext){crunchContext.close().catch(function(){});crunchContext=null;}}
    function storySound(src){
      stopStorySound();if(!src||!soundEnabled||closed)return;
      if(src==='crunch'){
        var Context=w.AudioContext||w.webkitAudioContext;if(!Context)return;var ctx=crunchContext=new Context(),buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.35),ctx.sampleRate),samples=buffer.getChannelData(0);
        for(var i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.pow(1-i/samples.length,3)*(Math.sin(i/ctx.sampleRate*85)>0?.6:.12);
        var source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=.12;source.connect(gain);gain.connect(ctx.destination);source.onended=function(){if(crunchContext===ctx)crunchContext=null;ctx.close().catch(function(){});};ctx.resume().catch(function(){});source.start();
      }else{storyAudio=new Audio(src);storyAudio.volume=.4;var play=storyAudio.play();if(play&&play.catch)play.catch(function(){});}
    }
    function decorateStory(){
      table.classList.toggle('has-fifth-seat',guestJoined);
      table.querySelectorAll('.zg-card-guest').forEach(function(n){n.remove();});
      if(guestVisible&&!guestJoined){var s=(project.speakers||{})[options.guestSpeakerId]||{},guest=el('aside','zg-card-guest');guest.dataset.speakerId=options.guestSpeakerId;var elapsed=performance.now()-guestArrivedAt;if(elapsed>=2500)guest.style.animation='none';else guest.style.animationDelay=(-elapsed)+'ms';if(s.portrait){var image=el('img');image.src=s.portrait;image.alt=local(s,'name');guest.appendChild(image);}guest.appendChild(el('b','',local(s,'name')));if(guestStones)guest.appendChild(el('span','zg-guest-stones','● ◕ ●'));if(guestPending)guest.appendChild(coinPile(guestPending,t('Медь','Мідь'),true));table.appendChild(guest);}
      table.querySelectorAll('.seat-4 .zg-card-hand > .zg-card').forEach(function(view,i){view.classList.toggle('is-story-hidden',hiddenGuestCard&&i===1&&!game.done);});
    }
    function canGift(amount){return Number.isSafeInteger(amount)&&amount>0&&guestVisible&&!guestJoined&&!guestPending&&!!options.guestSpeakerId&&ids.length<5&&game&&game.players[0].stack>amount&&!game.done;}
    function gift(amount){if(!canGift(amount))return false;game.players[0].stack-=amount;guestPending=amount;guestStones=false;decorateStory();var label=table.querySelector('.seat-0 .zg-money-pile');if(label)label.replaceWith(coinPile(game.players[0].stack,t('Медь','Мідь'),true));return true;}
    function canTopUp(amount){var index=ids.indexOf(options.guestSpeakerId);return Number.isSafeInteger(amount)&&amount>0&&guestJoined&&index>0&&game.done&&revealComplete&&(payoutCollected||game.paid===0)&&game.players[index].stack===0&&game.players[0].stack>amount;}
    function topUp(amount){if(!canTopUp(amount))return false;game.players[0].stack-=amount;game.players[ids.indexOf(options.guestSpeakerId)].stack+=amount;director.flags.guestBroke=false;return true;}
    function canPurchase(id){var offer=(options.itemStakes||[]).find(function(o){return o.speakerId===id;}),i=ids.indexOf(id);return !!wallet&&!!offer&&game?.done&&revealComplete&&(payoutCollected||game.paid===0)&&i>0&&game.players[i].stack===0&&!wallet.sold[offer.itemId]&&Number.isSafeInteger(offer.value)&&offer.value>0&&game.players[0].stack>offer.value;}
    function purchase(id){return canPurchase(id)&&wallet.sell(game,ids,id);}
    function storyAction(action){
      if((action.kind==='stone'||action.kind==='reachCard')&&storyFx)return storyFx.play(action);
      if(action.kind==='example'){var preview=el('div','zg-card-teaching-example');preview.append(el('small','',t('Пример: дуэт — два одинаковых ранга','Приклад: дует — два однакові ранги')),card({rank:2,color:0},true,false),card({rank:2,color:1},true,false));table.appendChild(preview);}
      if(action.kind==='guest'){guestVisible=true;guestArrivedAt=performance.now();director?.signal?.('guestAppeared');}if(action.kind==='stones'){guestVisible=true;guestStones=true;}if(action.kind==='hideCard'&&guestJoined)hiddenGuestCard=true;if(action.kind==='restoreCard')hiddenGuestCard=false;
      if(action.sound)storySound(action.sound);decorateStory();
    }
    function runStory(node,next){
      if(node.cardEvent&&node.cardEvent.silent&&node.cardAction?.kind!=='stone'&&node.cardAction?.kind!=='reachCard'){storyAction(node.cardAction||{});director?.complete?.(node.id);next();return;}
      storyBusy=true;clearTimeout(timeout);clearTimeout(linkTimer);clearTimeout(nextDealTimer);clearTimeout(payoutTimer);cancelAnimationFrame(countFrame);table.inert=true;
      if(awardCount&&!payoutCollecting)awardCount.transferScheduled=false;
      storyStop=w.ZargotaCardEvents.dialogue(project,node,modal,{flags:director.flags,format:function(text){return text.replace(/\{\{stake:([^}]+)\}\}/g,function(_,id){return (options.itemStakes||[]).find(function(o){return o.speakerId===id;})?.value||0;});},canGift:canGift,gift:gift,canTopUp:canTopUp,topUp:topUp,canPurchase:canPurchase,purchase:purchase,complete:function(id){director?.complete?.(id);},remember:function(flag){director.remember(flag);},action:storyAction},function(){storyStop=null;storyBusy=false;table.inert=false;stopStorySound();if(!closed){director?.complete?.(node.id);next();}});
    }
    function canContinue(){return game.players[0].stack>0&&game.players.filter(function(p){return p.stack>0;}).length+(guestPending>0?1:0)>1;}
    function continueSession(){if(closed||storyBusy||!game.done||!revealComplete||game.paid>0&&!payoutCollected||!canContinue())return;roundNumber++;start();}
    function drawCombinationLinks(){
      if(closed||resultFocus<0)return;
      var area=table.getBoundingClientRect(),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','zg-combo-links');svg.setAttribute('aria-hidden','true');svg.setAttribute('viewBox','0 0 '+area.width+' '+area.height);
      var order=0;function connect(a,b){var x=a.getBoundingClientRect(),y=b.getBoundingClientRect(),line=document.createElementNS('http://www.w3.org/2000/svg','path');var ax=x.left+x.width/2-area.left,ay=x.top+x.height*.2-area.top,bx=y.left+y.width/2-area.left,by=y.top+y.height*.2-area.top;line.setAttribute('d','M '+ax+' '+ay+' Q '+((ax+bx)/2)+' '+(Math.min(ay,by)-24)+' '+bx+' '+by);line.setAttribute('pathLength','1');line.style.animationDelay=(order++*140)+'ms';svg.appendChild(line);}
      var cards=Array.from(table.querySelectorAll('.zg-card-board .is-combo-card'));
      for(var n=1;n<cards.length;n++)connect(cards[n-1],cards[n]);
      table.querySelectorAll('.seat-'+resultFocus+' .zg-card-hand .is-combo-card').forEach(function(hand){var match=cards.find(function(c){return c.dataset.cardId===hand.dataset.cardId;});if(match)connect(hand,match);});
      table.appendChild(svg);
    }
    var coinSounds=eventAudio(function(){return soundEnabled&&!closed;}),moneySerial=0,payoutCollected=false,payoutCollecting=false,payoutTimer=0,countFrame=0,awardAnnounced=false;
    function stopDeal(){dealTimers.forEach(clearTimeout);dealTimers=[];if(dealSounds)dealSounds.stop();table.querySelectorAll('.zg-deal-flight').forEach(function(flight){flight.remove();});dealing=false;table.classList.remove('is-dealing');}
    function flyDealtCard(view,deck,reveal){
      if(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches){view.classList.remove('is-deal-pending');return;}
      var area=table.getBoundingClientRect(),rect=view.getBoundingClientRect(),width=view.offsetWidth||rect.width,height=view.offsetHeight||rect.height;
      // Move an entire card above the table, never its art inside the cropped back.
      var flight=el('div','zg-deal-flight'),copy=reveal?card(null,false,false):view.cloneNode(true);flight.setAttribute('aria-hidden','true');flight.inert=true;
      copy.classList.remove('is-deal-pending','is-dealt','is-inspectable','is-expanded');copy.style.animationDelay='';
      flight.style.left=(rect.left+rect.width/2-area.left-width/2)+'px';flight.style.top=(rect.top+rect.height/2-area.top-height/2)+'px';flight.style.width=width+'px';flight.style.height=height+'px';
      flight.style.setProperty('--flight-x',(deck.left+deck.width/2-rect.left-rect.width/2)+'px');flight.style.setProperty('--flight-y',(deck.top+deck.height/2-rect.top-rect.height/2)+'px');
      flight.style.setProperty('--flight-scale-x',deck.width/width);flight.style.setProperty('--flight-scale-y',deck.height/height);
      var angle=w.getComputedStyle(view).rotate;flight.style.setProperty('--flight-angle',angle&&angle!=='none'?angle:'0deg');flight.appendChild(copy);table.appendChild(flight);
      var landed=false;function land(){if(landed)return;landed=true;flight.remove();if(!closed){view.classList.remove('is-deal-pending');if(reveal)view.classList.add('is-revealed');}}
      flight.addEventListener('animationend',function(event){if(event.target===flight)land();});dealTimers.push(setTimeout(land,740));
    }
    function runDeal(boardSteps){
      dealSounds=eventAudio(function(){return soundEnabled&&!closed;});
      var sequence=boardSteps||dealSequence(game.players),deck=table.querySelector('.zg-card-deck').getBoundingClientRect();
      sequence.forEach(function(step,index){
        var view=step.board!=null?table.querySelector('.zg-card-board').children[step.board]:table.querySelector('.seat-'+step.seat+' .zg-card-hand').children[step.card];
        view.classList.remove('is-revealed');view.style.animationDelay='';view.classList.add('is-deal-pending');
        dealTimers.push(setTimeout(function(){
          if(closed||!dealing)return;
          flyDealtCard(view,deck,step.reveal);
          dealSounds.play('deal',roundNumber+':deal:'+index);
        },300+index*380));
      });
      dealTimers.push(setTimeout(function(){if(closed)return;stopDeal();if(game.turn===0)turnSound();render();},300+(sequence.length-1)*380+(boardSteps?1250:750)));
    }
    function flyCoins(from,to,amount){
      if(!from||!to||amount<=0)return;var area=table.getBoundingClientRect(),a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
      if(w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      for(var i=0;i<Math.min(12,Math.max(1,Math.ceil(Math.sqrt(amount))));i++){var coin=el('i','zg-copper-coin zg-money-flight','✦');coin.setAttribute('aria-hidden','true');coin.style.left=(a.left+a.width/2-area.left)+'px';coin.style.top=(a.top+a.height/2-area.top)+'px';coin.style.setProperty('--chip-x',(b.left+b.width/2-a.left-a.width/2)+'px');coin.style.setProperty('--chip-y',(b.top+b.height/2-a.top-a.height/2)+'px');coin.style.animationDelay=(i*45)+'ms';coin.addEventListener('animationend',function(){this.remove();});table.appendChild(coin);}
    }
    var awardCount=null;
    function scheduleBankTransfer(){
      if(closed||payoutCollected||payoutCollecting||!awardCount||awardCount.transferScheduled)return;
      awardCount.transferScheduled=true;payoutTimer=setTimeout(function(){if(!closed)collectBank();},2000);
    }
    function countAward(node,amount){
      if(!awardAnnounced){awardAnnounced=true;awardCount={start:null,value:0,done:false};coinSounds.play('bank',roundNumber+':count');}
      if(!awardCount||awardCount.done||payoutCollecting||w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches){node.textContent=amount;scheduleBankTransfer();return;}
      node.textContent=awardCount.value;
      function tick(now){if(closed||!node.isConnected)return;if(awardCount.start===null)awardCount.start=now;var fraction=Math.min(1,(now-awardCount.start)/1800);awardCount.value=Math.floor(amount*(1-Math.pow(1-fraction,2)));node.textContent=awardCount.value;if(fraction<1)countFrame=requestAnimationFrame(tick);else{awardCount.done=true;node.textContent=amount;scheduleBankTransfer();}}
      countFrame=requestAnimationFrame(tick);
    }
    function collectBank(){
      if(!game.done||!revealComplete||payoutCollected||payoutCollecting)return;
      payoutCollecting=true;render();coinSounds.play('bank',roundNumber+':bank');
      (game.payouts?game.payouts.map(function(n,i){return n>0?i:-1;}).filter(function(i){return i>=0;}):game.winners).forEach(function(index){flyCoins(table.querySelector('.zg-central-bank'),table.querySelector('.seat-'+index+' .zg-money-pile'),(game.payouts?game.payouts[index]:game.paid/game.winners.length));});
      payoutTimer=setTimeout(function(){if(closed)return;payoutCollected=true;payoutCollecting=false;render();game.winners.forEach(function(index){var pile=table.querySelector('.seat-'+index+' .zg-money-pile');if(pile)pile.classList.add('is-paid');});},1250);
    }
    function turnSound(){sounds.play('turn',roundNumber+':turn:'+(++turnSerial));}
    function revealSound(){if(resultFocus<0)return;var result=game.players[resultFocus].result;if(result)sounds.play(rules.strength(result.type)>=9?'strong':'combination',roundNumber+':reveal:'+resultFocus);}
    function outcomeSound(){if(!game.winners.includes(0))sounds.play('loss',roundNumber+':loss');}
    function revealed(index){return revealComplete?revealOrder.includes(index):revealOrder.indexOf(index)>=0&&revealOrder.indexOf(index)<=revealCursor;}
    function epicLevel(type){var power=rules.strength(type);return power>=12?4:power>=9?3:power>=4?2:power>=1?1:0;}
    function skipReveal(){sounds.stop();revealCursor=revealOrder.length-1;revealComplete=true;resultFocus=game.winners[0];outcomeSound();render();}
    function markCombination(view,c,index){
      if(resultFocus<0||!c||index!=null&&index!==resultFocus)return;
      var result=game.players[resultFocus].result;if(!result)return;
      var core=rules.combinationCards(result).some(function(v){return v.id===c.id;}),selected=result.cards.some(function(v){return v.id===c.id;});
      view.classList.add(core?'is-combo-card':selected?'is-combo-kicker':'is-outside-combo');view.dataset.epic=String(epicLevel(result.type));view.dataset.cardId=c.id;
    }
    function clearLiveCombo(){table.querySelectorAll('.is-live-combo').forEach(function(node){node.classList.remove('is-live-combo');});table.querySelectorAll('.zg-live-combo-label').forEach(function(node){node.remove();});}
    function showLiveCombo(){
      clearLiveCombo();if(dealing||game.done||game.players[0].folded||!game.board.length)return;
      var result=rules.visibleBest(game.players[0].hand.concat(game.board)),core=rules.combinationCards(result);
      function mark(selector,cards){table.querySelectorAll(selector).forEach(function(node,index){if(cards[index]&&core.some(function(c){return c.id===cards[index].id;}))node.classList.add('is-live-combo');});}
      if(result.type!==0){mark('.seat-0 .zg-card-hand .zg-card',game.players[0].hand);mark('.zg-card-board > .zg-card',game.board);}
      var label=el('div','zg-live-combo-label',result.type===0?t('Пока нет комбинации','Поки немає комбінації'):combos[result.type][uk()?1:0]);label.setAttribute('role','status');table.appendChild(label);
    }
    var ids=[project.playerSpeakerId].concat((options.opponents||[]).slice(0,4));
    while(ids.length<4)ids.push('');
    function person(id,i){var s=(project.speakers||{})[id]||{};return {name:local(s,'name')||(i?t('Игрок ','Гравець ')+i:t('Вы','Ви')),portrait:s.portrait||'',style:(options.styles||[])[i-1]||'balanced'};}
    var people=ids.map(person);
    modal.setAttribute('aria-label',t('Мини-игра · Башня и коготь','Мінігра · Вежа та кіготь'));
    modal.appendChild(table);document.body.appendChild(modal);
    var disabled=Array.from(document.body.children).filter(function(e){return e!==modal&&e.tagName!=='SCRIPT'&&e.tagName!=='STYLE';}).map(function(e){var before=e.inert;e.inert=true;return [e,before];});
    function dispose(){if(closed)return;closed=true;if(wallet)wallet.finish(game,ids,guestPending);director?.dispose?.();if(storyFx)storyFx.stop();if(storyStop)storyStop();stopStorySound();stopDeal();clearTimeout(timeout);clearTimeout(linkTimer);clearTimeout(nextDealTimer);clearTimeout(payoutTimer);cancelAnimationFrame(countFrame);sounds.stop();coinSounds.stop();if(purr){purr.pause();purr.onplaying=purr.onended=purr.onerror=null;purr.removeAttribute('src');purr.load();purr=null;}modal.close();modal.remove();disabled.forEach(function(v){v[0].inert=v[1];});if(focus&&focus.isConnected)focus.focus();if(active===dispose)active=null;}
    function finish(){var result={status:game&&game.done?'completed':'cancelled',won:!!game&&game.done&&game.winners.includes(0),delta:sessionDelta,rounds:roundNumber};dispose();if(done)done(result);}
    active=dispose;modal.addEventListener('cancel',function(e){e.preventDefault();finish();});
    modal.addEventListener('keydown',function(e){e.stopPropagation();});
    function inspect(index){
      if(storyBusy||dealing||payoutCollecting||game.done&&!revealComplete)return;
      clearTimeout(timeout);table.querySelectorAll('.zg-card-observation,.zg-card-help').forEach(function(e){e.remove();});
      var panel=el('aside','zg-card-observation');panel.setAttribute('aria-label',people[index].name);panel.appendChild(el('h3','',people[index].name));
      function positionPanel(){var anchor=table.querySelector('.seat-'+index+' .zg-card-token'),area=table.getBoundingClientRect();if(!anchor)return;var rect=anchor.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight;
        panel.style.left=Math.max(12,Math.min(area.width-width-12,rect.left-area.left+rect.width/2-width/2))+'px';
        panel.style.top=Math.max(12,rect.top-area.top-height-12)+'px';
      }
      var analyze=btn(inspection?t('Анализ использован','Аналіз використано'):t('Присмотреться · 1 за раздачу','Придивитися · 1 за роздачу'),function(){
        if(inspection)return;
        inspection={index:index,text:observation(people[index].style,lastActions[index],game.players[index].folded)};
        analyze.disabled=true;analyze.textContent=t('Анализ использован','Аналіз використано');panel.appendChild(el('p','',inspection.text));positionPanel();
      });analyze.disabled=!!inspection;panel.appendChild(analyze);
      if(inspection)panel.appendChild(el('p','',inspection.index===index?inspection.text:t('В этой раздаче ты уже присмотрелся к другому игроку.','У цій роздачі ти вже придивився до іншого гравця.')));
      if(revealed(index))panel.appendChild(btn(t('Показать комбинацию','Показати комбінацію'),function(){resultFocus=index;render();}));
      panel.appendChild(btn(t('Вернуться к игре','Повернутися до гри'),function(){render();}));table.appendChild(panel);positionPanel();panel.querySelector('button:not(:disabled)').focus();
    }
    function catStatus(message,playing){var cat=table.querySelector('.zg-card-cat');if(cat){cat.classList.add('has-message');cat.classList.toggle('is-purring',!!playing);cat.querySelector('span').textContent=message;}}
    function petCat(){
      if(!soundEnabled){catStatus(t('Включи звук наверху','Увімкни звук угорі'),false);return;}
      if(purr&&!purr.paused)return;
      if(!purr){purr=new Audio(base+'audio/cat-purr-0436.mp3');purr.volume=.35;purr.onplaying=function(){if(!closed)catStatus(t('Мр-р-р…','Мр-р-р…'),true);};purr.onended=function(){if(!closed)catStatus(t('Погладить кота','Погладити кота'),false);};purr.onerror=function(){if(!closed)catStatus(t('Звук не загрузился · попробуй ещё','Звук не завантажився · спробуй ще'),false);};}
      purr.currentTime=0;var play=purr.play();if(play&&play.catch)play.catch(function(){if(!closed)catStatus(t('Нажми ещё раз для звука','Натисни ще раз для звуку'),false);});
    }
    function help(){
      var old=table.querySelector('.zg-card-help');if(old){render();return;}clearTimeout(timeout);
      table.querySelectorAll('.zg-card.is-expanded').forEach(function(c){c.classList.remove('is-expanded');c.setAttribute('aria-expanded','false');});
      table.querySelectorAll('.zg-card-observation').forEach(function(p){p.remove();});
      var drawer=el('aside','zg-card-help');drawer.setAttribute('aria-label',t('Комбинации и примеры карт','Комбінації та приклади карт'));
      var header=el('header','zg-card-help-header');header.append(el('h2','',t('Комбинации','Комбінації')),btn('×',function(){render();}));header.lastChild.setAttribute('aria-label',t('Закрыть справку','Закрити довідку'));drawer.appendChild(header);
      drawer.appendChild(el('p','zg-card-help-intro',t('От слабой к сильной. Золотом выделена основа комбинации.','Від слабкої до сильної. Золотом виділено основу комбінації.')));
      rules.order.forEach(function(i,position){var c=combos[i];
        var row=el('section','zg-card-help-row');row.append(el('h3','',(position+1)+'. '+c[uk()?1:0]),el('small','',c[uk()?3:2]));
        var examples=exampleCards(i),core=rules.combinationCards(rules.six(examples)),strip=el('div','zg-card-help-examples');
        examples.forEach(function(example){var view=card(example,true,false);view.classList.add(core.some(function(v){return v.id===example.id;})?'is-example-core':'is-example-kicker');strip.appendChild(view);});
        row.appendChild(strip);drawer.appendChild(row);
      });
      drawer.appendChild(el('p','zg-card-help-intro',t('Лучшая шестёрка из восьми. 40 карт, по две копии каждого персонажа. Совпадение по рангу; цвет не решает ничью. Равные руки делят банк.','Найкраща шістка з восьми. 40 карт, по дві копії кожного персонажа. Збіг за рангом; колір не вирішує нічию. Рівні руки ділять банк.')));
      table.appendChild(drawer);drawer.querySelector('button').focus();
    }
    var startingStack=0;
    function start(){hiddenGuestCard=false;sounds.stop();inspection=null;stopDeal();coinSounds.stop();clearTimeout(payoutTimer);payoutCollected=false;payoutCollecting=false;awardAnnounced=false;var stacks=game?game.players.map(function(p){return p.stack;}):(options.stacks||[options.stack||20,14,27,9]);if(guestPending&&!guestJoined){ids.push(options.guestSpeakerId);people.push(person(options.guestSpeakerId,4));people[4].style=options.guestStyle||'cautious';stacks=stacks.concat(guestPending);guestPending=0;guestJoined=true;director.flags.guestJoined=true;}game=rules.create({players:people.length,stack:options.stack,stacks:stacks});roundStacks=game.players.map(function(p){return p.stack;});if(social)social.clear();startingStack=game.players[0].stack;previousBoard=0;reactions={};lastActions={};initialDeal=true;lastPot=0;wasDone=false;revealOrder=[];revealCursor=-1;revealComplete=true;resultFocus=-1;announcementKey='';dealing=!game.done;table.classList.toggle('is-dealing',dealing);render();if(dealing)runDeal();}
    function move(action,amount){if(closed||storyBusy||game.done||dealing)return;var actor=game.turn,oldRound=game.round,oldBoard=game.board.length,oldPot=game.pot,beforeStack=game.players[actor].stack,beforeContributed=game.players[actor].contributed;if(rules.act(game,action,amount)){var payment=(game.done?game.paid:game.pot)-oldPot;lastActions[actor]=action;moveSerial++;if(social)social.action({round:roundNumber,move:moveSerial,speaker:ids[actor],action:action,beforeStack:beforeStack,beforeContributed:beforeContributed,after:game.players[actor]});if(game.done){sessionDelta+=game.players[0].stack-startingStack;revealOrder=rules.showdown(game);revealCursor=revealOrder.length?0:-1;revealComplete=!revealOrder.length;resultFocus=revealOrder[0]==null?-1:revealOrder[0];if(revealComplete)outcomeSound();else revealSound();}else if(game.turn===0&&!(oldBoard>=3&&game.board.length>oldBoard)&&(actor!==0||oldRound!==game.round))turnSound();suppressStory=!game.done&&oldBoard>=3&&game.board.length>oldBoard;render();suppressStory=false;if(!game.done&&oldBoard>=3&&game.board.length>oldBoard){dealing=true;table.classList.add('is-dealing');clearTimeout(timeout);table.querySelectorAll('[data-card-action]').forEach(function(button){button.disabled=true;});var steps=[];for(var slot=oldBoard;slot<game.board.length;slot++)steps.push({board:slot,reveal:true});runDeal(steps);}if(payment>0){coinSounds.play('coins','bet:'+(++moneySerial));flyCoins(table.querySelector('.seat-'+actor+' .zg-money-pile'),table.querySelector('.zg-central-bank'),payment);}}}
    var pendingHeroReply=null;
    function render(){
      if(storyBusy||dealing&&!initialDeal)return;
      var eventNode=!payoutCollecting&&!initialDeal&&!dealing&&!suppressStory&&director?director.next(eventContext()):null;
      if(game.done&&revealComplete&&outcomeRound!==roundNumber){outcomeRound=roundNumber;if(social)social.results({round:roundNumber,ids:ids,players:game.players,winners:game.winners,starts:roundStacks});else ids.forEach(function(id,index){var reply=director&&director.reaction(id,game.winners.includes(index)?'win':'loss');if(!reply)return;if(index===0)pendingHeroReply=Object.assign({},reply,{id:'card-hero-result-'+roundNumber,speaker:id,showPortrait:true,slides:[],links:[]});else reactions[index]=local(reply,'text');});}
      if(!eventNode&&!dealing&&!suppressStory&&!payoutCollecting&&social)eventNode=social.take();
      if(!eventNode&&pendingHeroReply){eventNode=pendingHeroReply;pendingHeroReply=null;}
      clearTimeout(timeout);clearTimeout(linkTimer);clearTimeout(nextDealTimer);cancelAnimationFrame(countFrame);var wasFocused=modal.contains(document.activeElement);table.replaceChildren();
      var top=el('header','zg-card-top'),settings=el('details','zg-card-settings'),toggle=el('summary','','⚙'),settingsBody=el('div','zg-card-settings-body');toggle.setAttribute('aria-label',t('Настройки мини-игры','Налаштування мінігри'));settings.append(toggle,settingsBody);
      var mute=btn(soundEnabled?t('Звук: вкл','Звук: увімк'):t('Звук: выкл','Звук: вимк'),function(){soundEnabled=!soundEnabled;if(!soundEnabled){sounds.stop();coinSounds.stop();if(dealSounds)dealSounds.stop();if(purr)purr.pause();}mute.textContent=soundEnabled?t('Звук: вкл','Звук: увімк'):t('Звук: выкл','Звук: вимк');});
      settingsBody.append(mute,btn(t('Покинуть стол','Залишити стіл'),finish));top.append(btn(t('♧ Комбинации','♧ Комбінації'),help),settings);table.appendChild(top);
      var cat=btn('',petCat);cat.className='zg-card-cat';cat.setAttribute('aria-label',t('Погладить кота','Погладити кота'));cat.appendChild(el('span','',t('Погладить кота','Погладити кота')));table.appendChild(cat);if(purr&&!purr.paused)catStatus(t('Мр-р-р…','Мр-р-р…'),true);
      var deck=el('div','zg-card-deck');deck.append(card(null,false,false),el('small','',String(game.deck.length)));table.appendChild(deck);
      var board=el('div','zg-card-board');
      if(resultFocus>=0&&revealed(resultFocus)){
        board.classList.add('is-result-layout');
        var focused=game.players[resultFocus],resultKey=roundNumber+':'+resultFocus+':'+revealComplete;
        rules.combinationGroups(focused.result).forEach(function(group,groupIndex){
          var cluster=el('div','zg-card-result-group');
          group.forEach(function(c){var view=card(c,true,false),own=focused.hand.some(function(h){return h.id===c.id;});markCombination(view,c);
            view.appendChild(el('small','zg-card-source'+(own?' is-own':''),own?people[resultFocus].name:t('Стол','Стіл')));
            if(announcementKey!==resultKey){view.classList.add('is-result-arriving');view.style.setProperty('--arrival-delay',(groupIndex*170)+'ms');}
            cluster.appendChild(view);
          });board.appendChild(cluster);
        });
      }else for(var i=0;i<6;i++){var community=card(game.board[i],!!game.board[i],false);if(i>=Math.max(3,game.board.length))community.classList.add('is-empty-slot');markCombination(community,game.board[i]);if(i>=previousBoard&&i<game.board.length){community.classList.add('is-revealed');community.style.animationDelay=((i-previousBoard)*180)+'ms';}board.appendChild(community);}previousBoard=game.board.length;table.appendChild(board);
      people.forEach(function(person,index){var p=game.players[index],seat=el('section','zg-card-seat seat-'+index+(game.turn===index?' is-turn':'')+(p.folded?' is-folded':''));
        if(game.done&&revealComplete&&game.winners.includes(index)){seat.classList.add('is-winner');if(!wasDone)seat.classList.add('just-won');}
        if(resultFocus===index&&revealed(index)){seat.classList.add('is-showing-combo');var epic=epicLevel(p.result.type),pop=el('div','zg-combo-popup');pop.dataset.epic=String(epic);pop.setAttribute('role','status');var key=roundNumber+':'+index+':'+revealComplete;if(announcementKey!==key){pop.classList.add('is-new-result');announcementKey=key;}pop.append(el('strong','',combos[p.result.type][uk()?1:0]));seat.appendChild(pop);}
        var token=el('div','zg-card-token');if(person.portrait){var img=el('img');img.src=person.portrait;img.alt=person.name;token.appendChild(img);}else token.textContent=person.name.slice(0,1);if(index>0){token.tabIndex=0;token.setAttribute('role','button');token.setAttribute('aria-label',person.name+' · '+t('Присмотреться','Придивитися'));token.onclick=function(){inspect(index);};token.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(index);}};}seat.appendChild(token);seat.appendChild(el('b','zg-card-person',person.name));
        var hand=el('div','zg-card-hand');if(revealed(index))hand.classList.add('is-showdown-hand');p.hand.forEach(function(c){var view=card(c,index===0||revealed(index),false);if(index===0||revealed(index))markCombination(view,c,index);if(!revealComplete&&index===resultFocus&&index>0)view.classList.add('is-revealed');if(index===0){view.classList.add('is-inspectable');view.tabIndex=0;view.setAttribute('role','button');view.setAttribute('aria-label',cardName(c)+' · '+t('Увеличить карту','Збільшити карту'));view.setAttribute('aria-expanded','false');function toggle(){var expand=!view.classList.contains('is-expanded');hand.querySelectorAll('.is-expanded').forEach(function(other){other.classList.remove('is-expanded');other.setAttribute('aria-expanded','false');});view.classList.toggle('is-expanded',expand);view.setAttribute('aria-expanded',String(expand));}view.onclick=toggle;view.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();toggle();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();view.classList.remove('is-expanded');view.setAttribute('aria-expanded','false');view.blur();}};}hand.appendChild(view);});if(p.folded&&p.stack===0)hand.hidden=true;seat.appendChild(hand);
        if(index===0){hand.onmouseenter=showLiveCombo;hand.onmouseleave=clearLiveCombo;hand.onfocusin=showLiveCombo;hand.onfocusout=function(event){if(!hand.contains(event.relatedTarget))clearLiveCombo();};hand.addEventListener('click',function(){if(hand.querySelector('.is-expanded'))showLiveCombo();else clearLiveCombo();});}
        var visibleStack=p.stack;if(game.done&&!payoutCollected){var winIndex=game.winners.indexOf(index);visibleStack-=game.payouts?game.payouts[index]:(winIndex>=0?Math.floor(game.paid/game.winners.length)+(winIndex<game.paid%game.winners.length?1:0):0);}
        var purse=coinPile(visibleStack,t('Медь','Мідь'),index===0);seat.appendChild(purse);
        if(p.lastBet){var detail=purse.querySelector('.zg-money-amount');detail.appendChild(el('small','zg-bet-detail',t('Последняя ставка: +','Остання ставка: +')+p.lastBet.added+t('; всего в круге: ','; разом у колі: ')+p.lastBet.total+' / '+p.lastBet.target));}
        if(game.done&&revealComplete&&game.winners.includes(index)){var victory=el('div','zg-victory-title',t('Победа','Перемога'));victory.setAttribute('role','status');seat.appendChild(victory);}
        var caption=!p.folded&&p.stack===0&&!game.done?t('Ва-банк','Ва-банк'):p.folded?(p.stack===0?t('Выбыл','Вибув'):t('Пас','Пас')):'';
        if(caption)seat.appendChild(el('span','zg-card-reaction',caption));if(reactions[index])seat.appendChild(el('span','zg-card-banter',reactions[index]));table.appendChild(seat);
      });
      var footer=el('footer','zg-card-actions'),status=el('div','zg-card-status');status.setAttribute('aria-live','polite');
      var bank=game.done?(payoutCollected?0:game.paid):game.pot,bankPile=coinPile(bank,t('Банк','Банк'),false);bankPile.classList.add('zg-central-bank');table.appendChild(bankPile);
      if(game.done&&game.pots&&game.pots.length>1){var breakdown=bankPile.querySelector('.zg-money-amount');game.pots.forEach(function(pot,index){breakdown.appendChild(el('small','zg-pot-part',(pot.refund?t('Возврат','Повернення'):index?t('Доп. банк','Дод. банк'):t('Основной банк','Основний банк'))+': '+pot.amount+' → '+pot.winners.map(function(i){return people[i].name;}).join(', ')));});}
      status.textContent=game.done?revealComplete?t('Победа: ','Перемога: ')+game.winners.map(function(i){return people[i].name;}).join(', '):t('Вскрывается: ','Відкривається: ')+people[revealOrder[revealCursor]].name:game.turn===0?t('Ваш ход','Ваш хід'):people[game.turn].name+'…';footer.appendChild(status);
      if(game.done&&!revealComplete){footer.append(btn(t('Показать итог','Показати підсумок'),skipReveal));}
      else if(game.done){
        if(!payoutCollected&&game.paid>0){var award=el('div','zg-bank-award'),total=el('strong','zg-bank-total');award.setAttribute('role','status');award.append(el('small','',t('Банк раздачи','Банк роздачі')),total);table.appendChild(award);if(!eventNode)countAward(total,game.paid);}
        else {if(canContinue()){status.textContent=t('Следующая раздача…','Наступна роздача…');nextDealTimer=setTimeout(continueSession,2400);}else status.textContent=t('Игра завершена','Гру завершено');footer.appendChild(btn(t('Покинуть стол','Залишити стіл'),finish));}
      }
      else {var legal=rules.legal(game),cost=game.target-game.players[0].bet;[['fold',t('Пас','Пас')],['call',cost?t('Уравнять ','Зрівняти ')+Math.min(cost,game.players[0].stack):t('Чек','Чек')]].forEach(function(a){var b=btn(a[1],function(){move(a[0]);});b.disabled=dealing||game.turn!==0||!legal.includes(a[0]);b.dataset.cardAction=a[0];footer.appendChild(b);});
        var raise=btn(t('Повысить…','Підвищити…'),function(){
          if(table.querySelector('.zg-raise-picker'))return;var picker=el('aside','zg-raise-picker'),limit=rules.raiseLimit(game),input=el('input'),stepper=el('div','zg-raise-stepper'),preview=el('div','zg-raise-preview'),summary=el('p');
          input.type='number';input.inputMode='numeric';input.min=1;input.max=limit;input.step=1;input.value=Math.min(2,limit);input.setAttribute('aria-label',t('Сумма повышения','Сума підвищення'));
          var allIn=btn(t('✦ Всё на кон','✦ Усе на кін'),function(){input.value=limit;update(input.value);confirm.textContent=t('Подтвердить ва-банк · ','Підтвердити ва-банк · ')+(cost+limit);});allIn.className='zg-all-in';var confirm=btn('',function(){var n=Number(input.value);if(Number.isSafeInteger(n)&&n>=1&&n<=limit)move('raise',n);});
          function step(delta){var current=Number(input.value);if(!Number.isSafeInteger(current))current=1;input.value=Math.max(1,Math.min(limit,current+delta));coinSounds.play('coins','adjust:'+(++moneySerial));update(input.value);}
          var minus=btn('−',function(){step(-1);}),plus=btn('+',function(){step(1);});minus.className=plus.className='zg-raise-step';minus.setAttribute('aria-label',t('Уменьшить на одну монету','Зменшити на одну монету'));plus.setAttribute('aria-label',t('Добавить одну монету','Додати одну монету'));stepper.append(minus,input,plus);
          function update(value){var n=Number(value),valid=Number.isSafeInteger(n)&&n>=1&&n<=limit;confirm.disabled=!valid;minus.disabled=valid&&n===1;plus.disabled=valid&&n===limit;input.setAttribute('aria-invalid',String(!valid));confirm.textContent=t('Повысить на ','Підвищити на ')+(valid?n:'—');summary.textContent=valid?t('Всего внесёшь: ','Усього внесеш: ')+(cost+n)+t(' медных',' мідних'):t('Выбери целое число от 1 до ','Обери ціле число від 1 до ')+limit;preview.replaceChildren(coinPile(valid?n:0,t('Медь','Мідь'),false));}
          input.oninput=function(){update(input.value);};
          picker.append(el('h3','',t('Сколько добавить к ставке?','Скільки додати до ставки?')),preview,stepper,summary,confirm,allIn,btn(t('Отмена','Скасувати'),function(){picker.remove();raise.focus();}));table.appendChild(picker);update(input.value);input.focus();
        });raise.disabled=dealing||game.turn!==0||!legal.includes('raise');raise.dataset.cardAction='raise';footer.appendChild(raise);if(legal.includes('allin')&&!legal.includes('raise')){var allCall=btn(t('Всё на кон · ','Усе на кін · ')+game.players[0].stack,function(){move('allin');});allCall.disabled=dealing||game.turn!==0;allCall.dataset.cardAction='allin';footer.appendChild(allCall);}
      }
      if(dealing)status.textContent=t('Раздача…','Роздача…');table.appendChild(footer);table.appendChild(el('small','zg-card-mode',wallet?'':t('Учебная медь · серебро и предметы эпизода не расходуются','Навчальна мідь · срібло та предмети епізоду не витрачаються')));
      if(wasFocused){var control=footer.querySelector('button:not(:disabled)')||top.querySelector('button');control.focus({preventScroll:true});}
      var deckRect=deck.getBoundingClientRect();
      table.querySelectorAll('.zg-card.is-dealt').forEach(function(view){var rect=view.getBoundingClientRect();view.style.setProperty('--deal-x',(deckRect.left+deckRect.width/2-rect.left-rect.width/2)+'px');view.style.setProperty('--deal-y',(deckRect.top+deckRect.height/2-rect.top-rect.height/2)+'px');});
      initialDeal=false;wasDone=game.done&&revealComplete;decorateStory();if(eventNode){runStory(eventNode,render);return;}if(resultFocus>=0)linkTimer=setTimeout(drawCombinationLinks,1100);
      if(game.done&&!revealComplete)timeout=setTimeout(function(){if(closed)return;if(revealCursor+1<revealOrder.length){revealCursor++;resultFocus=revealOrder[revealCursor];revealSound();}else{revealComplete=true;resultFocus=game.winners[0];outcomeSound();}render();},rules.strength(game.players[resultFocus].result.type)>=9?3300:2400);
      if(!dealing&&!game.done&&game.turn!==0)timeout=setTimeout(function(){if(closed)return;var index=game.turn,a=rules.npc(game,Math.random,people[index].style);move(a,a==='raise'?Math.max(1,Math.min(rules.raiseLimit(game),Math.ceil(game.players[index].stack*(people[index].style==='bold'?.2:.1)))):undefined);},Math.max(600,Math.min(10000,Number(roundNumber===1?options.firstRoundThinkMs:options.npcThinkMs)||(roundNumber===1?2400:1350))));
    }
    storyFx=w.ZargotaCardSocial?w.ZargotaCardSocial.effects(modal,ids):null;modal.showModal();var intro=director&&director.next({intro:true,round:1,board:0,visit:visit});function begin(){var next=director&&director.next({intro:true,round:1,board:0,visit:visit});if(next)runStory(next,begin);else start();}if(intro)runStory(intro,begin);else start();modal.querySelector('button')?.focus();return dispose;
  }
  function seatChange(c,index,id){
    var opponents=(c.opponents||[]).slice(),styles=(c.styles||['balanced','balanced','balanced']).slice(),stacks=(c.stacks||[c.stack||20,14,27,9]).slice(),other=id?opponents.indexOf(id):-1;
    if(other>=0&&other!==index){var previous=opponents[index];opponents[other]=previous;var style=styles[index]||'balanced';styles[index]=styles[other]||'balanced';styles[other]=style;var money=stacks[index+1];stacks[index+1]=stacks[other+1];stacks[other+1]=money;}
    opponents[index]=id;return {opponents:opponents,styles:styles,stacks:stacks};
  }
  function edit(project,save,host){
    host.querySelectorAll('.zg-minigame-editor').forEach(function(e){e.remove();});var panel=el('section','zg-minigame-editor'),c=config(project);
    panel.append(el('h2','',t('Мини-игры · Башня и коготь','Мініігри · Вежа та кіготь')),el('p','',t('Не основная игра: запускается после выбранной реплики и возвращает к следующей. Выключено по умолчанию. Настройки входят в JSON эпизода.','Не основна гра: запускається після обраної репліки й повертає до наступної. Типово вимкнено. Налаштування входять до JSON епізоду.')));
    var target=panel;
    function group(title){var fold=el('details','zg-minigame-settings-group');fold.appendChild(el('summary','',title));panel.appendChild(fold);return fold;}
    function field(label,input){var l=el('label');l.append(el('span','',label),input);target.appendChild(l);}
    function change(key,value){project.minigames=project.minigames||{};project.minigames.towerClaw=Object.assign({},config(project),{[key]:value});save(function(p){p.minigames=p.minigames||{};p.minigames.towerClaw=Object.assign({},p.minigames.towerClaw||{}, {[key]:value});});}
    function refresh(){var restore=w.ZargotaStoryViewState?.capture(host);edit(project,save,host);if(restore)restore();}
    var enable=el('input');enable.type='checkbox';enable.checked=c.enabled===true;enable.onchange=function(){change('enabled',enable.checked);};field(t('Включить карточную мини-игру','Увімкнути карткову мінігру'),enable);
    function select(items,value,fn){var s=el('select');items.forEach(function(pair){var o=el('option','',pair[1]);o.value=pair[0];s.appendChild(o);});s.value=value||'';s.onchange=function(){fn(s.value);};return s;}
    field(t('Запустить после реплики','Запустити після репліки'),select([['',t('Не выбрана — только тест','Не обрана — лише тест')]].concat((project.nodes||[]).map(function(n){return[n.id,local(n,'title')||n.id];})),c.afterNodeId,function(v){change('afterNodeId',v);}));
    var participants=target=group(t('Участники и деньги','Учасники й гроші'));
    var paid=el('input');paid.type='checkbox';paid.checked=!!c.realMoney;paid.onchange=function(){change('realMoney',paid.checked);};field(t('Реальные монеты из сумки в сюжетном прохождении','Справжні монети із сумки в сюжетному проходженні'),paid);
    var economics=target=group(t('Вклад друга и вещи вместо монет','Внесок друга й речі замість монет'));
    economics.appendChild(el('p','',t('Предмет передаётся герою сразу за указанную медь, только с согласия игрока. Эти деньги получает разорившийся соперник. Вклад возвращается при выходе из игры; прибыль делится по проценту, убыток — пропорционально вкладам.','Річ переходить героєві одразу за вказану мідь, лише за згодою гравця. Ці гроші отримує збанкрутілий суперник. Внесок повертається під час виходу з гри; прибуток ділиться за відсотком, збиток — пропорційно внескам.')));
    function moneySetting(label,value,fn,max){var input=el('input');input.type='number';input.min=0;input.max=max||1000;input.value=value;input.onchange=function(){fn(Math.max(0,Math.min(max||1000,Math.floor(Number(input.value)||0))));};field(label,input);}
    moneySetting(t('Дополнительный вклад Лиды','Додатковий внесок Ліди'),c.sponsor?.amount||0,function(v){change('sponsor',Object.assign({},config(project).sponsor,{amount:v}));});
    var actorChoices=[['',t('Не выбран','Не обраний')]].concat(Object.entries(project.speakers||{}).map(function(pair){return [pair[0],local(pair[1],'name')||pair[0]];}));
    field(t('Кому добавляют деньги','Кому додають гроші'),select(actorChoices,c.sponsor?.playerId,function(id){change('sponsor',Object.assign({},config(project).sponsor,{playerId:id}));}));
    field(t('Кто вносит дополнительную сумму','Хто вносить додаткову суму'),select(actorChoices,c.sponsor?.speakerId,function(id){change('sponsor',Object.assign({},config(project).sponsor,{speakerId:id}));}));
    moneySetting(t('Доля Лиды в чистой прибыли, %','Частка Ліди в чистому прибутку, %'),Math.round((c.sponsor?.profitShare??.5)*100),function(v){change('sponsor',Object.assign({},config(project).sponsor,{profitShare:v/100}));},100);
    (c.itemStakes||[]).forEach(function(offer,index){var item=(project.storyItems||[]).find(function(i){return i.itemId===offer.itemId;});moneySetting((local(item||{},'name')||offer.itemId)+t(' · цена в меди',' · ціна в міді'),offer.value,function(v){var offers=JSON.parse(JSON.stringify(config(project).itemStakes||[]));offers[index].value=v;change('itemStakes',offers);});});target=participants;
    participants.appendChild(el('p','',t('Места: 1 — слева, 2 — сверху, 3 — справа. Выбор уже сидящего соперника меняет их местами вместе с кошельком и манерой игры.','Місця: 1 — ліворуч, 2 — угорі, 3 — праворуч. Вибір суперника, який уже сидить, міняє їх місцями разом із гаманцем і манерою гри.')));
    field(t('Поздний гость · пятое место со следующей раздачи','Пізній гість · п’яте місце з наступної роздачі'),select([['',t('Без гостя','Без гостя')]].concat(Object.keys(project.speakers||{}).filter(function(id){return id!==project.playerSpeakerId&&!(c.opponents||[]).includes(id);}).map(function(id){return[id,local(project.speakers[id],'name')||id];})),c.guestSpeakerId,function(v){change('guestSpeakerId',v);refresh();}));
    field(t('Манера гостя','Манера гостя'),select([['cautious',t('Осторожный','Обережний')],['balanced',t('Обычный','Звичайний')],['bold',t('Смелый','Сміливий')]],c.guestStyle||'cautious',function(v){change('guestStyle',v);}));
    if(w.ZargotaCardEvents)w.ZargotaCardEvents.editReplies(project,panel,change);
    if(w.ZargotaCardEvents?.editList)w.ZargotaCardEvents.editList(project,panel,save);
    target=group(t('Темп раздачи','Темп роздачі'));
    [['firstRoundThinkMs',t('Пауза соперника в первой раздаче, мс','Пауза суперника в першій роздачі, мс'),2400],['npcThinkMs',t('Пауза соперника дальше, мс','Пауза суперника далі, мс'),1350]].forEach(function(row){var input=el('input');input.type='number';input.min='600';input.max='10000';input.step='100';input.value=c[row[0]]||row[2];input.onchange=function(){change(row[0],Math.max(600,Math.min(10000,Number(input.value)||row[2])));};field(row[1],input);});
    target=participants;
    for(var i=0;i<3;i++)(function(index){var choices=[['',t('Без портрета','Без портрета')]].concat(Object.keys(project.speakers||{}).filter(function(id){return id!==project.playerSpeakerId&&id!==config(project).guestSpeakerId;}).map(function(id){return[id,local(project.speakers[id],'name')||id];}));field(t('Соперник ','Суперник ')+(index+1),select(choices,(c.opponents||[])[index],function(v){var patch=seatChange(config(project),index,v);project.minigames=project.minigames||{};project.minigames.towerClaw=Object.assign({},config(project),patch);save(function(p){p.minigames=p.minigames||{};p.minigames.towerClaw=Object.assign({},p.minigames.towerClaw||{},patch);});refresh();}));})(i);
    [project.playerSpeakerId].concat((c.opponents||[]).slice(0,3),['','','']).slice(0,4).forEach(function(id,index){var defaults=[c.stack||20,14,27,9],money=el('input');money.type='number';money.min=1;money.max=1000;money.value=(c.stacks||defaults)[index]??defaults[index];money.onchange=function(){var values=(config(project).stacks||defaults).slice();values[index]=Math.max(1,Math.min(1000,Math.floor(Number(money.value)||defaults[index])));money.value=values[index];change('stacks',values);};field(t('Стартовая медь · ','Стартова мідь · ')+(local((project.speakers||{})[id]||{},'name')||(index?t('Соперник ','Суперник ')+index:t('Герой','Герой'))),money);});
    for(var styleIndex=0;styleIndex<3;styleIndex++)(function(index){field(t('Манера соперника ','Манера суперника ')+(index+1),select([['balanced',t('Обычный','Звичайний')],['cautious',t('Осторожный','Обережний')],['bold',t('Смелый','Сміливий')]],(c.styles||[])[index]||'balanced',function(value){var styles=(config(project).styles||[]).slice();styles[index]=value;change('styles',styles);}));})(styleIndex);
    group(t('Правила и ограничения','Правила й обмеження')).appendChild(el('p','',t('40 карт; общие карты: 3 → 2 → 1. Повышение в пределах своего запаса. Ва-банк сохраняет участие; дополнительные ставки разыгрываются в отдельных банках, непокрытый остаток возвращается. Медь сохраняется между раздачами этой игры. Стартовые суммы применяются при новом запуске. Сюжетное серебро не расходуется.','40 карт; спільні карти: 3 → 2 → 1. Підвищення в межах власного запасу. Ва-банк зберігає участь; додаткові ставки розігруються в окремих банках, непокритий залишок повертається. Мідь зберігається між роздачами цієї гри. Стартові суми застосовуються під час нового запуску. Сюжетне срібло не витрачається.')));
    panel.appendChild(btn(t('▷ Тест мини-игры','▷ Тест мінігри'),function(){open(project,config(project));}));host.appendChild(panel);
  }
  w.ZargotaCardGame={seatChange:seatChange,open:open,edit:edit,match:match,config:config,dispose:function(){if(active)active();},cardPath:cardPath,combos:combos,exampleCards:exampleCards,observation:observation};
})(window);
