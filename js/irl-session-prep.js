/* Local, GM-only session preparation. Never writes the shared NPC/character registry. */
(function (w) {
  'use strict';
  var pack = w.ZG_MORELESYE_PACK;
  if (!pack) return;
  var selected = 'start', tab = 'briefing', query = '', place = 'all';
  var words = {
    'Подготовка партии':'Підготовка партії','Морелесье':'Морелісся','Только для мастера':'Лише для Майстра',
    'План и улики':'План і докази','Персонажи':'Персонажі','Встречи':'Зустрічі','Все места':'Усі місця','Дорога':'Дорога','Деревня':'Село','Маяк':'Маяк',
    'Поиск по памятке':'Пошук у пам’ятці','Закрыть подготовку':'Закрити підготовку','Цель':'Мета','Отыгрыш':'Відіграш','Знает':'Знає','Тайна мастера':'Таємниця Майстра',
    'Механика из источника':'Механіка з джерела','Когда':'Коли','Что видно':'Що видно','Развитие':'Розвиток','Источник':'Джерело','Сыграно':'Зіграно',
    'Заметка к карточке':'Нотатка до картки','Сохранено':'Збережено','Не удалось сохранить':'Не вдалося зберегти','Ничего не найдено':'Нічого не знайдено',
    'Выберите карточку слева':'Оберіть картку ліворуч','В сценах и событиях стола доступен тот же маршрут. Манеры отыгрыша — рекомендации; будущие встречи не считаются сыгранными.':'У сценах і подіях столу доступний той самий маршрут. Манери відіграшу — рекомендації; майбутні зустрічі не вважаються зіграними.',
    'Изменения характеристик и состояний сохраняются в этой сессии. Обновление из реестра отменяет сессионные правки.':'Зміни характеристик і станів зберігаються в цій сесії. Оновлення з реєстру скасовує сесійні правки.',
    'Добавить состояние':'Додати стан','Название состояния':'Назва стану','Своё состояние':'Власний стан','Длительность / заметка':'Тривалість / нотатка','Удалить состояние':'Видалити стан','Максимум HP':'Максимум HP',
    'Состояния вручную — памятка мастеру, без автоматического отсчёта и изменения бросков.':'Стани вручну — пам’ятка Майстру, без автоматичного відліку й зміни кидків.',
    'Карточки партии':'Картки партії','Полная карточка':'Повна картка','План доски':'План дошки','Черновик встречи':'Чернетка зустрічі','Есть открытые вопросы':'Є відкриті питання'
  };
  function locale(){ return w.ZargotaI18n && w.ZargotaI18n.getLocale() === 'uk' ? 'uk' : 'ru'; }
  function text(value){ return value && typeof value === 'object' ? value[locale()] || value.ru || '' : String(value || ''); }
  function tr(value){return locale()==='uk' ? words[value] || value : value;}
  function esc(value){return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function register(){
    if(!w.ZargotaI18n) return;
    var dictionary=Object.assign({},words);
    function scan(value){if(!value||typeof value!=='object')return;if(value.ru&&value.uk)dictionary[value.ru]=value.uk;else Object.keys(value).forEach(function(k){scan(value[k]);});}
    scan(pack);w.ZargotaI18n.registerContentTranslations(dictionary);
  }
  function state(){var s=w.zgIrlSessionRead&&w.zgIrlSessionRead();return s&&s.data&&s.data.sessionPrep||{done:{},notes:{}};}
  function store(id,field,value){var s=state();s.done=s.done||{};s.notes=s.notes||{};s[field][id]=value;var ok=w.zgIrlSessionSaveData('sessionPrep',s);var status=document.getElementById('irl-prep-save');if(status)status.textContent=tr(ok?'Сохранено':'Не удалось сохранить');return ok;}
  var places={road:['Дорога','Дорога'],village:['Морелесье','Морелісся'],lighthouse:['Маяк','Маяк']};
  w.zgIrlPackNpcRows=function(){return pack.npc.map(function(n){return{id:n.id,name:text(n.name),role:text(n.goal),place:places[n.place][locale()==='uk'?1:0],goal:text(n.goal),behavior:text(n.play),desc:text(n.knows),icon:n.place==='road'?'♧':'◈',sessionPack:true};});};
  // Add only absent records once per local session. User edits and scene selection survive.
  w.zgIrlPrepareSession=function(){
    var active=w.zgIrlSessionRead&&w.zgIrlSessionRead();if(!active)return false;
    var data=active.data||{},ws=data.tableWorkspace||{};if(ws.morelesyePackVersion)return true;
    ws.scenes=Array.isArray(ws.scenes)?ws.scenes:[];ws.events=Array.isArray(ws.events)?ws.events:[];
    Object.keys(places).forEach(function(key){var id='morelesye-scene-'+key;if(ws.scenes.some(function(s){return s.id===id;}))return;
      var names=places[key];words[names[0]]=names[1];
      ws.scenes.push({id:id,name:names[0],background:'',backgroundScale:100,backgroundDim:38,gmNotes:{important:key==='road'?pack.briefing[1].body.ru:pack.briefing[2].body.ru},npcIds:pack.npc.filter(function(n){return n.place===key;}).map(function(n){return n.id;})});
    });
    pack.encounters.forEach(function(e){if(ws.events.some(function(x){return x.id===e.id;}))return;ws.events.push({id:e.id,type:'encounter',title:e.title.ru,summary:e.visible.ru,trigger:e.trigger.ru,outcome:e.options.ru,gmNote:e.secret.ru,sceneIds:['morelesye-scene-'+e.place]});});
    if(!ws.activeSceneId)ws.activeSceneId='morelesye-scene-road';
    ws.morelesyePackVersion=pack.version;
    return w.zgIrlSessionSaveData('tableWorkspace',ws);
  };
  function badge(item){return item.status&&item.status.indexOf('episode-draft')>=0?tr('Черновик встречи'):item.status&&item.status.indexOf('unresolved')>=0?tr('Есть открытые вопросы'):tr('План доски');}
  function rows(){var list=pack[tab]||[];return list.filter(function(item){return(place==='all'||tab==='briefing'||item.place===place)&&(!query||JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));});}
  function renderList(){
    var host=document.getElementById('irl-prep-list');if(!host)return;
    var saved=state(),list=rows();
    host.innerHTML=list.length?list.map(function(n){return '<button type="button" data-prep-id="'+esc(n.id)+'" class="'+(selected===n.id?'active':'')+'" aria-pressed="'+(selected===n.id)+'"><strong>'+esc(text(n.name||n.title))+'</strong><small>'+esc(n.place?places[n.place][locale()==='uk'?1:0]:tr('План и улики'))+(saved.done&&saved.done[n.id]?' · ✓':'')+'</small></button>';}).join(''):'<p>'+tr('Ничего не найдено')+'</p>';
  }
  function field(label,value){return value?'<section><h3>'+esc(tr(label))+'</h3><p>'+esc(text(value))+'</p></section>':'';}
  function renderDetail(){
    var host=document.getElementById('irl-prep-detail'),item=(pack[tab]||[]).find(function(n){return n.id===selected;});if(!host)return;
    if(!item){host.innerHTML='<p>'+tr('Выберите карточку слева')+'</p>';return;}
    host.scrollTop=0;
    var saved=state();host.innerHTML='<header><small>'+esc(tr('Только для мастера'))+(item.status?' · '+esc(badge(item)):'')+'</small><h2>'+esc(text(item.name||item.title))+'</h2></header>'+(tab==='npc'?field('Цель',item.goal)+field('Отыгрыш',item.play)+field('Знает',item.knows)+field('Тайна мастера',item.secret)+field('Механика из источника',item.combat):tab==='encounters'?field('Когда',item.trigger)+field('Что видно',item.visible)+field('Развитие',item.options)+field('Тайна мастера',item.secret):'<p>'+esc(text(item.body))+'</p>')+'<details><summary>'+tr('Источник')+'</summary><p>'+esc(item.source)+'</p></details>'+(tab==='encounters'?'<label class="irl-prep-done"><input id="irl-prep-done" type="checkbox" '+(saved.done&&saved.done[item.id]?'checked':'')+'> '+tr('Сыграно')+'</label>':'')+'<label for="irl-prep-note">'+tr('Заметка к карточке')+'</label><textarea id="irl-prep-note" rows="3" maxlength="6000">'+esc(saved.notes&&saved.notes[item.id]||'')+'</textarea><small id="irl-prep-save" role="status"></small>';
  }
  function filterResults(){var list=rows();if(!list.some(function(n){return n.id===selected;})){selected=(list[0]||{}).id||'';renderDetail();}renderList();}
  function render(){
    var panel=document.getElementById('irl-prep-panel');if(!panel)return;
    panel.querySelectorAll('[data-prep-tab]').forEach(function(b){b.classList.toggle('active',b.dataset.prepTab===tab);b.setAttribute('aria-pressed',String(b.dataset.prepTab===tab));});
    renderList();renderDetail();
  }
  w.zgIrlPrepOpen=function(id){
    if(id){var item=pack.npc.find(function(n){return n.id===id;});if(item){tab='npc';selected=id;place='all';query='';}}
    var panel=document.getElementById('irl-prep-panel');if(!panel)return;
    if(w.zgIrlWorkspaceClosePanels)w.zgIrlWorkspaceClosePanels();panel.hidden=false;panel.querySelector('#irl-prep-search').value=query;panel.querySelector('#irl-prep-place').value=place;render();panel.querySelector('[data-prep-close]').focus();
  };
  function mount(){
    register();var table=document.querySelector('#page-gm-table .zg-irl-table');if(!table)return;
    var button=document.createElement('button');button.type='button';button.className='irl-prep-launch';button.id='irl-prep-launch';button.textContent=tr('Подготовка партии')+' · '+tr('Морелесье');button.onclick=function(){w.zgIrlPrepOpen();};table.appendChild(button);
    var panel=document.createElement('section');panel.id='irl-prep-panel';panel.className='irl-prep-panel';panel.hidden=true;panel.setAttribute('aria-label',tr('Подготовка партии'));panel.setAttribute('data-zg-i18n-skip','true');
    table.appendChild(panel);
    function shell(){panel.innerHTML='<header class="irl-prep-head"><div><small>'+tr('Только для мастера')+'</small><h2>'+esc(text(pack.title))+'</h2></div><button type="button" data-prep-close aria-label="'+tr('Закрыть подготовку')+'">×</button></header><p class="irl-prep-intro">'+tr('В сценах и событиях стола доступен тот же маршрут. Манеры отыгрыша — рекомендации; будущие встречи не считаются сыгранными.')+'</p><nav>'+[['briefing','План и улики'],['npc','Персонажи'],['encounters','Встречи']].map(function(p){return '<button type="button" data-prep-tab="'+p[0]+'">'+tr(p[1])+'</button>';}).join('')+'</nav><div class="irl-prep-filter"><input type="search" id="irl-prep-search" placeholder="'+tr('Поиск по памятке')+'" aria-label="'+tr('Поиск по памятке')+'" value="'+esc(query)+'"><select id="irl-prep-place" aria-label="'+tr('Все места')+'">'+[['all','Все места'],['road','Дорога'],['village','Деревня'],['lighthouse','Маяк']].map(function(p){return '<option value="'+p[0]+'" '+(place===p[0]?'selected':'')+'>'+tr(p[1])+'</option>';}).join('')+'</select></div><div class="irl-prep-layout"><aside id="irl-prep-list"></aside><article id="irl-prep-detail"></article></div>';render();}
    shell();
    panel.addEventListener('click',function(e){var target=e.target.closest('button');if(!target)return;if(target.hasAttribute('data-prep-close')){panel.hidden=true;button.focus();}else if(target.dataset.prepTab){tab=target.dataset.prepTab;selected=(rows()[0]||{}).id||'';render();}else if(target.dataset.prepId){selected=target.dataset.prepId;render();}});
    panel.addEventListener('input',function(e){if(e.target.id==='irl-prep-search'){query=e.target.value;filterResults();}if(e.target.id==='irl-prep-note')store(selected,'notes',e.target.value);});
    panel.addEventListener('change',function(e){if(e.target.id==='irl-prep-place'){place=e.target.value;filterResults();}if(e.target.id==='irl-prep-done'){store(selected,'done',e.target.checked);renderList();}});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden){panel.hidden=true;button.focus();}});
    document.addEventListener('zargota:localechange',function(){button.textContent=tr('Подготовка партии')+' · '+tr('Морелесье');panel.setAttribute('aria-label',tr('Подготовка партии'));shell();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(window);
