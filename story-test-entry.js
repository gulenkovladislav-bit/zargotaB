(function(w){
 const t=(a,b)=>w.ZargotaI18n?.getLocale()==='uk'?b:a;
 // Search isolated runtime states, never the editor's scene ordering.
 function prepare(data,target,limit=3000){
  const copy=x=>JSON.parse(JSON.stringify(x)),rules=w.ZargotaStoryRules;
  const initial=rules.createState(data);initial.sceneId=data.startSceneId||data.scenes?.[0]?.id||data.activeSceneId;
  const queue=[{state:initial,node:'',entry:'',route:[],used:[]}],seen=new Set();let index=0;
  const records=data.scenes||[],nodeById=id=>(data.nodes||[]).find(n=>n.id===id);
  function allowed(o,s){return !o.requires||!!s.flags[o.requires];}
  function equipped(o,s){return !o.requiresEquippedItem||(s.character?.inventoryItems||[]).some(i=>i.itemId===o.requiresEquippedItem&&i.equipped&&i.qty!==0);}
  function actions(list,s,questActions=false){for(const a of list||[]){if(a.enabled===false)continue;
   if(a.type==='giveItem'){
    if(!questActions&&a.actionId&&s.receivedItemActions?.[a.actionId])continue;
    const item=w.ZargotaStoryItems.list(data).find(i=>i.itemId===a.itemId);if(!item||!s.character)return false;
    const result=w.ZargotaStoryItems.award(s.character,item,a.qty,!questActions&&a.equip);s.character=result.character;
    if(!questActions&&a.actionId)(s.receivedItemActions||(s.receivedItemActions={}))[a.actionId]=true;
   }else if(a.type==='travel'){if(!records.some(r=>r.id===a.sceneId))return false;s.sceneId=a.sceneId;}
   else if(['reveal','hide','enable','disable','spawn'].includes(a.type)){
    const key=JSON.stringify([a.sceneId||'',a.kind||'tokens',a.id]),all=s.quests.actionObjects||(s.quests.actionObjects={}),old=all[key];
    const values=a.type==='reveal'?{visible:true,enabled:true,hidden:false,opacity:1}:a.type==='hide'?{visible:false,markerVisible:false,opacity:0}:a.type==='spawn'?Object.assign({},a.object,{id:a.id,enabled:true,visible:true,hidden:false}):{enabled:a.type==='enable'};
    all[key]={sceneId:a.sceneId||'',kind:a.kind||'tokens',id:a.id,spawn:a.type==='spawn'||old?.spawn,values:Object.assign({},old?.values,values)};
   }else if(!['sound','music','wait','fx','projectile'].includes(a.type))return false;
  }return true;}
  function push(row,state,node,entry,step,key){if(queue.length>=limit)return;queue.push({state,node:node||'',entry:entry||'',route:row.route.concat(step),used:row.used.concat(key||[])});}
  while(index<queue.length&&index<limit){const row=queue[index++],s=row.state;
   if(s.sceneId===target)return {ok:true,state:s,route:row.route,examined:index};
   const signature=JSON.stringify([s,row.node,row.entry,row.used.slice().sort()]);if(seen.has(signature))continue;seen.add(signature);
   if(row.node){
    const base=nodeById(row.node);if(!base||s.visited.includes(base.id))continue;
    // Outcomes of games and spatial sequences cannot be inferred safely.
    if(base.beforeActions?.length||base.afterActions?.length||base.openTravelMap||w.ZargotaCardGame?.match(data,base.id))continue;
    const n=w.ZargotaStoryBranch?w.ZargotaStoryBranch.resolve(data,base):base;
    const entered=copy(s);entered.visited.push(n.id);entered.nodeId=n.id;
    if(!actions(n.beforeWorldActions,entered))continue;if(n.effect)entered.flags[n.effect]=true;
    if(n.damage&&entered.character)entered.character.hp=Math.max(0,Number(entered.character.hp)-Math.max(0,Number(n.damage)||0));
    const pages=w.ZargotaStoryPages?w.ZargotaStoryPages.pages(n):[n,...(n.slides||[])];
    if(pages.some(p=>p.afterActions?.length)||!pages.every(p=>actions(p.afterPageActions,entered)))continue;
    const last=pages[pages.length-1];
    const links=pages[pages.length-1].links||n.links||[],choices=[];
    for(const link of links){const next=copy(entered),destination=rules.choose(Object.assign({},data,{nodes:[Object.assign({},n,{links}),...(data.nodes||[]).filter(x=>x.id!==n.id)]}),next,n.id,link.id);if(destination)choices.push({next,destination,link});}
    if(!choices.length&&links.length)continue;
    if(!links.length)choices.push({next:copy(entered),destination:{},link:null});
    for(const choice of choices){const next=choice.next;
     if(last.afterEffect)next.flags[last.afterEffect]=true;if(!actions(last.afterWorldActions,next))continue;
     w.ZargotaStorySideQuests?.complete(data,next,n.id);
     const q=w.ZargotaStoryQuests.complete(data,next.quests,n.id);if(q){if(q.flag)next.flags[q.flag]=true;if(!actions(w.ZargotaStoryQuestActions.list(q),next,true))continue;}
     const d=choice.destination;if(d.sceneId)next.sceneId=d.sceneId;
     if(!d.to&&!d.sceneId)next.completedDialogues[row.entry||n.id]=true;
     push(row,next,d.to,d.to?(row.entry||n.id):'',{sceneId:s.sceneId,nodeId:n.id,linkId:choice.link?.id||''});
    }continue;
   }
   w.ZargotaStoryQuests.enter(data,s.quests,s.sceneId);
   const q=(data.quests||[]).find(q=>q.id===s.quests.active);
   const milestone=(q?.milestones||[]).find(m=>{const ids=Array.from(new Set(m.dialogueIds||[])),min=Number(m.minCompleted);return m.id&&!s.dialogueMilestones?.[m.id]&&(!m.sceneId||m.sceneId===s.sceneId)&&equipped(m,s)&&nodeById(m.nodeId)&&Number.isInteger(min)&&min>=0&&min<=ids.length&&ids.filter(id=>s.completedDialogues[id]).length>=min;});
   if(milestone){const next=copy(s);(next.dialogueMilestones||(next.dialogueMilestones={}))[milestone.id]=true;push(row,next,milestone.nodeId,milestone.nodeId,{sceneId:s.sceneId,milestoneId:milestone.id});continue;}
   const record=records.find(r=>r.id===s.sceneId);if(!record)continue;
   const view=w.ZargotaStoryQuests.gatedScene(data,record.scene,s.sceneId,s.quests);
   for(const o of [...(view.tokens||[]),...(view.story?.zones||[])]){
    const key=s.sceneId+':'+o.id;if(row.used.includes(key)||s.consumed?.[key]||o.enabled===false||o.visible===false||o.blocked||o.spatial||!allowed(o,s)||!equipped(o,s))continue;
    const interaction=data.interactions?.[o.id],entry=o.entryId||(interaction?.main?data.entryId:interaction?.entryId);
    const next=copy(s);if(o.pickup){if(!w.ZargotaStorySecrets.collect(data,next,s.sceneId,o).ok)continue;}
    else if(!entry&&!o.sceneId&&!o.effect)continue;
    if((view.story?.zones||[]).includes(o)&&o.effect)next.flags[o.effect]=true;if(o.hideAfterInteraction)(next.consumed||(next.consumed={}))[key]=true;
    if(o.sceneId)next.sceneId=o.sceneId;
    const routed=entry&&w.ZargotaStorySideQuests?w.ZargotaStorySideQuests.route(data,next,entry):entry;
    push(row,next,routed,routed,{sceneId:s.sceneId,objectId:o.id,toSceneId:o.sceneId||''},key);
   }
  }
  return {ok:false,reason:queue.length>=limit?'limit':'unresolved',route:[],examined:index};
 }
 // Test-only union of rewards and completion from every earlier editor location.
 function prepareAll(data,target){
  const records=data.scenes||[],index=records.findIndex(r=>r.id===target);
  if(index<0)return {ok:false,reason:'missing'};
  const state=w.ZargotaStoryRules.createState(data),helpers=w.ZargotaStoryTestTools;
  const prior=records.slice(0,index),quests=new Map();
  for(const record of prior){
   state.sceneId=record.id;
   const scoped=Object.assign({},data,{activeSceneId:record.id,scene:record.scene||{}});
   const plan=helpers.plan(scoped,state,scoped.scene);
   plan.rewards.forEach(reward=>helpers.give(data,state,reward));
   plan.quests.forEach(q=>quests.set(q.id,q));
   for(const node of w.ZargotaStoryLocationDialogues.nodes(scoped,record.id)){
    if(!state.visited.includes(node.id))state.visited.push(node.id);
    state.completedDialogues[node.id]=true;
    for(const page of [node,...(node.slides||[])]){
     if(page.effect)state.flags[page.effect]=true;
     if(page.afterEffect)state.flags[page.afterEffect]=true;
     for(const link of page.links||[])if(link.effect)state.flags[link.effect]=true;
    }
   }
  }
  helpers.complete(data,state,Array.from(quests.values()));
  state.sceneId=target;state.nodeId='';
  return {ok:true,state};
 }
 function choose(data,done){
  const dialog=document.createElement('dialog');dialog.className='zg-custom-menu';
  const title=document.createElement('header');title.textContent=t('Вход на локацию · тест','Вхід на локацію · тест');
  const note=document.createElement('p');note.textContent=t('Выберите активное задание. Его завершение запустит обычные действия. Настройки эпизода не изменятся.','Оберіть активне завдання. Його завершення запустить звичайні дії. Налаштування епізоду не зміняться.');
  const preparation=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;preparation.append(check,document.createTextNode(t(' Выдать все предметы и завершить задания предыдущих локаций',' Видати всі предмети та завершити завдання попередніх локацій')));
  const list=document.createElement('div');list.className='zg-custom-options';
  const nodes=w.ZargotaStoryLocationDialogues.nodes(data,data.activeSceneId);
  let selected=(data.quests||[]).find(q=>[q.dialogueId,...(q.dialogueIds||[])].some(id=>nodes.some(n=>n.id===id)))?.id||data.initialQuestId||'';
  const buttons=[];
  [{id:'',title:t('Без задания','Без завдання')},...(data.quests||[])].forEach(q=>{
   const b=document.createElement('button');b.type='button';b.textContent=t(q.title||q.id,q.titleUk||q.title||q.id);
   const update=()=>b.setAttribute('aria-pressed',String(selected===q.id));buttons.push(update);update();
   b.onclick=()=>{selected=q.id;buttons.forEach(fn=>fn());};list.appendChild(b);
  });
  const start=document.createElement('button');start.textContent=t('▶ Зайти на локацию','▶ Зайти на локацію');
  start.onclick=()=>{dialog.remove();done(selected,check.checked);};
  const cancel=document.createElement('button');cancel.textContent=t('Отмена','Скасувати');cancel.onclick=()=>dialog.remove();
  dialog.addEventListener('cancel',()=>dialog.remove());
  const help=document.createElement('p');help.textContent=t('Все локации выше выбранной в списке редактора, включая награды альтернативных веток. Только в тестовой копии.','Усі локації вище обраної у списку редактора, включно з нагородами альтернативних гілок. Лише в тестовій копії.');
  dialog.append(title,note,preparation,help,list,start,cancel);document.body.appendChild(dialog);dialog.showModal();
 }
 w.ZargotaStoryTestEntry={choose,prepare,prepareAll};
})(window);
