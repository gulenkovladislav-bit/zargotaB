(function(w){
  'use strict';
  var panel,launcher,allTarget,resultBox,drag=null,ghost=null,activeKey='',tab='favorites',busy=false,receipts=[],suppressUntil=0,authEpoch=0;
  var defaults=['bleed','stun','poison','fear','burn','shield'];
  function t(ru,uk){return w.ZargotaI18n?.getLocale()==='uk'?uk:ru;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(s){return w.ZargotaI18n?.translate(s)||s;}
  function label(s){return w.ZargotaI18n?.getLocale()==='uk'&&s.labelUk?s.labelUk:tr(s.label||s.key);}
  function catalog(){return (w.zgGmStatusCatalog?.()||[]).filter(function(s){return s&&s.key&&s.enabled!==false;});}
  function definition(key){return catalog().find(function(s){return s.key===key;});}
  function glyph(s){return w.zgStatusGlyphMarkup?.(s,label(s),'gms-icon')||'<span class="gms-icon">'+esc(s.icon||'✦')+'</span>';}
  function favoriteKey(){return 'zg-gm-status-favorites-v1:'+String(w.ZargotaPersistentCharacters?.tableIdentity().uid||'local');}
  function favorites(){try{var value=JSON.parse(localStorage.getItem(favoriteKey()));if(Array.isArray(value))return value;}catch(_){}return defaults.slice();}
  function targets(){return w.ZargotaGmTable?.targets()||[];}
  function paintList(){
    if(!panel||panel.hidden)return;
    var query=panel.querySelector('input[type=search]').value.toLocaleLowerCase().trim(),favs=favorites();
    var list=catalog().filter(function(s){return query?[label(s),s.label,s.labelUk,s.key].join(' ').toLocaleLowerCase().includes(query):tab==='all'||favs.includes(s.key);});
    panel.querySelector('[data-gms-list]').innerHTML=list.map(function(s){var starred=favs.includes(s.key);return '<article class="gms-tile'+(activeKey===s.key?' is-selected':'')+'"><button type="button" data-gms-drag="'+esc(s.key)+'" aria-label="'+esc(label(s))+'">'+glyph(s)+'<span>'+esc(label(s))+'</span></button><button type="button" class="gms-star" data-gms-star="'+esc(s.key)+'" aria-pressed="'+starred+'" aria-label="'+esc(starred?t('Убрать из избранного','Прибрати з обраного'):t('В избранное','До обраного'))+'">'+(starred?'★':'☆')+'</button></article>';}).join('')||'<p class="gms-empty">'+t('Ничего не найдено','Нічого не знайдено')+'</p>';
    panel.querySelectorAll('[data-gms-tab]').forEach(function(el){el.setAttribute('aria-pressed',el.dataset.gmsTab===tab);});
  }
  var defaultDescriptionsUk={
    stun:'Втрачає довгу дію та реакцію. Перешкода на атаки й більшість перевірок. На початку ходу — Сл 14 Витривалості для зняття.',
    burn:'Отримує 1d4 Вогню на початку ходу. Гаситься водою, дією «Впасти й котитися» або залежно від обсягу полум’я.',
    poison:'Отримує 1 шкоди Отрутою на початку ходу. Перешкода на кидки атак і перевірки характеристик. Знімається ліками або Сл 14 Витривалості.',
    freeze:'Скутий льодом: знерухомлений, засліплений, загальмований. Вразливий до Дробильної та Звукової шкоди. Атаки по ньому — з перевагою.',
    fear:'Не може добровільно наближатися до джерела страху. Перешкода на кидки поряд із ним.',
    blind:'Перешкода на атаки. Усі атаки по ньому — з перевагою.',
    prone:'Повалений. Підвестися = половина швидкості ходу. Ближні атаки по ньому — з перевагою, дальні — з перешкодою.',
    bleed:'Отримує 1 шкоди на початку ходу. Кожне наступне накладання додає 1 накопичення та збільшує шкоду на 1. Знімається перев’язкою (Сл 10 Спритності).',
    silence:'Магічна німота. Не може використовувати заклинання й магічні здібності. Звичайні навички та атаки працюють.',
    anchor:'Магічний якір. Не може телепортуватися або переміщуватися магічними засобами (телепорт, Політ, портал, стрибок-крізь-тінь тощо).',
    charm:'Зачарований. Не може атакувати джерело чарів. Перешкода на перевірки проти нього.',
    dominate:'Підкорений. Діє повністю за волею джерела стану (контролера); власних дій не здійснює.',
    paralyze:'Повний параліч. Знерухомлений і не може діяти, але думки в порядку. Атаки по ньому — з перевагою. Сл 15 Витривалості для зняття.',
    restrain:'Знерухомлений. Швидкість 0. Перешкода на атаки й рятівні кидки Спритності. Атаки по ньому — з перевагою. Діяти (атакувати, чаклувати) — можна.',
    slow:'Уповільнений. Пересування вдвічі менше. Лише одна дія за хід.',
    curse:'Проклятий. Конкретні ефекти — власні, залежать від джерела прокляття. Типово: -2 до атак, -1 до шкоди. Знімається ритуалом або святою магією.',
    exhausted:'Виснажений (5 рівнів). Рів. 1 Втома — перешкода на перевірки характеристик. Рів. 2 Знемога — швидкість ÷ 2, реакцій немає. Рів. 3 Виснаження — перешкода на атаки й рятівні кидки. Рів. 4 Зрив — макс. HP ÷ 2, не можна чаклувати. Рів. 5 Колапс — непритомність (боротьба за життя). Знімається: -1 рівень за короткий відпочинок, усе за довгий.',
    invisible:'Справді невидимий. Можна лише почути за звуком, помітити за димом/рідинами або предметами, особливими заклинаннями чи перевірками Сприйняття від ГМ.',
    regen:'Відновлює 1d4 HP на початку ходу. Ефекти — власні, залежать від джерела регенерації.',
    shield:'Захисний щит (власний). Типово: +2 AC. Один удар може зняти — за рішенням джерела.',
    rage:'Лють. Посилення атак і шкоди, зниження захисту та контролю. Числа задає джерело люті. Не знімається добровільно до кінця бою.',
    fly:'Політ. Швидкість задає джерело ефекту. Ігнорує складну місцевість. Може вийти з ближнього бою без реакцій.',
    confusion:'Сум’яття. У свій хід: 50% шанс атакувати випадкову ціль у радіусі 1 клітини (включно із союзниками).'
  };
  function description(def){
    if(w.ZargotaI18n?.getLocale()==='uk'){
      if(def.descriptionUk)return def.descriptionUk;
      // Translate only the shipped text; never hide a master's custom rule
      // behind the default translation for a coincidentally matching key.
      var stock=(w.getDefaultStatusMechanics?.()||[]).find(function(s){return s.key===def.key;});
      if(stock&&stock.description===def.description&&defaultDescriptionsUk[def.key])return defaultDescriptionsUk[def.key];
    }
    return tr(def.description||'');
  }
  function selected(){
    var def=definition(activeKey),box=panel.querySelector('[data-gms-detail]');box.hidden=!def;
    if(!def)return;
    box.querySelector('strong').textContent=label(def);
    box.querySelector('p').textContent=description(def);
  }
  function optionsFor(def){
    var unit=panel.querySelector('[data-gms-unit]').value,amount=Number(panel.querySelector('[data-gms-duration]').value);
    if(unit==='default'){amount=Math.max(0,Number(def.defaultDuration)||0);unit=amount?'rounds':'manual';}
    if(unit!=='manual'&&(!Number.isInteger(amount)||amount<1||amount>999))return null;
    return {unit:unit,duration:unit==='manual'?0:amount};
  }
  function reasonText(reason){return ({
    added:t('Добавлен','Додано'),stacked:t('Кровотечение усилено','Кровотечу посилено'),undone:t('Отменено','Скасовано'),
    'already-active':t('Уже действует','Уже діє'),'stack-limit':t('Достигнут предел накопления','Досягнуто межі накопичення'),
    'duplicate-existing':t('Есть несколько эффектов — проверьте лист','Є кілька ефектів — перевірте аркуш'),
    'not-ready':t('Лист недоступен или ещё сохраняется','Аркуш недоступний або ще зберігається'),
    conflict:t('Лист изменился — повторите после проверки','Аркуш змінився — повторіть після перевірки'),
    unconfirmed:t('Нет подтверждения — проверьте лист','Немає підтвердження — перевірте аркуш'),
    'changed-since':t('Эффект уже изменён — отмена пропущена','Ефект уже змінено — скасування пропущено'),
    'local-save-failed':t('Не удалось сохранить на устройстве','Не вдалося зберегти на пристрої'),
    'unknown-status':t('Статус больше недоступен','Стан більше недоступний')
  })[reason]||t('Не удалось применить','Не вдалося застосувати');}
  function showResults(title,results){
    var failed=results.filter(function(r){return !r.ok;});
    resultBox.hidden=!failed.length;
    resultBox.textContent=failed.map(function(r){return r.target.name+': '+reasonText(r.reason);}).join(' · ');
  }
  async function deliver(def,chosen,options){
    if(busy||!chosen.length)return;
    busy=true;receipts=[];panel.setAttribute('aria-busy','true');
    resultBox.hidden=true;resultBox.textContent='';
    var result=[],epoch=authEpoch;
    try{
      // Fixed recipient set for this gesture. Each write checks current access,
      // saves against the latest acknowledged revision and reports independently.
      for(var target of chosen){
        if(epoch!==authEpoch)return;
        var response;
        try{response=await w.ZargotaGmTable.status(target,def.key,options);}
        catch(_){response={ok:false,reason:'unconfirmed'};}
        if(epoch!==authEpoch)return;
        if(response.ok&&response.changed)receipts.push({target:target,receipt:response.receipt});
        result.push(Object.assign({target:target},response));
      }
      showResults(label(def),result);
    }finally{busy=false;panel.setAttribute('aria-busy','false');}
  }
  async function undo(){
    if(busy||!receipts.length)return;
    busy=true;var entries=receipts;receipts=[];resultBox.textContent=t('Отменяем выдачу…','Скасовуємо надання…');
    try{
      var results=[],epoch=authEpoch;
      for(var entry of entries){if(epoch!==authEpoch)return;var response;try{response=await w.ZargotaGmTable.undoStatus(entry.target,entry.receipt);}catch(_){response={ok:false,reason:'unconfirmed'};}if(epoch!==authEpoch)return;results.push(Object.assign({target:entry.target},response));}
      showResults(t('Отмена выдачи','Скасування надання'),results);
    }finally{busy=false;}
  }
  function refreshTargets(){
    if(!drag||!drag.started)return;
    var now=targets();
    allTarget.querySelector('small').textContent=String(drag.targets.length);
    document.querySelectorAll('#zg-irl-character-dock [data-gm-key]').forEach(function(el){var target=now.find(function(r){return r.key===el.dataset.gmKey;});el.classList.toggle('gms-unavailable',!target||!target.ready);});
  }
  function clearHover(){document.querySelectorAll('.gms-drop-hover').forEach(function(el){el.classList.remove('gms-drop-hover');});}
  function cancel(){
    if(drag?.started)suppressUntil=Date.now()+400;
    drag=null;ghost?.remove();ghost=null;clearHover();if(allTarget)allTarget.hidden=true;
    if(document.body.classList.contains('gms-dragging'))document.body.classList.remove('gms-dragging');
    document.querySelectorAll('.gms-unavailable').forEach(function(el){el.classList.remove('gms-unavailable');});
  }
  function destination(x,y){
    var el=document.elementFromPoint(x,y);if(!el)return null;
    if(el.closest('[data-gms-all]'))return {node:allTarget,targets:drag.targets};
    var hero=el.closest('#zg-irl-character-dock [data-gm-key]');
    var target=hero&&drag.targets.find(function(r){return r.key===hero.dataset.gmKey;});
    return target?{node:hero,targets:[target]}:null;
  }
  function open(){if(!panel)return;panel.hidden=false;launcher.setAttribute('aria-expanded','true');paintList();panel.querySelector('input[type=search]').focus();}
  function close(){cancel();if(panel)panel.hidden=true;if(launcher)launcher.setAttribute('aria-expanded','false');}
  function chooseRecipients(){
    var def=definition(activeKey);if(!def||busy)return;
    var box=panel.querySelector('[data-gms-recipients]');box.hidden=!box.hidden;
    if(!box.hidden)box.innerHTML='<span>'+t('Кому выдать','Кому надати')+'</span><button type="button" data-gms-send="all">'+t('Всем на столе','Усім на столі')+'</button>'+targets().map(function(target){return '<button type="button" data-gms-send="'+esc(target.key)+'"'+(!target.ready?' disabled':'')+'>'+esc(target.name)+'</button>';}).join('');
  }
  function init(){
    var table=document.querySelector('#page-gm-table .zg-irl-table');if(!table)return;
    launcher=document.createElement('button');launcher.type='button';launcher.className='gms-launcher';launcher.setAttribute('aria-controls','gms-library');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('data-zg-i18n-skip','');table.appendChild(launcher);
    panel=document.createElement('section');panel.id='gms-library';panel.className='gms-library';panel.hidden=true;panel.setAttribute('data-zg-i18n-skip','');panel.setAttribute('aria-labelledby','gms-title');table.appendChild(panel);
    allTarget=document.createElement('div');allTarget.className='gms-all';allTarget.dataset.gmsAll='';allTarget.hidden=true;allTarget.setAttribute('data-zg-i18n-skip','');table.appendChild(allTarget);
    resultBox=document.createElement('section');resultBox.className='gms-result';resultBox.hidden=true;resultBox.setAttribute('role','status');resultBox.setAttribute('aria-live','polite');resultBox.setAttribute('data-zg-i18n-skip','');panel.appendChild(resultBox);
    function localize(){
      cancel();launcher.textContent=t('Хранилище','Сховище');
      panel.innerHTML='<header><h2 id="gms-title">'+t('Хранилище','Сховище')+'</h2><button type="button" data-gms-close aria-label="'+t('Закрыть хранилище','Закрити сховище')+'">×</button></header><div class="gms-controls"><b>'+t('Статусы','Стани')+'</b><input type="search" autocomplete="off" placeholder="'+t('Найти статус…','Знайти стан…')+'" aria-label="'+t('Поиск статусов','Пошук станів')+'"><nav aria-label="'+t('Каталог статусов','Каталог станів')+'"><button type="button" data-gms-tab="favorites">'+t('Избранное','Обране')+'</button><button type="button" data-gms-tab="all">'+t('Все статусы','Усі стани')+'</button></nav></div><div class="gms-list" data-gms-list></div><div class="gms-detail" data-gms-detail hidden><strong></strong><p></p><button type="button" data-gms-choose>'+t('Выдать…','Надати…')+'</button><div data-gms-recipients hidden></div></div><footer><label>'+t('Длительность','Тривалість')+'<select data-gms-unit><option value="default">'+t('По правилу статуса','За правилом стану')+'</option><option value="rounds">'+t('Раунды','Раунди')+'</option><option value="minutes">'+t('Минуты','Хвилини')+'</option><option value="hours">'+t('Часы','Години')+'</option><option value="days">'+t('Дни','Дні')+'</option><option value="manual">'+t('До снятия','До зняття')+'</option></select></label><input type="number" data-gms-duration min="1" max="999" value="3" hidden aria-label="'+t('Количество','Кількість')+'"></footer>';
      panel.appendChild(resultBox);
      allTarget.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="9" r="4"/><path d="M9 26v-4a7 7 0 0 1 14 0v4M6 9a3 3 0 1 0 0 6m20-6a3 3 0 1 1 0 6M2 26v-4a5 5 0 0 1 5-5m23 9v-4a5 5 0 0 0-5-5"/></svg><b>'+t('Всем','Усім')+'</b><small></small>';
      allTarget.title=t('Всем персонажам на этом столе','Усім персонажам на цьому столі');paintList();selected();
    }
    localize();launcher.addEventListener('click',function(){if(panel.hidden)open();else close();});
    panel.addEventListener('input',function(e){if(e.target.type==='search')paintList();});
    panel.addEventListener('change',function(e){if(e.target.matches('[data-gms-unit]'))panel.querySelector('[data-gms-duration]').hidden=['default','manual'].includes(e.target.value);});
    panel.addEventListener('click',function(e){
      var button=e.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-gms-close')){close();launcher.focus();}
      else if(button.dataset.gmsTab){tab=button.dataset.gmsTab;paintList();}
      else if(button.dataset.gmsStar){var fav=favorites(),key=button.dataset.gmsStar;try{localStorage.setItem(favoriteKey(),JSON.stringify(fav.includes(key)?fav.filter(function(k){return k!==key;}):fav.concat(key)));}catch(_){}paintList();}
      else if(button.dataset.gmsDrag){activeKey=button.dataset.gmsDrag;selected();paintList();}
      else if(button.hasAttribute('data-gms-choose'))chooseRecipients();
      else if(button.dataset.gmsSend){var def=definition(activeKey),opts=def&&optionsFor(def);if(!opts){panel.querySelector('[data-gms-duration]').reportValidity();return;}panel.querySelector('[data-gms-recipients]').hidden=true;deliver(def,button.dataset.gmsSend==='all'?targets():targets().filter(function(r){return r.key===button.dataset.gmsSend;}),opts);}
    });
    panel.addEventListener('pointerdown',function(e){
      var button=e.target.closest('[data-gms-drag]');if(!button||e.button!==0||busy)return;
      var def=definition(button.dataset.gmsDrag),opts=def&&optionsFor(def);if(!opts){panel.querySelector('[data-gms-duration]').reportValidity();return;}
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,def:def,options:opts,targets:targets(),started:false};button.setPointerCapture(e.pointerId);
    });
    document.addEventListener('pointermove',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.started&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;
      if(!drag.started){drag.started=true;document.body.classList.add('gms-dragging');allTarget.hidden=!drag.targets.length;refreshTargets();ghost=document.createElement('div');ghost.className='gms-ghost';ghost.innerHTML=glyph(drag.def)+'<span>'+esc(label(drag.def))+'</span>';document.body.appendChild(ghost);}
      e.preventDefault();ghost.style.left=(e.clientX+16)+'px';ghost.style.top=(e.clientY-30)+'px';clearHover();var dest=destination(e.clientX,e.clientY);dest?.node.classList.add('gms-drop-hover');
    },{passive:false});
    document.addEventListener('pointerup',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.started){cancel();return;}
      var dest=destination(e.clientX,e.clientY),def=drag.def,opts=drag.options;suppressUntil=Date.now()+400;cancel();
      if(dest)deliver(def,dest.targets,opts);
    });
    document.addEventListener('click',function(e){if(Date.now()<suppressUntil&&e.target.closest('[data-gms-drag],#zg-irl-character-dock,[data-gms-all]')){suppressUntil=0;e.preventDefault();e.stopImmediatePropagation();}},true);
    document.addEventListener('pointercancel',cancel);w.addEventListener('blur',cancel);
    document.addEventListener('visibilitychange',function(){if(document.hidden)cancel();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&(drag||!panel.hidden)){e.preventDefault();e.stopPropagation();if(drag)cancel();else{close();launcher.focus();}}},true);
    resultBox.addEventListener('click',function(e){if(e.target.closest('[data-gms-undo]'))undo();if(e.target.closest('[data-gms-result-close]'))resultBox.hidden=true;});
    document.addEventListener('zargota:localechange',function(){localize();resultBox.hidden=true;});
    w.addEventListener('zargota:persistent-auth-change',function(){authEpoch++;close();receipts=[];resultBox.hidden=true;});
    new MutationObserver(function(){if(!document.body.classList.contains('zg-irl-table-view'))close();}).observe(document.body,{attributes:true,attributeFilter:['class']});
    if(w.ZG_APP_CHANGELOG?.[0]){
      w.ZG_APP_CHANGELOG[0].notes+=' На столе мастера добавлено хранилище статусов с поиском, избранным и длительностью. Статус можно перетащить на героя или на временную зону «Всем» слева; сохранение подтверждается для каждого листа, успешная выдача проходит без всплывающего отчёта. Игрок видит сверху значок полученного состояния, название и длительность; правый клик по состоянию в листе открывает «Убрать». На столе отключено меню браузера, в мобильных листах — случайное выделение; поля ввода сохраняют выделение и вставку. Обновления содержимого доступны через восклицательный знак на характеристиках; большой баннер и уведомления о HP убраны. На телефоне после перезапуска восстанавливаются последний лист и вкладка, если версия сайта не изменилась.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' На столі майстра додано сховище станів із пошуком, обраним і тривалістю. Стан можна перетягнути на героя або на тимчасову зону «Усім» ліворуч; збереження підтверджується для кожного аркуша, успішне надання відбувається без спливного звіту. Гравець бачить угорі значок отриманого стану, назву й тривалість; правий клік по стану в аркуші відкриває «Прибрати». На столі вимкнено меню браузера, у мобільних аркушах — випадкове виділення; поля введення зберігають виділення та вставлення. Оновлення вмісту доступні через знак оклику на характеристиках; великий банер і сповіщення про HP прибрано. На телефоні після перезапуску відновлюються останній аркуш і вкладка, якщо версія сайту не змінилася.';
    }
  }
  w.ZargotaGmStatusLibrary={open:open,close:close,refreshTargets:refreshTargets,isActive:function(){return !!drag||!!panel&&!panel.hidden;}};
  if(document.readyState==='complete')init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})(window);
