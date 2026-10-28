/* Mobile character overview: presentation only, all edits use existing sheet actions. */
(function(w){
  'use strict';
  var current, toolsHTML='', pages={}, returnFocus=null, movedStatus=null, lastView=null, previousHP=null;
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function tr(s){return w.ZargotaI18n?w.ZargotaI18n.translate(s):s;}
  function controlMark(plus){return '<svg class="zgmo-control-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14'+(plus?'M12 5v14':'')+'"/></svg>';}
  function button(action,label,content,extra){if(content==='+'||content==='−')content=controlMark(content==='+');return '<button type="button" data-zgmo="'+action+'" aria-label="'+e(label)+'" '+(extra||'')+'>'+content+'</button>';}
  function character(){return (w.characters||[]).find(function(c){return c.id===current;});}
  function setActive(on){var page=document.getElementById('page-characters');on=!!on&&w.charView==='sheet'&&page&&page.classList.contains('active');document.body.classList.toggle('zg-stats-overview',!!on);if(!on){close();lastView=null;previousHP=null;}}
  function effects(c){
    var result=(c.tempEffects||[]).filter(function(x){return x.type==='status';}).map(function(x){return {key:x.statusKey,label:x.label||x.value,effect:x};});
    (c.statuses||[]).forEach(function(key){if(!result.some(function(x){return x.key===key;}))result.push({key:key});});
    return result;
  }
  function states(c){
    var all=effects(c),count=Math.max(1,Math.ceil(all.length/2)),page=Math.min(pages[c.id]||0,count-1);pages[c.id]=page;
    return '<section class="zgmo-states" aria-label="'+t('Состояния','Стани')+'"><div class="zgmo-state-heading">'+button('add-status',t('Добавить состояние','Додати стан'),'+')+'<strong>'+t('Состояния','Стани')+'</strong><span class="zgmo-state-total" aria-label="'+t('Всего состояний: ','Усього станів: ')+all.length+'"><span>'+t('Всего','Усього')+'</span><span class="zgmo-count-diamond"><b>'+all.length+'</b></span></span></div><div class="zgmo-state-carousel">'+
      (page>0?button('prev',t('Предыдущие состояния','Попередні стани'),'‹','class="zgmo-state-arrow zgmo-state-prev"'):'')+
      '<div class="zgmo-state-cards">'+(all.length?all.slice(page*2,page*2+2).map(function(x,i){
      var st=(w.ALL_STATUSES||[]).find(function(s){return s.key===x.key;})||{},f=x.effect;
      var unit=f?({round:t('раунд.','раунд.'),rounds:t('раунд.','раунд.'),minute:t('мин.','хв.'),minutes:t('мин.','хв.'),hour:t('ч.','год.'),hours:t('ч.','год.'),days:t('дн.','дн.')})[f.unit]||tr(f.unit||''):'';
      var glyph=(x.key==='poison'||x.key==='shield')?'<img src="images/ui/character-mobile/status-'+x.key+'-v1.webp" alt="" width="32" height="32">':w.characterStatusGlyph(Object.assign({},st,f||{}),st.label||'','character-status-icon');
      return button('status',tr(x.label||st.label||x.key||t('Состояние','Стан')),'<span class="zgmo-status-icon">'+glyph+'</span><span class="zgmo-state-copy"><b>'+e(tr(x.label||st.label||x.key||t('Состояние','Стан')))+'</b><small>'+e(f&&f.remaining!=null?f.remaining+' '+unit:t('До снятия','До зняття'))+'</small></span>','data-index="'+(page*2+i)+'" style="--tone:'+e(st.color||'#c6ad70')+'"');
    }).join(''):'<span class="zgmo-empty">'+t('Нет активных состояний','Немає активних станів')+'</span>')+'</div>'+
      (page<count-1?button('next',t('Следующие состояния','Наступні стани'),'›','class="zgmo-state-arrow zgmo-state-next"'):'')+'</div><span class="zgmo-page-count" aria-live="polite">'+(count>1?(page+1)+' / '+count:'')+'</span></section>';
  }
  function render(c,combat){
    current=c.id;toolsHTML=combat;
    var labels={str:['Сила','Сила'],dex:['Ловкость','Спритність'],int:['Интеллект','Інтелект'],cha:['Харизма','Харизма'],per:['Восприятие','Сприйняття'],con:['Выносливость','Витривалість']};
    var colors={str:'#ed7676',dex:'#93d18b',int:'#7dc7f0',cha:'#ebbc68',per:'#c59af0',con:'#d7d4cd'};
    var stats=Object.keys(labels).map(function(key){var temp=w.readTempBonusTotal(c,key),val=(parseInt((c.stats[key]||{}).cur)||0)+temp,label=t.apply(null,labels[key]);return '<div class="zgmo-stat" style="--tone:'+colors[key]+'">'+w.zgStatIcon(key)+'<label for="zgmo-'+key+'">'+label+'</label><input id="zgmo-'+key+'" data-stat="'+key+'" type="number" inputmode="numeric" enterkeyhint="done" aria-label="'+label+'" value="'+val+'" style="color:'+(temp>0?'#86d7a0':temp<0?'#f08f80':'#f1d58b')+'">'+button('temp',t('Временный эффект: ','Тимчасовий ефект: ')+label,'⌛','data-field="'+key+'"'+(temp?' class="has-effect"':''))+'</div>';}).join('');
    var derived=[['ac',t('Броня','Броня'),'⛨','#b3c5ee',Number(c.ac)||0],['initiative',t('Инициатива','Ініціатива'),'ϟ','#f0d16c',Number(c.initiative)||0],['speed',t('Скорость','Швидкість'),'»','#9ed49b',w.parseSpeedNumber(c.speed||'0')]].map(function(x){return button('vital',x[1],'<small>'+x[1]+'</small><span><img class="zgmo-vital-icon" alt="" src="images/ui/stats/'+({ac:'armor',initiative:'initiative',speed:'speed'})[x[0]]+'.png"> '+(x[4]+w.readTempBonusTotal(c,x[0]))+'</span>','data-field="'+x[0]+'" style="--tone:'+x[3]+'"');}).join('');
    var hp=Math.max(0,Math.min(100,c.hpMax?c.hpCur/c.hpMax*100:0)),tmp=w.readTempHpTotal(c);
    return '<div class="zgmo-overview" data-zg-i18n-skip><input type="file" id="sheet-portrait-input" accept="image/*" hidden onchange="handleSheetPortrait('+c.id+',event)"><section class="zgmo-portrait">'+(c.portrait?'<img class="zgmo-portrait-image" src="'+e(c.portrait)+'" alt="'+e(w.characterEntryText(c,c.name))+'">':'')+'<div class="zgmo-top">'+button('back',t('Назад','Назад'),'‹')+'<div>'+button('sync',t('Синхронизация','Синхронізація'),'<span></span>','class="zgmo-sync"')+button('menu',t('Меню персонажа','Меню персонажа'),'⋯')+'</div></div><div class="zgmo-identity"><h1>'+e(w.characterEntryText(c,c.name))+'</h1><div><span>'+e(w.characterEntryText(c,c.race||''))+' · '+e(w.characterEntryText(c,c.klasse||''))+'</span>'+button('level',t('Управление уровнем','Керування рівнем'),t('Ур. ','Рів. ')+(c.level||1)+(c.unspentStatPoints?' ✦'+c.unspentStatPoints:''))+'</div></div></section><div class="zgmo-hp">'+button('damage',t('Убрать 1 HP','Зняти 1 HP'),'−','class="zgmo-damage"')+button('health',t('Здоровье и эффекты','Здоров’я та ефекти'),'<b>♥ '+(c.hpCur||0)+' / '+(c.hpMax||0)+(tmp?' <small>+'+tmp+'</small>':'')+'</b><span class="zgmo-hp-track"><span style="width:'+hp+'%"></span></span>','class="zgmo-hp-value"')+button('heal',t('Восстановить 1 HP','Відновити 1 HP'),'+','class="zgmo-heal"')+'</div><div class="zgmo-derived">'+derived+'</div><section class="zgmo-stats" aria-label="'+t('Характеристики','Характеристики')+'">'+stats+'</section>'+states(c)+'</div>';
  }
  function fame(c){return '<section class="zgmo-fame"><h3>'+t('Слава','Слава')+'</h3>'+[['fameMundo',t('Мировая слава','Світова слава')],['fameZargoty',t('Слава в Зарготе','Слава в Зарготі')]].map(function(x){return '<div><span>'+x[1]+'</span><div>'+Array.from({length:8},function(_,i){return '<button aria-label="'+x[1]+': '+(i+1)+'" aria-pressed="'+(i<(c[x[0]]||0))+'" onclick="toggleFame('+c.id+',\''+x[0]+'\','+i+')">'+(i<(c[x[0]]||0)?'◆':'◇')+'</button>';}).join('')+'</div></div>';}).join('')+'</section>';}
  function close(){closeStatus(true);var modal=document.getElementById('zgmo-modal');if(movedStatus){var sheet=document.getElementById('char-sheet-view');sheet.prepend(movedStatus);movedStatus=null;}if(modal)modal.remove();if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
  function modal(title,html){close();returnFocus=document.activeElement;var el=document.createElement('div');el.id='zgmo-modal';el.innerHTML='<section role="dialog" aria-modal="true" aria-label="'+e(title)+'"><header><h2>'+e(title)+'</h2>'+button('close',t('Закрыть','Закрити'),'×')+'</header><div class="zgmo-modal-body">'+html+'</div></section>';el.addEventListener('click',function(ev){if(ev.target===el)close();});document.body.appendChild(el);el.querySelector('button').focus();return el;}
  var statusReturnFocus=null;
  function closeStatus(immediate){
    var popup=document.querySelector('#status-info-popup.zgmo-status-dialog');if(!popup)return;
    var done=function(){popup.remove();if(statusReturnFocus&&statusReturnFocus.isConnected)statusReturnFocus.focus({preventScroll:true});statusReturnFocus=null;};
    if(immediate||matchMedia('(prefers-reduced-motion:reduce)').matches){done();return;}
    if(popup.classList.contains('zgmo-closing'))return;
    popup.classList.add('zgmo-closing');setTimeout(done,170);
  }
  function openStatus(c,state,source){
    closeStatus(true);
    if(state.key)w.showStatusInfoPopup(c.id,state.key);
    else {
      var old=document.getElementById('status-info-popup');if(old)old.remove();
      var custom=document.createElement('div');custom.id='status-info-popup';
      custom.innerHTML='<div class="status-info-card"><div><div>'+w.characterStatusGlyph(state.effect||{},state.label,'status-dialog-icon')+'</div><div>'+e(tr(state.label||t('Состояние','Стан')))+'</div></div><div>'+e(state.effect&&state.effect.description||t('Описание пока не добавлено','Опис поки не додано'))+'</div><div><button type="button">'+t('Снять состояние','Зняти стан')+'</button></div></div>';
      custom.querySelector('button').onclick=function(){closeStatus(true);if(state.effect)w.removeEffect(c.id,state.effect.id);};document.body.appendChild(custom);
    }
    var popup=document.getElementById('status-info-popup'),card=popup&&popup.querySelector('.status-info-card');if(!card)return;
    popup.classList.add('zgmo-status-dialog');popup.setAttribute('role','dialog');popup.setAttribute('aria-label',tr(state.label||state.key));
    statusReturnFocus=source;
    var children=Array.from(card.children),heading=children.shift(),footer=children.pop();
    heading.classList.add('zgmo-status-hero');
    var body=document.createElement('div');body.className='zgmo-status-body';
    // Lead with the status description; keep detailed rules available on demand.
    var description=children.pop();if(description)body.appendChild(description);
    if(children.length){var more=document.createElement('details');more.className='zgmo-status-rules';var moreTitle=document.createElement('summary');moreTitle.textContent=t('Подробнее о действии','Докладніше про дію');more.appendChild(moreTitle);children.forEach(function(child){more.appendChild(child);});body.appendChild(more);}
    var dismiss=document.createElement('button');dismiss.className='zgmo-status-dismiss';dismiss.type='button';dismiss.setAttribute('aria-label',t('Закрыть состояние','Закрити стан'));dismiss.textContent='×';dismiss.onclick=function(){closeStatus(false);};
    var actions=document.createElement('details');actions.className='zgmo-status-actions';var summary=document.createElement('summary');summary.textContent=t('Действия с состоянием','Дії зі станом');actions.appendChild(summary);
    var remove=footer&&footer.querySelector('button');if(remove)actions.appendChild(remove);
    body.appendChild(actions);card.replaceChildren(dismiss,heading,body);
    popup.onclick=function(ev){if(ev.target===popup)closeStatus(false);};dismiss.focus({preventScroll:true});
  }
  document.addEventListener('click',function(ev){if(ev.target.closest('#char-sheet-tab-bar'))closeStatus(true);},true);
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&document.querySelector('#status-info-popup.zgmo-status-dialog')){closeStatus(false);ev.preventDefault();}});
  function sync(){var source=document.getElementById('character-cloud-indicator'),dest=document.querySelector('.zgmo-sync'),persistent=document.getElementById('persistent-sheet-status');if(!dest)return;if(persistent&&!persistent.hidden){dest.dataset.state='linked';dest.title=persistent.textContent;dest.setAttribute('aria-label',persistent.textContent);}else if(source){dest.dataset.state=source.dataset.state;dest.title=source.title;dest.setAttribute('aria-label',source.getAttribute('aria-label'));}}
  // Reconcile the existing mobile tree so updates keep images, inputs and navigation alive.
  function patchNode(node,next){
    if(node.nodeType!==next.nodeType||node.nodeName!==next.nodeName){node.replaceWith(next.cloneNode(true));return;}
    if(node.nodeType!==1){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;return;}
    var focused=node===document.activeElement;
    Array.from(node.attributes).forEach(function(a){if(!next.hasAttribute(a.name))node.removeAttribute(a.name);});
    Array.from(next.attributes).forEach(function(a){if(!(focused&&a.name==='value')&&node.getAttribute(a.name)!==a.value)node.setAttribute(a.name,a.value);});
    if(node.tagName==='INPUT'&&!focused&&node.type!=='file'&&node.value!==next.value)node.value=next.value;
    var oldChildren=Array.from(node.childNodes),newChildren=Array.from(next.childNodes);
    newChildren.forEach(function(child,i){if(oldChildren[i])patchNode(oldChildren[i],child);else node.appendChild(child.cloneNode(true));});
    oldChildren.slice(newChildren.length).forEach(function(child){child.remove();});
  }
  function updateMarkup(container,html){
    var template=document.createElement('template');template.innerHTML=html;
    var children=Array.from(container.childNodes),next=Array.from(template.content.childNodes);
    next.forEach(function(node,i){if(children[i])patchNode(children[i],node);else container.appendChild(node.cloneNode(true));});
    children.slice(next.length).forEach(function(node){node.remove();});
  }
  function editingInput(){var el=document.activeElement;return el&&el.matches('input:not([type=file]),textarea')&&el.closest('.zgmo-overview,#zgmo-modal,#quick-temp-popup,#status-popup,#level-manager')?el:null;}
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
    lastView=view;
    if(c)previousHP={id:c.id,value:c.hpCur,temp:w.readTempHpTotal(c),percent:Math.max(0,Math.min(100,c.hpMax?c.hpCur/c.hpMax*100:0))};
    var modal=document.querySelector('#zgmo-modal[data-tools] .zgmo-modal-body');if(modal)updateMarkup(modal,toolsHTML);}
  function action(name,el){var c=character();if(name==='close'){close();return;}if(!c)return;
    if(name==='back'){setActive(false);w.zgCharBack();}
    else if(name==='temp')w.openQuickTemp(c.id,el.dataset.field);
    else if(name==='damage'||name==='heal'){close();w.changeHP(c.id,name==='damage'?-1:1);}
    else if(name==='level')w.openLevelManager(c.id);
    else if(name==='health')modal(t('Здоровье и эффекты','Здоров’я та ефекти'),toolsHTML).dataset.tools='true';
    else if(name==='prev'||name==='next'){pages[c.id]=Math.max(0,(pages[c.id]||0)+(name==='next'?1:-1));document.querySelector('.zgmo-states').outerHTML=states(c);var cards=document.querySelector('.zgmo-state-cards');if(!matchMedia('(prefers-reduced-motion:reduce)').matches&&cards.animate)cards.animate([{opacity:0,transform:'translateX('+(name==='next'?14:-14)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:230,easing:'cubic-bezier(.2,.8,.2,1)'});}
    else if(name==='status'){var state=effects(c)[Number(el.dataset.index)];if(state)openStatus(c,state,el);}
    else if(name==='add-status'){modal(t('Добавить состояние','Додати стан'),'<div class="zgmo-status-picker">'+w.ALL_STATUSES.map(function(st){return button('choose-status',tr(st.label),w.characterStatusGlyph(st,st.label,'character-status-icon')+' '+e(tr(st.label)),'data-key="'+e(st.key)+'"');}).join('')+'</div>');}
    else if(name==='choose-status'){close();w.toggleStatus(c.id,el.dataset.key);}
    else if(name==='vital'){var key=el.dataset.field,label=el.getAttribute('aria-label'),base=key==='speed'?w.parseSpeedNumber(c.speed):Number(c[key])||0;modal(label,'<label class="zgmo-vital-editor">'+e(label)+'<input type="number" data-vital="'+key+'" value="'+(base+w.readTempBonusTotal(c,key))+'"></label>'+button('temp',t('Временный эффект','Тимчасовий ефект'),'⌛ '+t('Временный эффект','Тимчасовий ефект'),'data-field="'+key+'"'));}
    else if(name==='menu')modal(t('Персонаж','Персонаж'),'<div class="zgmo-menu">'+button('edit',t('Редактировать персонажа','Редагувати персонажа'),t('Редактировать персонажа','Редагувати персонажа'))+button('portrait',t('Изменить портрет','Змінити портрет'),t('Изменить портрет','Змінити портрет'))+button('level',t('Уровень и развитие','Рівень і розвиток'),t('Уровень и развитие','Рівень і розвиток'))+button('health',t('Здоровье и эффекты','Здоров’я та ефекти'),t('Здоровье и эффекты','Здоров’я та ефекти'))+button('sync',t('Синхронизация','Синхронізація'),t('Синхронизация','Синхронізація'))+'</div>');
    else if(name==='edit'){close();setActive(false);w.openCharEditor(c.id);}
    else if(name==='portrait'){close();w.triggerPortraitUpload(c.id);}
    else if(name==='sync'){var toolbar=document.getElementById('persistent-sheet-status');close();if(toolbar&&!toolbar.hidden){var m=modal(t('Синхронизация','Синхронізація'),'');m.querySelector('.zgmo-modal-body').appendChild(toolbar);movedStatus=toolbar;}else{var lamp=document.getElementById('character-cloud-indicator');if(lamp)lamp.click();}}
  }
  document.addEventListener('click',function(ev){var el=ev.target.closest('[data-zgmo]');if(el)action(el.dataset.zgmo,el);});
  document.addEventListener('change',function(ev){var c=character(),el=ev.target;if(!c)return;if(el.dataset.stat)w.updateStatField(c.id,el.dataset.stat,'cur',el.value);if(el.dataset.vital){var val=Number(el.value)||0;if(el.dataset.vital==='initiative')val-=w.readTempBonusTotal(c,'initiative');w.updateSimpleField(c.id,el.dataset.vital,val);w.renderCharSheet();}});
  document.addEventListener('keydown',function(ev){var m=document.getElementById('zgmo-modal');if(!m)return;if(ev.key==='Escape'){close();ev.preventDefault();}if(ev.key==='Tab'){var a=Array.from(m.querySelectorAll('button,input,select,textarea,[tabindex="0"]')).filter(function(x){return !x.disabled&&x.getClientRects().length;});if(!a.length)return;var first=a[0],last=a[a.length-1];if(ev.shiftKey&&document.activeElement===first){last.focus();ev.preventDefault();}else if(!ev.shiftKey&&document.activeElement===last){first.focus();ev.preventDefault();}}});
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
  w.ZargotaMobileSheet={updateMarkup:updateMarkup,render:render,fame:fame,navIcon:navIcon,setActive:setActive,mounted:mounted,openTools:function(){action('health');},openMenu:function(){action('menu');}};
})(window);
