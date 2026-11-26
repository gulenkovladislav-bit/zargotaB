(function(w){
  'use strict';
  var roster=[],selected='',host=null,home=null,previous=null,signature='',sheetSignature='',mountedId='',drag=null,opening=false,styleNode=null,resizeObserver=null,mobileStyles=null;
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(s){return w.ZargotaI18n?w.ZargotaI18n.translate(s):s;}
  function hero(row){
    var id=row.character&&row.character.id;
    if(w.ZargotaPersistentCharacters)id=w.ZargotaPersistentCharacters.resolveCharacterId(id);
    return (w.characters||[]).find(function(c){return String(c.id)===String(id);})||null;
  }
  function current(){var row=roster.find(function(r){return r.key===selected;});return row&&hero(row);}
  function refresh(){if(w.zgIrlCharactersRender)w.zgIrlCharactersRender(true);}
  function close(){if(w.zgIrlCharacterClose)w.zgIrlCharacterClose();}
  function isOpen(){return !!host&&document.body.classList.contains('zg-gm-sheet-open');}
  function isEditing(id){
    var c=current();if(!isOpen()||!c||String(c.id)!==String(id))return false;
    var editor=host.querySelector('#char-editor-view');
    // Inline style formatting is not visibility: "display:none" and
    // "display: none" must both leave a read-only sheet free to receive updates.
    return !!(host.querySelector('#zgmo-number-pad')||editor&&getComputedStyle(editor).display!=='none'||host.contains(document.activeElement)&&document.activeElement.matches('input:not([readonly]),textarea:not([readonly]),select,[contenteditable="true"]'));
  }
  function portal(){return isOpen()?host:document.body;}
  function presentDialog(dialog){if(isOpen())dialog.show();else dialog.showModal();}
  function deactivate(){
    w.ZargotaMobileSkills?.setActive(false,true);w.ZargotaMobileLore?.setActive(false);
    w.ZargotaMobileSheet?.setInventoryActive(false);w.ZargotaMobileSheet?.setActive(false);
    host?.querySelectorAll('#status-popup,#quick-temp-popup,#status-info-popup,#zgmo-number-pad').forEach(function(el){el.remove();});
  }
  function unmountSheet(){
    if(!host)return;
    deactivate();
    var page=document.getElementById('page-characters');page.classList.remove('active');
    home.replaceWith(page);home=null;
    document.getElementById('char-sheet-tab-bar')?.remove();
    if(previous){w.viewingCharId=previous.id;w.charView=previous.view;w._charSheetTab=previous.tab;}
    document.body.classList.remove('zg-gm-sheet-open');
    resizeObserver?.disconnect();resizeObserver=null;host.remove();host=null;sheetSignature='';mountedId='';
    styleNode?.remove();styleNode=null;
  }
  // Adapt the existing mobile styles to this component's dimensions. Rules stay
  // sourced from the mobile stylesheets, so phone and table cannot drift apart.
  function sheetStyles(){
    if(!host)return;
    var box=host.getBoundingClientRect(),scope='body.zg-gm-sheet-open .zg-gm-sheet-host';
    host.style.setProperty('--zg-viewport-height',box.height+'px');host.style.setProperty('--zg-viewport-top','0px');
    function selector(value){
      var parts=[],start=0,depth=0;
      for(var i=0;i<value.length;i++){if('(['.includes(value[i]))depth++;if(')]'.includes(value[i]))depth--;if(value[i]===','&&!depth){parts.push(value.slice(start,i));start=i+1;}}
      parts.push(value.slice(start));
      return parts.map(function(part){part=part.trim();var body=part.match(/^body((?:\.[\w-]+)*)(?:\s*>\s*|\s+)?(.*)$/);return body?'body.zg-gm-sheet-open'+body[1]+' .zg-gm-sheet-host'+(body[2]?' '+body[2]:''):scope+' '+part;}).join(',');
    }
    function media(condition){return w.matchMedia(condition.replace(/\((min|max)-(width|height):\s*([\d.]+)px\)/g,function(_,bound,axis,n){var yes=bound==='max'?box[axis]<=Number(n):box[axis]>=Number(n);return yes?'(min-width:0px)':'(min-width:10000000px)';})).matches;}
    function values(text){return text.replace(/(-?[\d.]+)([dsv]?v[wh])/g,function(_,n,unit){return (Number(n)*(unit.endsWith('w')?box.width:box.height)/100)+'px';}).replace(/position:\s*fixed/g,'position: absolute');}
    function rules(list){return Array.from(list).map(function(rule){
      if(rule.type===CSSRule.STYLE_RULE)return selector(rule.selectorText)+'{'+values(rule.style.cssText)+'}';
      if(rule.type===CSSRule.MEDIA_RULE)return media(rule.conditionText)?rules(rule.cssRules):'';
      if(rule.type===CSSRule.SUPPORTS_RULE)return CSS.supports(rule.conditionText)?rules(rule.cssRules):'';
      if(rule.type===CSSRule.KEYFRAMES_RULE)return rule.cssText;
      return '';
    }).join('\n');}
    if(!mobileStyles){mobileStyles=new CSSStyleSheet();mobileStyles.replaceSync(w.ZargotaGmSheetStyles);}
    var css=rules(mobileStyles.cssRules);
    if(!styleNode){styleNode=document.createElement('style');styleNode.id='gm-sheet-component-styles';document.head.appendChild(styleNode);}
    styleNode.textContent=css;
  }
  function mountSheet(card){
    if(host)return;
    card.removeAttribute('data-irl-draggable');card.removeAttribute('data-irl-window-key');card.removeAttribute('style');card.classList.add('zg-gm-phone');
    card.innerHTML='<header class="zg-gm-phone-head"><span aria-hidden="true">⠿</span><strong></strong><button type="button" data-gm-close aria-label="'+t('Закрыть лист','Закрити аркуш')+'">×</button></header>';
    host=document.createElement('div');host.className='zg-gm-sheet-host';card.appendChild(host);
    var page=document.getElementById('page-characters');
    previous={id:w.viewingCharId,view:w.charView,tab:w._charSheetTab};home=document.createComment('character-page-home');page.before(home);host.appendChild(page);page.classList.add('active');
    document.body.classList.add('zg-gm-sheet-open');sheetStyles();
    resizeObserver=new ResizeObserver(sheetStyles);resizeObserver.observe(host);
  }
  function updateSheet(){
    if(!host||!selected||opening)return;
    var c=current();if(!c)return;
    var next=JSON.stringify(c);
    opening=true;
    try{
      if(mountedId!==String(c.id)){
        mountedId=String(c.id);deactivate();w._charSheetTab='stats';w.openCharSheet(c.id);
      }else if(next!==sheetSignature&&!isEditing(c.id))w.renderCharSheet();
      sheetSignature=JSON.stringify(c);
    }finally{opening=false;}
  }
  function render(rows,state,helpers){
    if(!document.body.classList.contains('zg-irl-table-view')){unmountSheet();selected='';w.ZargotaGmParticipants?.close();w.ZargotaGmStatusLibrary?.close();return;}
    var shared=w.ZargotaPersistentCharacters?w.ZargotaPersistentCharacters.tableHeroes():[];
    var participants=w.ZargotaGmParticipants?.rows(rows);
    rows=participants||rows.filter(function(row){return row.key.indexOf('sheet-')!==0;}).map(function(row){var c=hero(row),linked=c&&shared.find(function(s){return String(s.localId)===String(c.id);});return Object.assign({},row,{shared:linked||row.shared});});
    w.ZargotaGmReminders?.refresh();
    roster=rows;selected=rows.some(function(row){return row.key===state.selectedKey&&hero(row);})?state.selectedKey:'';
    var dock=document.getElementById('zg-irl-character-dock'),card=document.getElementById('zg-irl-character-card');
    if(!dock||!card)return;
    var markup=rows.map(function(row){
      var c=hero(row),name=c&&c.name||row.meta.name,hp=Math.max(0,Number(c&&c.hpCur)||0),max=Math.max(1,Number(c&&c.hpMax)||1),ac=Number(c&&c.ac)||0;
      // Sheet states are statuses + status tempEffects; statusEffects is a separate legacy/combat snapshot.
      var statuses=c?helpers.statuses(Object.assign({},c,{statusEffects:[]})):[],active=selected===row.key,locked=!c||row.shared&&!row.shared.ready;
      return '<article class="zg-gm-hero'+(active?' is-selected':'')+'" data-gm-key="'+e(row.key)+'">'+
        '<button type="button" class="zg-gm-hero-open" data-gm-open="'+e(row.key)+'" aria-expanded="'+active+'" aria-label="'+e(t('Открыть лист: ','Відкрити аркуш: ')+name)+'"'+(!c?' disabled':'')+'>'+helpers.portrait(c,row.meta,'zg-gm-hero-portrait')+'<strong>'+e(name)+'</strong></button>'+
        '<div class="zg-gm-hero-data">'+helpers.badge(row.shared)+'<div class="zg-gm-hp"><button type="button" data-gm-hp="-1" aria-label="'+e(t('Уменьшить HP: ','Зменшити HP: ')+name)+'"'+(locked||hp<=0?' disabled':'')+'>−</button><span aria-label="HP"><i aria-hidden="true">♥</i> <b>'+hp+'</b><small> / '+max+'</small></span><button type="button" data-gm-hp="1" aria-label="'+e(t('Увеличить HP: ','Збільшити HP: ')+name)+'"'+(locked||hp>=max?' disabled':'')+'>+</button></div>'+resources(c,ac)+''+
        '<div class="zg-gm-statuses" role="button" tabindex="0" data-gm-statuses="'+e(row.key)+'">'+statuses.slice(0,2).map(function(s){var key=s.key||s.statusKey||statusList(c).find(function(k){var def=(w.ALL_STATUSES||[]).find(function(d){return d.key===k;}),f=(c.tempEffects||[]).find(function(f){return f.statusKey===k;});return tr(def?.label||f?.label||k)===tr(s.name);})||'';return '<span data-dock-status="'+e(key)+'" title="'+e(tr(s.name))+'">'+e(s.icon)+' '+e(tr(s.name))+'</span>';}).join('')+(statuses.length>2?'<span>+'+(statuses.length-2)+'</span>':'')+'</div></div>'+(!c?'':'<button type="button" class="zg-gm-reminder-button" data-gm-reminder="'+e(row.key)+'" aria-label="'+e(t('Памятка мастера: ','Пам’ятка майстра: ')+name)+'">?</button>')+'</article>';
    }).join('');
    if(w.ZargotaGmParticipants){
      var showAdd=rows.length<5;
      markup=(markup||w.ZargotaGmParticipants.empty())+(showAdd?w.ZargotaGmParticipants.dock():'');
      dock.classList.toggle('has-player-picker',showAdd);dock.style.setProperty('--gm-hero-count',Math.max(1,rows.length));
      w.ZargotaGmParticipants.refresh();
    }
    if(markup!==signature){dock.innerHTML=markup;signature=markup;}
    w.ZargotaGmStatusLibrary?.refreshTargets();
    card.classList.toggle('open',!!selected);
    if(selected){
      mountSheet(card);card.querySelector('[data-gm-close]').setAttribute('aria-label',t('Закрыть лист','Закрити аркуш'));var c=current();card.querySelector('strong').textContent=c?c.name:t('Персонаж недоступен','Персонаж недоступний');
      updateSheet();
    }else unmountSheet();
  }
  function resources(c,ac){
    var inspiration=w.ZargotaCharacterSpecial?.count(c||{})||0,level=Math.min(5,Math.max((c?.statuses||[]).includes('exhausted')?1:0,...(c?.tempEffects||[]).filter(function(f){return f.type==='status'&&f.statusKey==='exhausted';}).map(function(f){return Math.max(1,Number(f.stacks)||1);})));
    function badge(cls,src,title,value){return '<span class="'+cls+'" title="'+e(title)+'" aria-label="'+e(title)+'"><img src="'+src+'" alt="">'+value+'</span>';}
    return '<div class="zg-gm-resources">'+badge('zg-gm-armor','images/character-derived/armor-v3.webp',t('Броня','Броня')+': '+ac,ac)+(inspiration?badge('zg-gm-inspiration','images/ui/character-mobile/inspiration-candle-v1.png',t('Вдохновение','Натхнення')+': '+inspiration,inspiration):'')+(level?badge('zg-gm-exhaustion','images/ui/character-mobile/exhaustion-traveller-v1.png',t('Истощение','Виснаження')+': '+level+' / 5',level+'/5'):'')+'</div>';
  }
  document.addEventListener('DOMContentLoaded',function(){if(w.ZG_APP_CHANGELOG?.[0]){w.ZG_APP_CHANGELOG[0].notes+=' Документы: создание писем, записок и объявлений, выдача перетаскиванием, три оформления бумаги и звук открытия.';w.ZG_APP_CHANGELOG[0].notesUk+=' Документи: створення листів, записок і оголошень, надання перетягуванням, три оформлення паперу та звук відкриття.';w.ZG_APP_CHANGELOG[0].notes+=' Хранилище: выдача заклинаний, шаблоны своих черт и мастерства, подготовка на столе.';w.ZG_APP_CHANGELOG[0].notesUk+=' Сховище: надання заклинань, шаблони власних рис і майстерності, підготовка на столі.';w.ZG_APP_CHANGELOG[0].notes+=' Общий список состояний на карточке, снятие одного уровня истощения или всех уровней, Shift + ПКМ для снятия у всех и восстановление одного уровня истощения игроком.';w.ZG_APP_CHANGELOG[0].notesUk+=' Спільний список станів на картці, зняття одного рівня виснаження або всіх рівнів, Shift + ПКМ для зняття в усіх та відновлення одного рівня виснаження гравцем.';w.ZG_APP_CHANGELOG[0].notes+=' Карточки мастера: значок брони вместо КД, свеча со счётчиком вдохновения и путник с уровнем истощения. Нулевые счётчики скрыты; вдохновение без рамки.';w.ZG_APP_CHANGELOG[0].notesUk+=' Картки майстра: значок броні замість КЗ, свічка з лічильником натхнення та мандрівник із рівнем виснаження. Нульові лічильники приховані; натхнення без рамки.';}});
  function statusList(c){var keys=Array.from(new Set((c.statuses||[]).concat((c.tempEffects||[]).filter(function(f){return f.type==='status';}).map(function(f){return f.statusKey;}))));return keys.filter(Boolean);}
  function openStates(key){
    var row=roster.find(function(r){return r.key===key;}),c=row&&hero(row);if(!c)return;
    document.querySelector('#zg-gm-state-list')?.remove();var d=document.createElement('dialog');d.id='zg-gm-state-list';d.className='zg-gm-state-list';d.setAttribute('data-zg-i18n-skip','');
    d.innerHTML='<header><strong>'+e(c.name)+' · '+t('Состояния','Стани')+'</strong><button data-close>×</button></header><div class="zg-gm-state-list-body">'+statusList(c).map(function(k){var f=(c.tempEffects||[]).find(function(f){return f.type==='status'&&f.statusKey===k;})||{},def=(w.zgGmStatusCatalog?.()||w.ALL_STATUSES||[]).find(function(x){return x.key===k;})||{};return '<details style="--state-color:'+e(/^#[0-9a-f]{3,8}$/i.test(f.color||def.color||'')?(f.color||def.color):'#c6a465')+'" data-state="'+e(k)+'"><summary>'+e(tr(f.label||def.label||k))+(f.stacks>1?' ×'+f.stacks:'')+'<small>'+e(f.remaining!=null?String(f.remaining)+' '+({rounds:t('раунд.','раунд.'),minutes:t('мин.','хв.'),hours:t('ч.','год.'),days:t('дн.','дн.')}[f.unit]||''):t('До снятия','До зняття'))+'</small></summary><p>'+(w.ZargotaSpellDetailContent?.highlightPersonal(tr(f.description||def.description||''))||e(tr(f.description||def.description||'')))+'</p><button data-detail="'+e(k)+'">'+t('Подробнее','Докладніше')+'</button> '+(k==='exhausted'?'<button data-remove="exhausted" data-one>'+t('Снять 1 уровень','Зняти 1 рівень')+'</button> ':'')+'<button data-remove="'+e(k)+'">'+(k==='exhausted'?t('Снять полностью','Зняти повністю'):t('Убрать','Прибрати'))+'</button></details>';}).join('')+'</div><p role="status"></p>';
    document.body.appendChild(d);d.show();positionStates(d,key);d.querySelector('[data-close]').onclick=function(){d.remove();};d.addEventListener('cancel',function(){d.remove();});
    d.onclick=async function(ev){var remove=ev.target.closest('[data-remove]'),detail=ev.target.closest('[data-detail]');if(detail){d.remove();w.showStatusInfoPopup(c.id,detail.dataset.detail);return;}if(remove){remove.disabled=true;var result=await removeDockStatus(row,remove.dataset.remove,remove.hasAttribute('data-one'));if(result.ok){d.remove();openStates(key);}else{remove.disabled=false;d.querySelector('[role=status]').textContent=t('Не удалось сохранить. Повторите после синхронизации.','Не вдалося зберегти. Повторіть після синхронізації.');}}};
    d.oncontextmenu=function(ev){var node=ev.target.closest('[data-state]');if(node&&ev.shiftKey){ev.preventDefault();statusMenu(node.dataset.state,ev);}};
  }
  function positionStates(d,key){
    var card=Array.from(document.querySelectorAll('[data-gm-key]')).find(function(n){return n.dataset.gmKey===key;}),anchor=card?.getBoundingClientRect(),rect=d.getBoundingClientRect();
    d.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,anchor?anchor.left:20))+'px';
    d.style.top=Math.max(8,(anchor?anchor.top:innerHeight)-rect.height-12)+'px';
    var header=d.querySelector('header'),motion=null;
    header.addEventListener('pointerdown',function(ev){if(ev.button!==0||ev.target.closest('button'))return;ev.preventDefault();var box=d.getBoundingClientRect();motion={id:ev.pointerId,x:ev.clientX,y:ev.clientY,left:box.left,top:box.top};header.setPointerCapture(ev.pointerId);});
    header.addEventListener('pointermove',function(ev){if(!motion||motion.id!==ev.pointerId)return;d.style.left=Math.max(8,Math.min(innerWidth-d.offsetWidth-8,motion.left+ev.clientX-motion.x))+'px';d.style.top=Math.max(8,Math.min(innerHeight-44,motion.top+ev.clientY-motion.y))+'px';});
    function stop(){if(motion&&header.hasPointerCapture(motion.id))header.releasePointerCapture(motion.id);motion=null;}
    header.addEventListener('pointerup',stop);header.addEventListener('pointercancel',stop);header.addEventListener('lostpointercapture',function(){motion=null;});
  }
  async function removeDockStatus(row,key,one){
    one=key==='exhausted'&&!!one;
    var c=hero(row);if(!c)return {ok:false};
    if(row.shared||w.ZargotaPersistentCharacters?.usesCharacter(c.id))return w.ZargotaPersistentCharacters.specialWrite(c.id,one?'reduce-exhaustion':'remove-status',key);
    if(statusWrites.has(String(c.id)))return {ok:false};statusWrites.add(String(c.id));var before={tempEffects:c.tempEffects,statuses:c.statuses};
    try{var result=w.ZargotaCharacterSpecial.removeStatus(c,key,one);if(!result.changed)return {ok:true};var saved=await w.saveChars({reason:'gm-remove-status'});if(!saved?.ok)throw Error('save');return {ok:true};}catch(_){c.tempEffects=before.tempEffects;c.statuses=before.statuses;return {ok:false};}finally{statusWrites.delete(String(c.id));refresh();}
  }
  function statusMenu(key,event){
    if(!document.body.classList.contains('zg-irl-table-view'))return;
    document.querySelector('#zg-gm-status-menu')?.remove();var menu=document.createElement('dialog');menu.id='zg-gm-status-menu';menu.className='zg-gm-state-list';menu.setAttribute('data-zg-i18n-skip','');
    var def=(w.ALL_STATUSES||[]).find(function(s){return s.key===key;})||{};
    menu.innerHTML='<header><strong>'+e(tr(def.label||key))+'</strong><button data-close>×</button></header>'+(key==='exhausted'?'<button data-all data-one>'+t('Снять 1 уровень у всех','Зняти 1 рівень в усіх')+'</button> ':'')+'<button data-all>'+(key==='exhausted'?t('Снять полностью у всех','Зняти повністю в усіх'):t('Снять у всех на столе','Зняти в усіх на столі'))+'</button><p role="status"></p>';document.body.appendChild(menu);presentDialog(menu);menu.querySelector('[data-close]').onclick=function(){menu.remove();};menu.addEventListener('cancel',function(){menu.remove();});
    menu.querySelectorAll('[data-all]').forEach(function(button){button.onclick=async function(){var one=this.hasAttribute('data-one');menu.querySelectorAll('[data-all]').forEach(function(b){b.disabled=true;});var failed=0;for(var row of roster.slice()){var c=hero(row);if(c&&statusList(c).includes(key)){var result=await removeDockStatus(row,key,one);if(!result.ok)failed++;}}if(failed){menu.querySelector('[role=status]').textContent=t('Не удалось снять у героев: ','Не вдалося зняти в героїв: ')+failed;}else{menu.remove();document.querySelector('#zg-gm-state-list')?.remove();}};});
  }
  document.addEventListener('keydown',function(ev){var el=ev.target.closest?.('[data-gm-statuses]');if(el&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();openStates(el.dataset.gmStatuses);}});
  function changeHp(key,delta){
    var row=roster.find(function(r){return r.key===key;}),c=row&&hero(row);if(!c)return;
    if(row.shared){w.ZargotaPersistentCharacters.tableHp(c.id,delta);return;}
    c.hpCur=Math.max(0,Math.min(Math.max(1,Number(c.hpMax)||1),(Number(c.hpCur)||0)+delta));
    Promise.resolve(w.saveChars()).then(refresh);refresh();
  }
  function targets(){return roster.map(function(row){var c=hero(row);return {key:row.key,id:c&&c.id,name:c&&c.name||row.meta.name,shared:!!row.shared,ready:!!c&&(!row.shared||row.shared.ready)};});}
  var statusWrites=new Set();
  async function statusWrite(target,key,options,receipt){
    var row=roster.find(function(r){return r.key===target.key;}),c=row&&hero(row);
    if(!c||String(c.id)!==String(target.id)||statusWrites.has(String(c.id)))return {ok:false,reason:'not-ready'};
    if(row.shared||w.ZargotaPersistentCharacters?.usesCharacter(c.id)){
      return receipt?w.ZargotaPersistentCharacters.tableUndoStatus(c.id,receipt):w.ZargotaPersistentCharacters.tableStatus(c.id,key,options);
    }
    var def=(w.zgGmStatusCatalog?w.zgGmStatusCatalog():[]).concat(w.ZargotaCharacterSpecial.catalog(w.ZARGOTA_INJURY_TABLE),w.ZargotaGmStatusLibrary?.abilityCatalog()||[]).find(function(s){return s.key===key&&s.enabled!==false;});
    if(!receipt&&!def)return {ok:false,reason:'unknown-status'};
    var before=JSON.parse(JSON.stringify(c)),result=receipt?w.ZargotaCharacterStatus.undo(c,receipt):w.ZargotaCharacterStatus.apply(c,def,options);
    if(!result.changed)return Object.assign({ok:true},result);
    statusWrites.add(String(c.id));
    try{
      var saved=await w.saveChars({reason:'gm-table-status'});
      if(!saved||!saved.ok)throw Error('local-save-failed');
      return Object.assign({ok:true},result);
    }catch(err){
      // Restore only this operation's fields, never replace the full character.
      ['family','journalEntries','spellRefs','spellsLearned','spellGrantCatalog','preparedSpells','mastery','tempEffects','statuses','inspiration','inspirationEvent','injuries','baseHpMax','hpMax','hpCur'].forEach(function(field){if(before[field]===undefined)delete c[field];else c[field]=before[field];});
      return {ok:false,reason:'local-save-failed'};
    }finally{statusWrites.delete(String(c.id));refresh();}
  }
  async function itemWrite(target,definition,qty,grantId){
    var row=roster.find(function(r){return r.key===target.key;}),c=row&&hero(row);
    if(!c||String(c.id)!==String(target.id)||statusWrites.has(String(c.id)))return {ok:false,reason:'not-ready'};
    if(row.shared||w.ZargotaPersistentCharacters?.usesCharacter(c.id))return w.ZargotaPersistentCharacters.tableItem(c.id,definition,qty,grantId);
    var before=JSON.parse(JSON.stringify(c)),result=w.ZargotaItemGrants.apply(c,definition,qty,grantId,w.ZargotaItemEconomy?.definitionToInventorySnapshot);
    if(!result.changed)return Object.assign({ok:result.reason==='already-granted'},result);
    statusWrites.add(String(c.id));
    try{var saved=await w.saveChars({reason:'gm-table-item'});if(!saved?.ok)throw Error();return Object.assign({ok:true},result);}
    catch(_){['inventoryItems','coins','gmItemGrants','gmItemAccepted'].forEach(function(k){if(before[k]===undefined)delete c[k];else c[k]=before[k];});return {ok:false,reason:'local-save-failed'};}
    finally{statusWrites.delete(String(c.id));refresh();}
  }
  function init(){
    if(w.ZG_APP_CHANGELOG&&w.ZG_APP_CHANGELOG[0]){w.ZG_APP_CHANGELOG[0].notes+=' Стол мастера: спокойный картографический фон, широкие карточки героев и открытие существующего мобильного листа поверх доски. Лист встроен как компонент текущей страницы без повторной загрузки сайта. На столе оставлены имена и панель героев; убраны старые инструменты, случайное выделение и перетаскивание изображений. Сохранённые имена доступны внутри генератора. Кнопка ＋ позволяет выбрать аккаунты игроков для стола; используются их существующие синхронизируемые листы. При пяти героях плюс скрыт; меню правой кнопки показывает связь и позволяет убрать карточку со стола.';w.ZG_APP_CHANGELOG[0].notesUk+=' Стіл майстра: спокійне картографічне тло, широкі картки героїв і відкриття наявного мобільного аркуша поверх дошки. Аркуш вбудовано як компонент поточної сторінки без повторного завантаження сайту. На столі залишено імена й панель героїв; прибрано старі інструменти, випадкове виділення та перетягування зображень. Збережені імена доступні всередині генератора. Кнопка ＋ дозволяє вибрати акаунти гравців для столу; використовуються їхні наявні синхронізовані аркуші. За п’яти героїв плюс приховано; меню правої кнопки показує зв’язок і дозволяє прибрати картку зі столу.';}
    var rail=document.querySelector('.zg-irl-tool-rail'),table=document.querySelector('.zg-irl-table');if(!rail||!table)return;
    // Saved names belong to the Names tool, not a second board toolbar.
    var saved=document.getElementById('zg-irl-saved-tool');
    if(saved)document.getElementById('zg-irl-name-popover').appendChild(saved);
    function editable(target){target=target.nodeType===1?target:target.parentElement;return !!target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');}
    table.addEventListener('selectstart',function(event){if(!editable(event.target))event.preventDefault();});
    table.addEventListener('dragstart',function(event){if(!editable(event.target))event.preventDefault();});
    // Empty canvas must not navigate to a dropped image or open an imported file.
    function blockCanvasDrop(event){
      if(event.target.closest('.zg-gm-sheet-host,#zg-irl-name-popover,#zg-irl-saved'))return;
      event.preventDefault();event.stopPropagation();
    }
    table.addEventListener('dragover',blockCanvasDrop);
    table.addEventListener('drop',blockCanvasDrop);
    document.addEventListener('click',function(event){
      var reminder=event.target.closest('[data-gm-reminder]');
      var states=event.target.closest('[data-gm-statuses],.zg-gm-exhaustion');if(states){openStates(states.closest('[data-gm-key]').dataset.gmKey);return;}
      if(reminder){var row=roster.find(function(r){return r.key===reminder.dataset.gmReminder;});if(row&&hero(row))w.ZargotaGmReminders?.open(row,hero(row),reminder);return;}
      var open=event.target.closest('[data-gm-open]'),hp=event.target.closest('[data-gm-hp]');
      if(open){w.zgIrlCharacterToggle(open.dataset.gmOpen);return;}
      if(hp){changeHp(hp.closest('[data-gm-key]').dataset.gmKey,Number(hp.dataset.gmHp));return;}
      if(event.target.closest('[data-gm-close]'))close();
    });
    document.addEventListener('contextmenu',function(event){
      var el=event.target.closest('.zg-gm-hero[data-gm-key]');
      if(!el||!document.body.classList.contains('zg-irl-table-view'))return;
      var row=roster.find(function(r){return r.key===el.dataset.gmKey;});var chip=event.target.closest('[data-dock-status]');if(event.shiftKey&&(event.target.closest('.zg-gm-exhaustion')||chip?.dataset.dockStatus)){event.preventDefault();statusMenu(chip?.dataset.dockStatus||'exhausted',event);return;}if(!row||!w.ZargotaGmParticipants)return;
      event.preventDefault();w.ZargotaGmParticipants.context(row,event);
    });
    document.addEventListener('pointerdown',function(event){
      if(!event.target.closest('.zg-gm-phone-head')||event.target.closest('button')||event.button!==0)return;
      var card=document.getElementById('zg-irl-character-card'),r=card.getBoundingClientRect();
      drag={x:event.clientX,y:event.clientY,left:r.left,top:r.top,card:card};
      event.target.setPointerCapture(event.pointerId);card.classList.add('is-dragging');event.preventDefault();
    });
    document.addEventListener('pointermove',function(event){if(!drag)return;var c=drag.card;
      c.style.left=Math.max(8,Math.min(innerWidth-c.offsetWidth-8,drag.left+event.clientX-drag.x))+'px';c.style.right='auto';
      c.style.top=Math.max(8,Math.min(innerHeight-c.offsetHeight-parseFloat(getComputedStyle(document.body).getPropertyValue('--gm-dock-height'))-12,drag.top+event.clientY-drag.y))+'px';
    });
    function endDrag(){if(drag)drag.card.classList.remove('is-dragging');drag=null;}
    w.addEventListener('resize',function(){var card=document.getElementById('zg-irl-character-card');if(!host||!card.style.left)return;var r=card.getBoundingClientRect();card.style.left=Math.max(8,Math.min(innerWidth-r.width-8,r.left))+'px';card.style.top=Math.max(8,Math.min(innerHeight-r.height-parseFloat(getComputedStyle(document.body).getPropertyValue('--gm-dock-height'))-12,r.top))+'px';});
    document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!w.ZargotaGmStatusLibrary?.isActive()&&!document.querySelector('dialog.zg-gm-participants[open],.zg-gm-participant-menu,dialog.zg-gm-reminder[open]')&&selected&&document.body.classList.contains('zg-irl-table-view')&&host&&!host.querySelector('[role=dialog],dialog[open],#status-popup,#quick-temp-popup'))close();},true);
    document.addEventListener('zargota:localechange',function(){signature='';if(isOpen())w.renderCharSheet();refresh();});
    refresh();
  }
  // Legacy sheet dialogs also stay in the same component. Never adopt unrelated
  // editor/game overlays; only these character-owned roots are eligible.
  new MutationObserver(function(records){if(!isOpen())return;records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType===1&&node.matches('#status-popup,#quick-temp-popup,#status-info-popup,#char-sheet-tab-bar'))host.appendChild(node);});});}).observe(document.body,{childList:true});
  w.ZargotaGmTable={statusMenu:statusMenu,item:itemWrite,render:render,refresh:refresh,isEditing:isEditing,isOpen:isOpen,portal:portal,presentDialog:presentDialog,unmount:unmountSheet,targets:targets,status:function(target,key,options){return statusWrite(target,key,options);},undoStatus:function(target,receipt){return statusWrite(target,receipt.key,null,receipt);}};
  if(document.readyState==='complete')init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})(window);
