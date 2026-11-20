(function(w){
  'use strict';
  // A session roster contains references to existing account sheets, never copies
  // of their data. The persistent-character controller owns all subscriptions.
  var picker=null,pickerOwner='',draft=new Set(),lastRows=[],pickerSignature='',menu=null,menuRow=null,menuOwner='';
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function api(){return w.ZargotaPersistentCharacters;}
  function identity(){return api()?.tableIdentity?.()||{enabled:false,role:'visitor',uid:''};}
  function admin(who){return who.enabled&&who.role==='admin'&&!!who.uid;}
  function stored(){return w.zgIrlSessionRead?.()?.data?.gmParticipants||{};}
  function savedIds(who){var ids=stored().owners?.[who.uid];return Array.isArray(ids)?ids.filter(function(id){return typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id);}):null;}
  function available(){return (api()?.tableHeroes()||[]).filter(function(row){return /^[a-zA-Z0-9_-]{8,100}$/.test(row.sheetId);});}
  function defaultIds(rows,shared){
    // Keep the existing five heroes when upgrading an existing table. Additional
    // profiles, including custom characters, are chosen explicitly in the picker.
    return shared.filter(function(s){return rows.some(function(r){return r.key.indexOf('sheet-')!==0&&String(api().resolveCharacterId(r.character?.id))===String(s.localId);});}).map(function(s){return s.sheetId;});
  }
  function rows(localRows){
    lastRows=localRows;
    var who=identity(),shared=available();
    if(!admin(who)){
      if(who.enabled||stored().version)return [];
      var localKeys=stored().localKeys;
      return Array.isArray(localKeys)?localRows.filter(function(row){return localKeys.includes(row.key);}):null;
    }
    var ids=savedIds(who)||defaultIds(localRows,shared);
    return ids.map(function(id){
      var sheet=shared.find(function(s){return s.sheetId===id;});
      if(!sheet)return {key:'sheet-'+id,character:null,meta:{name:t('Лист недоступен','Аркуш недоступний')},shared:{sheetId:id,ready:false,state:'loading'}};
      return {key:'sheet-'+id,character:sheet.character,meta:{name:sheet.name},shared:sheet};
    });
  }
  function status(row){
    if(row.state==='offline')return t('Нет связи с сервером','Немає зв’язку із сервером');
    if(row.state==='loading')return t('Подключение…','Підключення…');
    if(row.state==='error')return t('Ошибка синхронизации','Помилка синхронізації');
    if(row.state==='conflict')return t('Проверьте изменения в листе','Перевірте зміни в аркуші');
    return row.online?t('В сети','У мережі'):t('Не в сети','Поза мережею');
  }
  function portrait(row){
    var c=(w.characters||[]).find(function(c){return String(c.id)===String(row.localId);});
    // Use the account's existing portrait renderer (including URL validation).
    return w.ZargotaAccountViews?.avatar(c,false)||'<span class="pc-avatar">◇</span>';
  }
  function refresh(){w.ZargotaGmTable?.refresh();}
  function closeMenu(restoreFocus){
    var key=menuRow?.key;if(menu)menu.remove();menu=null;menuRow=null;menuOwner='';
    if(restoreFocus)(Array.from(document.querySelectorAll('[data-gm-open]')).find(function(b){return b.dataset.gmOpen===key;})||document.querySelector('[data-gm-add-player]'))?.focus({preventScroll:true});
  }
  function menuStatus(){
    if(!menu)return;
    if(menuOwner!==identity().uid||!document.body.classList.contains('zg-irl-table-view')){closeMenu();return;}
    var row=menuRow.shared&&available().find(function(r){return r.sheetId===menuRow.shared.sheetId;});
    var line=menu.querySelector('[role=status]');
    line.textContent=row?status(row):menuRow.shared?t('Лист недоступен','Аркуш недоступний'):t('Лист на этом устройстве','Аркуш на цьому пристрої');
    line.dataset.online=String(!!row?.online);
  }
  function removeRow(row){
    var who=identity(),value=stored();
    if(row.shared){
      if(!admin(who)||who.uid!==menuOwner)return false;
      var ids=savedIds(who)||defaultIds(lastRows,available()),owners=Object.assign({},value.owners);
      owners[who.uid]=ids.filter(function(id){return id!==row.shared.sheetId;});
      value=Object.assign({},value,{version:1,owners:owners});
    }else{
      if(who.enabled||value.version)return false;
      var keys=value.localKeys||lastRows.filter(function(r){return r.key.indexOf('sheet-')!==0;}).map(function(r){return r.key;});
      value=Object.assign({},value,{localKeys:keys.filter(function(key){return key!==row.key;})});
    }
    if(!w.zgIrlSessionSaveData('gmParticipants',value)){
      w.showToast?.(t('Не удалось сохранить состав стола.','Не вдалося зберегти склад столу.'));return false;
    }
    // Clear the old selection even if its card disappeared during the save render.
    if(w.zgIrlSessionRead?.()?.data?.characterConsole?.selectedKey===row.key)w.zgIrlCharacterClose?.();
    refresh();return true;
  }
  function context(row,event){
    closeMenu();menuRow=row;menuOwner=identity().uid;
    menu=document.createElement('div');menu.className='zg-gm-participant-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',t('Персонаж на столе','Персонаж на столі'));menu.setAttribute('data-zg-i18n-skip','');
    menu.innerHTML='<p role="status"></p><button type="button" role="menuitem" data-gmp-open>'+t('Открыть лист','Відкрити аркуш')+'</button><button type="button" role="menuitem" data-gmp-choose>'+t('Выбрать игроков','Вибрати гравців')+'</button><button type="button" role="menuitem" data-gmp-remove>'+t('Убрать со стола','Прибрати зі столу')+'</button>';
    if(!row.character)menu.querySelector('[data-gmp-open]').disabled=true;
    document.body.appendChild(menu);menuStatus();
    if(!menu)return;
    var box=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-box.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-box.height-8))+'px';
    menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    menu.addEventListener('click',function(event){
      if(event.target.closest('[data-gmp-remove]')){if(removeRow(row))closeMenu(true);return;}
      if(event.target.closest('[data-gmp-choose]')){closeMenu();open();return;}
      if(event.target.closest('[data-gmp-open]')){
        closeMenu();if(w.zgIrlSessionRead?.()?.data?.characterConsole?.selectedKey!==row.key)w.zgIrlCharacterToggle?.(row.key);
      }
    });
    menu.addEventListener('keydown',function(event){
      var buttons=Array.from(menu.querySelectorAll('button:not(:disabled)')),i=buttons.indexOf(document.activeElement);
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}
    });
  }
  function close(){if(picker){picker.close();picker.remove();picker=null;}pickerOwner='';pickerSignature='';}
  function paint(){
    menuStatus();
    if(!picker)return;
    var who=identity();
    if(pickerOwner!==(admin(who)?who.uid:'')){close();return;}
    var list=picker.querySelector('.zg-gm-participant-list'),shared=admin(who)?available():[];
    picker.querySelector('h2').textContent=t('Участники стола','Учасники столу');
    picker.querySelector('[data-gmp-close]').setAttribute('aria-label',t('Закрыть','Закрити'));
    picker.querySelector('[data-gmp-cancel]').textContent=t('Отмена','Скасувати');
    var apply=picker.querySelector('[data-gmp-apply]');apply.textContent=t('Готово','Готово');apply.hidden=!admin(who);
    picker.querySelector('[data-gmp-account]').textContent=admin(who)?t('Аккаунты игроков','Акаунти гравців'):t('Войти в аккаунт','Увійти в акаунт');
    picker.querySelector('.zg-gm-participant-hint').textContent=admin(who)?t('Выберите профили игроков. Изменения в их листах видны и здесь.','Виберіть профілі гравців. Зміни в їхніх аркушах видно й тут.'):t('Войдите как администратор, чтобы выбрать профили своих игроков.','Увійдіть як адміністратор, щоб вибрати профілі своїх гравців.');
    var signature=shared.map(function(r){return r.sheetId+':'+r.name+':'+portrait(r);}).join('|');
    var missing=Array.from(draft).filter(function(id){return !shared.some(function(r){return r.sheetId===id;});});
    signature+='|'+missing.join('|');
    // Presence ticks must not replace a focused checkbox or a selection in progress.
    if(signature!==pickerSignature){
      var focused=document.activeElement?.dataset?.gmParticipant;
      list.innerHTML=shared.map(function(row){return '<label class="zg-gm-participant"><input type="checkbox" data-gm-participant="'+esc(row.sheetId)+'"'+(draft.has(row.sheetId)?' checked':'')+'>'+portrait(row)+'<span><b>'+esc(row.name)+'</b><small data-gmp-status="'+esc(row.sheetId)+'"></small></span></label>';}).join('')+
        missing.map(function(id){return '<label class="zg-gm-participant"><input type="checkbox" data-gm-participant="'+esc(id)+'" checked><span><b>'+t('Лист недоступен','Аркуш недоступний')+'</b><small>'+t('Можно убрать со стола','Можна прибрати зі столу')+'</small></span></label>';}).join('');
      pickerSignature=signature;
      if(focused)Array.from(list.querySelectorAll('input')).find(function(el){return el.dataset.gmParticipant===focused;})?.focus({preventScroll:true});
    }
    list.querySelectorAll('[data-gmp-status]').forEach(function(el){var row=shared.find(function(r){return r.sheetId===el.dataset.gmpStatus;});el.textContent=status(row);el.dataset.online=String(row.online);});
    var notice=picker.querySelector('.zg-gm-participant-notice');
    notice.textContent=!admin(who)?'':who.error?t('Не удалось обновить список. Показаны сохранённые листы.','Не вдалося оновити список. Показано збережені аркуші.'):who.loading?t('Загружаем профили…','Завантажуємо профілі…'):!shared.length?t('Пока нет аккаунтов игроков. Добавьте их в разделе аккаунтов.','Поки немає акаунтів гравців. Додайте їх у розділі акаунтів.'):'';
  }
  function open(){
    closeMenu();close();var who=identity();pickerOwner=admin(who)?who.uid:'';
    draft=new Set(admin(who)?savedIds(who)||defaultIds(lastRows,available()):[]);
    pickerSignature='initial';
    picker=document.createElement('dialog');picker.className='zg-gm-participants';picker.setAttribute('data-zg-i18n-skip','');picker.setAttribute('aria-labelledby','zg-gmp-title');
    picker.innerHTML='<header><h2 id="zg-gmp-title"></h2><button type="button" data-gmp-close>×</button></header><div class="zg-gm-participant-body"><p class="zg-gm-participant-hint"></p><div class="zg-gm-participant-list"></div><p class="zg-gm-participant-notice" role="status"></p><button type="button" data-gmp-account></button><p role="alert"></p></div><footer><button type="button" data-gmp-cancel></button><button type="button" data-gmp-apply></button></footer>';
    document.body.appendChild(picker);paint();picker.showModal();
    picker.addEventListener('cancel',function(event){event.preventDefault();close();});
    picker.addEventListener('change',function(event){var id=event.target.dataset.gmParticipant;if(id){if(event.target.checked)draft.add(id);else draft.delete(id);}});
    picker.addEventListener('click',function(event){
      if(event.target.closest('[data-gmp-close],[data-gmp-cancel]')){close();return;}
      if(event.target.closest('[data-gmp-account]')){close();Promise.resolve(api()?.settings()).catch(function(){w.showToast?.(t('Не удалось открыть аккаунты. Проверьте соединение.','Не вдалося відкрити акаунти. Перевірте з’єднання.'));});return;}
      if(!event.target.closest('[data-gmp-apply]'))return;
      var who=identity();if(!admin(who)||who.uid!==pickerOwner){close();return;}
      var value=stored(),owners=Object.assign({},value.owners);
      owners[who.uid]=Array.from(draft);
      // Session preferences only; selecting/removing a profile never saves a sheet.
      if(!w.zgIrlSessionSaveData('gmParticipants',{version:1,owners:owners})){
        picker.querySelector('[role=alert]').textContent=t('Не удалось сохранить выбор на этом устройстве.','Не вдалося зберегти вибір на цьому пристрої.');return;
      }
      var active=document.querySelector('.zg-gm-hero.is-selected')?.dataset.gmKey;
      if(active&&active.indexOf('sheet-')===0&&!draft.has(active.slice(6)))w.zgIrlCharacterClose?.();
      close();refresh();
    });
  }
  function dock(){return '<button type="button" class="zg-gm-add-player" data-gm-add-player aria-label="'+t('Выбрать игроков','Вибрати гравців')+'"><b aria-hidden="true">＋</b><span>'+t('Игроки','Гравці')+'</span></button>';}
  function empty(){var who=identity();return '<div class="zg-gm-empty-party">'+(who.loading?t('Загружаем профили…','Завантажуємо профілі…'):t('Добавьте игроков через ＋','Додайте гравців через ＋'))+'</div>';}
  document.addEventListener('click',function(event){if(event.target.closest('[data-gm-add-player]'))open();});
  document.addEventListener('pointerdown',function(event){if(menu&&!menu.contains(event.target))closeMenu();});
  document.addEventListener('keydown',function(event){if(menu&&event.key==='Escape'){event.preventDefault();closeMenu(true);}else if(menu&&event.key==='Tab')closeMenu();});
  w.addEventListener('resize',function(){closeMenu();});
  document.addEventListener('zargota:localechange',function(){closeMenu();paint();});
  w.addEventListener('zargota:persistent-auth-change',function(){closeMenu();close();});
  w.ZargotaGmParticipants={rows:rows,dock:dock,empty:empty,refresh:paint,context:context,close:function(){closeMenu();close();}};
})(window);
