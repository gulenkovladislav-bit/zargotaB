(function(w){
  'use strict';
  var R=w.ZargotaCharacterReview, key='zargota_character_cloud_v1', state={records:{},pending:[]}, live={},started=false,busy=false,error='';
  function id(){var a=new Uint8Array(16);w.crypto.getRandomValues(a);return Array.from(a,function(v){return v.toString(16).padStart(2,'0');}).join('');}
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  var store=w.ZargotaCharacterCloudStore.create(function(){return w.ZargotaRooms.characterCloudTransport();},id);
  try{var saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&saved.records&&Array.isArray(saved.pending))state=saved;}catch(_){}
  function persist(){localStorage.setItem(key,JSON.stringify(state));}
  function character(){var view=document.getElementById('char-sheet-view');if(!view||view.style.display==='none')return null;return (w.characters||[]).find(function(c){return String(c.id)===String(w.viewingCharId);});}
  function binding(c){if(!c)return null;return Object.keys(state.records).find(function(sid){return String(state.records[sid].characterId)===String(c.id);})||null;}
  function message(e){var code=String(e&&e.code||e&&e.message||e);
    if(/permission.denied|PERMISSION_DENIED/i.test(code))return t('Нет доступа. Мастер должен подтвердить приглашение; новые правила Firebase должны быть опубликованы.','Немає доступу. Майстер має підтвердити запрошення; нові правила Firebase мають бути опубліковані.');
    if(code==='review-conflict')return t('Данные изменились во время просмотра. Откройте сравнение заново.','Дані змінилися під час перегляду. Відкрийте порівняння знову.');
    if(code==='already-resolved')return t('Эта заявка уже обработана.','Цю заявку вже опрацьовано.');
    if(/too-large/.test(code))return t('Слишком большой лист или запрос. Уменьшите встроенные изображения перед отправкой.','Аркуш або запит завеликі. Зменште вбудовані зображення перед надсиланням.');
    return t('Не удалось сохранить или загрузить изменения. Черновик остаётся на устройстве.','Не вдалося зберегти або завантажити зміни. Чернетка залишається на пристрої.')+' '+code;
  }
  function fail(e){error=message(e);var alert=document.querySelector('#character-cloud-dialog [role=alert]');if(alert)alert.textContent=error;render();}
  function run(fn){if(busy)return;busy=true;error='';render();Promise.resolve().then(fn).catch(fail).finally(function(){busy=false;render();});}
  function changed(c){var sid=binding(c),record=sid&&state.records[sid];return !!(record&&record.base&&R.diff(record.base,c).length);}
  function prepareLocal(chars){chars.forEach(function(c,index){if(binding(c))Object.assign(c,R.prepare(c,id));});}
  function saveLocal(sid,data,base){
    var record=state.records[sid],chars=w.characters||[],index=chars.findIndex(function(c){return String(c.id)===String(data.id);});
    var previous=index<0?null:R.clone(chars[index]),oldBase=R.clone(record.base),oldId=record.characterId;
    if(index<0)chars.push(data);else chars[index]=data;
    record.base=R.clone(base);record.characterId=data.id;
    try{persist();}catch(e){record.base=oldBase;record.characterId=oldId;if(index>=0)chars[index]=previous;else chars.pop();throw e;}
    data._updatedAt=Date.now();data.revision=Math.max(Number(data.revision)||0,Number(previous&&previous.revision)||0)+1;
    return w.ZargotaCharacterStore.saveCharacter(data.id,data,chars,{replace:true}).then(function(result){
      if(!result.ok){record.base=oldBase;record.characterId=oldId;persist();if(index>=0)chars[index]=previous;else chars.splice(chars.indexOf(data),1);throw Error('local-storage-failed');}
      if(String(w.viewingCharId)===String(data.id)&&typeof w.renderCharSheet==='function')w.renderCharSheet();
      if(typeof w.renderCharList==='function')w.renderCharList();render();
    });
  }
  function receive(sid,approved){
    var record=state.records[sid],current=(w.characters||[]).find(function(c){return String(c.id)===String(record.characterId);});
    if(!approved||!record.base)return;
    // Do not replace a sheet while the editor holds unsaved form values or a live room owns its runtime.
    var editor=document.getElementById('char-editor-view'),session=w.ZargotaRooms.getSnapshot().session;
    if((editor&&editor.style.display!=='none')||session||document.getElementById('character-cloud-dialog')||(document.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)&&document.activeElement.closest('#char-sheet'))){record.deferred=true;render();return;}
    var merged=current?R.rebase(record.base,current,approved.data):{base:approved.data,character:approved.data};
    record.deferred=false;
    if(current&&R.equal(current,merged.character)){record.base=R.clone(merged.base);persist();render();return;}
    saveLocal(sid,merged.character,merged.base).catch(fail);
  }
  function watch(sid){
    if(live[sid])return;live[sid]={requests:{},joins:{}};
    state.records[sid]=state.records[sid]||{};persist();
    live[sid].stop=store.watch(sid,function(kind,value,identity){
      live[sid].master=identity.master;live[sid].uid=identity.uid;live[sid][kind]=value;
      if(kind==='approved')receive(sid,value);render();
    },fail);
  }
  function start(){if(started)return;started=true;store.list().then(function(ids){ids.forEach(watch);render();}).catch(function(e){started=false;fail(e);});}
  function button(action,label,attrs){return '<button type="button" class="btn btn-dim btn-sm" data-cloud-action="'+action+'" '+(attrs||'')+' '+(busy?'disabled':'')+'>'+label+'</button>';}
  function pendingRequests(){var rows=[];Object.keys(live).forEach(function(sid){var item=live[sid];if(!item.master)return;Object.keys(item.requests||{}).forEach(function(uid){Object.values(item.requests[uid]||{}).forEach(function(r){if(r.status==='pending')rows.push({sid:sid,request:r});});});});return rows;}
  function render(){
    var panel=document.getElementById('character-cloud-panel');if(!panel)return;
    var c=character(),sid=binding(c),item=sid&&live[sid],record=sid&&state.records[sid],dirty=record&&record.base&&c?R.diff(record.base,c).length:0;
    var html='<div class="character-cloud-actions"><strong>'+t('Синхронизация листов','Синхронізація аркушів')+'</strong>';
    if(!sid&&c)html+=button('create',t('Сделать этот лист общим','Зробити цей аркуш спільним'));
    html+=button('join',t('Подключиться по приглашению','Приєднатися за запрошенням'));
    if(sid&&item){html+='<span>'+t('Изменённых полей: ','Змінених полів: ')+dirty+'</span>';
      if(dirty)html+=button(item.master?'publish':'submit',item.master?t('Опубликовать мои изменения','Опублікувати мої зміни'):t('Подтвердить и отправить мастеру','Підтвердити й надіслати майстру'));
      if(item.master)html+=button('invite',t('Приглашение к этому листу','Запрошення до цього аркуша'));
      if(record.deferred)html+=button('refresh',t('Получить обновления после выхода из редактора и комнаты','Отримати оновлення після виходу з редактора та кімнати'));
      if(!item.master){var requests=Object.values(item.requests||{}).sort(function(a,b){return b.createdAt-a.createdAt;});if(requests[0])html+='<span>'+({pending:t('Отправлено мастеру','Надіслано майстру'),accepted:t('Мастер принял заявку','Майстер прийняв заявку'),rejected:t('Мастер отклонил заявку; черновик сохранён','Майстер відхилив заявку; чернетку збережено')}[requests[0].status]||'')+'</span>';}
    }
    var inbox=pendingRequests();if(inbox.length)html+=button('inbox',t('Заявки игроков','Заявки гравців')+' · '+inbox.length);
    html+='</div>';
    Object.keys(live).forEach(function(id){var row=live[id],rec=state.records[id];
      if(row.approved&&!rec.base)html+='<div>'+esc(row.approved.data.name)+' '+button('load',t('Загрузить общую версию','Завантажити спільну версію'),'data-sheet="'+id+'"')+'</div>';
      if(row.master)Object.values(row.joins||{}).forEach(function(join){html+='<div>'+t('Запрос доступа: ','Запит доступу: ')+esc(join.name)+' · '+esc(row.approved&&row.approved.data.name)+' '+button('grant',t('Разрешить','Дозволити'),'data-sheet="'+id+'" data-uid="'+esc(join.uid)+'"')+button('deny',t('Отклонить','Відхилити'),'data-sheet="'+id+'" data-uid="'+esc(join.uid)+'"')+'</div>';});
    });
    state.pending.forEach(function(id){html+='<div>'+t('Ожидается доступ к листу','Очікується доступ до аркуша')+' '+button('check',t('Проверить доступ','Перевірити доступ'),'data-sheet="'+id+'"')+'</div>';});
    if(sid)html+='<p class="character-cloud-hint">'+t('Несохранённый в облаке черновик остаётся на этом устройстве. Доступ Firebase сейчас закреплён за входом этого браузера.','Не збережена в хмарі чернетка залишається на цьому пристрої. Доступ Firebase зараз закріплено за входом цього браузера.')+'</p>';
    if(error)html+='<p role="alert">'+esc(error)+'</p>';panel.innerHTML=html;
  }
  function modal(title,content){var old=document.getElementById('character-cloud-dialog');if(old)old.remove();var dialog=document.createElement('dialog');dialog.id='character-cloud-dialog';dialog.innerHTML='<h2>'+esc(title)+'</h2>'+content+'<p role="alert"></p><div class="character-cloud-actions">'+button('close',t('Закрыть','Закрити'))+'</div>';document.body.appendChild(dialog);dialog.addEventListener('click',action);dialog.showModal();return dialog;}
  function display(entry){if(!entry.exists)return t('Отсутствует','Відсутнє');if(typeof entry.value==='string')return entry.value;return JSON.stringify(entry.value,null,2);}
  function pathLabel(path,source){var fields={name:t('Имя','Ім’я'),description:t('Описание','Опис'),skills:t('Навыки','Навички'),mastery:t('Позиции','Позиції'),inventoryItems:t('Инвентарь','Інвентар'),equipItems:t('Экипировка','Спорядження'),notes:t('Заметки','Нотатки'),hpCur:t('Текущее HP','Поточне HP'),hpMax:t('Максимум HP','Максимум HP'),coins:t('Монеты','Монети'),copper:t('Медные','Мідні'),silver:t('Серебряные','Срібні'),gold:t('Золотые','Золоті'),stats:t('Характеристики','Характеристики'),qty:t('Количество','Кількість'),cur:t('Значение','Значення')};return path.map(function(p,i){if(typeof p==='string')return fields[p]||p;var v=R.get(source,path.slice(0,i+1));return v.exists&&v.value.name||p.item;}).join(' / ');}
  function review(sid,request,own){
    if(request.invalid){var invalidDialog=modal(t('Повреждённая заявка','Пошкоджена заявка'),'<p>'+t('Заявку нельзя применить. Отклоните её и попросите игрока отправить изменения заново.','Заявку неможливо застосувати. Відхиліть її та попросіть гравця надіслати зміни знову.')+'</p>'+button('reject',t('Отклонить заявку','Відхилити заявку')));invalidDialog._review={sid:sid,request:request,expected:[],own:false};return;}
    var item=live[sid],rows=R.analyze(item.approved.data,request.changes),expected=rows.map(function(r){return r.current;});
    var dialog=modal(t('Согласование изменений','Узгодження змін'),rows.map(function(row,i){return '<section class="character-review-row"><h3>'+esc(pathLabel(row.path,item.approved.data))+'</h3><div class="character-review-values">'+[[t('Исходное','Початкове'),row.before],[t('Сейчас в общем листе','Зараз у спільному аркуші'),row.current],[t('Предложение','Пропозиція'),row.after]].map(function(pair){return '<div><strong>'+pair[0]+'</strong><pre>'+esc(display(pair[1]))+'</pre></div>';}).join('')+'</div><label>'+t('Решение','Рішення')+' <select data-choice="'+i+'">'+(row.status==='conflict'?'<option value="">'+t('Конфликт — выберите версию','Конфлікт — виберіть версію')+'</option>':'')+'<option value="take">'+t('Принять предложенное','Прийняти запропоноване')+'</option><option value="keep">'+t('Оставить текущее','Залишити поточне')+'</option></select></label></section>';}).join('')+'<p role="alert" id="character-review-error"></p>'+button('accept',t('Применить выбранные изменения','Застосувати вибрані зміни'))+(own?'':button('reject',t('Отклонить всю заявку','Відхилити всю заявку'))));
    dialog._review={sid:sid,request:request,expected:expected,own:own};
  }
  function action(event){var b=event.target.closest('[data-cloud-action]');if(!b||b.disabled)return;var a=b.dataset.cloudAction,c=character(),sid=b.dataset.sheet||binding(c),dialog=document.getElementById('character-cloud-dialog');
    if(a==='close'){dialog.close();dialog.remove();return;}
    if(a==='create'){if(!c)return;modal(t('Общий лист Firebase','Спільний аркуш Firebase'),'<p>'+t('Текущая версия станет общей. Этот вход браузера будет мастером листа. Игроки получат доступ только после вашего разрешения. Сохраните перенос персонажа перед первым подключением.','Поточна версія стане спільною. Цей вхід браузера буде майстром аркуша. Гравці отримають доступ лише після вашого дозволу. Збережіть перенесення персонажа перед першим підключенням.')+'</p>'+button('create-confirm',t('Создать общий лист','Створити спільний аркуш')));return;}
    if(a==='create-confirm'){run(function(){state.creating=state.creating||{};state.creating[c.id]=state.creating[c.id]||id();persist();return store.create(c,state.creating[c.id]).then(function(result){delete state.creating[c.id];state.records[result.id]={characterId:c.id,base:R.clone(result.character),backup:R.clone(c)};persist();return saveLocal(result.id,result.character,result.character).then(function(){watch(result.id);dialog.close();dialog.remove();});});});return;}
    if(a==='invite'){modal(t('Приглашение к листу','Запрошення до аркуша'),'<p>'+t('Передайте игроку этот код. После его запроса подтвердите доступ здесь.','Передайте гравцеві цей код. Після його запиту підтвердьте доступ тут.')+'</p><input readonly value="'+esc(sid)+'" aria-label="'+t('Код приглашения','Код запрошення')+'">');return;}
    if(a==='join'){modal(t('Подключиться к листу','Приєднатися до аркуша'),'<label>'+t('Код приглашения','Код запрошення')+'<input id="character-cloud-code" autocomplete="off"></label><label>'+t('Ваше имя для мастера','Ваше ім’я для майстра')+'<input id="character-cloud-name" maxlength="100"></label>'+button('join-confirm',t('Запросить доступ','Запросити доступ')));return;}
    if(a==='join-confirm'){var code=document.getElementById('character-cloud-code').value.trim(),name=document.getElementById('character-cloud-name').value.trim();if(!name)return;run(function(){return store.join(code,name).then(function(){if(state.pending.indexOf(code)<0)state.pending.push(code);persist();dialog.close();dialog.remove();});});return;}
    if(a==='check'){run(function(){return store.checkAccess(sid).then(function(ok){if(ok){state.pending=state.pending.filter(function(s){return s!==sid;});persist();watch(sid);}});});return;}
    if(a==='grant'||a==='deny'){run(function(){return store.grant(sid,b.dataset.uid,a==='grant');});return;}
    if(a==='load'){run(function(){var rec=state.records[sid],data=R.clone(live[sid].approved.data);if(binding(data)&&binding(data)!==sid)throw Error('character-already-connected');rec.backup=R.clone((w.characters||[]).find(function(x){return String(x.id)===String(data.id);})||null);persist();return saveLocal(sid,data,data);});return;}
    if(a==='refresh'){run(function(){receive(sid,live[sid].approved);});return;}
    if(a==='submit'){run(function(){var rec=state.records[sid],changes=R.diff(rec.base,c);var previous=rec.outgoing&&live[sid].requests&&live[sid].requests[rec.outgoing.id];if(!rec.outgoing||(previous&&previous.status!=='pending')||!R.equal(rec.outgoing.changes,changes)){rec.outgoing={id:id(),changes:changes};persist();}return store.submit(sid,rec.base,c,rec.outgoing.id);});return;}
    if(a==='publish'){var req={changes:R.diff(state.records[sid].base,c)};review(sid,req,true);return;}
    if(a==='inbox'){var requests=pendingRequests();modal(t('Заявки игроков','Заявки гравців'),requests.map(function(row){return '<p>'+esc(live[row.sid].approved.data.name)+' · '+row.request.changes.length+' '+button('review',t('Сравнить поля','Порівняти поля'),'data-sheet="'+row.sid+'" data-author="'+esc(row.request.authorUid)+'" data-request="'+esc(row.request.id)+'"')+'</p>';}).join(''));return;}
    if(a==='review'){review(sid,live[sid].requests[b.dataset.author][b.dataset.request],false);return;}
    if(a==='accept'||a==='reject'){var context=dialog._review,choices={};dialog.querySelectorAll('[data-choice]').forEach(function(select){choices[select.dataset.choice]=select.value;});if(a==='accept'&&Object.values(choices).some(function(v){return !v;})){document.getElementById('character-review-error').textContent=t('Выберите решение для каждого конфликта.','Виберіть рішення для кожного конфлікту.');return;}
      run(function(){var op=context.own?store.publish(context.sid,state.records[context.sid].base,character(),choices,context.expected):store.resolve(context.sid,context.request.authorUid,context.request.id,choices,context.expected,a==='reject');return op.then(function(){dialog.close();dialog.remove();receive(context.sid,live[context.sid].approved);});});
    }
  }
  w.ZargotaCharacterCloud={isDraft:changed,prepareLocal:prepareLocal,refresh:function(){start();setTimeout(render,0);}};
  document.addEventListener('click',function(e){if(e.target.closest('#character-cloud-panel'))action(e);});
  document.addEventListener('DOMContentLoaded',function(){start();render();});
})(window);
