(function(w){
 'use strict';
 var dialog=null,model=null,editing=false,storageKey='',owner='',returnTo=null;
 function locale(){return w.ZargotaI18n?.getLocale()==='uk'?'uk':'ru';}
 function t(ru,uk){return locale()==='uk'?uk:ru;}
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function identity(){return w.ZargotaPersistentCharacters?.tableIdentity?.().uid||'local';}
 function close(){if(dialog)dialog.remove();dialog=null;model=null;returnTo?.focus({preventScroll:true});}
 function clean(value){return {title:String(value.title||'').slice(0,200),items:(Array.isArray(value.items)?value.items:[]).slice(0,30).map(x=>({kind:String(x.kind||'').slice(0,80),title:String(x.title||'').slice(0,200),text:String(x.text||'').slice(0,4000),icon:String(x.icon||'◇').slice(0,12),tone:['secret','trigger','warning','roleplay','mechanic'].includes(x.tone)?x.tone:'roleplay'}))};}
 function field(name,label,value,area,max){return '<label>'+esc(label)+(area?'<textarea':'<input type="text"')+' data-field="'+name+'" maxlength="'+max+'"'+(area?' rows="3">'+esc(value)+'</textarea>':' value="'+esc(value)+'">')+'</label>';}
 function collect(){if(!editing)return;model.title=dialog.querySelector('[data-heading]').value;model.items=Array.from(dialog.querySelectorAll('[data-reminder-row]')).map((el,i)=>{var x=Object.assign({},model.items[i]);el.querySelectorAll('[data-field]').forEach(f=>x[f.dataset.field]=f.value);return x;});}
 function paint(){
  dialog.innerHTML='<header><span class="zg-gmr-emblem" aria-hidden="true">?</span><div><small>'+t('Памятка мастера','Пам’ятка майстра')+'</small><h2 id="zg-gmr-title">'+esc(model.title)+'</h2></div><button type="button" data-reminder-close aria-label="'+t('Закрыть','Закрити')+'">×</button></header>'+
   '<div class="zg-gmr-content">'+(editing?'<label>'+t('Заголовок памятки','Заголовок пам’ятки')+'<input data-heading maxlength="200" value="'+esc(model.title)+'"></label><p class="zg-gmr-hint">'+t('Личная памятка сохраняется в этом браузере.','Особиста пам’ятка зберігається в цьому браузері.')+'</p>':'')+
   model.items.map((x,i)=>'<article data-reminder-row data-tone="'+esc(x.tone)+'"><span class="zg-gmr-icon" aria-hidden="true">'+esc(x.icon)+'</span><div>'+(editing?field('kind',t('Раздел','Розділ'),x.kind,false,80)+field('title',t('Заголовок','Заголовок'),x.title,false,200)+field('text',t('Напоминание','Нагадування'),x.text,true,4000)+'<button type="button" class="zg-gmr-remove" data-reminder-remove="'+i+'">'+t('Удалить блок','Видалити блок')+'</button>':'<small>'+esc(x.kind)+'</small><h3>'+esc(x.title)+'</h3><p>'+esc(x.text)+'</p>')+'</div></article>').join('')+
   (!model.items.length&&!editing?'<p>'+t('Добавь подсказки для этого персонажа.','Додай підказки для цього персонажа.')+'</p>':'')+
   (editing?'<button type="button" data-reminder-add '+(model.items.length>=30?'disabled':'')+'>+ '+t('Добавить блок','Додати блок')+'</button>':'')+'</div><footer><p role="alert"></p>'+
   (editing?'<button type="button" data-reminder-cancel>'+t('Отмена','Скасувати')+'</button><button type="button" data-reminder-save>'+t('Сохранить','Зберегти')+'</button>':'<button type="button" data-reminder-edit>✎ '+t('Редактировать','Редагувати')+'</button>')+'</footer>';
 }
 var initial;
 function open(row,character,button){
  close();owner=identity();returnTo=button;editing=false;
  storageKey='zg-gm-reminder-v1:'+owner+':'+(row.shared?.sheetId||character.id)+':'+locale();
  initial=clean(w.zgIrlGmFocusData?.(character)||{title:character.name,items:[]});model=initial;
  try{var saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&Array.isArray(saved.items))model=clean(saved);}catch(_){}
  initial=JSON.parse(JSON.stringify(model));
  dialog=document.createElement('dialog');dialog.className='zg-gm-reminder';dialog.setAttribute('data-zg-i18n-skip','');dialog.setAttribute('aria-labelledby','zg-gmr-title');
  dialog.addEventListener('cancel',ev=>{ev.preventDefault();ev.stopPropagation();close();});
  dialog.addEventListener('click',ev=>{
   var b=ev.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-reminder-close'))return close();
   if(owner!==identity())return close();
   if(b.hasAttribute('data-reminder-edit')){editing=true;paint();dialog.querySelector('input')?.focus();}
   else if(b.hasAttribute('data-reminder-cancel')){model=JSON.parse(JSON.stringify(initial));editing=false;paint();}
   else if(b.hasAttribute('data-reminder-add')){collect();if(model.items.length<30)model.items.push({kind:'',title:'',text:'',icon:'◇',tone:'roleplay'});paint();dialog.querySelector('[data-reminder-row]:last-of-type input')?.focus();}
   else if(b.hasAttribute('data-reminder-remove')){collect();model.items.splice(Number(b.dataset.reminderRemove),1);paint();}
   else if(b.hasAttribute('data-reminder-save')){collect();model=clean(model);try{localStorage.setItem(storageKey,JSON.stringify(model));initial=JSON.parse(JSON.stringify(model));editing=false;paint();}catch(_){dialog.querySelector('[role=alert]').textContent=t('Не удалось сохранить. Скопируй текст перед закрытием.','Не вдалося зберегти. Скопіюй текст перед закриттям.');}}
  });
  document.body.appendChild(dialog);paint();dialog.showModal();
 }
 function refresh(){if(dialog&&(owner!==identity()||!document.body.classList.contains('zg-irl-table-view')))close();}
 document.addEventListener('zargota:localechange',close);
 w.ZargotaGmReminders={open:open,close:close,refresh:refresh};
})(window);
