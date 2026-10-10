(function(w){
 'use strict';
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
 const label=o=>t(o.title||o.name||o.id||o.itemId,o.titleUk||o.nameUk||o.title||o.name||o.id||o.itemId);
 function plan(data,state,scene){
  const id=state.sceneId;
  const scoped=Object.assign({},data,{activeSceneId:id,scene});
  const nodes=w.ZargotaStoryLocationDialogues.nodes(scoped,id),ids=new Set(nodes.map(n=>n.id));
  const quests=(data.quests||[]).filter(q=>{const ends=[q.dialogueId,...(q.dialogueIds||[]),...(q.endNodeIds||[])].filter(Boolean);return ends.length?ends.every(n=>ids.has(n)):q.startSceneId===id;});
  const objects=[...(scene.tokens||[]),...(scene.story?.zones||[]),...(scene.story?.decorations||[])];
  const rewards=[];
  function actions(list,key){(list||[]).forEach((a,i)=>{if(a.enabled!==false&&a.type==='giveItem')rewards.push({key:key+':'+i,action:a,itemId:a.itemId});});}
  nodes.forEach(n=>{actions(n.beforeWorldActions,'node:'+n.id+':before');actions(n.afterWorldActions,'node:'+n.id+':after');actions(n.afterPageActions,'node:'+n.id+':page');(n.slides||[]).forEach((s,i)=>{actions(s.beforeWorldActions,'node:'+n.id+':slide:'+i);actions(s.afterPageActions,'node:'+n.id+':slide-after:'+i);actions(s.afterWorldActions,'node:'+n.id+':slide-world-after:'+i);});});
  quests.forEach(q=>actions(w.ZargotaStoryQuestActions.list(q),'quest:'+q.id));
  objects.filter(o=>o.pickup).forEach(o=>rewards.push({key:'pickup:'+id+':'+o.id,sceneId:id,itemId:o.pickup.itemId,object:o}));
  return {quests,rewards,exits:objects.filter(o=>o.sceneId&&o.sceneId!==id)};
 }
 function previousLocations(data,state){
  const scenes=data.scenes||[],index=scenes.findIndex(s=>s.id===state.sceneId);
  return scenes.slice(0,Math.max(0,index)).map(s=>({scene:s,rewards:plan(data,Object.assign({},state,{sceneId:s.id}),s.scene||{}).rewards}));
 }
 function complete(data,state,quests){
  const changes=[];state.quests=state.quests||{active:'',done:[]};
  for(const q of quests){if(state.quests.done.includes(q.id))continue;state.quests.done.push(q.id);if(q.flag)state.flags[q.flag]=true;changes.push(label(q));
   if(q.kind==='side')(state.sideQuests||(state.sideQuests={}))[q.id]={active:false,done:true,steps:(q.steps||[]).map(s=>s.id),consumed:true};
   for(const a of w.ZargotaStoryQuestActions.list(q)){if(a.enabled===false||a.sceneId!==state.sceneId||!['reveal','hide','enable','disable'].includes(a.type))continue;
    const key=w.ZargotaStoryQuestActions.key? w.ZargotaStoryQuestActions.key(a):JSON.stringify([a.sceneId||'',a.kind||'tokens',a.id]);
    const all=state.quests.actionObjects||(state.quests.actionObjects={}),old=all[key];
    const values=a.type==='reveal'?{visible:true,enabled:true,hidden:false,opacity:1}:a.type==='hide'?{visible:false,markerVisible:false,opacity:0}:{enabled:a.type==='enable'};
    all[key]={sceneId:a.sceneId,kind:a.kind||'tokens',id:a.id,values:Object.assign({},old?.values,values)};
   }
  }
  const seen=new Set();while(state.quests.done.includes(state.quests.active)&&!seen.has(state.quests.active)){seen.add(state.quests.active);state.quests.active=(data.quests||[]).find(q=>q.id===state.quests.active)?.nextId||'';}
  return changes;
 }
 function give(data,state,reward){
  const done=state.testRewards||(state.testRewards={});if(done[reward.key])return false;
  if(reward.object){const r=w.ZargotaStorySecrets.collect(data,state,reward.sceneId||state.sceneId,reward.object);if(r.ok)done[reward.key]=true;return r.ok;}
  const a=reward.action;if(a.actionId&&state.receivedItemActions?.[a.actionId])return false;
  const item=w.ZargotaStoryItems.list(data).find(i=>i.itemId===reward.itemId);if(!item)return false;
  const r=w.ZargotaStoryItems.award(state.character,item,a.qty,false);if(!r.received)return false;
  state.character=r.character;done[reward.key]=true;if(a.actionId)(state.receivedItemActions||(state.receivedItemActions={}))[a.actionId]=true;return true;
 }
 function mount(root,ctx){
  const old=root.querySelector('[data-test-tools]');if(old)old.remove();if(!ctx.enabled)return;
  const host=document.createElement('details');host.dataset.testTools='';host.className='zg-test-tools';
  const summary=document.createElement('summary');summary.textContent='⚒';summary.title=t('Тест локации','Тест локації');summary.setAttribute('aria-label',summary.title);host.appendChild(summary);
  const body=document.createElement('div');body.className='zg-test-tools-body';host.appendChild(body);root.appendChild(host);
  host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();host.open=false;summary.focus();}});
  function draw(){body.replaceChildren();const {data,state,scene}=ctx.get(),p=plan(data,state,scene);
   function el(tag,text){const e=document.createElement(tag);e.textContent=text;body.appendChild(e);return e;}
   el('h3',t('Тест локации','Тест локації'));
   el('small',t('Тестовая копия в памяти. Эпизод и обычное прохождение не изменяются.','Тестова копія в пам’яті. Епізод і звичайне проходження не змінюються.'));
   el('strong',(data.scenes||[]).find(s=>s.id===state.sceneId)?.name||state.sceneId);
   if(data.testPreparedRoute){const route=el('details',''),heading=document.createElement('summary');heading.textContent=t('Подготовленный маршрут','Підготовлений маршрут');route.appendChild(heading);data.testPreparedRoute.forEach(step=>{const line=document.createElement('div'),scene=(data.scenes||[]).find(s=>s.id===step.sceneId),node=(data.nodes||[]).find(n=>n.id===step.nodeId);line.textContent=(scene?label(scene):step.sceneId)+' · '+(node?label(node):step.objectId||step.milestoneId||'')+(step.linkId?' → '+step.linkId:'');route.appendChild(line);});}
   const report=el('p','');report.setAttribute('role','status');
   const openedSceneId=state.sceneId;
   function action(text,fn){const b=el('button',text);b.type='button';b.onclick=()=>{if(ctx.get().state.sceneId!==openedSceneId){draw();return;}if(ctx.busy()){report.textContent=t('Сначала завершите диалог или анимацию.','Спершу завершіть діалог або анімацію.');return;}report.textContent=fn();ctx.refresh();};return b;}
   action(t('Завершить задания локации','Завершити завдання локації'),()=>{const names=complete(data,state,p.quests);return t('Завершены: ','Завершено: ')+(names.join(', ')||'0');});
   el('small',t('Награды разных веток могут противоречить друг другу. Выберите нужные. Предметы не надеваются автоматически.','Нагороди різних гілок можуть суперечити одна одній. Оберіть потрібні. Предмети не споряджаються автоматично.'));
   function checkbox(parent,text){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';l.append(c,document.createTextNode(' '+text));parent.appendChild(l);return c;}
   function selectAll(parent,text,rows){const all=checkbox(parent,text);function sync(){const count=rows.filter(c=>c.checked).length;all.checked=rows.length>0&&count===rows.length;all.indeterminate=count>0&&count<rows.length;all.disabled=!rows.length;}all.onchange=()=>{rows.forEach(c=>{c.checked=all.checked;});sync();};rows.forEach(c=>c.addEventListener('change',sync));sync();return all;}
   const currentGroup=el('div',''),selected=[];
   p.rewards.forEach(r=>{const item=w.ZargotaStoryItems.list(data).find(i=>i.itemId===r.itemId),c=checkbox(currentGroup,item?label(item):r.itemId);c.parentNode.title=r.key;selected.push({r,c});});
   const currentAll=selectAll(currentGroup,t('Выбрать все предметы','Вибрати всі предмети'),selected.map(x=>x.c));currentGroup.prepend(currentAll.parentNode);
   action(t('Выдать выбранные предметы','Видати вибрані предмети'),()=>{const names=[];selected.filter(x=>x.c.checked).forEach(({r})=>{if(give(data,state,r))names.push(r.itemId);});return t('Выданы: ','Видано: ')+(names.join(', ')||'0');});
   const prior=el('details','');prior.className='zg-test-prior';
   const heading=document.createElement('summary');heading.textContent=t('Предметы предыдущих локаций','Предмети попередніх локацій');prior.appendChild(heading);
   const note=document.createElement('small');note.textContent=t('Локации выше текущей в редакторе, не подтверждённый маршрут. Отметьте пройденные: будут выданы все потенциальные награды, включая разные ветки. Задания не завершаются.','Локації вище поточної в редакторі, не підтверджений маршрут. Позначте пройдені: буде видано всі потенційні нагороди, включно з різними гілками. Завдання не завершуються.');prior.appendChild(note);
   const priorRows=previousLocations(data,state).map(row=>({...row,c:checkbox(prior,label(row.scene)+' · '+row.rewards.length)}));
   const quick=action(t('Выдать все','Видати всі'),()=>{let count=0;priorRows.forEach(x=>x.rewards.forEach(r=>{if(give(data,state,r))count++;}));return t('Выдано наград: ','Видано нагород: ')+count;});quick.className='zg-test-prior-quick';quick.disabled=!priorRows.some(x=>x.rewards.length);quick.title=t('Выдать все предметы предыдущих локаций','Видати всі предмети попередніх локацій');quick.setAttribute('aria-label',quick.title);const quickClick=quick.onclick;quick.onclick=e=>{e.preventDefault();e.stopPropagation();quickClick();};heading.appendChild(quick);
   const priorAll=selectAll(prior,t('Выбрать все предыдущие локации','Вибрати всі попередні локації'),priorRows.map(x=>x.c));prior.insertBefore(priorAll.parentNode,note.nextSibling);
   const priorButton=action(t('Выдать предметы выбранных локаций','Видати предмети вибраних локацій'),()=>{let count=0;priorRows.filter(x=>x.c.checked).forEach(x=>x.rewards.forEach(r=>{if(give(data,state,r))count++;}));return t('Выдано наград: ','Видано нагород: ')+count;});priorButton.disabled=!priorRows.length;prior.appendChild(priorButton);
   el('small',t('Переход: снимает ограничения только выбранного выхода в тестовой копии. Не запускает сюжетные ветки.','Перехід: знімає обмеження лише вибраного виходу в тестовій копії. Не запускає сюжетні гілки.'));
   p.exits.forEach(exit=>action(t('Подготовить: ','Підготувати: ')+(label(exit)||exit.sceneId),()=>{const values={enabled:true,visible:true,hidden:false,requires:'',requiresEquippedItem:''};Object.assign(exit,values);const kind=(scene.tokens||[]).includes(exit)?'tokens':(scene.story?.zones||[]).includes(exit)?'zones':'decorations';const key=JSON.stringify([state.sceneId,kind,exit.id]);state.quests=state.quests||{active:'',done:[]};const objects=state.quests.actionObjects||(state.quests.actionObjects={});objects[key]={sceneId:state.sceneId,kind,id:exit.id,values};return t('Выход доступен: ','Вихід доступний: ')+exit.sceneId;}));
   action(t('Сбросить весь тест','Скинути весь тест'),()=>{ctx.reset();return '';});
   el('small',t('Побочные задания и сложные сценарии могут требовать ручного прохождения. Видео, покупки и альтернативные концовки автоматически не запускаются.','Побічні завдання й складні сценарії можуть потребувати ручного проходження. Відео, покупки й альтернативні кінцівки автоматично не запускаються.'));
  }
  host.addEventListener('toggle',()=>{if(host.open)draw();});
 }
 w.ZargotaStoryTestTools={plan,previousLocations,complete,give,mount};
})(window);
