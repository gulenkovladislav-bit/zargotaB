(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.ZargotaCharacterUpdates = api.mount(root);
})(typeof window === 'undefined' ? null : window, function() {
  'use strict';
  var fields = {
    name:['Имя','Ім’я'], level:['Уровень','Рівень'], hpCur:['Здоровье','Здоров’я'], hpMax:['Максимум здоровья','Максимум здоров’я'],
    tempHp:['Временное здоровье','Тимчасове здоров’я'], ac:['Броня','Броня'], initiative:['Инициатива','Ініціатива'], speed:['Скорость','Швидкість'],
    inventoryItems:['Инвентарь','Інвентар'], equipItems:['Экипировка','Спорядження'], skills:['Навыки','Навички'], mastery:['Позиции','Позиції'],
    spellRefs:['Карточки','Картки'], spellsLearned:['Изученные карточки','Вивчені картки'], spellCD:['Ресурсы карточек','Ресурси карток'],
    preparedSpells:['Подготовленные карточки','Підготовлені картки'], coins:['Монеты','Монети'], statuses:['Состояния','Стани'],
    tempEffects:['Временные эффекты','Тимчасові ефекти'], injuries:['Травмы','Травми'], deathSaves:['Спасброски','Рятівні кидки'],
    journalEntries:['Записи персонажа','Записи персонажа'], notes:['Записи персонажа','Записи персонажа'], biography:['Биография','Біографія'],
    description:['Описание','Опис'], currentGoal:['Цель персонажа','Мета персонажа'], progressionPlan:['Развитие персонажа','Розвиток персонажа'],
    battleEcho:['След боя','Слід бою'], portrait:['Портрет','Портрет'], fameMundo:['Слава в мире','Слава у світі'], fameZargoty:['Слава в Зарготе','Слава в Зарготі']
  };
  var stats = {str:['Сила','Сила'],dex:['Ловкость','Спритність'],int:['Интеллект','Інтелект'],cha:['Харизма','Харизма'],per:['Восприятие','Сприйняття'],con:['Выносливость','Витривалість']};
  function equal(a,b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    var ak=Object.keys(a),bk=Object.keys(b);
    return ak.length===bk.length && ak.every(function(k){return Object.prototype.hasOwnProperty.call(b,k)&&equal(a[k],b[k]);});
  }
  function short(value) { return String(value==null?'':value).slice(0,180); }
  function summary(before,after) {
    if (!before || !after) return [];
    var rows=[];
    Object.keys(stats).forEach(function(k) {
      var a=before.stats&&before.stats[k],b=after.stats&&after.stats[k];
      if (!equal(a,b)) rows.push({field:'stats.'+k,label:stats[k],before:short(a&&a.cur!=null?a.cur:a&&a.base),after:short(b&&b.cur!=null?b.cur:b&&b.base)});
    });
    Object.keys(fields).forEach(function(k) {
      if (equal(before[k],after[k])) return;
      var row={field:k,label:fields[k]};
      if (k==='portrait') row.kind='updated';
      else if (Array.isArray(before[k]) || Array.isArray(after[k])) {
        var old=Array.isArray(before[k])?before[k]:[],next=Array.isArray(after[k])?after[k]:[];
        function key(item){return item&&typeof item==='object'?item.itemId||item.id||item._syncId||item.journalId||item.name:String(item);}
        var added=next.filter(function(item){return !old.some(function(prev){return key(prev)===key(item);});});
        var removed=old.filter(function(item){return !next.some(function(curr){return key(curr)===key(item);});});
        row.kind='list';row.before=String(old.length);row.after=String(next.length);
        row.added=added.map(function(item){return short(item&&typeof item==='object'?item.name||item.title||'':item);}).filter(Boolean).slice(0,5);
        row.removed=removed.map(function(item){return short(item&&typeof item==='object'?item.name||item.title||'':item);}).filter(Boolean).slice(0,5);
        row.edited=next.map(function(item){var prev=old.find(function(v){return key(v)===key(item);});if(!prev||equal(prev,item)||!item||typeof item!=='object')return '';var name=short(item.name||item.title||'');return name+(prev.qty!==item.qty?' ('+short(prev.qty)+' → '+short(item.qty)+')':'');}).filter(Boolean).slice(0,5);
      } else if ((before[k]!=null&&typeof before[k]==='object') || (after[k]!=null&&typeof after[k]==='object')) row.kind='updated';
      else {row.before=short(before[k]);row.after=short(after[k]);}
      rows.push(row);
    });
    return rows;
  }
  function record(entries,event,now) {
    var changes=summary(event.before,event.after);
    if (!changes.length || event.characterId==null || event.own) return entries;
    var channel=event.channel==='room'?'room':'cloud';
    var token=channel+':'+String(event.revision||JSON.stringify(changes));
    var previous=entries.find(function(entry){return entry.token===token;});
    var status=['pending','review'].indexOf(event.status)>=0?event.status:'applied';
    if (previous && previous.status===status) return entries;
    var next={token:token,channel:channel,status:status,author:event.author==='master'?'master':'shared',at:now,changes:changes,read:false};
    return [next].concat(entries.filter(function(entry){return entry.token!==token && !(entry.channel===channel&&entry.status==='pending');})).slice(0,12);
  }
  function mount(w) {
    var doc=w.document,storageKey='zargota_character_updates_v1',history=Object.create(null),timer;
    function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
    function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    try {var stored=JSON.parse(w.localStorage.getItem(storageKey)||'{}');Object.keys(stored).slice(0,100).forEach(function(id){if(Array.isArray(stored[id]))history[id]=stored[id].filter(function(e){return e&&Array.isArray(e.changes)&&typeof e.token==='string';}).slice(0,12);});}catch(_){}
    function persist(){try{w.localStorage.setItem(storageKey,JSON.stringify(history));}catch(_){} }
    function activeId(){return w.viewingCharId==null?'':String(w.viewingCharId);}
    function entries(id){return history[id]||[];}
    function unread(id){return entries(id).filter(function(e){return !e.read;});}
    function label(row){return row.label[t('ru','uk')==='uk'?1:0];}
    function title(entry) {
      if(entry.status==='pending')return t('Есть обновление листа','Є оновлення аркуша');
      if(entry.status==='review')return t('Обновление требует внимания','Оновлення потребує уваги');
      return entry.author==='master'?t('Мастер обновил лист','Майстер оновив аркуш'):t('Лист обновлён','Аркуш оновлено');
    }
    function refresh(){clearTimeout(timer);timer=setTimeout(function(){render();doc.dispatchEvent(new CustomEvent('zargota:character-updates'));},0);}
    function receive(event){var id=String(event.characterId),old=entries(id),next=record(old,event,Date.now());if(next!==old){history[id]=next;persist();refresh();}}
    function settle(id,channel,revision){id=String(id);var token=channel+':'+revision;history[id]=entries(id).filter(function(entry){return entry.token!==token||entry.status!=='pending';});persist();refresh();}
    function pending(){return t('Обновление ещё не применено. Текущий ввод не заменён. Завершите редактирование и откройте синхронизацию через лампочку.','Оновлення ще не застосовано. Поточне введення не замінено. Завершіть редагування й відкрийте синхронізацію через індикатор.');}
    function brief(row) {
      if(row.kind==='updated')return label(row);
      if(row.kind==='list')return label(row)+(row.before===row.after?'':': '+row.before+' → '+row.after);
      return label(row)+': '+(row.before||'—')+' → '+(row.after||'—');
    }
    function details(id,help,field) {
      var old=doc.getElementById('character-update-dialog');if(old)old.close();
      var dialog=doc.createElement('dialog');dialog.id='character-update-dialog';
      dialog.setAttribute('aria-labelledby','character-update-dialog-title');
      var records=entries(id),html='<h2 id="character-update-dialog-title">'+t('Обновления персонажа','Оновлення персонажа')+'</h2>';
      if(help)html+='<p>'+t('Метка ↻ возле характеристики означает, что её значение обновилось при синхронизации. Нажмите на метку, чтобы увидеть, что изменилось.','Позначка ↻ біля характеристики означає, що її значення оновилося під час синхронізації. Натисніть на позначку, щоб побачити, що змінилося.')+'</p><p>'+t('«Есть обновление» означает, что новые данные ещё ожидают применения. Уведомление не заменяет ваш ввод и не подтверждает отправку ваших изменений. Состояние синхронизации доступно через лампочку.','«Є оновлення» означає, що нові дані ще очікують застосування. Сповіщення не замінює ваше введення й не підтверджує надсилання ваших змін. Стан синхронізації доступний через індикатор.')+'</p>';
      if(!records.length)html+='<p>'+t('Полученных обновлений пока нет.','Отриманих оновлень поки немає.')+'</p>';
      records.forEach(function(entry){
        var changes=entry.changes.filter(function(row){return !field||row.field===field;});if(!changes.length)return;
        html+='<section class="character-update-entry"><h3>'+esc(title(entry))+'</h3><time>'+esc(new Date(entry.at).toLocaleString(t('ru-RU','uk-UA')))+'</time>';
        if(entry.status==='pending')html+='<p>'+pending()+'</p>';
        if(entry.status==='review')html+='<p>'+t('Новая версия получена, но часть полей отличается от вашего черновика. Ваши правки сохранены; откройте синхронизацию для согласования. Ниже показаны изменения общей версии.','Нову версію отримано, але частина полів відрізняється від вашої чернетки. Ваші правки збережено; відкрийте синхронізацію для узгодження. Нижче показано зміни спільної версії.')+'</p>';
        html+='<ul>'+changes.map(function(row){return '<li><strong>'+esc(label(row))+'</strong><span>'+esc(row.kind==='updated'||row.kind==='list'&&row.before===row.after?t('Обновлено','Оновлено'):(row.before||'—')+' → '+(row.after||'—'))+'</span>'+(row.added&&row.added.length?'<small>'+t('Добавлено: ','Додано: ')+esc(row.added.join(', '))+'</small>':'')+(row.removed&&row.removed.length?'<small>'+t('Убрано: ','Прибрано: ')+esc(row.removed.join(', '))+'</small>':'')+(row.edited&&row.edited.length?'<small>'+t('Изменено: ','Змінено: ')+esc(row.edited.join(', '))+'</small>':'')+'</li>';}).join('')+'</ul></section>';
      });
      html+='<div class="character-update-dialog-actions"><button type="button" data-update-close>'+t('Закрыть','Закрити')+'</button>'+(field?'<button type="button" data-update-all>'+t('Все изменения','Усі зміни')+'</button>':unread(id).some(function(e){return e.status!=='pending';})?'<button type="button" data-update-read>'+t('Отметить просмотренным','Позначити переглянутим')+'</button>':'')+'</div>';
      dialog.innerHTML=html;doc.body.appendChild(dialog);
      dialog.addEventListener('close',function(){dialog.remove();});
      dialog.addEventListener('click',function(e){
        if(e.target.closest('[data-update-read]')){entries(id).forEach(function(entry){if(entry.status!=='pending')entry.read=true;});persist();dialog.close();refresh();}
        else if(e.target.closest('[data-update-all]'))details(id,false);
        else if(e.target.closest('[data-update-close]'))dialog.close();
      });
      dialog.showModal();
    }
    function render() {
      var id=activeId(),sheet=doc.getElementById('char-sheet'),view=doc.getElementById('char-sheet-view'),editor=doc.getElementById('char-editor-view'),bar=doc.getElementById('chars-back-bar');
      if(!sheet||!view||!bar)return;
      var editing=editor&&editor.style.display!=='none',show=view.style.display!=='none';
      var currentId=editing&&w.editingCharId!=null?String(w.editingCharId):id;
      var help=doc.getElementById('character-update-help');
      if(!help){help=doc.createElement('button');help.type='button';help.id='character-update-help';help.textContent='?';help.addEventListener('click',function(){details(help.dataset.character,true);});bar.appendChild(help);}
      help.hidden=!show&&!editing;help.dataset.character=currentId;help.setAttribute('aria-label',t('Как работают обновления листа','Як працюють оновлення аркуша'));help.setAttribute('aria-haspopup','dialog');
      var notice=doc.querySelector('.character-update-notice');
      if(!show&&!editing){if(notice)notice.remove();sheet.querySelectorAll('.character-update-marker').forEach(function(el){el.remove();});return;}
      var updates=unread(currentId),latest=updates[0];
      if(latest){
        if(!notice)notice=doc.createElement('section');notice.className='character-update-notice';notice.setAttribute('aria-label',t('Обновления листа','Оновлення аркуша'));
        var noticeHTML='<div role="status"><strong>'+esc(title(latest))+'</strong><span>'+esc(latest.status==='pending'?t('Ваш ввод не заменён','Ваше введення не замінено'):brief(latest.changes[0]))+(updates.length>1?' · '+t('ещё обновлений: ','ще оновлень: ')+(updates.length-1):latest.changes.length>1?' · +'+(latest.changes.length-1):'')+'</span></div><button type="button">'+t('Подробнее','Докладніше')+'</button>';
        if(notice.innerHTML!==noticeHTML)notice.innerHTML=noticeHTML;
        notice.querySelector('button').onclick=function(){details(currentId,false);};
        var host=editing?editor.querySelector('.char-editor'):sheet.querySelector('.tab-content-wrap')||sheet;
        if(host&&notice.parentNode!==host)host.insertBefore(notice,host.firstChild);
      }else if(notice)notice.remove();
      if(!show)return;
      sheet.querySelectorAll('.character-update-marker').forEach(function(marker){
        if(marker.dataset.character!==id||!updates.some(function(entry){return entry.status==='applied'&&entry.changes.some(function(row){return row.field==='stats.'+marker.dataset.stat;});}))marker.remove();
      });
      Object.keys(stats).forEach(function(stat){
        var changed=updates.some(function(entry){return entry.status==='applied'&&entry.changes.some(function(row){return row.field==='stats.'+stat;});});
        if(!changed)return;
        sheet.querySelectorAll('input[onchange]').forEach(function(input){
          var handler=input.getAttribute('onchange');if(handler.indexOf('updateStatField(')<0||handler.indexOf("'"+stat+"'")<0)return;
          var container=input.closest('.stat-block')||input.parentElement;
          if(container.querySelector('.character-update-marker[data-stat="'+stat+'"]'))return;
          var marker=doc.createElement('button');marker.dataset.stat=stat;marker.dataset.character=id;marker.className='character-update-marker';marker.type='button';marker.textContent='↻';
          marker.setAttribute('aria-label',t('Что изменилось: ','Що змінилося: ')+stats[stat][t('ru','uk')==='uk'?1:0]);marker.setAttribute('aria-haspopup','dialog');
          marker.addEventListener('click',function(){details(id,false,'stats.'+stat);});
          var desktopStat=input.closest('.stat-block');
          if(desktopStat)desktopStat.appendChild(marker);else input.insertAdjacentElement('afterend',marker);
        });
      });
    }
    doc.addEventListener('DOMContentLoaded',refresh);doc.addEventListener('zargota:localechange',refresh);
    return {receive:receive,settle:settle,refresh:refresh,unread:function(id){return unread(String(id)).length;},open:function(id){details(String(id),false);}};
  }
  return {summary:summary,record:record,mount:mount};
});
