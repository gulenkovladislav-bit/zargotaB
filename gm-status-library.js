(function(w){
  'use strict';
  var panel,launcher,allTarget,resultBox,drag=null,ghost=null,activeKey='',tab='favorites',busy=false,receipts=[],suppressUntil=0,authEpoch=0;
  var kind='statuses',category='';
  var defaults=['bleed','stun','poison','fear','burn','shield'];
  function t(ru,uk){return w.ZargotaI18n?.getLocale()==='uk'?uk:ru;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(s){return w.ZargotaI18n?.translate(s)||s;}
  function label(s){return w.ZargotaI18n?.getLocale()==='uk'&&s.labelUk?s.labelUk:tr(s.label||s.key);}
  function catalog(section){if((section||kind)==='items')return (w.loadShopItems?.()||[]).filter(function(i){return i&&i.id&&i.name&&!['service','services'].includes(i.category||i.cat);}).map(function(i){return Object.assign({},i,{key:String(i.id),label:i.name,labelUk:i.nameUk,description:i.description||i.desc||'',_item:true});});return (w.zgGmStatusCatalog?.()||[]).filter(function(s){return s&&s.key&&s.enabled!==false;});}
  function definition(key){return catalog().find(function(s){return s.key===key;});}
  function glyph(s){if(s._item){var src=s.imageThumb||s.image||w.ZargotaItemIcons?.pathFor(s)||'';return /^(https?:\/\/|images\/|assets\/|data:image\/)/i.test(src)?'<img class="gms-icon gms-item-art" src="'+esc(src)+'" alt="" draggable="false">':'<span class="gms-icon">◇</span>';}return w.zgStatusGlyphMarkup?.(s,label(s),'gms-icon')||'<span class="gms-icon">'+esc(s.icon||'✦')+'</span>';}
  function favoriteKey(){return 'zg-gm-'+(kind==='items'?'item':'status')+'-favorites-v1:'+String(w.ZargotaPersistentCharacters?.tableIdentity().uid||'local');}
  function favorites(){try{var value=JSON.parse(localStorage.getItem(favoriteKey()));if(Array.isArray(value))return value;}catch(_){}return kind==='items'?[]:defaults.slice();}
  function targets(){return w.ZargotaGmTable?.targets()||[];}
  var categories={currency:['Монеты','Монети'],weapon:['Оружие','Зброя'],armor:['Броня','Броня'],shield:['Щиты','Щити'],potion:['Зелья','Зілля'],consumable:['Расходники','Витратні предмети'],food:['Еда и быт','Їжа й побут'],magic:['Магическое','Магічне'],accessory:['Украшения','Прикраси'],tool:['Инструменты','Інструменти'],mount:['Транспорт','Транспорт'],property:['Жильё','Житло'],material:['Материалы','Матеріали'],contraband:['Подпольное','Підпільне'],other:['Разное','Різне']};
  function itemCategory(item){var key=item.category==='currency'?'currency':item.cat||item.category||'other';key=({artifact:'magic',clothing:'armor',item:'other'})[key]||key;return categories[key]?key:'other';}
  function filterMarkup(){
    var values=new Set(catalog().map(itemCategory));
    return '<div class="gms-filters">'+(kind==='items'?'<select data-gms-category aria-label="'+t('Категория предметов','Категорія предметів')+'"><option value="">'+t('Все категории','Усі категорії')+'</option>'+Object.keys(categories).filter(function(key){return values.has(key);}).map(function(key){return '<option value="'+key+'"'+(category===key?' selected':'')+'>'+t(categories[key][0],categories[key][1])+'</option>';}).join('')+'</select>':'')+'<button type="button" data-gms-favorites aria-pressed="'+(tab==='favorites')+'" aria-label="'+t('Только избранное','Лише обране')+'" title="'+t('Только избранное','Лише обране')+'">★</button></div>';
  }
  function paintList(){
    if(!panel||panel.hidden)return;
    var query=panel.querySelector('input[type=search]').value.toLocaleLowerCase().trim(),favs=favorites();
    var list=catalog().filter(function(s){return (tab!=='favorites'||favs.includes(s.key))&&(kind!=='items'||!category||itemCategory(s)===category)&&(!query||[label(s),s.label,s.labelUk,s.key].join(' ').toLocaleLowerCase().includes(query));});
    panel.querySelector('[data-gms-list]').innerHTML=list.map(function(s){var starred=favs.includes(s.key);return '<article class="gms-tile'+(activeKey===s.key?' is-selected':'')+'"><button type="button" data-gms-drag="'+esc(s.key)+'" aria-label="'+esc(label(s))+'">'+glyph(s)+'<span>'+esc(label(s))+'</span></button><button type="button" class="gms-star" data-gms-star="'+esc(s.key)+'" aria-pressed="'+starred+'" aria-label="'+esc(starred?t('Убрать из избранного','Прибрати з обраного'):t('В избранное','До обраного'))+'">'+(starred?'★':'☆')+'</button></article>';}).join('')||'<p class="gms-empty">'+t('Ничего не найдено','Нічого не знайдено')+'</p>';
    panel.querySelector('[data-gms-favorites]').setAttribute('aria-pressed',tab==='favorites');
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
    if(def._item){var qty=Number(panel.querySelector('[data-gms-qty]').value);return Number.isInteger(qty)&&qty>0&&qty<=999?{qty:qty}:null;}
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
    'unknown-item':t('Предмет больше недоступен','Предмет більше недоступний'),'invalid-quantity':t('Количество: от 1 до 999','Кількість: від 1 до 999'),'inventory-full':t('Достигнут предел записей инвентаря','Досягнуто межі записів інвентарю'),'receipt-limit':t('Игроку нужно просмотреть прошлые выдачи','Гравцеві потрібно переглянути минулі надходження'),'unknown-status':t('Статус больше недоступен','Стан більше недоступний')
  })[reason]||t('Не удалось применить','Не вдалося застосувати');}
  function showResults(title,results){
    var failed=results.filter(function(r){return !r.ok;});
    if(failed.length&&panel.hidden)open();
    resultBox.hidden=!failed.length;
    resultBox.textContent=failed.map(function(r){return r.target.name+(r.entry?' · '+r.entry:'')+': '+reasonText(r.reason);}).join(' · ');
  }
  async function deliver(def,chosen,options,bundle){
    if(busy||!chosen.length)return;
    busy=true;receipts=[];panel.setAttribute('aria-busy','true');
    resultBox.hidden=true;resultBox.textContent='';
    var result=[],epoch=authEpoch,operations=bundle||[{def:def,options:options}];
    try{
      // Fixed recipient set for this gesture. Each write checks current access,
      // saves against the latest acknowledged revision and reports independently.
      for(var target of chosen){
       for(var operation of operations){
        var def=operation.def,options=operation.options;
        if(epoch!==authEpoch)return;
        var response;
        try{response=def._item?await w.ZargotaGmTable.item(target,(w.loadShopItems?.()||[]).find(function(i){return String(i.id)===def.key;}),options.qty,w.crypto.randomUUID()):await w.ZargotaGmTable.status(target,def.key,options);}
        catch(_){response={ok:false,reason:'unconfirmed'};}
        if(epoch!==authEpoch)return;
        if(response.ok&&response.changed)receipts.push({target:target,receipt:response.receipt});
        result.push(Object.assign({target:target,entry:label(def)},response));
       }
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
    drag?.hooks?.cancel();drag=null;ghost?.remove();ghost=null;clearHover();if(allTarget)allTarget.hidden=true;
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
  function init(){
    var table=document.querySelector('#page-gm-table .zg-irl-table');if(!table)return;
    launcher=document.createElement('button');launcher.type='button';launcher.className='gms-launcher';launcher.setAttribute('aria-controls','gms-library');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('data-zg-i18n-skip','');table.appendChild(launcher);
    panel=document.createElement('section');panel.id='gms-library';panel.className='gms-library';panel.hidden=true;panel.setAttribute('data-zg-i18n-skip','');panel.setAttribute('aria-labelledby','gms-title');table.appendChild(panel);
    allTarget=document.createElement('div');allTarget.className='gms-all';allTarget.dataset.gmsAll='';allTarget.hidden=true;allTarget.setAttribute('data-zg-i18n-skip','');table.appendChild(allTarget);
    resultBox=document.createElement('section');resultBox.className='gms-result';resultBox.hidden=true;resultBox.setAttribute('role','status');resultBox.setAttribute('aria-live','polite');resultBox.setAttribute('data-zg-i18n-skip','');panel.appendChild(resultBox);
    function localize(){
      cancel();launcher.textContent=t('Хранилище','Сховище');
      panel.innerHTML='<header><h2 id="gms-title">'+t('Хранилище','Сховище')+'</h2><button type="button" data-gms-close aria-label="'+t('Закрыть хранилище','Закрити сховище')+'">×</button></header><div class="gms-controls"><nav class="gms-kinds"><button type="button" data-gms-kind="statuses" aria-pressed="'+(kind==='statuses')+'">'+t('Статусы','Стани')+'</button><button type="button" data-gms-kind="items" aria-pressed="'+(kind==='items')+'">'+t('Предметы','Предмети')+'</button></nav><input type="search" autocomplete="off" placeholder="'+(kind==='items'?t('Найти предмет…','Знайти предмет…'):t('Найти статус…','Знайти стан…'))+'" aria-label="'+t('Поиск в хранилище','Пошук у сховищі')+'">'+filterMarkup()+'</div><div class="gms-list" data-gms-list></div><div class="gms-detail" data-gms-detail hidden><strong></strong><p></p></div><footer><label>'+t('Длительность','Тривалість')+'<select data-gms-unit><option value="default">'+t('По правилу статуса','За правилом стану')+'</option><option value="rounds">'+t('Раунды','Раунди')+'</option><option value="minutes">'+t('Минуты','Хвилини')+'</option><option value="hours">'+t('Часы','Години')+'</option><option value="days">'+t('Дни','Дні')+'</option><option value="manual">'+t('До снятия','До зняття')+'</option></select></label><input type="number" data-gms-duration min="1" max="999" value="3" hidden aria-label="'+t('Количество','Кількість')+'"></footer>';
      if(kind==='items')panel.querySelector('footer').innerHTML='<label>'+t('Количество каждому','Кількість кожному')+'<input type="number" data-gms-qty min="1" max="999" value="1"></label>';
      panel.appendChild(resultBox);
      allTarget.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="9" r="4"/><path d="M9 26v-4a7 7 0 0 1 14 0v4M6 9a3 3 0 1 0 0 6m20-6a3 3 0 1 1 0 6M2 26v-4a5 5 0 0 1 5-5m23 9v-4a5 5 0 0 0-5-5"/></svg><b>'+t('Всем','Усім')+'</b><small></small>';
      allTarget.title=t('Всем персонажам на этом столе','Усім персонажам на цьому столі');paintList();selected();
    }
    localize();launcher.addEventListener('click',function(){if(panel.hidden)open();else close();});
    panel.addEventListener('input',function(e){if(e.target.type==='search')paintList();});
    panel.addEventListener('change',function(e){if(e.target.matches('[data-gms-category]')){category=e.target.value;activeKey='';selected();paintList();}if(e.target.matches('[data-gms-unit]'))panel.querySelector('[data-gms-duration]').hidden=['default','manual'].includes(e.target.value);});
    panel.addEventListener('click',function(e){
      var button=e.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-gms-close')){close();launcher.focus();}
      else if(button.dataset.gmsKind&&!busy){kind=button.dataset.gmsKind;activeKey='';tab=kind==='items'?'all':'favorites';localize();}
      else if(button.hasAttribute('data-gms-favorites')){tab=tab==='favorites'?'all':'favorites';paintList();}
      else if(button.dataset.gmsStar){var fav=favorites(),key=button.dataset.gmsStar;try{localStorage.setItem(favoriteKey(),JSON.stringify(fav.includes(key)?fav.filter(function(k){return k!==key;}):fav.concat(key)));}catch(_){}paintList();}
      else if(button.dataset.gmsDrag){activeKey=button.dataset.gmsDrag;selected();paintList();}
    });
    panel.addEventListener('pointerdown',function(e){
      var button=e.target.closest('[data-gms-drag]');if(!button||e.button!==0||busy)return;
      var def=definition(button.dataset.gmsDrag),opts=def&&optionsFor(def);if(!opts){panel.querySelector(kind==='items'?'[data-gms-qty]':'[data-gms-duration]').reportValidity();return;}
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,def:def,options:opts,targets:targets(),started:false};button.setPointerCapture(e.pointerId);
    });
    document.addEventListener('pointermove',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.started&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<7)return;
      if(!drag.started){drag.started=true;document.body.classList.add('gms-dragging');allTarget.hidden=!drag.targets.length;refreshTargets();if(!drag.hooks){ghost=document.createElement('div');ghost.className='gms-ghost';ghost.innerHTML=glyph(drag.def)+'<span>'+esc(label(drag.def))+'</span>';document.body.appendChild(ghost);}}
      if(drag.hooks)drag.hooks.move(e.clientX,e.clientY);
      e.preventDefault();if(ghost){ghost.style.left=(e.clientX+16)+'px';ghost.style.top=(e.clientY-30)+'px';}clearHover();var dest=destination(e.clientX,e.clientY);dest?.node.classList.add('gms-drop-hover');
    },{passive:false});
    document.addEventListener('pointerup',function(e){
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.started){cancel();return;}
      var dest=destination(e.clientX,e.clientY),def=drag.def,opts=drag.options,prepared=drag.prepared,bundle=drag.bundle;drag.hooks?.drop(e.clientX,e.clientY,!!dest);suppressUntil=Date.now()+400;cancel();
      if(dest)deliver(def,dest.targets,opts,bundle);
      else if(!prepared)w.ZargotaTableObjects?.place(def,opts,e.clientX,e.clientY);
    });
    document.addEventListener('click',function(e){if(Date.now()<suppressUntil&&e.target.closest('[data-gms-drag],[data-table-object],#zg-irl-character-dock,[data-gms-all]')){suppressUntil=0;e.preventDefault();e.stopImmediatePropagation();}},true);
    document.addEventListener('pointercancel',cancel);w.addEventListener('blur',cancel);
    document.addEventListener('visibilitychange',function(){if(document.hidden)cancel();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&(drag||!panel.hidden)){e.preventDefault();e.stopPropagation();if(drag)cancel();else{close();launcher.focus();}}},true);
    resultBox.addEventListener('click',function(e){if(e.target.closest('[data-gms-undo]'))undo();if(e.target.closest('[data-gms-result-close]'))resultBox.hidden=true;});
    document.addEventListener('zargota:localechange',function(){var query=panel.querySelector('input[type=search]').value,qty=panel.querySelector('[data-gms-qty]')?.value,unit=panel.querySelector('[data-gms-unit]')?.value,duration=panel.querySelector('[data-gms-duration]')?.value;localize();panel.querySelector('input[type=search]').value=query;if(qty)panel.querySelector('[data-gms-qty]').value=qty;if(unit){panel.querySelector('[data-gms-unit]').value=unit;panel.querySelector('[data-gms-duration]').value=duration;panel.querySelector('[data-gms-duration]').hidden=['default','manual'].includes(unit);}paintList();resultBox.hidden=true;});
    w.addEventListener('zargota:persistent-auth-change',function(){authEpoch++;close();receipts=[];resultBox.hidden=true;});
    new MutationObserver(function(){if(!document.body.classList.contains('zg-irl-table-view'))close();}).observe(document.body,{attributes:true,attributeFilter:['class']});
    if(w.ZG_APP_CHANGELOG?.[0]){
      w.ZG_APP_CHANGELOG[0].notes+=' Монеты со стола зачисляются в кошелёк. Принятие выдачи сопровождается звуком монет или предмета. Правый клик по предмету позволяет удалить выбранное количество, а старые стопки монет — перенести в кошелёк. Исправлено пустое название при отсутствии перевода.';
      w.ZG_APP_CHANGELOG[0].notes+=' В хранилище убраны кнопка выдачи и список получателей: предметы и статусы выдаются перетаскиванием, нажатие показывает описание.';
      w.ZG_APP_CHANGELOG[0].notes+=' Фильтры хранилища упрощены: категории предметов и компактная звезда избранного вместо второго ряда вкладок. Подписи следуют общему языку сайта.';
      w.ZG_APP_CHANGELOG[0].notes+=' В хранилище добавлены предметы из общего каталога: выдача перетаскиванием одному или всем, с количеством каждому. Полученные предметы показываются в листе игрока на весь экран, со стрелками и кнопкой «Принять»; непросмотренные выдачи сохраняются до следующего входа.';
      w.ZG_APP_CHANGELOG[0].notes+=' На столе мастера добавлено хранилище статусов с поиском, избранным и длительностью. Статус можно перетащить на героя или на временную зону «Всем» слева; сохранение подтверждается для каждого листа, успешная выдача проходит без всплывающего отчёта. Игрок видит сверху значок полученного состояния, название и длительность; правый клик по состоянию в листе открывает «Убрать». На столе отключено меню браузера, в мобильных листах — случайное выделение; поля ввода сохраняют выделение и вставку. Обновления содержимого доступны через восклицательный знак на характеристиках; большой баннер и уведомления о HP убраны. На телефоне после перезапуска восстанавливаются последний лист и вкладка, если версия сайта не изменилась.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Монети зі столу зараховуються до гаманця. Прийняття надходження супроводжується звуком монет або предмета. Правий клік по предмету дозволяє видалити вибрану кількість, а старі стоси монет — перенести до гаманця. Виправлено порожню назву за відсутності перекладу.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' У сховищі прибрано кнопку надання та список одержувачів: предмети й стани надаються перетягуванням, натискання показує опис.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' Фільтри сховища спрощено: категорії предметів і компактна зірка обраного замість другого ряду вкладок. Підписи відповідають загальній мові сайту.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' У сховищі додано предмети зі спільного каталогу: надання перетягуванням одному або всім, із кількістю кожному. Отримані предмети показуються в аркуші гравця на весь екран, зі стрілками та кнопкою «Прийняти»; непереглянуті надходження зберігаються до наступного входу.';
      w.ZG_APP_CHANGELOG[0].notesUk+=' На столі майстра додано сховище станів із пошуком, обраним і тривалістю. Стан можна перетягнути на героя або на тимчасову зону «Усім» ліворуч; збереження підтверджується для кожного аркуша, успішне надання відбувається без спливного звіту. Гравець бачить угорі значок отриманого стану, назву й тривалість; правий клік по стану в аркуші відкриває «Прибрати». На столі вимкнено меню браузера, у мобільних аркушах — випадкове виділення; поля введення зберігають виділення та вставлення. Оновлення вмісту доступні через знак оклику на характеристиках; великий банер і сповіщення про HP прибрано. На телефоні після перезапуску відновлюються останній аркуш і вкладка, якщо версія сайту не змінилася.';
    }
  }
  w.ZargotaGmStatusLibrary={lookup:function(section,key){return catalog(section).find(function(s){return s.key===key;});},label:label,glyph:glyph,description:description,beginPrepared:function(event,section,key,options,hooks,bundle){if(busy)return;var def=catalog(section).find(function(s){return s.key===key;});if(!def)return;var operations=(bundle||[{kind:section,key:key,options:options}]).map(function(entry){return {def:catalog(entry.kind).find(function(d){return d.key===entry.key;}),options:JSON.parse(JSON.stringify(entry.options))};});if(operations.some(function(entry){return !entry.def;})){w.showToast?.(t('Часть выбранных карточек больше недоступна в каталоге.','Частина вибраних карток більше недоступна в каталозі.'));return;}drag={id:event.pointerId,x:event.clientX,y:event.clientY,def:def,options:JSON.parse(JSON.stringify(options)),targets:targets(),started:false,prepared:true,hooks:hooks,bundle:operations};event.target.closest('[data-table-object]').setPointerCapture(event.pointerId);},cancelDrag:cancel,open:open,close:close,refreshTargets:refreshTargets,isActive:function(){return !!drag||!!panel&&!panel.hidden;}};
  if(document.readyState==='complete')init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})(window);
