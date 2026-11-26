/* Mobile character overview: presentation only, all edits use existing sheet actions. */
(function(w){
  'use strict';
  var current, pages={}, returnFocus=null, movedStatus=null, lastView=null, previousHP=null;
  var pageAnimations=new WeakMap();
  function cancelPageAnimation(node){var pending=node&&pageAnimations.get(node);if(pending)pending.cancel();}
  // Advance page state before calling. update only renders that state and may return
  // its mounted container (or a Promise of it). A superseded update is never run.
  // The returned Promise always settles, including cancellation and screen changes.
  function animatePage(node,direction,update){
    if(typeof update!=='function')return Promise.resolve(false);
    var from=node&&node.isConnected?getComputedStyle(node):null;
    var startOpacity=from?from.opacity:'1',startTransform=from&&from.transform!=='none'?from.transform:'translateX(0)';
    cancelPageAnimation(node);
    if(node&&!node.isConnected)return Promise.resolve(false);
    if(!node||!node.animate||matchMedia('(prefers-reduced-motion:reduce)').matches){
      try{return Promise.resolve(update()).then(function(value){return value!==false;});}catch(error){return Promise.reject(error);}
    }
    var target=node,state={node:node,animation:null,settled:false},resolveResult,rejectResult;
    var result=new Promise(function(resolve,reject){resolveResult=resolve;rejectResult=reject;});
    function blockActivation(ev){if(!ev.target.closest('[data-status-step],.zgmo-status-dismiss')){ev.preventDefault();ev.stopImmediatePropagation();}}
    function mark(el){el.classList.add('zg-page-turn');el.setAttribute('data-zg-page-turn','out');el.addEventListener('click',blockActivation,true);}
    function unmark(el){el.classList.remove('zg-page-turn');el.removeAttribute('data-zg-page-turn');el.removeEventListener('click',blockActivation,true);}
    function currentRun(){return !state.settled&&pageAnimations.get(target)===state;}
    function finish(ok,error){
      if(state.settled)return;state.settled=true;
      if(state.animation)state.animation.cancel();
      if(pageAnimations.get(target)===state){pageAnimations.delete(target);unmark(target);}
      if(error)rejectResult(error);else resolveResult(ok);
    }
    state.cancel=function(){finish(false);};pageAnimations.set(node,state);mark(node);
    var distance=direction<0?-16:16;
    state.animation=node.animate([{opacity:startOpacity,transform:startTransform},{opacity:0,transform:'translateX('+(-distance)+'px)'}],{duration:90,easing:'cubic-bezier(.4,0,.7,1)',fill:'forwards'});
    state.animation.finished.then(function(){
      if(!currentRun()||!target.isConnected){finish(false);return;}
      var updated;try{updated=update();}catch(error){finish(false,error);return;}
      Promise.resolve(updated).then(function(next){
        if(!currentRun()){finish(false);return;}
        if(next===false){finish(false);return;}
        if(next&&next.nodeType===1&&next!==target){
          if(!next.isConnected){finish(false);return;}
          pageAnimations.delete(target);unmark(target);cancelPageAnimation(next);target=next;state.node=next;pageAnimations.set(target,state);mark(target);
        }
        if(!target.isConnected){finish(false);return;}
        state.animation.cancel();mark(target);target.setAttribute('data-zg-page-turn','in');
        state.animation=target.animate([{opacity:0,transform:'translateX('+distance+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'});
        state.animation.finished.then(function(){finish(target.isConnected);},function(){finish(false);});
      },function(error){finish(false,error);});
    },function(){finish(false);});
    return result;
  }
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(s){return w.ZargotaI18n?w.ZargotaI18n.translate(s):s;}
  function controlMark(plus){return '<svg class="zgmo-control-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14'+(plus?'M12 5v14':'')+'"/></svg>';}
  function button(action,label,content,extra){if(content==='+'||content==='−')content=controlMark(content==='+');return '<button type="button" data-zgmo="'+action+'" aria-label="'+e(label)+'" '+(extra||'')+'>'+content+'</button>';}
  function character(){return (w.characters||[]).find(function(c){return c.id===current;});}
  function setActive(on){var page=document.getElementById('page-characters');on=!!on&&w.charView==='sheet'&&page&&page.classList.contains('active');document.body.classList.toggle('zg-stats-overview',!!on);if(!on){cancelPageAnimation(document.querySelector('.zgmo-state-cards'));close();lastView=null;previousHP=null;}}
  function setInventoryActive(on){if(w.ZargotaMobileInventory)w.ZargotaMobileInventory.setActive(on);var page=document.getElementById('page-characters');document.body.classList.toggle('zg-inventory-view',!!on&&w.charView==='sheet'&&!!page&&page.classList.contains('active'));}
  function inventory(c,content){if(w.ZargotaMobileInventory)return w.ZargotaMobileInventory.render(c);return '<section class="zgmi-sheet"><header class="zgmi-toolbar">'+button('back',t('Назад к персонажам','Назад до персонажів'),'‹')+'<div><h1>'+t('Инвентарь','Інвентар')+'</h1><small>'+e(w.characterEntryText(c,c.name||''))+'</small></div>'+button('menu',t('Действия персонажа','Дії персонажа'),'⋯')+'</header><div class="tab-content-wrap">'+content+'</div></section>';}
  function effects(c){
    var result=(c.tempEffects||[]).filter(function(x){return x.type==='status';}).map(function(x){return {key:x.statusKey,label:x.label||x.value,effect:x};});
    (c.statuses||[]).forEach(function(key){if(!result.some(function(x){return x.key===key;}))result.push({key:key});});
    return result;
  }
  function states(c){
    var all=effects(c),count=Math.max(1,Math.ceil(all.length/2)),page=Math.min(pages[c.id]||0,count-1);pages[c.id]=page;
    return '<section class="zgmo-states" aria-label="'+t('Состояния','Стани')+'"><div class="zgmo-state-heading">'+button('add-status',t('Добавить состояние','Додати стан'),'+')+'<strong>'+t('Состояния','Стани')+'</strong><span class="zgmo-state-total" aria-label="'+t('Всего состояний: ','Усього станів: ')+all.length+'"><span>'+t('Всего','Усього')+'</span><span class="zgmo-count-diamond"><b>'+all.length+'</b></span></span></div><div class="zgmo-state-carousel">'+
      button('prev',t('Предыдущие состояния','Попередні стани'),'‹','class="zgmo-state-arrow zgmo-state-prev"'+(page>0?'':' hidden disabled'))+
      '<div class="zgmo-state-cards">'+(all.length?all.slice(page*2,page*2+2).map(function(x,i){
      var st=(w.ALL_STATUSES||[]).find(function(s){return s.key===x.key;})||{},f=x.effect;
      var unit=f?({round:t('раунд.','раунд.'),rounds:t('раунд.','раунд.'),minute:t('мин.','хв.'),minutes:t('мин.','хв.'),hour:t('ч.','год.'),hours:t('ч.','год.'),days:t('дн.','дн.')})[f.unit]||tr(f.unit||''):'';
      var glyph=statusGlyph(x,st);
      return button('status',tr(x.label||st.label||x.key||t('Состояние','Стан')),'<span class="zgmo-status-icon">'+glyph+'</span><span class="zgmo-state-copy"><b>'+e(tr(x.label||st.label||x.key||t('Состояние','Стан')))+'</b><small>'+e(f&&f.remaining!=null?f.remaining+' '+unit:t('До снятия','До зняття'))+'</small></span>','data-index="'+(page*2+i)+'" style="--tone:'+e(st.color||'#c6ad70')+'"');
    }).join(''):'<span class="zgmo-empty">'+t('Нет активных состояний','Немає активних станів')+'</span>')+'</div>'+
      button('next',t('Следующие состояния','Наступні стани'),'›','class="zgmo-state-arrow zgmo-state-next"'+(page<count-1?'':' hidden disabled'))+'</div><span class="zgmo-page-count" aria-live="polite">'+(count>1?(page+1)+' / '+count:'')+'</span></section>';
  }
  var specialBusy=false,seenInspiration={};
  function special(){return w.ZargotaCharacterSpecial;}
  function canManageInjuries(c){return !w.ZargotaPersistentCharacters?.usesCharacter(c.id)||w.ZargotaPersistentCharacters.tableIdentity().role==='admin';}
  function injuryBadge(c){var n=special().injuries(c).length;return button('injuries',t('Травмы','Травми')+': '+n,'<img src="images/vtt-injuries/broken-arm.png" alt=""><span>'+n+'</span>','class="zgmo-injuries'+(n?' is-active':'')+'" aria-haspopup="dialog"');}
  function inspirationBadge(c){var n=special().count(c);return button('inspiration',t('Вдохновение','Натхнення')+': '+n,'<img src="images/ui/character-mobile/inspiration-candle-v1.png" alt=""><b>'+n+'</b>','class="zgmo-inspiration'+(n?' is-active':'')+'" aria-haspopup="dialog"');}
  function inspirationHTML(c){var n=special().count(c);return '<div class="zgmo-inspiration-detail"><img src="images/ui/character-mobile/inspiration-candle-v1.png" alt=""><strong>'+n+'</strong><p>'+t('Вдохновение от мастера','Натхнення від майстра')+'</p>'+button('spend-inspiration',t('Использовать одно вдохновение','Використати одне натхнення'),t('Использовать · 1','Використати · 1'),(!n||specialBusy?'disabled':'')+' class="zgmo-spend"')+'</div>';}
  function injuryHTML(c){var list=special().injuries(c);return '<div class="zgmo-injury-detail"><div class="zgmo-injury-summary"><strong>'+list.length+' / 4</strong><span>'+t('Травмы','Травми')+'</span></div>'+(list.length?'<p>'+t('Максимум HP: −','Максимум HP: −')+Math.min(3,list.length)*10+'%</p>':'<p>'+t('Травм нет.','Травм немає.')+'</p>')+(list.length>=4?'<p class="zgmo-critical">'+t('Четвёртая травма: без сознания. Нужна помощь до конца сцены.','Четверта травма: непритомність. Потрібна допомога до кінця сцени.')+'</p>':'')+list.map(function(injury){var d=typeof injury==='object'?injury:{name:injury};return '<article><header>'+w.zgInjuryIconMarkup(d,'zgmo-injury-art')+'<div><h3>'+e(tr(d.name||t('Травма','Травма')))+'</h3><small>'+e(tr(d.severity||''))+'</small></div></header><p>'+e(tr(d.effect||''))+'</p><h4>'+t('Лечение','Лікування')+'</h4><p>'+e(tr(d.treatment||''))+'</p>'+(canManageInjuries(c)&&d.id?button('remove-injury',t('Снять травму','Зняти травму'),t('Снять травму','Зняти травму'),'data-injury="'+e(d.id)+'"'+(specialBusy?' disabled':'')):'')+'</article>';}).join('')+'</div>';}
  async function changeSpecial(c,action,id){
    if(specialBusy)return;specialBusy=true;var result;
    try{
      if(w.ZargotaPersistentCharacters?.usesCharacter(c.id))result=await w.ZargotaPersistentCharacters.specialWrite(c.id,action,id);
      else{
        var fields=['tempEffects','statuses','inspiration','inspirationEvent','injuries','baseHpMax','hpMax','hpCur'],before={};fields.forEach(function(k){before[k]=c[k]===undefined?undefined:JSON.parse(JSON.stringify(c[k]));});
        result=action==='reduce-exhaustion'?special().removeStatus(c,'exhausted',true):action==='spend-inspiration'?special().spend(c):special().remove(c,id);
        if(result.changed){try{var saved=await w.saveChars({reason:'sheet-special'});if(!saved||!saved.ok)throw Error('save');result.ok=true;}catch(_){fields.forEach(function(k){if(before[k]===undefined)delete c[k];else c[k]=before[k];});result={ok:false};}}else result.ok=true;
      }
      if(!result.ok)w.showToast?.(t('Не удалось подтвердить изменение. Проверьте соединение и лист.','Не вдалося підтвердити зміну. Перевірте з’єднання й аркуш.'));
    }finally{specialBusy=false;w.renderCharSheet();}
  }
  function animateInspiration(c,root){
    var event=c.inspirationEvent;if(!event||!root)return;
    var key='zg-inspiration-seen:'+String(w.ZargotaPersistentCharacters?.tableIdentity().uid||'local')+':'+String(c.campaignKey||c.id),seen=seenInspiration[key];
    try{seen=seen||localStorage.getItem(key);}catch(_){}
    if(seen===event.id)return;seenInspiration[key]=event.id;try{localStorage.setItem(key,event.id);}catch(_){}
    var popup=document.querySelector('#zgmo-modal[data-inspiration]>section'),target=popup?.querySelector('.zgmo-inspiration-detail>img')||root.querySelector('.zgmo-inspiration'),spent=event.kind==='spent';if(!target)return;
    var label=document.createElement('span');label.className='zgmo-inspiration-feedback';label.setAttribute('role','status');label.textContent=spent?t('Вдохновение использовано','Натхнення використано'):t('+1 Вдохновение','+1 Натхнення');(popup||root.querySelector('.zgmo-portrait')).appendChild(label);
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches){target.animate(spent?[{filter:'brightness(1.6)',transform:'scale(1.08)',opacity:1},{filter:'brightness(2)',transform:'translateY(-12px) scale(.75)',opacity:.2,offset:.6},{filter:'brightness(1)',transform:'scale(1)',opacity:1}]:[{filter:'brightness(1)',transform:'scale(.9)'},{filter:'brightness(2)',transform:'scale(1.15)',offset:.4},{filter:'brightness(1)',transform:'scale(1)'}],{duration:1100,easing:'ease-out'});label.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)',offset:.2},{opacity:1,offset:.8},{opacity:0,transform:'translateY(-8px)'}],{duration:2400});}
    setTimeout(function(){label.remove();},2400);
  }
  function exhaustionLevel(c){
    var values=(c.tempEffects||[]).filter(function(x){return x.type==='status'&&x.statusKey==='exhausted';});
    return Math.min(5,Math.max((c.statuses||[]).includes('exhausted')?1:0,...values.map(function(x){return Math.max(1,Math.floor(Number(x.stacks)||1));})));
  }
  function exhaustionBadge(c){var level=exhaustionLevel(c);return button('exhaustion',t('Истощение','Виснаження')+': '+level+' / 5','<img src="images/ui/character-mobile/exhaustion-traveller-v1.png" alt=""><span>'+level+'<small>/5</small></span>','class="zgmo-exhaustion'+(level?' is-active':'')+'" aria-haspopup="dialog"');}
  function exhaustionHTML(c){
    var level=exhaustionLevel(c),names=[['Нет истощения','Немає виснаження'],['Усталость','Втома'],['Изнеможение','Знемога'],['Истощение','Виснаження'],['Срыв','Зрив'],['Коллапс','Колапс']];
    var rules=[['Помеха на проверки характеристик','Перешкода на перевірки характеристик'],['Скорость уменьшена вдвое. Реакции недоступны.','Швидкість зменшено вдвічі. Реакції недоступні.'],['Помеха на атаки и спасброски','Перешкода на атаки й рятівні кидки'],['Максимум HP уменьшен вдвое. Нельзя применять заклинания.','Максимум HP зменшено вдвічі. Не можна застосовувати закляття.'],['Без сознания. Борьба за жизнь по правилам 0 HP.','Непритомність. Боротьба за життя за правилами 0 HP.']];
    return '<div class="zgmo-exhaustion-detail"><div class="zgmo-exhaustion-meter"><img src="images/ui/character-mobile/exhaustion-traveller-v1.png" alt=""><strong>'+level+' / 5</strong></div><div class="zgmo-exhaustion-pips" aria-hidden="true">'+Array.from({length:5},function(_,i){return '<i class="'+(i<level?'filled':'')+'"></i>';}).join('')+'</div><h3>'+t(...names[level])+'</h3>'+(level?'<p class="zgmo-exhaustion-label">'+t('Действует сейчас','Діє зараз')+'</p><ul>'+rules.slice(0,level).map(function(r){return '<li>'+t(...r)+'</li>';}).join('')+'</ul>':'<p>'+t('Штрафов от истощения нет.','Штрафів від виснаження немає.')+'</p>')+(level?button('reduce-exhaustion',t('Снять один уровень истощения','Зняти один рівень виснаження'),'⚙ '+t('Снять 1 уровень','Зняти 1 рівень'),specialBusy?'disabled':''):'')+'<section><h4>'+t('Восстановление','Відновлення')+'</h4><p>'+t('Короткий отдых: −1 уровень.','Короткий відпочинок: −1 рівень.')+'<br>'+t('Долгий отдых: снять полностью.','Довгий відпочинок: зняти повністю.')+'</p></section></div>';
  }
  function render(c,combat){
    closeStatusMenu(false);
    cancelPageAnimation(document.querySelector('.zgmo-state-cards'));
    current=c.id;
    var labels={str:['Сила','Сила'],dex:['Ловкость','Спритність'],int:['Интеллект','Інтелект'],cha:['Харизма','Харизма'],per:['Восприятие','Сприйняття'],con:['Выносливость','Витривалість']};
    var colors={str:'#ed7676',dex:'#93d18b',int:'#7dc7f0',cha:'#ebbc68',per:'#c59af0',con:'#d7d4cd'};
    var stats=Object.keys(labels).map(function(key){var temp=w.readTempBonusTotal(c,key),val=(parseInt((c.stats[key]||{}).cur)||0)+temp,label=t.apply(null,labels[key]);return '<div class="zgmo-stat" style="--tone:'+colors[key]+'">'+w.zgStatIcon(key)+'<label for="zgmo-'+key+'">'+label+'</label><input id="zgmo-'+key+'" data-stat="'+key+'" type="text" readonly inputmode="none" role="button" aria-haspopup="dialog" data-zgmo="number" aria-label="'+label+'" value="'+val+'" style="color:'+(temp>0?'#86d7a0':temp<0?'#f08f80':'#f1d58b')+'">'+button('temp',t('Временный эффект: ','Тимчасовий ефект: ')+label,'⌛','data-field="'+key+'"'+(temp?' class="has-effect"':''))+'</div>';}).join('');
    var derived=[['ac',t('Броня','Броня'),'⛨','#b3c5ee',Number(c.ac)||0],['initiative',t('Инициатива','Ініціатива'),'ϟ','#f0d16c',Number(c.initiative)||0],['speed',t('Скорость','Швидкість'),'»','#9ed49b',w.parseSpeedNumber(c.speed||'0')]].map(function(x){return button('vital',x[1],'<small>'+x[1]+'</small><span><img class="zgmo-vital-icon" alt="" src="images/character-derived/'+({ac:'armor',initiative:'initiative',speed:'speed'})[x[0]]+'-v3.webp"> '+(x[4]+w.readTempBonusTotal(c,x[0]))+'</span>','data-field="'+x[0]+'" style="--tone:'+x[3]+'"');}).join('');
    var hp=Math.max(0,Math.min(100,c.hpMax?c.hpCur/c.hpMax*100:0)),tmp=w.readTempHpTotal(c);
    return '<div class="zgmo-overview" data-zg-i18n-skip><input type="file" id="sheet-portrait-input" accept="image/*" hidden onchange="handleSheetPortrait('+c.id+',event)"><section class="zgmo-portrait">'+(c.portrait?'<img'+(w.ZargotaPortrait?w.ZargotaPortrait.attributes(c,'sheet'):'')+' class="zgmo-portrait-image" src="'+e(c.portrait)+'" alt="'+e(w.characterEntryText(c,c.name))+'">':'')+'<div class="zgmo-top">'+button('back',t('Назад','Назад'),'‹')+'<div>'+button('updates',t('Обновления персонажа','Оновлення персонажа'),'<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M9 2h6l-1 19h-4Z"/><path d="m12 25 3 3-3 3-3-3Z"/></svg>','class="zgmo-sync" hidden')+button('menu',t('Меню персонажа','Меню персонажа'),'⋯')+'</div></div>'+inspirationBadge(c)+'<div class="zgmo-identity"><h1>'+e(w.characterEntryText(c,c.name))+'</h1><div><span>'+e(w.characterEntryText(c,c.race||''))+' · '+e(w.characterEntryText(c,c.klasse||''))+'</span>'+button('level',t('Управление уровнем','Керування рівнем'),t('Ур. ','Рів. ')+(c.level||1)+(c.unspentStatPoints?' ✦'+c.unspentStatPoints:''))+'</div></div></section><div class="zgmo-hp">'+exhaustionBadge(c)+button('damage',t('Убрать 1 HP','Зняти 1 HP'),'−','class="zgmo-damage"')+button('health',t('Здоровье','Здоров’я'),'<b>♥ '+(c.hpCur||0)+' / '+(c.hpMax||0)+(tmp?' <small>+'+tmp+'</small>':'')+'</b><span class="zgmo-hp-track"><span style="width:'+hp+'%"></span></span>','class="zgmo-hp-value"')+button('heal',t('Восстановить 1 HP','Відновити 1 HP'),'+','class="zgmo-heal"')+injuryBadge(c)+'</div><div class="zgmo-derived">'+derived+'</div><section class="zgmo-stats" aria-label="'+t('Характеристики','Характеристики')+'">'+stats+'</section>'+states(c)+'</div>';
  }
  function fame(c){return '<section class="zgmo-fame"><h3>'+t('Слава','Слава')+'</h3>'+[['fameMundo',t('Мировая слава','Світова слава')],['fameZargoty',t('Слава в Зарготе','Слава в Зарготі')]].map(function(x){return '<div><span>'+x[1]+'</span><div>'+Array.from({length:8},function(_,i){return '<button aria-label="'+x[1]+': '+(i+1)+'" aria-pressed="'+(i<(c[x[0]]||0))+'" onclick="toggleFame('+c.id+',\''+x[0]+'\','+i+')">'+(i<(c[x[0]]||0)?'◆':'◇')+'</button>';}).join('')+'</div></div>';}).join('')+'</section>';}
  function close(){closeStatusMenu(false);closeNumber();closeStatus(true);var modal=document.getElementById('zgmo-modal');if(movedStatus){var sheet=document.getElementById('char-sheet-view');sheet.prepend(movedStatus);movedStatus=null;}if(modal)modal.remove();if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
  function modal(title,html){close();returnFocus=document.activeElement;var el=document.createElement('div');el.id='zgmo-modal';el.innerHTML='<section role="dialog" aria-modal="true" aria-label="'+e(title)+'"><header><h2>'+e(title)+'</h2>'+button('close',t('Закрыть','Закрити'),'×')+'</header><div class="zgmo-modal-body">'+html+'</div></section>';el.addEventListener('click',function(ev){if(ev.target===el)close();});(w.ZargotaGmTable?.portal()||document.body).appendChild(el);el.querySelector('button').focus();return el;}
  function editableGestureTarget(target){return !!target?.closest?.('input:not([readonly]),textarea:not([readonly]),select,[contenteditable]:not([contenteditable="false"])');}
  function protectedGestureSurface(){return document.body.classList.contains('zg-irl-table-view')||(matchMedia('(max-width:900px), (pointer:coarse)').matches&&!!document.querySelector('#page-characters.active'));}
  // Cancel browser defaults only; custom context menus still receive the event.
  ['contextmenu','selectstart','dragstart'].forEach(function(type){document.addEventListener(type,function(ev){if(protectedGestureSurface()&&!editableGestureTarget(ev.target))ev.preventDefault();},true);});
  var statusMenu=null,statusMenuSource=null;
  function closeStatusMenu(restore){
    if(statusMenu)statusMenu.remove();statusMenu=null;
    if(restore&&statusMenuSource?.isConnected)statusMenuSource.focus({preventScroll:true});statusMenuSource=null;
  }
  document.addEventListener('contextmenu',function(ev){
    var ex=ev.target.closest('[data-zgmo="exhaustion"]');if(ex&&ev.shiftKey&&w.ZargotaGmTable?.isOpen()){ev.preventDefault();w.ZargotaGmTable.statusMenu('exhausted',ev);return;}
    var source=ev.target.closest('[data-zgmo="status"]');
    if(!source||!source.closest('.zgmo-overview'))return;
    var c=character(),state=c&&effects(c)[Number(source.dataset.index)];if(!state)return;
    if(ev.shiftKey&&state.key&&w.ZargotaGmTable?.isOpen()){ev.preventDefault();w.ZargotaGmTable.statusMenu(state.key,ev);return;}
    ev.preventDefault();ev.stopPropagation();closeStatusMenu(false);
    statusMenuSource=source;var menu=document.createElement('div');statusMenu=menu;menu.id='zgmo-status-menu';menu.setAttribute('role','menu');menu.setAttribute('data-zg-i18n-skip','');menu.setAttribute('aria-label',t('Действия с состоянием','Дії зі станом'));
    menu.innerHTML='<button type="button" role="menuitem">'+t('Убрать','Прибрати')+'</button>';document.body.appendChild(menu);
    var rect=source.getBoundingClientRect(),x=ev.clientX||rect.left,y=ev.clientY||rect.bottom;
    menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight-8))+'px';
    menu.querySelector('button').onclick=function(){
      var latest=character();closeStatusMenu(false);
      if(!latest||latest.id!==c.id)return;
      var stillPresent=effects(latest).some(function(item){return state.effect?.id!=null?item.effect?.id===state.effect.id:item.key===state.key;});
      if(!stillPresent)return;
      if(state.key)w.removeStatusFromInfo(c.id,state.key);else if(state.effect?.id!=null)w.removeEffect(c.id,state.effect.id);
    };
    menu.querySelector('button').focus({preventScroll:true});
  });
  document.addEventListener('pointerdown',function(ev){if(statusMenu&&!statusMenu.contains(ev.target))closeStatusMenu(false);},true);
  document.addEventListener('keydown',function(ev){if(!statusMenu)return;if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();closeStatusMenu(true);}else if(ev.key==='Tab')closeStatusMenu(false);},true);
  document.addEventListener('scroll',function(){closeStatusMenu(false);},true);
  document.addEventListener('zargota:localechange',function(){closeStatusMenu(false);});
  w.addEventListener('resize',function(){closeStatusMenu(false);});w.addEventListener('blur',function(){closeStatusMenu(false);});
  w.addEventListener('zargota:persistent-auth-change',function(){closeStatusMenu(false);});
  var statusReturnFocus=null;
  function closeStatus(immediate){
    var popup=document.querySelector('#status-info-popup.zgmo-status-dialog');if(!popup)return;
    cancelPageAnimation(popup.firstElementChild);
    var done=function(){popup.remove();if(statusReturnFocus&&statusReturnFocus.isConnected)statusReturnFocus.focus({preventScroll:true});statusReturnFocus=null;};
    if(immediate||matchMedia('(prefers-reduced-motion:reduce)').matches){done();return;}
    if(popup.classList.contains('zgmo-closing'))return;
    popup.classList.add('zgmo-closing');setTimeout(done,170);
  }
  function highlighted(text){return String(text==null?'':text).split(/([+−-]?\d+(?:[dдк]\d+)?(?:\s*[–—-]\s*\d+)?(?:\s*[%])?)/gi).map(function(part,i){return i%2?'<strong class="zgmo-rule-value">'+e(part)+'</strong>':e(part);}).join('');}
  function statusMarkup(state,st,f,label,duration,rules,mech,all,index){return '<article class="status-info-card character-ui-dialog"><button type="button" class="zgmo-status-dismiss" aria-label="'+t('Закрыть состояние','Закрити стан')+'">×</button><header class="zgmo-status-hero"><div>'+statusGlyph(state,st)+'</div><h2 style="color:'+e(f.color||st.color||'#e4cc96')+'">'+e(label)+'</h2><p>'+highlighted(duration)+'</p></header><div class="zgmo-status-body">'+(rules.length?'<div class="zgmo-player-rules">'+rules.join('')+'</div>':'')+'<div class="zgmo-status-description">'+highlighted(tr(f.description||mech.description||t('Описание пока не добавлено.','Опис поки не додано.')))+'</div><section class="zgmo-status-extra" id="zgmo-status-actions" hidden><button type="button" class="zgmo-remove-status">'+t('Снять состояние','Зняти стан')+'</button></section></div><div class="zgmo-status-toolbar">'+(all.length>1?'<span class="zgmo-status-position" aria-live="polite">'+(index+1)+' / '+all.length+'</span>':'')+'<button type="button" class="zgmo-status-tool" aria-controls="zgmo-status-actions" aria-expanded="false" aria-label="'+t('Действия с состоянием','Дії зі станом')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3 1-2h4l1 2 3 2 2 .5 2 3-1 2v3l1 2-2 3-2 .5-3 2-1 2h-4l-1-2-3-2-2-.5-2-3 1-2v-3l-1-2 2-3L6 5Z" transform="translate(1 1) scale(.91)"/><circle cx="12" cy="12" r="3"/></svg></button></div></article>';}
  function statusGlyph(state,st){
    var source=Object.assign({},st,state.effect||{},{key:state.key}),key=w.zgStatusGlyphKey(source,state.label||st.label),color=source.color||'#c6ad70';
    if(state.key==='poison'||state.key==='shield')return '<img class="zgmo-detail-icon" src="images/ui/character-mobile/status-'+state.key+'-v1.webp" alt="">';
    if(!/^#[0-9a-f]{3,8}$/i.test(color))color='#c6ad70';
    return '<svg class="zgmo-status-symbol" data-status-glyph="'+e(key)+'" viewBox="0 0 64 64" aria-hidden="true" focusable="false" style="color:'+color+'"><use href="character-status-symbols.svg?v=2026-11-14.13#'+e(key)+'"></use></svg>';
  }
  function swipeOn(node,move){
    var start=null;
    node.addEventListener('touchstart',function(ev){start=ev.touches.length===1&&!ev.target.closest('button,input,select,textarea')?{x:ev.touches[0].clientX,y:ev.touches[0].clientY,at:Date.now()}:null;},{passive:true});
    node.addEventListener('touchcancel',function(){start=null;},{passive:true});
    node.addEventListener('touchend',function(ev){if(!start)return;var first=start;start=null;var touch=ev.changedTouches[0];if(!touch)return;var dx=touch.clientX-first.x,dy=touch.clientY-first.y;if(Date.now()-first.at<900&&Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)move(dx<0?1:-1);},{passive:true});
  }
  function openStatus(c,state,source,direction,refreshOnly){
    var popup=(direction||refreshOnly)&&document.querySelector('#status-info-popup.zgmo-status-dialog'),reuse=!!popup;
    if(!reuse)closeStatus(true);
    var all=effects(c),index=all.findIndex(function(x){return state.effect&&state.effect.id!=null?x.effect&&x.effect.id===state.effect.id:x.key===state.key;});
    function sameStatus(a,b){return a.effect&&a.effect.id!=null?b.effect&&b.effect.id===a.effect.id:b.key===a.key;}
    function move(step){
      var fresh=character();if(!fresh||popup.classList.contains('zgmo-closing'))return;
      var selected=popup._statusCurrent||state,list=effects(fresh),at=list.findIndex(function(x){return sameStatus(selected,x);});
      if(at<0){closeStatus(false);return;}if(!list[at+step])return;
      var nextState=list[at+step];popup._statusCurrent=nextState;
      popup.querySelectorAll('[data-status-step]').forEach(function(nav){nav.hidden=Number(nav.dataset.statusStep)<0?at+step<=0:at+step>=list.length-1;});
      animatePage(popup.firstElementChild,step,function(){
        var latest=character();if(!latest||String(latest.id)!==String(c.id)||!popup.isConnected||popup.classList.contains('zgmo-closing'))return false;
        var present=effects(latest).find(function(x){return sameStatus(nextState,x);});
        if(!present){closeStatus(false);return false;}
        openStatus(latest,present,source,step);return popup.firstElementChild;
      });
    }

    var st=(w.ALL_STATUSES||[]).find(function(x){return x.key===state.key;})||{},f=state.effect||{};
    var mech=(typeof w.getStatusMechanics==='function'?w.getStatusMechanics():[]).find(function(x){return x.key===state.key;})||{};
    var label=tr(state.label||st.label||state.key||t('Состояние','Стан')),rules=[];
    function rule(value){rules.push('<span>'+highlighted(value)+'</span>');}
    if(f.tickType&&Number(f.tickValue))rule((f.tickValue>0?'+':'')+f.tickValue+' '+tr(f.tickType)+t(' каждый раунд',' кожен раунд'));
    var units={round:t('раунд.','раунд.'),rounds:t('раунд.','раунд.'),minute:t('мин.','хв.'),hour:t('ч.','год.'),minutes:t('мин.','хв.'),hours:t('ч.','год.'),days:t('дн.','дн.')};
    var duration=f.remaining!=null?f.remaining+' '+(units[f.unit]||tr(f.unit||'')):t('До снятия','До зняття');
    if(!popup)popup=document.createElement('div');popup.id='status-info-popup';popup.className='zgmo-status-dialog';popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','true');popup.setAttribute('aria-label',label);popup.setAttribute('data-zg-i18n-skip','');
    var markup=statusMarkup(state,st,f,label,duration,rules,mech,all,index);
    if(reuse){var template=document.createElement('template');template.innerHTML=markup;popup.firstElementChild.replaceChildren.apply(popup.firstElementChild,Array.from(template.content.firstElementChild.childNodes));}
    else popup.innerHTML=markup;
    var hero=popup.querySelector('.zgmo-status-hero');
    [-1,1].forEach(function(step){var nav=document.createElement('button');nav.type='button';nav.className='zgmo-status-browse '+(step<0?'is-prev':'is-next');nav.dataset.statusStep=step;nav.setAttribute('aria-label',step<0?t('Предыдущее состояние','Попередній стан'):t('Следующее состояние','Наступний стан'));nav.textContent=step<0?'‹':'›';nav.hidden=step<0?index<=0:index>=all.length-1;nav.onclick=function(){move(step);};hero.appendChild(nav);});
    statusReturnFocus=source;
    popup._statusCurrent=state;
    popup._moveStatus=move;
    if(!reuse){
      swipeOn(popup,function(step){if(!popup.classList.contains('zgmo-closing'))popup._moveStatus(step);});
      popup.addEventListener('keydown',function(ev){if(ev.key==='ArrowLeft'||ev.key==='ArrowRight'){ev.preventDefault();popup._moveStatus(ev.key==='ArrowLeft'?-1:1);}});
    }

    popup.querySelector('.zgmo-status-dismiss').onclick=function(){closeStatus(false);};
    popup.querySelector('.zgmo-status-tool').onclick=function(){var extra=popup.querySelector('#zgmo-status-actions');extra.hidden=!extra.hidden;this.setAttribute('aria-expanded',String(!extra.hidden));};
    popup.querySelector('.zgmo-remove-status').onclick=function(){closeStatus(true);if(state.key)w.removeStatusFromInfo(c.id,state.key);else if(f.id!=null)w.removeEffect(c.id,f.id);};
    popup.onclick=function(ev){if(ev.target===popup)closeStatus(false);};
    if(!reuse){(w.ZargotaGmTable?.portal()||document.body).appendChild(popup);popup.querySelector('.zgmo-status-dismiss').focus({preventScroll:true});}
    else if(!refreshOnly){
      var focus=popup.querySelector('[data-status-step="'+direction+'"]:not([hidden])')||popup.querySelector('.zgmo-status-dismiss');focus.focus({preventScroll:true});
    }
  }
  document.addEventListener('zargota:localechange',function(){
    cancelPageAnimation(document.querySelector('.zgmo-state-cards'));
    var popup=document.querySelector('#status-info-popup.zgmo-status-dialog'),c=character();
    if(!popup||!c||popup.classList.contains('zgmo-closing'))return;
    cancelPageAnimation(popup.firstElementChild);
    var selected=popup._statusCurrent,state=selected&&effects(c).find(function(x){return selected.effect&&selected.effect.id!=null?x.effect&&x.effect.id===selected.effect.id:x.key===selected.key;});
    if(!state){closeStatus(true);return;}
    var body=popup.querySelector('.zgmo-status-body'),scroll=body?body.scrollTop:0,focus=document.activeElement;
    var expanded=!popup.querySelector('#zgmo-status-actions').hidden,selector=focus&&focus.hasAttribute('data-status-step')?'[data-status-step="'+focus.dataset.statusStep+'"]':focus&&focus.classList.contains('zgmo-status-tool')?'.zgmo-status-tool':focus&&focus.classList.contains('zgmo-remove-status')?'.zgmo-remove-status':focus&&focus.classList.contains('zgmo-status-dismiss')?'.zgmo-status-dismiss':null;
    openStatus(c,state,statusReturnFocus,0,true);
    popup.querySelector('.zgmo-status-body').scrollTop=scroll;
    popup.querySelector('#zgmo-status-actions').hidden=!expanded;
    popup.querySelector('.zgmo-status-tool').setAttribute('aria-expanded',String(expanded));
    if(selector){var nextFocus=popup.querySelector(selector);if(nextFocus)nextFocus.focus({preventScroll:true});}
  });
  function healthHTML(c){
    var temp=w.readTempHpTotal(c);
    return '<div class="zgmo-health-tools">'+[['hpCur',t('Текущее здоровье','Поточне здоров’я'),c.hpCur||0],['hpMax',t('Максимум здоровья','Максимум здоров’я'),c.hpMax||1]].map(function(x){return button('health-number',x[1],'<span>'+x[1]+'</span><b>'+e(x[2])+'</b>','data-field="'+x[0]+'"');}).join('')+button('health-temp',t('Временные HP','Тимчасові HP'),'<span>'+t('Временные HP','Тимчасові HP')+'</span><b>+'+temp+'</b>')+'</div>';
  }
  document.addEventListener('click',function(ev){if(ev.target.closest('#char-sheet-tab-bar'))closeStatus(true);},true);
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&document.querySelector('#status-info-popup.zgmo-status-dialog')){closeStatus(false);ev.preventDefault();}});
  var stateSwipeStart=null;
  document.addEventListener('touchstart',function(ev){var cards=ev.target.closest('.zgmo-state-cards');stateSwipeStart=cards&&ev.touches.length===1?{x:ev.touches[0].clientX,y:ev.touches[0].clientY,at:Date.now()}:null;},{passive:true});
  document.addEventListener('touchcancel',function(){stateSwipeStart=null;},{passive:true});
  document.addEventListener('touchend',function(ev){if(!stateSwipeStart)return;var from=stateSwipeStart;stateSwipeStart=null;var touch=ev.changedTouches[0];if(!touch)return;var dx=touch.clientX-from.x,dy=touch.clientY-from.y;if(Date.now()-from.at<900&&Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){var target=document.querySelector('.zgmo-states [data-zgmo="'+(dx<0?'next':'prev')+'"]:not([hidden])');if(target)action(dx<0?'next':'prev',target);}},{passive:true});
  function sync(){var dest=document.querySelector('.zgmo-sync'),updates=w.ZargotaCharacterUpdates,c=character();if(!dest)return;var count=c&&updates&&updates.unread(c.id)||0;dest.hidden=!count;var label=t('Обновления персонажа','Оновлення персонажа')+(count?': '+count:'');dest.title=label;dest.setAttribute('aria-label',label);dest.setAttribute('aria-haspopup','dialog');}
  // Update sheet content without replacing mounted media or synchronization decorations.
  function contentChildren(node){return Array.from(node.childNodes).filter(function(child){return child.nodeType!==1||!child.matches(".character-update-notice,.character-update-marker");});}
  function patchNode(node,next){
    if(node.nodeType!==next.nodeType||node.nodeName!==next.nodeName){node.replaceWith(next.cloneNode(true));return;}
    if(node.nodeType!==1){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;return;}
    var focused=node===document.activeElement;
    var sameImage=node.tagName==='IMG'&&(node.getAttribute('src')===next.getAttribute('src')||node.dataset.zgResolvedSource===next.getAttribute('src'));
    // Runtime image resolution and face framing belong to the mounted image.
    // Reapplying its original URL would reload a local portrait on every edit.
    if(sameImage){
      next.setAttribute('src',node.getAttribute('src'));
      ['data-zg-resolved','data-zg-resolved-source'].forEach(function(key){if(node.hasAttribute(key))next.setAttribute(key,node.getAttribute(key));});
      if(node.hasAttribute('data-zg-portrait'))next.style.objectPosition=node.style.objectPosition;
    }
    Array.from(node.attributes).forEach(function(a){if(!next.hasAttribute(a.name))node.removeAttribute(a.name);});
    Array.from(next.attributes).forEach(function(a){if(!(focused&&a.name==='value')&&node.getAttribute(a.name)!==a.value)node.setAttribute(a.name,a.value);});
    if((node.tagName==='INPUT'&&node.type!=='file'||node.tagName==='TEXTAREA')&&!focused&&node.value!==next.value)node.value=next.value;
    var oldChildren=contentChildren(node),newChildren=contentChildren(next);
    newChildren.forEach(function(child,i){if(oldChildren[i])patchNode(oldChildren[i],child);else node.appendChild(child.cloneNode(true));});
    oldChildren.slice(newChildren.length).forEach(function(child){child.remove();});
  }
  function updateMarkup(container,html){
    var template=document.createElement('template');template.innerHTML=html;
    var children=contentChildren(container),next=contentChildren(template.content);
    next.forEach(function(node,i){if(children[i])patchNode(children[i],node);else container.appendChild(node.cloneNode(true));});
    children.slice(next.length).forEach(function(node){node.remove();});
    if(w.ZargotaPortrait)w.ZargotaPortrait.refresh(container);
  }
  var numberEntry=null;
  function closeNumber(restore){
    var entry=numberEntry,popup=document.getElementById('zgmo-number-pad');numberEntry=null;if(popup)popup.remove();
    if(restore!==false&&entry&&entry.source&&entry.source.isConnected)entry.source.focus({preventScroll:true});
  }
  function numberKey(key){
    var entry=numberEntry;if(!entry)return;
    if(key==='cancel'){closeNumber();return;}
    if(key==='temp'){closeNumber(false);w.openQuickTemp(entry.id,entry.key);return;}
    if(key==='save'){
      var value=Number(entry.draft);if(!/^-?\d+$/.test(entry.draft)||!Number.isSafeInteger(value))return;
      if(entry.kind==='health')value=Math.max(entry.key==='hpMax'?1:0,value);
      closeNumber(false);
      if(entry.kind==='stat')w.updateStatField(entry.id,entry.key,'cur',value);
      else {var c=(w.characters||[]).find(function(x){return x.id===entry.id;});if(!c)return;if(entry.key==='initiative')value-=w.readTempBonusTotal(c,entry.key);w.updateSimpleField(entry.id,entry.key,value);}
      w.renderCharSheet();if(entry.source&&entry.source.isConnected)entry.source.focus({preventScroll:true});return;
    }
    if(key!=='plus'&&key!=='minus')return;
    var next=Number(entry.draft)+(key==='plus'?1:-1);if(!Number.isSafeInteger(next))return;
    entry.draft=String(next);
    var output=document.querySelector('#zgmo-number-pad output');output.textContent=entry.draft;
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches&&output.animate){output.getAnimations().forEach(function(a){a.cancel();});output.animate([{transform:'scale(1.12)',color:key==='plus'?'#a5d691':'#ef7970'},{transform:'scale(1)',color:'#f5da92'}],{duration:180});}

  }
  function openNumber(c,key,label,value,kind,source){
    close();numberEntry={id:c.id,key:key,kind:kind,draft:String(value),source:source};
    var popup=document.createElement('div');popup.id='zgmo-number-pad';popup.style.setProperty('--tone',getComputedStyle(source.closest('.zgmo-stat')||source).getPropertyValue('--tone')||'#c5a56a');
    function keyButton(key,text,label){return '<button type="button" data-number-key="'+key+'"'+(label?' aria-label="'+e(label)+'"':'')+'>'+text+'</button>';}
    popup.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="zgmo-number-title"><header><h2 id="zgmo-number-title">'+e(label)+'</h2>'+(kind==='vital'?keyButton('temp','⌛',t('Временный эффект','Тимчасовий ефект')):'')+keyButton('cancel','×',t('Закрыть','Закрити'))+'</header><div class="zgmo-number-stepper">'+keyButton('minus',controlMark(false),t('Уменьшить на 1','Зменшити на 1'))+'<output aria-live="polite">'+e(value)+'</output>'+keyButton('plus',controlMark(true),t('Увеличить на 1','Збільшити на 1'))+'</div><footer>'+keyButton('cancel',t('Отмена','Скасувати'))+keyButton('save',t('Сохранить','Зберегти'))+'</footer></section>';
    popup.onclick=function(ev){if(ev.target===popup){closeNumber();return;}var b=ev.target.closest('[data-number-key]');if(b)numberKey(b.dataset.numberKey);};(w.ZargotaGmTable?.portal()||document.body).appendChild(popup);popup.querySelector('[data-number-key=save]').focus({preventScroll:true});
  }
  document.addEventListener('keydown',function(ev){
    var popup=document.getElementById('zgmo-number-pad');
    if(!popup){if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('.zgmo-stat input[readonly]')){ev.preventDefault();ev.target.click();}return;}
    if(ev.key==='Escape'){ev.preventDefault();numberKey('cancel');}
    else if(['ArrowUp','ArrowDown','+','-'].indexOf(ev.key)>=0){ev.preventDefault();if(!ev.repeat)numberKey(ev.key==='ArrowUp'||ev.key==='+'?'plus':'minus');}
    else if(ev.key==='Tab'){var buttons=Array.from(popup.querySelectorAll('button:not(:disabled)')),first=buttons[0],last=buttons[buttons.length-1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
  });
  function editingInput(){var el=document.activeElement;return el&&el.matches('input:not([type=file]):not([readonly]),textarea')&&el.closest('.zgmo-overview,#zgmo-modal,#quick-temp-popup,#status-popup,#level-manager')?el:null;}
  function keepEditorVisible(){
    var el=editingInput();document.body.classList.toggle('zgmo-number-editing',!!el&&mobile.matches);
    if(!el)return;
    var root=el.closest('.zgmo-overview');
    if(root){var target=el.closest('.zgmo-stat')||el,r=target.getBoundingClientRect(),bounds=root.getBoundingClientRect();if(r.bottom>bounds.bottom-16)root.scrollTop+=r.bottom-bounds.bottom+16;else if(r.top<bounds.top+12)root.scrollTop+=r.top-bounds.top-12;}
  }
  var editingTimer;
  function scheduleEditor(){requestAnimationFrame(keepEditorVisible);clearTimeout(editingTimer);editingTimer=setTimeout(keepEditorVisible,180);}
  document.addEventListener('focusin',scheduleEditor);
  document.addEventListener('focusout',scheduleEditor);
  if(w.visualViewport){w.visualViewport.addEventListener('resize',scheduleEditor);w.visualViewport.addEventListener('scroll',scheduleEditor);}
  w.addEventListener('resize',scheduleEditor);
  document.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&editingInput()===ev.target&&ev.target.tagName==='INPUT'){ev.preventDefault();ev.target.blur();}});
  function animateHP(c,root){
    var temp=w.readTempHpTotal(c),delta=(c.hpCur+temp)-(previousHP.value+previousHP.temp),percent=Math.max(0,Math.min(100,c.hpMax?c.hpCur/c.hpMax*100:0));
    var track=root.querySelector('.zgmo-hp-track>span'),value=root.querySelector('.zgmo-hp-value');
    if(track&&track.animate){track.getAnimations().forEach(function(a){a.cancel();});track.animate([{width:previousHP.percent+'%'},{width:percent+'%'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});}
    if(value&&value.animate){value.getAnimations().forEach(function(a){a.cancel();});value.animate([{filter:'brightness(1)',transform:'scale(1)'},{filter:'brightness(1.6)',transform:'scale(.97)',offset:.25},{filter:'brightness(1)',transform:'scale(1)'}],{duration:480});}
    if(delta){var old=root.querySelector('.zgmo-hp-change');if(old)old.remove();var label=document.createElement('span');label.className='zgmo-hp-change';label.textContent=(delta>0?'+':'−')+Math.abs(delta);label.style.color=delta>0?'#a5d691':'#ff8c80';label.setAttribute('aria-hidden','true');root.querySelector('.zgmo-hp').appendChild(label);var a=label.animate([{opacity:0,transform:'translate(-50%,4px)'},{opacity:1,transform:'translate(-50%,-4px)',offset:.2},{opacity:0,transform:'translate(-50%,-24px)'}],{duration:800});a.onfinish=function(){label.remove();};}
  }
  function mounted(){
    sync();
    var page=document.getElementById('page-characters');
    if(!page||!page.classList.contains('active')||w.charView!=='sheet')return;
    var c=character(),view=String(current)+':'+(w._charSheetTab||'stats'),root=document.querySelector('.zgmo-overview'),nav=document.querySelector('.zgmo-nav');
    var reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(view!==lastView){if(root)root.classList.add('zgmo-enter');if(nav)nav.classList.add('zgmo-nav-enter');}
    else if(root&&c&&previousHP&&previousHP.id===c.id&&(previousHP.value!==c.hpCur||previousHP.temp!==w.readTempHpTotal(c))&&!reduced)animateHP(c,root);
    if(c&&root)animateInspiration(c,root);
    lastView=view;
    if(c)previousHP={id:c.id,value:c.hpCur,temp:w.readTempHpTotal(c),percent:Math.max(0,Math.min(100,c.hpMax?c.hpCur/c.hpMax*100:0))};
    var modal=document.querySelector('#zgmo-modal[data-tools] .zgmo-modal-body');if(modal&&c)updateMarkup(modal,healthHTML(c));var exhaustion=document.querySelector('#zgmo-modal[data-exhaustion] .zgmo-modal-body');if(exhaustion&&c)updateMarkup(exhaustion,exhaustionHTML(c));var inspiration=document.querySelector('#zgmo-modal[data-inspiration] .zgmo-modal-body');if(inspiration&&c)updateMarkup(inspiration,inspirationHTML(c));var injury=document.querySelector('#zgmo-modal[data-injuries] .zgmo-modal-body');if(injury&&c)updateMarkup(injury,injuryHTML(c));}
  function action(name,el){var c=character();if(name==='close'){close();return;}if(!c)return;
    if(name==='back'){setActive(false);w.zgCharBack();}
    else if(name==='temp')w.openQuickTemp(c.id,el.dataset.field);
    else if(name==='damage'||name==='heal'){close();w.changeHP(c.id,name==='damage'?-1:1);}
    else if(name==='health-number')openNumber(c,el.dataset.field,el.getAttribute('aria-label'),Number(c[el.dataset.field])||0,'health',el);
    else if(name==='health-temp'){close();w.openQuickTemp(c.id,'hp');}
    else if(name==='level')w.openLevelManager(c.id);
    else if(name==='inspiration')modal(t('Вдохновение','Натхнення'),inspirationHTML(c)).dataset.inspiration='true';
    else if(name==='injuries')modal(t('Травмы','Травми'),injuryHTML(c)).dataset.injuries='true';
    else if(name==='spend-inspiration'){el.disabled=true;changeSpecial(c,'spend-inspiration');}
    else if(name==='remove-injury'&&canManageInjuries(c)){el.disabled=true;changeSpecial(c,'remove-injury',el.dataset.injury);}
    else if(name==='reduce-exhaustion'){el.disabled=true;changeSpecial(c,'reduce-exhaustion');}
    else if(name==='exhaustion')modal(t('Истощение','Виснаження'),exhaustionHTML(c)).dataset.exhaustion='true';
    else if(name==='health')modal(t('Здоровье','Здоров’я'),healthHTML(c)).dataset.tools='true';
    else if(name==='prev'||name==='next'){
      var step=name==='next'?1:-1,count=Math.max(1,Math.ceil(effects(c).length/2)),at=pages[c.id]||0,nextPage=Math.max(0,Math.min(count-1,at+step));
      if(nextPage===at)return;pages[c.id]=nextPage;
      var root=document.querySelector('.zgmo-states'),cards=root&&root.querySelector('.zgmo-state-cards');
      if(root){root.querySelector('[data-zgmo=prev]').hidden=nextPage<=0;root.querySelector('[data-zgmo=prev]').disabled=nextPage<=0;root.querySelector('[data-zgmo=next]').hidden=nextPage>=count-1;root.querySelector('[data-zgmo=next]').disabled=nextPage>=count-1;}
      animatePage(cards,step,function(){
        var latest=character();if(!latest||String(latest.id)!==String(c.id)||!root.isConnected)return false;
        var holder=document.createElement('template');holder.innerHTML=states(latest);var next=holder.content.firstElementChild;
        updateMarkup(cards,next.querySelector('.zgmo-state-cards').innerHTML);
        ['prev','next'].forEach(function(key){var target=root.querySelector('[data-zgmo='+key+']'),source=next.querySelector('[data-zgmo='+key+']');target.hidden=source.hidden;target.disabled=source.disabled;});
        root.querySelector('.zgmo-page-count').textContent=next.querySelector('.zgmo-page-count').textContent;
        return cards;
      });
    }
    else if(name==='number')openNumber(c,el.dataset.stat,el.getAttribute('aria-label'),el.value,'stat',el);
    else if(name==='status'){var state=effects(c)[Number(el.dataset.index)];if(state)openStatus(c,state,el);}
    else if(name==='add-status'){modal(t('Добавить состояние','Додати стан'),'<div class="zgmo-status-picker">'+w.ALL_STATUSES.map(function(st){return button('choose-status',tr(st.label),statusGlyph({key:st.key},st)+' '+e(tr(st.label)),'data-key="'+e(st.key)+'"');}).join('')+'</div>');}
    else if(name==='choose-status'){close();w.toggleStatus(c.id,el.dataset.key);}
    else if(name==='vital'){var key=el.dataset.field,base=key==='speed'?w.parseSpeedNumber(c.speed):Number(c[key])||0;openNumber(c,key,el.getAttribute('aria-label'),base+w.readTempBonusTotal(c,key),'vital',el);}
    else if(name==='menu'&&w.ZargotaPersistentCharacters&&w.ZargotaPersistentCharacters.accountMenu)w.ZargotaPersistentCharacters.accountMenu(el);
    else if(name==='character-actions'||name==='menu')modal(t('Персонаж','Персонаж'),'<div class="zgmo-menu">'+button('edit',t('Редактировать персонажа','Редагувати персонажа'),t('Редактировать персонажа','Редагувати персонажа'))+button('portrait',t('Изменить портрет','Змінити портрет'),t('Изменить портрет','Змінити портрет'))+button('level',t('Уровень и развитие','Рівень і розвиток'),t('Уровень и развитие','Рівень і розвиток'))+button('health',t('Здоровье','Здоров’я'),t('Здоровье','Здоров’я'))+button('sync',t('Синхронизация','Синхронізація'),t('Синхронизация','Синхронізація'))+'</div>');
    else if(name==='edit'){close();setActive(false);w.openCharEditor(c.id);}
    else if(name==='portrait'){close();w.triggerPortraitUpload(c.id);}
    else if(name==='updates'){if(w.ZargotaCharacterUpdates)w.ZargotaCharacterUpdates.open(c.id);}
    else if(name==='sync'){var toolbar=document.getElementById('persistent-sheet-status');close();if(toolbar&&!toolbar.hidden){var m=modal(t('Синхронизация','Синхронізація'),'');m.querySelector('.zgmo-modal-body').appendChild(toolbar);movedStatus=toolbar;}else{var lamp=document.getElementById('character-cloud-indicator');if(lamp)lamp.click();}}
  }
  w.zgMobileCharacterActions=function(){action('character-actions');};
  document.addEventListener('click',function(ev){var el=ev.target.closest('[data-zgmo]');if(el)action(el.dataset.zgmo,el);});
  document.addEventListener('change',function(ev){var c=character(),el=ev.target;if(!c)return;if(el.dataset.stat)w.updateStatField(c.id,el.dataset.stat,'cur',el.value);if(el.dataset.vital){var val=Number(el.value)||0;if(el.dataset.vital==='initiative')val-=w.readTempBonusTotal(c,'initiative');w.updateSimpleField(c.id,el.dataset.vital,val);w.renderCharSheet();}});
  document.addEventListener('keydown',function(ev){var m=document.getElementById('zgmo-modal');if(!m)return;if(ev.key==='Escape'){close();ev.preventDefault();}if(ev.key==='Tab'){var a=Array.from(m.querySelectorAll('button,input,select,textarea,[tabindex="0"]')).filter(function(x){return !x.disabled&&x.getClientRects().length;});if(!a.length)return;var first=a[0],last=a[a.length-1];if(ev.shiftKey&&document.activeElement===first){last.focus();ev.preventDefault();}else if(!ev.shiftKey&&document.activeElement===last){first.focus();ev.preventDefault();}}});
  document.addEventListener('zargota:character-updates',sync);
  // Observe only the existing sync status; do not create another connection.
  var observer=new MutationObserver(function(records){if(records.some(function(r){return r.target.id==='character-cloud-indicator'||r.target.id==='persistent-sheet-status'||r.target.closest&&r.target.closest('#persistent-sheet-status');}))sync();});
  var popupObserver=new MutationObserver(function(records){
    if(!mobile.matches)return;
    records.forEach(function(record){Array.from(record.addedNodes).forEach(function(node){if(node.nodeType!==1)return;if(node.id==='quick-temp-popup'||node.id==='status-popup'||node.id==='level-manager'){node.classList.add('zgmo-aux-dialog');node.querySelectorAll('input[type=number]').forEach(function(input){input.setAttribute('inputmode','numeric');input.setAttribute('enterkeyhint','done');});}});});
    if(document.body.classList.contains('zgmo-number-editing')&&!editingInput())scheduleEditor();
  });
  popupObserver.observe(document.body,{childList:true});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-state','title','hidden']});
  // Simple silhouettes from the approved diamond navigation; color follows selection.
  function navIcon(key){
    var shapes={
      stats:'<path d="M32 5c-9 0-14 6-14 15v5c0 4 2 7 5 9v6l-13 7c-4 3-5 7-5 13h54c0-6-1-10-5-13l-13-7v-6c3-2 5-5 5-9v-5C46 11 41 5 32 5Z"/><path d="m23 40 9 12 9-12-5 20h-8Z" fill="var(--zgmo-icon-detail,#8d7150)" opacity=".45"/>',
      skills:'<path d="M35 3c2 10 5 13 15 16-10 2-13 6-15 15-3-9-6-13-16-15C29 16 32 13 35 3Z"/><path d="m4 48 12-9c3-2 6-3 10-2l11 2c4 1 4 5 0 6l-11 1 2 2 16-3 12-12c3-3 6-1 4 3L48 53c-2 3-5 5-9 5H21l-7 5Z"/><path d="m42 40 8-12c2-3 5-1 3 2l-6 12Z"/>',
      inventory:'<path d="M10 8h44c4 0 6 3 6 7l-3 14-20 5v-8H27v8L7 29 4 15c0-4 2-7 6-7Z"/><path d="m8 34 17 4v6c0 3 3 5 7 5s7-2 7-5v-6l17-4 3 19c1 5-2 9-7 9H12c-5 0-8-4-7-9Z"/><path d="M30 29h4v15h-4Z"/>',
      lore:'<path d="M6 9c10-2 18 0 24 5v40c-8-5-15-7-24-5Zm52 0c-10-2-18 0-24 5v40c8-5 15-7 24-5Z"/><path d="M1 14h2v38c11-1 20 1 29 7 9-6 18-8 29-7V14h2v43c-12-2-21 0-31 6-10-6-19-8-31-6Z"/>'
    };
    return '<svg class="zgmo-nav-icon" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true" focusable="false" fill="currentColor">'+(shapes[key]||shapes.stats)+'</svg>';
  }
  var mobile=matchMedia('(max-width: 899px)');mobile.addEventListener('change',function(){if(w.charView==='sheet'&&document.getElementById('page-characters').classList.contains('active')){w.renderCharSheet();}else setActive(false);});
  document.addEventListener('DOMContentLoaded',function(){if(w.ZG_APP_CHANGELOG?.[0]){w.ZG_APP_CHANGELOG[0].notes+=' Особое: истощение и травмы по сторонам HP, вдохновение под меню портрета. Новые иконки, единые рамки со срезанными углами, выдача перетаскиванием, просмотр последствий травм и расходование вдохновения с мягкой анимацией. Истощение накапливается до пяти уровней; до четырёх травм сохраняются с описанием и лечением.';w.ZG_APP_CHANGELOG[0].notesUk+=' Особливе: виснаження й травми обабіч HP, натхнення під меню портрета. Нові іконки, єдині рамки зі зрізаними кутами, надання перетягуванням, перегляд наслідків травм і витрачання натхнення з м’якою анімацією. Виснаження накопичується до п’яти рівнів; до чотирьох травм зберігаються з описом і лікуванням.';}});
  w.ZargotaMobileSheet={statusPreviewMarkup:function(def,options){var mech=(w.getStatusMechanics?.()||[]).find(function(x){return x.key===def.key;})||{},label=w.ZargotaGmStatusLibrary.label(def),description=w.ZargotaGmStatusLibrary.description(def);return statusMarkup(def,def,{description:description},label,options.unit==='manual'?t('До снятия','До зняття'):String(options.duration||''),[],mech,[],0);},settingsIcon:function(){return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 3 .8-2h4.4l.8 2 2.2 1.3 2.1-.3 2.2 3.8-1.3 1.7v2.6l1.3 1.7-2.2 3.8-2.1-.3L15 18.4l-.8 2H9.8l-.8-2-2.2-1.3-2.1.3-2.2-3.8 1.3-1.7V9.3L2.5 7.6l2.2-3.8 2.1.3Z" transform="translate(0 1)"/><circle cx="12" cy="12" r="3.2"/></svg>';},setInventoryActive:setInventoryActive,inventory:inventory,updateMarkup:updateMarkup,animatePage:animatePage,cancelPageAnimation:cancelPageAnimation,render:render,fame:fame,navIcon:navIcon,setActive:setActive,mounted:mounted,openTools:function(){action('health');},openMenu:function(){action('menu');}};
})(window);
