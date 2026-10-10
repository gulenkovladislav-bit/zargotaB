(function(w){
 'use strict';
 const t=(ru,uk)=>w.ZargotaI18n?.getLocale()==='uk'?uk:ru;
 const fields=['speaker','emotion','portrait','speakerName','speakerNameUk','showPortrait','textAnimation','textSpeed','textSize'];
 function root(project,edit){return edit.cardReplySource?w.ZargotaCardEvents?.replyTarget(project,edit.cardReplySource):project.nodes?.find(n=>n.id===edit.nodeId);}
 function apply(project,edit){
  const node=root(project,edit);if(!node||!Number.isInteger(edit.pageIndex)||edit.pageIndex<0)return false;
  const page=edit.pageIndex===0?node:node.slides?.[edit.pageIndex-1];if(!page)return false;
  if(edit.operation==='imageSecrets'){
   if(JSON.stringify(page.imageSecrets||[])!==edit.expected||!w.ZargotaImageSecrets?.valid(edit.rows))return false;
   page.imageSecrets=JSON.parse(JSON.stringify(edit.rows));return true;
  }
  if(edit.operation==='insertPage'){
   if(JSON.stringify(node.slides||[])!==edit.expected)return false;
   const effective=Object.assign({},node,page);
   const blank={text:'',textUk:'',speaker:effective.speaker||'',emotion:effective.emotion||'',portrait:effective.portrait||'',speakerName:effective.speakerName||'',speakerNameUk:effective.speakerNameUk||'',musicEvent:null,afterPageActions:[],kind:'dialogue'};
   node.slides=node.slides||[];node.slides.splice(edit.pageIndex,0,blank);return true;
  }
  if(edit.operation!=='pageSettings'||!edit.values||Object.keys(edit.values).some(k=>!fields.includes(k)))return false;
  if(Object.keys(edit.values).some(k=>page[k]!==edit.expected[k]))return false;
  if(Object.entries(edit.values).some(([k,v])=>k==='showPortrait'?typeof v!=='boolean':['textSpeed','textSize'].includes(k)?!Number.isFinite(v)||v<(k==='textSpeed'?5:16)||v>(k==='textSpeed'?100:48):typeof v!=='string'))return false;
  Object.assign(page,edit.values);return true;
 }
 function portraitChoices(project,id){
  const key=id==='@player'?project.playerSpeakerId:id,actor=project.speakers?.[key]||{};
  const outfit=key===project.playerSpeakerId?actor.equipmentPortraits:null;
  return [['',actor],...Object.entries(actor.emotions||{})].map(([emotion,data])=>[emotion,Object.assign({},data,{portrait:outfit?(outfit.emotions?.[emotion]||(emotion?data.portrait:null)||outfit.portrait||data.portrait):data.portrait})]);
 }
 const recentSearchKey='zg-portrait-recent-searches-v1';
 let recentSearches=[];
 function searchHistory(query){
  try{const saved=JSON.parse(w.localStorage.getItem(recentSearchKey)||'[]');if(Array.isArray(saved))recentSearches=saved.filter(v=>typeof v==='string'&&v.trim()).slice(0,8);}catch(_){}
  const value=typeof query==='string'?query.trim().slice(0,100):'';
  if(value){recentSearches=[value,...recentSearches.filter(v=>v.toLocaleLowerCase()!==value.toLocaleLowerCase())].slice(0,8);try{w.localStorage.setItem(recentSearchKey,JSON.stringify(recentSearches));}catch(_){}}
  return recentSearches.slice();
 }
 const cleanups=new WeakMap();
 function unmount(host){cleanups.get(host)?.();cleanups.delete(host);host.querySelectorAll('.zg-live-page-tools').forEach(e=>e.remove());}
 function mount(host,project,meta,save,refresh){
  unmount(host);
  const node=root(project,meta),page=meta.pageIndex===0?node:node?.slides?.[meta.pageIndex-1];if(!page)return;
  const effective=Object.assign({},node,page),bar=document.createElement('div');bar.className='zg-live-page-tools';const restores=[];
  cleanups.set(host,()=>restores.forEach(fn=>fn()));
  function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=e=>{e.stopPropagation();fn();};return b;}
  function commit(edit){if(!save(Object.assign({},meta,edit))){w.showToast?.(t('Реплика изменилась. Откройте настройки заново.','Репліка змінилася. Відкрийте налаштування знову.'));return false;}return true;}
  function change(values){const expected={};Object.keys(values).forEach(k=>expected[k]=page[k]);if(commit({operation:'pageSettings',values,expected}))refresh(meta.pageIndex,false);}
  function panel(title){bar.querySelectorAll('.zg-live-page-fields').forEach(e=>e.remove());const box=document.createElement('div');box.className='zg-live-page-fields';const header=document.createElement('header'),heading=document.createElement('strong');heading.textContent=title;const close=button('×',()=>box.remove());close.setAttribute('aria-label',t('Закрыть','Закрити'));header.append(heading,close);box.appendChild(header);bar.appendChild(box);return box;}
  function bind(target,title,action){if(!target)return;const oldClick=target.onclick,oldKey=target.onkeydown,oldTab=target.getAttribute('tabindex'),oldTitle=target.getAttribute('title');target.dataset.livePageTarget='';target.tabIndex=0;target.title=title;target.onclick=e=>{e.stopPropagation();action();};target.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();action();}};restores.push(()=>{target.onclick=oldClick;target.onkeydown=oldKey;delete target.dataset.livePageTarget;if(oldTab==null)target.removeAttribute('tabindex');else target.setAttribute('tabindex',oldTab);if(oldTitle==null)target.removeAttribute('title');else target.setAttribute('title',oldTitle);});}
  function portraits(){
   const box=panel(t('Кто говорит · портрет','Хто говорить · портрет'));
   const search=document.createElement('input');search.type='search';search.className='zg-live-actor-search';search.placeholder=t('Поиск по имени…','Пошук за ім’ям…');search.setAttribute('aria-label',search.placeholder);box.appendChild(search);
   const recent=document.createElement('div');recent.className='zg-live-recent-searches';box.appendChild(recent);
   function renderRecent(){const history=searchHistory();recent.replaceChildren();recent.hidden=!history.length;if(!history.length)return;const label=document.createElement('span');label.textContent=t('Недавние:','Нещодавні:');recent.appendChild(label);history.forEach(query=>recent.appendChild(button(query,()=>{search.value=query;search.oninput();remember();})));}
   function remember(){searchHistory(search.value);renderRecent();}
   search.onchange=remember;
   search.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();remember();}};
   renderRecent();
   const actors=document.createElement('div');actors.className='zg-live-actor-list';box.appendChild(actors);const empty=document.createElement('p');empty.textContent=t('Никого не найдено','Нікого не знайдено');empty.hidden=true;box.appendChild(empty);
   search.oninput=()=>{const query=search.value.trim().toLocaleLowerCase();let count=0;actors.querySelectorAll('button').forEach(b=>{const actor=project.speakers?.[b.dataset.actor==='@player'?project.playerSpeakerId:b.dataset.actor]||{};b.hidden=![b.textContent,actor.name,actor.nameUk].some(name=>(name||'').toLocaleLowerCase().includes(query));if(!b.hidden)count++;});empty.hidden=count>0;};
   const grid=document.createElement('div');grid.className='zg-live-portrait-grid';box.appendChild(grid);
   function show(id){grid.replaceChildren();actors.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.actor===id)));const actor=project.speakers?.[id==='@player'?project.playerSpeakerId:id]||{};
    portraitChoices(project,id).forEach(([emotion,data])=>{if(!data.portrait)return;const pick=button(t(data.name||'Основной',data.nameUk||data.name||'Основний'),()=>{remember();change({speaker:id,emotion,portrait:data.portrait,showPortrait:true});});const img=document.createElement('img');img.src=data.portrait;img.alt='';pick.prepend(img);pick.setAttribute('aria-pressed',String(id===effective.speaker&&emotion===(effective.emotion||'')));grid.appendChild(pick);});
   }
   [['@player',t('Герой','Герой')],...Object.entries(project.speakers||{}).map(([id,s])=>[id,t(s.name||id,s.nameUk||s.name||id)])].forEach(([id,name])=>{const b=button(name,()=>{remember();show(id);});b.dataset.actor=id;actors.appendChild(b);});show(effective.speaker||project.playerSpeakerId);
  }
  const name=host.querySelector('.zg-story-speaker-name');
  bind(host.querySelector('.zg-story-speaker-frame'),t('Изменить портрет и говорящего','Змінити портрет і мовця'),portraits);
  bind(name,t('Изменить имя в этой реплике','Змінити ім’я в цій репліці'),()=>{
   if(name.querySelector('input'))return;const original=name.textContent,input=document.createElement('input');input.className='zg-live-name-input';input.value=original;input.setAttribute('aria-label',t('Имя в этой реплике','Ім’я в цій репліці'));let ended=false;
   function finish(cancel){if(ended)return;ended=true;const value=input.value.trim();name.textContent=original;if(!cancel&&value!==original)change({[w.ZargotaI18n?.getLocale()==='uk'?'speakerNameUk':'speakerName']:value});}
   input.onclick=e=>e.stopPropagation();input.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(false);}if(e.key==='Escape'){e.preventDefault();finish(true);}};input.onblur=()=>finish(false);name.replaceChildren(input);input.focus();input.select();restores.push(()=>{ended=true;if(name.contains(input))name.textContent=original;});
  });
  bar.appendChild(button(t('+ Реплика','+ Репліка'),()=>{if(commit({operation:'insertPage',expected:JSON.stringify(node.slides||[])}))refresh(meta.pageIndex+1,true);}));
  const gear=button('⚙',()=>{
   if(bar.querySelector('.zg-live-page-fields')){bar.querySelector('.zg-live-page-fields').remove();return;}
   const box=panel(t('Отображение реплики','Відображення репліки')),values={};
   if(effective.image)box.appendChild(button(t('Тайники на картинке','Схованки на зображенні'),()=>{
    const expected=JSON.stringify(page.imageSecrets||[]);
    const close=w.ZargotaImageSecrets.edit(project,effective,rows=>{if(!commit({operation:'imageSecrets',expected,rows}))return false;refresh(meta.pageIndex,false);return true;});restores.push(close);
   }));
   const label=document.createElement('p');label.textContent=t('Появление текста','Поява тексту');box.appendChild(label);const modes=document.createElement('div');modes.className='zg-live-animation-modes';
   [['typewriter',t('Печать','Друк')],['fade',t('Плавно','Плавно')],['rise',t('Снизу','Знизу')],['none',t('Сразу','Одразу')]].forEach(([id,title])=>{const b=button(title,()=>{values.textAnimation=id;modes.querySelectorAll('button').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));});b.setAttribute('aria-pressed',String(id===(effective.textAnimation||'typewriter')));modes.appendChild(b);});box.appendChild(modes);
   function range(key,title,min,max,fallback,suffix){const row=document.createElement('label'),output=document.createElement('span'),input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=1;input.value=effective[key]||fallback;const update=()=>{output.textContent=title+' · '+input.value+suffix;};update();input.oninput=()=>{values[key]=Number(input.value);update();};row.append(output,input);box.appendChild(row);}
   range('textSpeed',t('Скорость','Швидкість'),5,100,37,t(' зн./с',' зн./с'));range('textSize',t('Размер','Розмір'),16,48,30,' px');
   const portrait=button(effective.showPortrait===false?t('Показать портрет','Показати портрет'):t('Скрыть портрет','Приховати портрет'),()=>change({showPortrait:effective.showPortrait===false}));box.appendChild(portrait);
   if(effective.showPortrait===false)box.appendChild(button(t('Выбрать портрет','Обрати портрет'),portraits));
   box.appendChild(button(t('Применить','Застосувати'),()=>change(values)));
  });gear.setAttribute('aria-label',t('Настройки отображения реплики','Налаштування відображення репліки'));bar.appendChild(gear);host.appendChild(bar);
 }
 function answer(host,button,nodeId,link,linkIndex,save,done){
  const pencil=document.createElement('span');pencil.className='zg-card-choice-pencil';pencil.dataset.livePageTarget='';pencil.tabIndex=0;pencil.setAttribute('role','button');pencil.setAttribute('aria-label',t('Изменить ответ','Змінити відповідь')+': '+(link.label||''));pencil.title=t('Изменить текст ответа','Змінити текст відповіді');
  function open(){host.querySelectorAll('.zg-live-answer-form').forEach(e=>e.remove());const form=document.createElement('div');form.className='zg-live-page-tools zg-live-answer-form';const input=document.createElement('textarea'),field=w.ZargotaI18n?.getLocale()==='uk'?'labelUk':'label';input.value=link[field]||link.label||'';input.setAttribute('aria-label',t('Текст ответа','Текст відповіді'));
   const expected=link[field];function control(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=e=>{e.stopPropagation();fn();};return b;}
   form.append(input,control(t('Сохранить','Зберегти'),()=>{const edit={nodeId,linkId:link.id,linkIndex,field,expected,value:input.value};if(save(edit)){link[field]=edit.value;form.remove();done();}else w.showToast?.(t('Ответ изменился. Откройте его снова.','Відповідь змінилася. Відкрийте її знову.'));}),control(t('Отмена','Скасувати'),()=>form.remove()));host.appendChild(form);input.focus();
  }
  pencil.onclick=e=>{e.stopPropagation();open();};pencil.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();open();}};button.appendChild(pencil);
 }
 w.ZargotaLivePageEditor={apply,mount,unmount,answer,portraitChoices,searchHistory};
})(window);
