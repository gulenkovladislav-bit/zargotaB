(function(w){
 'use strict';
 const uk=()=>w.ZargotaI18n?.getLocale()==='uk',t=(ru,ua)=>uk()?ua:ru,local=(v,k)=>uk()&&v[k+'Uk']||v[k]||'';
 function director(project,memory={},wake=()=>{}){
  const started=new Map(),signals=new Map(),timers=new Map();let disposed=false;
  function signal(key){signals.set(key,Date.now());}
  const seen=new Set(),flags={...(memory.flags||{})},counts={},groups=new Set();
  const lastReaction=memory.lastReaction||(memory.lastReaction={}),bags=memory.bags||(memory.bags={}),lastEvent=memory.lastEvent||(memory.lastEvent={});
  return {flags,signal,complete(id){signal('done:'+id);},dispose(){disposed=true;timers.forEach(clearTimeout);timers.clear();},next(context){
   if(disposed)return null;
   const candidates=(project.nodes||[]).filter(node=>{
    const e=node.cardEvent;if(!e?.enabled)return false;
    const key=node.id+(e.once===false?':'+context.round:'');
    if(seen.has(key)||e.round>0&&Number(e.round)!==context.round||e.requires&&!flags[e.requires])return false;
    if(e.unless&&flags[e.unless]||e.minRound>context.round||e.minVisit>(context.visit||1)||e.maxVisit>0&&(context.visit||1)>e.maxVisit)return false;
    if(e.everyRounds>1&&(context.round-(e.minRound||1))%e.everyRounds!==0||e.maxTimes>0&&(counts[node.id]||0)>=e.maxTimes)return false;
    if(e.participants&&context.participants&&!e.participants.every(id=>context.participants.includes(id)))return false;
    if(e.group&&groups.has(e.group+':'+context.round))return false;
    const signalKey=e.phase==='guestAppeared'?'guestAppeared':e.phase==='afterEvent'?'done:'+e.afterEventId:null;
    const ready=signalKey?signals.has(signalKey):e.phase==='intro'?context.intro:e.phase==='roundStart'?context.roundStart:e.phase==='roundEnd'?context.roundEnd:e.phase==='board'?context.board>=Number(e.boardCount||3)&&!context.intro:false;
    if(!ready&&!started.has(key))return false;
    const delay=Math.max(0,Math.min(600000,Number(e.delaySeconds)||0))*1000;
    if(!started.has(key))started.set(key,signalKey?signals.get(signalKey):Date.now());
    const remaining=started.get(key)+delay-Date.now();
    if(remaining>0){if(!timers.has(key))timers.set(key,setTimeout(()=>{timers.delete(key);if(!disposed)wake();},remaining));return false;}
    return true;
   });
   let node=candidates[0];if(!node)return null;
   if(node.cardEvent.group){const peers=candidates.filter(n=>n.cardEvent.group===node.cardEvent.group),previous=lastEvent[node.cardEvent.group];node=peers.find(n=>n.id!==previous)||node;lastEvent[node.cardEvent.group]=node.id;groups.add(node.cardEvent.group+':'+context.round);}
   seen.add(node.id+(node.cardEvent.once===false?':'+context.round:''));counts[node.id]=(counts[node.id]||0)+1;return node;
  },remember(flag){flags[flag]=true;memory.flags=Object.assign({},memory.flags,{[flag]:true});
  },reaction(speaker,event,random=Math.random){
   const rows=project.minigames?.towerClaw?.replies?.[speaker]?.[event]||[],key=speaker+':'+event;
   if(!rows.length)return null;let choices=(bags[key]||[]).filter(i=>i<rows.length);
   if(!choices.length)choices=rows.map((v,i)=>i);
   const eligible=choices.filter(i=>rows.length===1||i!==lastReaction[key]),pool=eligible.length?eligible:choices;
   const index=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];bags[key]=choices.filter(i=>i!==index);lastReaction[key]=index;return rows[index];
  }};
 }
 function dialogue(project,entry,host,api,finish){
  const skin=document.createElement('div');skin.className='zg-story-player open zg-card-dialogue-layer';host.appendChild(skin);
  const pane=document.createElement('section');pane.className='zg-story-dialogue';pane.setAttribute('role','dialog');pane.setAttribute('aria-modal','true');pane.setAttribute('aria-label',t('Разговор за столом','Розмова за столом'));skin.appendChild(pane);
  let node=entry,index=0,closed=false,steps=0;const acted=new Set();
  function dispose(){skin.remove();w.removeEventListener?.('resize',fit);}
  function close(){if(closed)return;closed=true;api.complete?.(node.id);dispose();finish();}
  function fit(){w.ZargotaStoryDialogueLayout?.fit(skin,pane,project,node);}
  function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
  function enter(next){api.complete?.(node.id);node=next;index=0;draw();}
  function draw(){
   if(closed)return;if(++steps>100){close();return;}
   if(!acted.has(node.id)){acted.add(node.id);const action=api.action(node.cardAction||{});if(action&&typeof action.then==='function'){pane.hidden=true;const resume=()=>{if(!closed){pane.hidden=false;draw();}};action.then(resume,resume);return;}}
   const pages=w.ZargotaStoryPages?.pages(node)||[node,...(node.slides||[])],page=pages[index],s=w.ZargotaStoryActors?.portrait(project,page)||(project.speakers||{})[page.speaker]||{},emotion=s.emotions?.[page.emotion]||{};
   pane.replaceChildren();const body=document.createElement('div');body.className='zg-story-dialogue-body';
   const portrait=page.portrait||emotion.portrait||s.portrait;
   const frame=document.createElement('div');frame.className='zg-story-speaker-frame';frame.hidden=!portrait||page.showPortrait===false;
   const img=document.createElement('img');img.className='zg-story-speaker-portrait';if(portrait)img.src=portrait;img.alt=local(s,'name');frame.appendChild(img);pane.appendChild(frame);
   const name=document.createElement('div');name.className='zg-story-speaker-name';name.textContent=w.ZargotaStoryActors?.displayName(s)||local(s,'name');const text=document.createElement('p');text.className='zg-story-line';text.textContent=api.format?api.format(local(page,'text')):local(page,'text');body.append(name,text);
   const choices=document.createElement('div');choices.className='zg-story-answers';
   if(index<pages.length-1)choices.appendChild(button(t('Далее','Далі'),()=>{index++;draw();}));
   else{
    for(const link of node.links||[]){
     if(link.requires&&!api.flags[link.requires]||link.cardGift&& !api.canGift(Number(link.cardGift)))continue;
     if(link.cardTopUp&&!api.canTopUp?.(Number(link.cardTopUp)))continue;
     if(link.cardPurchase&&!api.canPurchase?.(link.cardPurchase))continue;
     const next=(project.nodes||[]).find(n=>n.id===link.to);if(!next)continue;
     choices.appendChild(button(local(link,'label')||t('Далее','Далі'),()=>{
      if(link.cardGift&&!api.gift(Number(link.cardGift)))return;
      if(link.cardTopUp&&!api.topUp?.(Number(link.cardTopUp)))return;
      if(link.cardPurchase&&!api.purchase?.(link.cardPurchase))return;
      if(link.effect){api.flags[link.effect]=true;if(link.rememberEffect)api.remember?.(link.effect);}enter(next);
     }));
    }
    if(!choices.children.length)choices.appendChild(button(t('Продолжить игру','Продовжити гру'),close));
   }
   const choice=choices.children.length>1||page.kind==='choice';choices.className+=' '+(choice?'':'is-single-advance');
   if(choice)Array.from(choices.children).forEach(b=>b.className='is-choice');
   pane.setAttribute('data-kind',choice?'choice':'dialogue');
   body.appendChild(choices);pane.appendChild(body);
   if(w.ZargotaStoryPresentation)w.ZargotaStoryPresentation.apply(skin,pane,s,w.ZargotaStoryPresentation.resolve(project,page));
   fit();choices.querySelector('button')?.focus({preventScroll:true});
  }
  w.addEventListener?.('resize',fit);draw();return ()=>{if(closed)return;closed=true;dispose();};
 }
 function editNode(project,node,host,save){
  const box=document.createElement('details'),legend=document.createElement('summary');box.className='zg-card-event-settings';legend.textContent=t('Мини-игра · событие и действия','Мінігра · подія та дії');box.appendChild(legend);
  function set(group,key,value){save(p=>{const n=p.nodes.find(n=>n.id===node.id);if(n)n[group]=Object.assign({},n[group]||{},{[key]:value});});}
  function input(label,group,key,type,values){const row=document.createElement('label');row.className='zg-story-field';row.textContent=label;let field=document.createElement(values?'select':'input');if(values){for(const [value,name] of values){const o=document.createElement('option');o.value=value;o.textContent=name;field.appendChild(o);}}else field.type=type;const value=node[group]?.[key];if(type==='checkbox')field.checked=value===true;else field.value=value??'';if(type==='number'){field.min='0';field.step='1';}field.onchange=()=>set(group,key,type==='checkbox'?field.checked:type==='number'?Number(field.value):field.value);row.appendChild(field);box.appendChild(row);}
  input(t('Запускать как событие мини-игры','Запускати як подію мінігри'),'cardEvent','enabled','checkbox');
  input(t('Момент','Мить'),'cardEvent','phase','select',[['intro',t('Перед первой раздачей','Перед першою роздачею')],['roundStart',t('Начало раздачи','Початок роздачі')],['board',t('Открыты общие карты','Відкриті спільні карти')],['roundEnd',t('После выплаты банка','Після виплати банку')],['guestAppeared',t('После появления гостя','Після появи гостя')],['afterEvent',t('После завершения диалога','Після завершення діалогу')]]);
  input(t('После какого диалога','Після якого діалогу'),'cardEvent','afterEventId','select',[['',t('Выбери для триггера «После диалога»','Обери для тригера «Після діалогу»')],...(project.nodes||[]).filter(n=>n.id!==node.id).map(n=>[n.id,local(n,'title')||n.id])]);
  input(t('Задержка после триггера, секунд (0 — сразу, максимум 600)','Затримка після тригера, секунд (0 — одразу, максимум 600)'),'cardEvent','delaySeconds','number');
  const timingNote=document.createElement('p');timingNote.textContent=t('Таймер не останавливает партию. Реплика ждёт завершения раздачи карт или текущего диалога, затем ставит игру на паузу. Для появления без реплики включи «Только действие» и выбери появление гостя. Отдельную реплику запускай после появления гостя с нужной задержкой. Номер раздачи 0 разрешает запуск в любой раздаче.','Таймер не зупиняє партію. Репліка чекає завершення роздавання карт або поточного діалогу, потім ставить гру на паузу. Для появи без репліки ввімкни «Лише дія» й обери появу гостя. Окрему репліку запускай після появи гостя з потрібною затримкою. Номер роздачі 0 дозволяє запуск у будь-якій роздачі.');box.appendChild(timingNote);
  input(t('Номер раздачи (0 — любая)','Номер роздачі (0 — будь-яка)'),'cardEvent','round','number');
  input(t('Открыто карт (3, 5 или 6)','Відкрито карт (3, 5 або 6)'),'cardEvent','boardCount','number');
  // Explicit selector avoids making an absent default-on checkbox misleading.
  const repeat=document.createElement('label');repeat.className='zg-story-field';repeat.textContent=t('Повторять в следующих подходящих раздачах','Повторювати в наступних відповідних роздачах');const check=document.createElement('input');check.type='checkbox';check.checked=node.cardEvent?.once===false;check.onchange=()=>set('cardEvent','once',!check.checked);repeat.appendChild(check);box.appendChild(repeat);
  input(t('Условие: флаг мини-игры','Умова: прапорець мінігри'),'cardEvent','requires','text');
  input(t('Не запускать при флаге','Не запускати за прапорця'),'cardEvent','unless','text');
  input(t('Начиная с раздачи','Починаючи з роздачі'),'cardEvent','minRound','number');
  input(t('Интервал повторения, раздач','Інтервал повторення, роздач'),'cardEvent','everyRounds','number');
  input(t('Максимум за игру (0 — без лимита)','Максимум за гру (0 — без ліміту)'),'cardEvent','maxTimes','number');
  input(t('Группа вариантов (один за раздачу)','Група варіантів (один за роздачу)'),'cardEvent','group','text');
  input(t('Начиная с визита за стол','Починаючи з візиту за стіл'),'cardEvent','minVisit','number');
  input(t('До визита включительно (0 — любой)','До візиту включно (0 — будь-який)'),'cardEvent','maxVisit','number');
  const participants=document.createElement('details'),names=document.createElement('summary'),checks=[];names.textContent=t('Кто должен быть за столом','Хто має бути за столом');participants.appendChild(names);
  for(const [id,speaker] of Object.entries(project.speakers||{})){const row=document.createElement('label'),check=document.createElement('input');row.textContent=local(speaker,'name')||id;check.type='checkbox';check.checked=(node.cardEvent?.participants||[]).includes(id);checks.push([id,check]);check.onchange=()=>set('cardEvent','participants',checks.filter(v=>v[1].checked).map(v=>v[0]));row.appendChild(check);participants.appendChild(row);}box.appendChild(participants);
  input(t('Только действие, без окна диалога','Лише дія, без вікна діалогу'),'cardEvent','silent','checkbox');
  input(t('Действие при входе в реплику','Дія на вході в репліку'),'cardAction','kind','select',[['',t('Без действия','Без дії')],['example',t('Показать пример дуэта','Показати приклад дуету')],['guest',t('Подходит приглашённый персонаж','Підходить запрошений персонаж')],['stones',t('Показать камушки у гостя','Показати камінці в гостя')],['hideCard',t('Спрятать одну карту гостя (только визуально)','Сховати одну карту гостя (лише візуально)')],['restoreCard',t('Вернуть видимость карты','Повернути видимість карти')],['stone',t('Камушек к портрету и вздрагивание','Камінчик до портрета й здригання')],['reachCard',t('Потянуться к чужой карте (без смены руки)','Потягнутися до чужої карти (без зміни руки)')]]);
  const actors=[['',t('Не выбран','Не обраний')],...Object.entries(project.speakers||{}).map(([id,s])=>[id,local(s,'name')||id])];
  input(t('Кто действует','Хто діє'),'cardAction','from','select',actors);
  input(t('На кого','На кого'),'cardAction','to','select',actors);
  input(t('Звук действия: файл или crunch','Звук дії: файл або crunch'),'cardAction','sound','text');
  const note=document.createElement('p');note.textContent=t('Текст, страницы и переходы редактируются как обычный диалог. Флаг guestJoined означает, что гость уже получил место. Общие карты открываются 3 → 2 → 1. Событие на четвёртой карте запускается после открытия пары до пятой.','Текст, сторінки й переходи редагуються як звичайний діалог. Прапорець guestJoined означає, що гість уже отримав місце. Спільні карти відкриваються 3 → 2 → 1. Подія на четвертій карті запускається після відкриття пари до п’ятої.');box.appendChild(note);host.appendChild(box);
  host.querySelectorAll('.zg-story-link-row').forEach((row,index)=>{const link=node.links[index],label=document.createElement('label'),amount=document.createElement('input'),fold=document.createElement('details'),title=document.createElement('summary');fold.className='zg-card-link-settings';title.textContent=t('Мини-игра · действие ответа','Мінігра · дія відповіді');fold.appendChild(title);row.appendChild(fold);label.className='zg-story-field';label.textContent=t('Дать гостю медь со стола (0 — без передачи)','Дати гостю мідь зі столу (0 — без передачі)');amount.type='number';amount.min='0';amount.step='1';amount.value=link.cardGift||0;amount.onchange=()=>save(p=>{const l=p.nodes.find(n=>n.id===node.id)?.links.find(l=>l.id===link.id);if(l)l.cardGift=Math.max(0,Math.floor(Number(amount.value)||0));});label.appendChild(amount);fold.appendChild(label);});
  host.querySelectorAll('.zg-story-link-row').forEach((row,index)=>{const link=node.links[index];for(const [key,title,type] of [['cardTopUp',t('Помочь выбывшему гостю после банка · медь','Допомогти вибулому гостю після банку · мідь'),'number'],['rememberEffect',t('Помнить флаг ответа при возвращении за стол','Пам’ятати прапорець відповіді після повернення за стіл'),'checkbox']]){const label=document.createElement('label'),input=document.createElement('input');label.className='zg-story-field';label.textContent=title;input.type=type;if(type==='checkbox')input.checked=!!link[key];else{input.min='0';input.step='1';input.value=link[key]||0;}input.onchange=()=>save(p=>{const l=p.nodes.find(n=>n.id===node.id)?.links.find(l=>l.id===link.id);if(l)l[key]=type==='checkbox'?input.checked:Math.max(0,Math.floor(Number(input.value)||0));});label.appendChild(input);row.querySelector('.zg-card-link-settings').appendChild(label);}});
  host.querySelectorAll('.zg-story-link-row').forEach((row,index)=>{
   const link=node.links[index],label=document.createElement('label'),select=document.createElement('select');
   label.className='zg-story-field';label.textContent=t('Купить предложенный предмет у персонажа','Купити запропоновану річ у персонажа');
   for(const [value,title] of [['',t('Без покупки','Без купівлі')],...actors.filter(a=>a[0])]){const option=document.createElement('option');option.value=value;option.textContent=title;select.appendChild(option);}
   select.value=link.cardPurchase||'';
   select.onchange=()=>save(p=>{const l=p.nodes.find(n=>n.id===node.id)?.links.find(l=>l.id===link.id);if(l)l.cardPurchase=select.value;});
   label.appendChild(select);row.querySelector('.zg-card-link-settings').appendChild(label);
  });
 }
 function editReplies(project,host,change){
  const c=project.minigames?.towerClaw||{},details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=t('Реплики за столом · характеры и ставки','Репліки за столом · характери та ставки');details.appendChild(summary);
  const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=!!c.socialReplies;enabled.onchange=()=>change('socialReplies',enabled.checked);const enabledLabel=document.createElement('label');enabledLabel.textContent=t('Все реакции — нижним диалогом','Усі реакції — нижнім діалогом');enabledLabel.appendChild(enabled);details.appendChild(enabledLabel);
  const limit=document.createElement('input');limit.type='number';limit.min='0';limit.max='4';limit.value=c.actionRepliesPerRound??2;limit.onchange=()=>change('actionRepliesPerRound',Math.max(0,Math.min(4,Number(limit.value)||0)));const limitLabel=document.createElement('label');limitLabel.textContent=t('Реплик о ставках за раздачу (0 — выключить)','Реплік про ставки за роздачу (0 — вимкнути)');limitLabel.appendChild(limit);details.appendChild(limitLabel);
  const events={win:t('Победа','Перемога'),loss:t('Поражение','Поразка'),allin:t('Ва-банк','Ва-банк'),raise:t('Повышение','Підвищення'),bigWin:t('Крупный выигрыш','Великий виграш'),rich:t('Много монет','Багато монет'),lowMoney:t('Последние монеты','Останні монети')};
  for(const id of [...new Set([project.playerSpeakerId,...(c.opponents||[]),c.guestSpeakerId].filter(Boolean))]){
   const actor=document.createElement('details'),title=document.createElement('summary');title.textContent=local(project.speakers?.[id]||{},'name');actor.appendChild(title);details.appendChild(actor);
   for(const event of Object.keys(events)){
    const group=document.createElement('details'),heading=document.createElement('summary');heading.textContent=events[event];group.appendChild(heading);actor.appendChild(group);
    for(const key of ['text','textUk']){const row=document.createElement('label');row.textContent=(key==='text'?'RU':'UK')+t(' · одна реплика на строку',' · одна репліка на рядок');const field=document.createElement('textarea');field.rows=3;field.value=(c.replies?.[id]?.[event]||[]).map(r=>r[key]||'').join('\n');field.onchange=()=>{const all=JSON.parse(JSON.stringify(project.minigames?.towerClaw?.replies||{}));all[id]=all[id]||{};const old=all[id][event]||[],lines=field.value.split('\n');all[id][event]=Array.from({length:Math.max(old.length,lines.length)},(_,i)=>({...old[i],[key]:lines[i]||''})).filter(r=>r.text||r.textUk);change('replies',all);};row.appendChild(field);group.appendChild(row);}
    (c.replies?.[id]?.[event]||[]).forEach((reply,index)=>{const label=document.createElement('label'),select=document.createElement('select');label.textContent=t('Эмоция варианта ','Емоція варіанта ')+(index+1);for(const [value,name] of [['',t('Основной портрет','Основний портрет')],...Object.entries(project.speakers?.[id]?.emotions||{}).map(([key,v])=>[key,local(v,'name')||key])]){const option=document.createElement('option');option.value=value;option.textContent=name;select.appendChild(option);}select.value=reply.emotion||'';select.onchange=()=>{const all=JSON.parse(JSON.stringify(project.minigames?.towerClaw?.replies||{}));if(all[id]?.[event]?.[index]){all[id][event][index].emotion=select.value;change('replies',all);}};label.appendChild(select);group.appendChild(label);});
   }
  }host.appendChild(details);
 }
 function editList(project,host,save){
  const root=document.createElement('details'),title=document.createElement('summary');root.className='zg-card-event-list';title.textContent=t('События во время игры','Події під час гри');root.appendChild(title);
  const note=document.createElement('p');note.textContent=t('Привяжи обычный диалог к раздаче. Текст и страницы открываются в привычном редакторе; условия и повторы — здесь.','Прив’яжи звичайний діалог до роздачі. Текст і сторінки відкриваються у звичному редакторі; умови й повтори — тут.');root.appendChild(note);
  const controls=document.createElement('div'),select=document.createElement('select'),list=document.createElement('div');select.setAttribute('aria-label',t('Диалог для события','Діалог для події'));
  function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
  function open(id){w.zgStoryEditorSelectDialogue?.(id);}
  function bind(id){const node=project.nodes.find(n=>n.id===id);if(!node)return;const event={...node.cardEvent,enabled:true,phase:node.cardEvent?.phase||'roundStart',round:node.cardEvent?.round??1};node.cardEvent=event;save(p=>{const n=p.nodes.find(n=>n.id===id);if(n)n.cardEvent={...event};});draw();}
  controls.append(select,button(t('Привязать диалог','Прив’язати діалог'),()=>bind(select.value)),button(t('＋ Новое событие','＋ Нова подія'),()=>{
   let id='card-event-'+Date.now().toString(36);while(project.nodes.some(n=>n.id===id))id+='x';
   const node={id,title:'Новое событие мини-игры',titleUk:'Нова подія мінігри',text:'',textUk:'',speaker:project.playerSpeakerId||'',editorSceneId:project.activeSceneId||'',x:100,y:100,links:[],cardEvent:{enabled:false,phase:'roundStart',round:1,once:true}};
   project.nodes.push(node);save(p=>{if(!p.nodes.some(n=>n.id===id))p.nodes.push(JSON.parse(JSON.stringify(node)));});draw();open(id);
  }));root.append(controls,list);host.appendChild(root);
  function draw(){select.replaceChildren();list.replaceChildren();for(const n of project.nodes||[]){const option=document.createElement('option');option.value=n.id;option.textContent=local(n,'title')||n.id;select.appendChild(option);if(!n.cardEvent)continue;
    const row=document.createElement('details'),heading=document.createElement('summary');heading.textContent=local(n,'title')||n.id;row.appendChild(heading);
    row.appendChild(button(t('Текст, страницы и ответы ↗','Текст, сторінки та відповіді ↗'),()=>open(n.id)));
    const enabled=document.createElement('input'),label=document.createElement('label');enabled.type='checkbox';enabled.checked=n.cardEvent.enabled===true;label.textContent=t('Запускать событие','Запускати подію');enabled.onchange=()=>{n.cardEvent.enabled=enabled.checked;save(p=>{const node=p.nodes.find(v=>v.id===n.id);if(node)node.cardEvent={...node.cardEvent,enabled:enabled.checked};});};label.appendChild(enabled);row.appendChild(label);
    editNode(project,n,row,fn=>{fn(project);save(fn);});list.appendChild(row);
   }
  }draw();
 }
 w.ZargotaCardEvents={director,dialogue,editNode,editReplies,editList};
})(window);
