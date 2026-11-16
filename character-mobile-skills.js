/* Mobile skills groups. Traits and mastery share a view, not a storage schema. */
(function(w){
 'use strict';
 var current=null, views={}, dialogKey=null, returnFocus=null, refreshFrame=0, pending=null, detailTab='use', detailScroll={}, dialogDesktop=false, dialogDirty=false, skillGesture=null, suppressSkillClickUntil=0, artReturnFocus=null;
 var colors={kodex:'#c8d4dc',folio:'#5a9ae0',obrad:'#c03030'};
 var books={kodex:'codex',folio:'folio',obrad:'ritual'};
 function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
 function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function text(c,s,spell){return spell?w.catalogEntryText(spell,s||''):w.characterEntryText(c,s||'');}
 function char(){return (w.characters||[]).find(function(c){return String(c.id)===String(current);});}
 function view(){return views[current]||(views[current]={group:'learned',filter:'equipped',pages:{}});}
 function labels(){return {personal:t('Личные','Особисті'),learned:t('Каталог','Каталог'),features:t('Черты и мастерство','Риси й майстерність')};}
 function category(item,field){
  // Legacy traits live in both arrays. Positions/styles remain in Mastery.
  var explicit=String(item.type||'').toLowerCase(), name=String(item.name||'').replace(/^[^\p{L}]+/u,'').toLowerCase();
  if (/черта|риса|trait/.test(explicit)||/^(?:черта|риса)(?=[\s:—-]|$)/u.test(name))return 'traits';
  return field==='mastery'?'mastery':'personal';
 }
 function resource(item,c,spell){
  var raw=String(spell?item.cd||'':item.usages||''), match=raw.match(/(\d+)\s*(?:раз|заряд|применени|использован|застосуван|використан)/i);
  // Use the sheet's existing spell charge convention; preserve full recovery text.
  var max=spell?(raw?(match?Number(match[1]):1):0):Math.max(0,Number(item.cdMax)||0);
  var used=spell?Number(c.spellCD&&c.spellCD[item.id]&&c.spellCD[item.id].used)||0:Number(item.cdUsed)||0;
  used=Math.max(0,Math.min(max,used));return {max:max,used:used,remaining:max-used,text:raw};
 }
 function safeImage(value){value=String(value||'');return /^(?:images\/|assets\/|https?:\/\/|data:image\/|blob:|\.\.?\/)/i.test(value)?value:'';}
 function artwork(item,spell,visual){
  var art=w.ZargotaSpellArt,approved=art&&(spell?art.resolve(item):art.resolveCustom(item));
  if(approved)return {src:approved,scene:art.isScene(approved)};
  var own=['iconAsset','abilityIcon','iconImage','image','icon'].map(function(key){return safeImage(item[key]);}).find(Boolean);if(own)return {src:own,scene:true};
  if(spell){
   var name=String(item.name||'').toLowerCase(),key=/ответный шип/.test(name)?'thorn':/жар пальцев/.test(name)?'heat':/луч гнили/.test(name)?'rot':/огненный снаряд/.test(name)?'fire':'';
   if(key)return {src:'images/ui/mobile-skills/'+key+'-v1.png',scene:true};
   var profile=w.ZargotaSpellAutomation&&w.ZargotaSpellAutomation.resolve(item);
   return {src:profile&&profile.iconAsset||'images/ui/combat-generated/'+(books[item.spellType]||'folio')+'.png',scene:false};
  }
  return {src:visual.asset,scene:false};
 }
 function rows(c){
  var result=[],prepared=w.normalizePreparedSpellsForCharacter(c,{bootstrapLegacy:true}),equipped=new Set(Object.values(prepared).flat().map(String));
  ['skills','mastery'].forEach(function(field){(c[field]||[]).forEach(function(item,index){
   if(!item||typeof item!=='object')return;
   var visual=w.characterAbilityVisual(item,field),description=item.description||'';
   if(item.descByLevel){var levels=Object.keys(item.descByLevel).map(Number).filter(function(n){return n>0;}).sort(function(a,b){return a-b;}),level=levels.filter(function(n){return n<=(c.level||1);}).pop()||levels[0];if(level)description=item.descByLevel[level]||description;}
   result.push({key:field+'-'+index,field:field,index:index,item:item,group:category(item,field),name:w.characterAbilityDisplayName(text(c,item.name)),description:text(c,description),tone:visual.color,art:artwork(item,false,visual),resource:resource(item,c,false),type:text(c,item.type),passive:/пассив|пасив/i.test(item.type||'')});
  });});
  var seen=new Set();(c.spellRefs||[]).forEach(function(id){var item=w.findCharacterCatalogSpell(id);if(!item||seen.has(String(id)))return;seen.add(String(id));
   result.push({key:'spell-'+id,spell:true,item:item,group:'learned',name:w.characterAbilityDisplayName(text(c,item.name,item)),tone:colors[item.spellType]||'#c7a451',art:artwork(item,true),resource:resource(item,c,true),equipped:equipped.has(String(id)),learned:!!(c.spellsLearned&&c.spellsLearned[id]),type:({kodex:t('Боевой кодекс','Бойовий кодекс'),folio:t('Фолиант','Фоліант'),obrad:t('Обрядник','Обрядник')})[item.spellType]||''});
  });return result;
 }
 function button(action,label,body,attrs){return '<button type="button" data-zgms="'+action+'" aria-label="'+e(label)+'" '+(attrs||'')+'>'+body+'</button>';}
 function sourceLabel(row){return row.spell?row.type:({personal:t('Личный навык','Особиста навичка'),traits:t('Черта','Риса'),mastery:t('Мастерство','Майстерність')})[row.group];}
 function source(row){
  if(row.spell)return '<img src="images/ui/mobile-skills/source-'+(books[row.item.spellType]||'folio')+'-v2.png" alt="" draggable="false">';
  var kind=({personal:'personal',traits:'traits',mastery:'mastery'})[row.group]||'personal';
  return '<img src="images/ui/mobile-skills/source-'+kind+(kind==='traits'?'-v2.png':'-v1.png')+'" alt="" draggable="false">';
 }
 function recoveryLabel(usage,r){
  // Only remove an already-displayed leading charge count. Keep all limits and timing.
  var match=usage.match(/^\s*(\d+)\s+(?:раза|разів|рази|раз)(?=\s|$)\s*/i);
  return match&&Number(match[1])===r.max?usage.slice(match[0].length).replace(/^./,function(c){return c.toUpperCase();}):usage;
 }
 function cardResource(row,usage,status){
  var r=row.resource,counted=r.max&&(!row.spell||row.learned),label=e(status);
  if(counted)label=label.replace(/\d+/g,'<b class="zgms-usage-value">$&</b>');
  return (status?'<span class="zgms-resource'+(counted&&!r.remaining?' exhausted':'')+'">'+label+'</span>':'')+(usage?'<small>'+e(usage)+'</small>':'');
 }
 function card(c,row){
  var r=row.resource,usage=recoveryLabel(text(c,r.text,row.spell&&row.item),r),status=row.spell&&!row.learned?t('Ещё не изучено','Ще не вивчено'):r.max?t('Осталось ','Залишилось ')+r.remaining+t(' из ',' із ')+r.max:row.passive?t('Пассивная','Пасивна'):row.type;
  // The group and source icon already identify traits/mastery; do not repeat their label.
  if(!r.max&&/^(?:черта|риса|мастерство|майстерність)$/i.test(status))status='';
  if(usage.toLowerCase()===status.toLowerCase())usage='';
  var origin=sourceLabel(row),sameArt=row.spell&&row.art.src==='images/ui/combat-generated/'+(books[row.item.spellType]||'folio')+'.png';
  return button('card',[row.name,origin,status,usage].filter(Boolean).join(', '),'<span class="zgms-art '+(row.art.scene?'scene':'symbol')+'"><img src="'+e(row.art.src)+'" alt="" draggable="false">'+(sameArt?'':'<span class="zgms-source" role="img" aria-label="'+e(origin)+'" title="'+e(origin)+'" data-source="'+(row.spell?e(row.item.spellType):row.group)+'">'+source(row)+'</span>')+'</span><span class="zgms-copy"><strong>'+e(row.name||t('Без названия','Без назви'))+'</strong>'+cardResource(row,usage,status)+(row.equipped&&view().filter!=='equipped'?'<em>'+t('Экипировано','Споряджено')+'</em>':'')+'</span>','class="zgms-card'+(row.spell&&!row.learned?' is-unlearned':'')+'" data-key="'+e(row.key)+'" style="--tone:'+row.tone+'"');
 }
 function selected(c){var v=view();return rows(c).filter(function(row){var inGroup=v.group==='features'?(row.group==='traits'||row.group==='mastery'):row.group===v.group;return inGroup&&(row.group!=='learned'||(v.filter==='unlearned'?!row.learned:row.learned&&(v.filter==='all'||row.equipped)));}).sort(function(a,b){return Number(!!b.equipped)-Number(!!a.equipped);});}
 function content(c){
  var v=view(),all=selected(c),key=v.group+'-'+v.filter,count=Math.max(1,Math.ceil(all.length/4)),page=Math.min(v.pages[key]||0,count-1);v.pages[key]=page;
  var empty=v.group==='learned'?(v.filter==='equipped'?t('Пока нет экипированных способностей','Поки немає споряджених здібностей'):v.filter==='unlearned'?t('Нет неизученных записей','Немає невивчених записів'):t('Пока нет изученных способностей','Поки немає вивчених здібностей')):t('В этом разделе пока пусто','Цей розділ поки порожній');
  return '<div class="zgms-filter"'+(v.group==='learned'?'':' hidden')+'>'+['equipped','all','unlearned'].map(function(key){var label=key==='equipped'?t('Экипировано','Споряджено'):key==='all'?t('Изучено','Вивчено'):t('Не изучено','Не вивчено');return button('filter',label,label,'data-filter="'+key+'" aria-pressed="'+(v.filter===key)+'"');}).join('')+'</div><div class="zgms-grid" id="zgms-cards">'+(all.length?all.slice(page*4,page*4+4).map(function(row){return card(c,row);}).join(''):'<div class="zgms-empty"><span>◇</span><p>'+empty+'</p>'+(v.group==='learned'&&v.filter==='equipped'?'':button('add',t('Добавить способности','Додати здібності'),t('Добавить','Додати')))+'</div>')+'</div><div class="zgms-pagination">'+button('prev',t('Предыдущая страница','Попередня сторінка'),'‹',page?'':'disabled')+'<span aria-live="polite">'+(page+1)+' / '+count+'</span>'+button('next',t('Следующая страница','Наступна сторінка'),'›',page<count-1?'':'disabled')+'</div>';
 }
 function markup(c){var v=view(),names=labels();return '<section class="zgms-screen" data-zg-i18n-skip><header class="zgms-header">'+button('back',t('Назад к персонажам','Назад до персонажів'),'‹')+'<h1>'+t('Навыки','Навички')+'</h1>'+button('menu',t('Действия раздела','Дії розділу'),'⋯','aria-expanded="false"')+'</header><nav class="zgms-tabs" aria-label="'+t('Разделы навыков','Розділи навичок')+'">'+Object.keys(names).map(function(key){return button('group',names[key],names[key],'data-group="'+key+'" aria-pressed="'+(v.group===key)+'"');}).join('')+'</nav><div class="zgms-content">'+content(c)+'</div></section>';}
 function active(on,forceClose){document.body.classList.toggle('zg-skills-view',!!on);if(!on){if(forceClose||!dialogDesktop)close();document.querySelector('.zgms-menu')?.remove();}}
 function render(c){if(dialogKey&&String(current)!==String(c.id))close();current=c.id;return markup(c);}
 function refresh(after){
  if(!document.body.classList.contains('zg-skills-view')&&!dialogKey)return;
  cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(function(){var c=char(),root=document.querySelector('.zgms-screen');if(!c)return;if(root&&document.body.classList.contains('zg-skills-view'))w.ZargotaMobileSheet.updateMarkup(root.parentElement,markup(c));if(dialogKey)updateDialog();if(typeof after==='function')after();});
 }
 function page(delta){var v=view(),key=v.group+'-'+v.filter;v.pages[key]=Math.max(0,(v.pages[key]||0)+delta);refresh();requestAnimationFrame(function(){var grid=document.querySelector('.zgms-grid');if(grid&&!matchMedia('(prefers-reduced-motion:reduce)').matches)grid.animate([{opacity:.25,transform:'translateX('+(delta*10)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'ease-out'});});}
 function close(refreshSheet){closeArt(false);skillGesture=null;var redraw=refreshSheet&&dialogDesktop&&dialogDirty&&String(w.viewingCharId)===String(current);var dialog=document.getElementById('zgms-dialog');if(dialog)dialog.remove();dialogKey=null;dialogDesktop=false;dialogDirty=false;detailScroll={};if(redraw&&typeof w.renderCharSheet==='function')w.renderCharSheet();if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
 function spellMeta(c,sp){
  var categoryNames={damage:['Урон','Шкода'],aoe:['Область','Область'],control:['Контроль','Контроль'],defense:['Защита','Захист'],heal:['Исцеление','Зцілення'],buff:['Усиление','Посилення'],debuff:['Ослабление','Послаблення'],move:['Движение','Рух'],info:['Информация','Інформація'],illusion:['Иллюзии','Ілюзії'],support:['Вспомогательные','Допоміжні'],summon:['Призыв','Заклик'],transform:['Трансформация','Перетворення'],necro:['Некромантия','Некромантія'],curse:['Проклятия','Прокляття'],risk:['Риск','Ризик']};
  var damageNames={fire:['Огонь','Вогонь'],cold:['Холод','Холод'],elec:['Электро','Електро'],necro:['Некротика','Некротика'],holy:['Святой','Святий'],psych:['Психический','Психічний'],poison:['Яд','Отрута'],pierce:['Колющий','Колючий'],slash:['Рубящий','Рубальний'],blunt:['Дробящий','Дробильний'],acid:['Кислота','Кислота'],radiant:['Лучевой','Променевий'],chaos:['Хаос','Хаос'],sound:['Звуковой','Звуковий']};
  function tags(keys,registry,names,icon){return (keys||[]).map(function(key){var meta=registry.find(function(x){return x.key===key;}),name=names[key];return '<span class="zgms-spell-tag">'+(meta&&typeof icon==='function'?icon(meta):'')+e(name?t(name[0],name[1]):key)+'</span>';}).join('');}
  var cats=tags(sp.categories,typeof CATEGORIES==='undefined'?[]:CATEGORIES,categoryNames,w.catalogCategoryIcon),dmgs=tags(sp.damageTypes,typeof DAMAGE_TYPES==='undefined'?[]:DAMAGE_TYPES,damageNames,w.catalogDamageIcon);
  var extra=[sp.klasse,sp.tip].filter(Boolean).map(function(value){return '<span class="zgms-spell-tag zgms-spell-classification">'+e(text(c,value,sp))+'</span>';}).join('');
  return cats||dmgs||extra?'<div class="zgms-spell-metadata" aria-label="'+t('Метки каталога','Позначки каталогу')+'">'+(cats||extra?'<div>'+cats+extra+'</div>':'')+(dmgs?'<div><small>'+t('Типы урона:','Типи шкоди:')+'</small>'+dmgs+'</div>':'')+'</div>':'';
 }
 function detailIcon(kind){return kind==='close'?'<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>':'<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><g fill="currentColor"><circle cx="4" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="20" cy="12" r="1.7"/></g></svg>';}
 function closeArt(restoreFocus){
  var viewer=document.getElementById('zgms-art-viewer');if(viewer){viewer.close();viewer.remove();}
  if(restoreFocus&&artReturnFocus&&artReturnFocus.isConnected)artReturnFocus.focus({preventScroll:true});artReturnFocus=null;
 }
 function previewArt(source){
  var c=char(),row=c&&rows(c).find(function(x){return x.key===dialogKey;});if(!row)return;
  closeArt(false);skillGesture=null;artReturnFocus=source;
  var helper=w.ZargotaSpellDetailContent,captionItem=row.spell?row.item:Object.assign({},row.item,{description:row.description}),caption=helper.artCaption(captionItem,function(value){return !row.spell&&value===row.description?value:text(c,value,row.spell&&row.item);}),viewer=document.createElement('dialog');
  viewer.id='zgms-art-viewer';viewer.setAttribute('data-zg-i18n-skip','');viewer.setAttribute('aria-labelledby','zgms-art-title');
  viewer.innerHTML=button('close-art',t('Закрыть изображение','Закрити зображення'),detailIcon('close'),'autofocus')+'<figure><img src="'+e(row.art.src)+'" alt="'+e(row.name)+'" draggable="false"><figcaption><h2 id="zgms-art-title">'+e(row.name)+'</h2>'+(caption?'<blockquote>«'+e(caption)+'»</blockquote>':'')+'</figcaption></figure>';
  viewer.addEventListener('cancel',function(ev){ev.preventDefault();closeArt(true);});
  viewer.addEventListener('keydown',function(ev){ev.stopPropagation();if(ev.key==='Escape'){ev.preventDefault();closeArt(true);}else if(ev.key==='Tab'){ev.preventDefault();viewer.querySelector('[data-zgms=close-art]').focus({preventScroll:true});}});
  document.body.appendChild(viewer);viewer.showModal();
 }
 function detailHeading(row,classification,extra,disabled){return '<header><div class="zgms-spell-heading">'+button('preview-art',t('Открыть рисунок: ','Відкрити зображення: ')+row.name,'<img alt="" src="'+e(row.art.src)+'" draggable="false">','class="zgms-detail-art '+(row.art.scene?'scene':'symbol')+'" aria-haspopup="dialog"')+'<div class="zgms-heading-copy"><h2 id="zgms-detail-title">'+e(row.name)+'</h2><span class="zgms-detail-type">'+e(classification)+'</span>'+extra+'</div></div>'+button('detail-menu',t('Действия способности','Дії здібності'),detailIcon('menu'),'aria-expanded="false"'+disabled)+button('close',t('Закрыть','Закрити'),detailIcon('close'))+'</header>';}
 function spellDetails(c,row){
  var helper=w.ZargotaSpellDetailContent,r=row.resource,sp=row.item,tx=function(value){return text(c,value,sp);},fields=helper.sections(sp,tx,t),busy=!!(pending&&String(pending.id)===String(c.id)&&pending.key===row.key),disabled=busy?' disabled aria-busy="true"':'',usage=tx(r.text),school=tx(sp.school==='custom'?sp.schoolCustom:sp.school),requirements=helper.requirements(tx(sp.restriction)),learned=row.learned,empty=t('В каталоге пока нет описания этого раздела.','У каталозі поки немає опису цього розділу.'),tabs=[['use',t('Применение','Застосування')],['learn',t('Изучение','Вивчення')],['description',t('Описание','Опис')]];
  var compact=!!(w.matchMedia&&w.matchMedia('(max-width:899px)').matches);
  var meter=r.max?'<div class="zgms-charges'+(!r.remaining?' exhausted':'')+'"><div class="zgms-charge-copy"><span>'+t('Осталось','Залишилось')+' <strong aria-live="polite">'+r.remaining+' / '+r.max+'</strong></span><small>'+e(usage)+'</small></div><div class="zgms-use-pips" aria-hidden="true">'+Array.from({length:Math.min(r.max,10)},function(_,i){return '<span'+(i>=r.remaining?' class="spent"':'')+'></span>';}).join('')+'</div></div>':'<p class="zgms-usage-note">'+t('Лимит использований не указан.','Ліміт використань не зазначено.')+'</p>';
  var learningAction=learned?button('equip',row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити'),row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити'),'class="zgms-study-primary"'+disabled):button('learn',t('Отметить изученным','Позначити вивченим'),t('Отметить изученным','Позначити вивченим'),'class="zgms-study-primary"'+disabled);
  var tabContent={use:meter+spellMeta(c,sp)+(helper.rules(fields.use)||'<p>'+empty+'</p>'),learn:(helper.rules(fields.learn)||'<p>'+empty+'</p>')+'<div class="zgms-learning-actions"><small>'+t('Отметьте изучение после выполнения условий.','Позначте вивчення після виконання умов.')+'</small></div>',description:'<div class="zgms-description-art"><img src="'+e(row.art.src)+'" alt="'+e(row.name)+'"></div>'+(helper.rules(fields.description)||'<p>'+empty+'</p>')};
  var applyLabel=!learned?t('Перейти к изучению','Перейти до вивчення'):!r.max?t('Нет счётчика использований','Немає лічильника використань'):!r.remaining?t('На восстановлении','На відновленні'):t('Применить','Застосувати');
  var apply=button(!learned?'study-tab':'spend',applyLabel,applyLabel,'class="zgms-apply"'+disabled+(learned&&(!r.max||!r.remaining)?' disabled':'')+(learned?'':' data-unlearned="true"'));
  var hint=!learned?t('Сначала изучите способность.','Спочатку вивчіть здібність.'):r.max?(r.remaining?t('Учитывает одно использование.','Враховує одне використання.')+' '+(r.max===1?t('Осталось 1.','Залишилось 1.'):t('Осталось ','Залишилось ')+r.remaining+' / '+r.max):usage):t('Правила применения — во вкладке выше.','Правила застосування — у вкладці вище.');
  var status='<div class="zgms-spell-status">'+(compact?'<span class="zgms-study-state" data-learned="'+learned+'">'+(learned?t('Изучено','Вивчено'):t('Не изучено','Не вивчено'))+'</span>':button('study-tab',t('Статус изучения: ','Стан вивчення: ')+(learned?t('Изучено','Вивчено'):t('Не изучено','Не вивчено')),learned?t('Изучено','Вивчено'):t('Не изучено','Не вивчено'),'class="zgms-study-state" data-learned="'+learned+'"'))+(row.equipped?'<span class="zgms-equipped-label">'+t('Экипировано','Споряджено')+'</span>':'')+'</div>';
  var actionPanel='';
  if(compact){
   var compactLabel=!learned?t('К изучению','До вивчення'):r.max&&!r.remaining?t('Нет зарядов','Немає зарядів'):t('Применить','Застосувати');
   var compactApply=button(!learned?'study-tab':'spend',compactLabel,compactLabel,'class="zgms-apply"'+disabled+(learned&&(!r.max||!r.remaining)?' disabled':'')+(learned?'':' data-unlearned="true"'));
   var compactMeter=learned&&r.max?'<div class="zgms-charges'+(!r.remaining?' exhausted':'')+'"><div class="zgms-charge-copy"><span>'+t('Осталось','Залишилось')+'</span><strong aria-live="polite">'+r.remaining+' / '+r.max+'</strong></div></div>':'';
   var compactRecovery=learned?recoveryLabel(usage,r):usage;
   actionPanel='<footer class="zgms-compact-actions"'+(detailTab==='use'?'':' hidden')+'>'+compactApply+compactMeter+(compactRecovery?'<small class="zgms-recovery-note'+(compactRecovery.length>32?' is-long':'')+'">'+e(compactRecovery)+'</small>':'')+'</footer>';
   tabContent.use=spellMeta(c,sp)+(helper.rules(fields.use)||'<p>'+empty+'</p>');
   tabContent.learn='<div class="zgms-learning-summary">'+status+learningAction+'</div>'+(school?'<p class="zgms-learning-source">'+t('Источник: ','Джерело: ')+e(school)+'</p>':'')+(helper.rules(fields.learn)||'<p>'+empty+'</p>');
   tabContent.description=helper.rules(fields.description.map(function(field){return field.heading===t('Описание','Опис')?{heading:'',body:field.body}:field;}))||'<p>'+empty+'</p>';
  }
  return detailHeading(row,row.type+(sp.level?' · '+t('Ур. ','Рів. ')+sp.level:''),(!compact&&school?'<small class="zgms-detail-school">'+e(school)+'</small>':'')+(!compact&&requirements.length?'<div class="zgms-requirements">'+requirements.map(helper.highlight).join(' · ')+'</div>':''),disabled)+
   (compact?'':status)+
   '<nav class="zgms-detail-tabs" role="tablist" aria-label="'+t('Разделы заклинания','Розділи заклинання')+'">'+tabs.map(function(tab){return button('detail-tab',tab[1],tab[1],'id="zgms-tab-'+tab[0]+'" role="tab" data-tab="'+tab[0]+'" aria-controls="zgms-panel-'+tab[0]+'" aria-selected="'+(detailTab===tab[0])+'" tabindex="'+(detailTab===tab[0]?'0':'-1')+'"');}).join('')+'</nav>'+actionPanel+
   '<div class="zgms-detail-body">'+tabs.map(function(tab){return '<section class="zgms-tab-panel" id="zgms-panel-'+tab[0]+'" role="tabpanel" aria-labelledby="zgms-tab-'+tab[0]+'" tabindex="0"'+(detailTab===tab[0]?'':' hidden')+'>'+tabContent[tab[0]]+'</section>';}).join('')+'</div>'+
   (compact?'':'<footer class="zgms-use-footer">'+(detailTab==='learn'?learningAction:apply)+'<small aria-live="polite">'+e(detailTab==='learn'?(learned?t('Экипировка занимает слот соответствующего типа.','Спорядження займає слот відповідного типу.'):t('После выполнения условий изучения.','Після виконання умов вивчення.')):hint)+'</small></footer>');
 }
 function selectDetailTab(tab,focus){
  if(!['use','learn','description'].includes(tab))return;
  var body=document.querySelector('#zgms-dialog .zgms-detail-body');if(body)detailScroll[detailTab]=body.scrollTop;detailTab=tab;updateDialog();
  body=document.querySelector('#zgms-dialog .zgms-detail-body');if(body)body.scrollTop=detailScroll[tab]||0;
  if(focus)document.getElementById('zgms-tab-'+tab)?.focus({preventScroll:true});
 }
 function abilityDetails(c,row){
  var helper=w.ZargotaSpellDetailContent,r=row.resource,busy=!!(pending&&String(pending.id)===String(c.id)&&pending.key===row.key),disabled=busy?' disabled aria-busy="true"':'',usage=recoveryLabel(text(c,r.text),r);
  var rules=w.characterAbilityRulesHtml(row.description,row.item);
  var origin=sourceLabel(row),classification=origin+(row.type&&row.type!==origin?' · '+row.type:'')+(row.item.descByLevel?' · '+t('Ур. ','Рів. ')+(c.level||1):'');
  var charges=r.max?'<div class="zgms-charges zgms-simple-charges'+(!r.remaining?' exhausted':'')+'">'+button('spend',t('Потратить использование','Витратити використання'),'−',disabled+(r.remaining?'':' disabled'))+'<div class="zgms-charge-copy"><span>'+t('Осталось','Залишилось')+' <strong aria-live="polite">'+r.remaining+' / '+r.max+'</strong></span>'+(usage?'<small>'+e(usage)+'</small>':'')+'</div>'+button('restore',t('Вернуть использование','Повернути використання'),'＋',disabled+(r.used?'':' disabled'))+'</div>':'';
  return detailHeading(row,classification,'',disabled)+charges+'<div class="zgms-detail-body">'+(!r.max&&usage?'<p class="zgms-simple-note">'+e(usage)+'</p>':'')+'<div class="zgms-rules">'+rules+'</div></div>';
 }
 function details(c,row){
  if(w.ZargotaSpellDetailContent)return row.spell?spellDetails(c,row):abilityDetails(c,row);
  var fields=row.spell?[[t('Эффект','Ефект'),row.item.effect],[t('Бой','Бій'),row.item.battle],[t('Проявление','Прояв'),row.item.manifestation],[t('Описание','Опис'),row.item.description],[t('Обучение','Навчання'),row.item.learnText],[t('Ограничения','Обмеження'),row.item.restriction]].concat((row.item.optFields||[]).map(function(f){return [text(c,f.label,row.item),f.text];})):[];
  var r=row.resource,usage=recoveryLabel(text(c,r.text,row.spell&&row.item),r),seen=new Set();
  var rules=row.spell?fields.filter(function(f){if(!f[1])return false;var value=text(c,f[1],row.item).trim();if(seen.has(value))return false;seen.add(value);return true;}).map(function(f){return '<section class="zgms-rule"><h3>'+e(f[0])+'</h3><p>'+e(text(c,f[1],row.item))+'</p></section>';}).join(''):'<div class="zgms-rules">'+w.characterAbilityRulesHtml(row.description,row.item)+'</div>';
  var origin=sourceLabel(row),kind=row.type&&row.type!==origin?' · '+row.type:'';
  return '<header><h2>'+e(row.name)+'</h2>'+button('detail-menu',t('Действия способности','Дії здібності'),'⋯','aria-expanded="false"')+button('close',t('Закрыть','Закрити'),'×')+'</header>'+
   '<div class="zgms-detail-summary"><div class="zgms-detail-art '+(row.art.scene?'scene':'symbol')+'"><img alt="" src="'+e(row.art.src)+'"></div><div><span class="zgms-detail-type">'+e(origin+kind)+'</span>'+(row.item.descByLevel?'<small>'+t('На уровне персонажа: ','На рівні персонажа: ')+e(c.level||1)+'</small>':'')+(!r.max&&usage?'<small>'+e(usage)+'</small>':'')+'</div></div>'+
   (r.max&&(!row.spell||row.learned)?'<div class="zgms-charges'+(!r.remaining?' exhausted':'')+'">'+button('spend',t('Потратить использование','Витратити використання'),'−',r.remaining?'':'disabled')+'<div class="zgms-charge-copy"><span>'+t('Осталось','Залишилось')+' <strong aria-live="polite">'+r.remaining+' / '+r.max+'</strong></span>'+(usage?'<small>'+e(usage)+'</small>':'')+(!r.remaining?'<small class="zgms-exhausted-label">'+t('Всё потрачено','Усе витрачено')+'</small>':'')+'</div>'+button('restore',t('Вернуть использование','Повернути використання'),'＋',r.used?'':'disabled')+'</div>':'')+
   '<div class="zgms-detail-body">'+rules+'</div>'+(row.spell?'<footer class="zgms-study-actions"><span class="zgms-study-state" aria-live="polite">'+(row.equipped?t('Экипировано','Споряджено'):row.learned?t('Изучено','Вивчено'):t('Ещё не изучено','Ще не вивчено'))+'</span>'+button(row.learned?'equip':'learn',row.learned?(row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити')):t('Изучить','Вивчити'),'<span aria-hidden="true">'+(row.learned?(row.equipped?'◇':'◆'):'✦')+'</span> '+(row.learned?(row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити')):t('Изучить','Вивчити')),'class="zgms-study-primary"'+(pending&&String(pending.id)===String(c.id)&&pending.key===row.key?' disabled aria-busy="true"':''))+'</footer>':'');
 }
 function updateDialog(){var c=char(),row=c&&rows(c).find(function(x){return x.key===dialogKey;}),panel=document.querySelector('#zgms-dialog>section');if(!panel)return;if(!row){close();return;}var reading=!!w.ZargotaSpellDetailContent;if(reading)panel.setAttribute('aria-labelledby','zgms-detail-title');else panel.removeAttribute('aria-labelledby');panel.classList.toggle('zgms-spell-panel',reading);panel.classList.toggle('zgms-simple-panel',reading&&!row.spell);panel.classList.toggle('is-unlearned',!!row.spell&&!row.learned);panel.parentElement.classList.toggle('zgms-spell-dialog',reading);panel.setAttribute('aria-busy',String(!!(pending&&String(pending.id)===String(c.id)&&pending.key===row.key)));w.ZargotaMobileSheet.updateMarkup(panel,details(c,row));panel.style.setProperty('--tone',row.tone);}
 function open(key,source){close();dialogKey=key;detailTab='use';dialogDesktop=innerWidth>=900;returnFocus=source;var el=document.createElement('div');el.id='zgms-dialog';el.setAttribute('data-zg-i18n-skip','');el.innerHTML='<section role="dialog" aria-modal="true" aria-label="'+t('Описание способности','Опис здібності')+'"></section>';el.addEventListener('click',function(ev){if(ev.target===el)close(true);});document.body.appendChild(el);updateDialog();var dismiss=el.querySelector('[data-zgms=close]');if(dismiss)dismiss.focus({preventScroll:true});}
 function openSpell(charId,spellId){var target=(w.characters||[]).find(function(c){return String(c.id)===String(charId);});if(!target)return false;var row=rows(target).find(function(r){return r.spell&&String(r.item.id)===String(spellId);});if(!row||!w.ZargotaSpellDetailContent)return false;close();current=target.id;open(row.key,document.activeElement);return true;}
 function menu(source,detail){
  var old=document.querySelector('.zgms-menu');if(old){old.remove();source.setAttribute('aria-expanded','false');return;}
  var c=char(),row=detail&&rows(c).find(function(x){return x.key===dialogKey;}),el=document.createElement('div');el.className='zgms-menu';el.setAttribute('data-zg-i18n-skip','');
  if(row)el.innerHTML=row.spell?(row.learned&&row.resource.used?button('restore',t('Вернуть одно использование','Повернути одне використання'),t('Вернуть одно использование','Повернути одне використання')):'')+(row.learned?button('forget',t('Забыть','Забути'),t('Забыть','Забути')):'')+button('remove',t('Убрать из листа','Прибрати з аркуша'),t('Убрать из листа','Прибрати з аркуша')):button('edit',t('Редактировать','Редагувати'),t('Редактировать','Редагувати'))+button('remove',t('Удалить','Видалити'),t('Удалить','Видалити'));
  else el.innerHTML=view().group==='features'?button('add-trait',t('Добавить черту','Додати рису'),t('Добавить черту','Додати рису'))+button('add-mastery',t('Добавить мастерство','Додати майстерність'),t('Добавить мастерство','Додати майстерність')):button('add',t('Добавить','Додати'),view().group==='learned'?t('Добавить из каталога','Додати з каталогу'):t('Добавить запись','Додати запис'));
  source.setAttribute('aria-expanded','true');source.parentElement.appendChild(el);
 }
 function editorOptions(c,field){return {onSave:function(item){var index=(c[field]||[]).indexOf(item),key=field+'-'+index,v=view();if(index>=0)v.pages[v.group+'-'+v.filter]=Math.floor(Math.max(0,selected(c).findIndex(function(row){return row.key===key;}))/4);refresh();if(index>=0)open(key,null);}};}
 function add(kind,source){var c=char(),group=kind||view().group;if(group==='features'){menu(source,false);return;}if(group==='learned'){view().filter='unlearned';view().pages['learned-unlearned']=0;refresh();w.openSpellPicker(c.id);return;}
  var field=group==='personal'?'skills':'mastery';if(!c[field])c[field]=[];
  c[field].push({name:'',description:'',type:group==='traits'?'Черта':group==='mastery'?'Мастерство':'Активный',usages:'',cdMax:0,cdUsed:0});w.openSkillCardPopup(c.id,field,c[field].length-1,editorOptions(c,field));
 }
 async function mutate(action){
  if(pending)return;
  var c=char();if(!c)return;var row=rows(c).find(function(x){return x.key===dialogKey;});if(!row)return;var item=row.item,r=row.resource;
  if(action==='edit'){close();w.openSkillCardPopup(c.id,row.field,row.index,editorOptions(c,row.field));var popup=document.getElementById('skill-card-popup');if(popup&&popup.dataset.mode!=='edit')popup.querySelector('.sc-edit-btn')?.click();return;}
  if(action==='remove'){
   if(!w.confirm(t('Убрать «','Прибрати «')+row.name+t('» из листа?','» з аркуша?')))return;
   close();if(row.spell)w.removeSpellRef(c.id,item.id);else w.removeListItem(c.id,row.field,row.index);refresh();return;
  }
  var snapshot={preparedSpells:c.preparedSpells&&JSON.parse(JSON.stringify(c.preparedSpells)),spellsLearned:c.spellsLearned&&Object.assign({},c.spellsLearned),spellCD:c.spellCD&&JSON.parse(JSON.stringify(c.spellCD)),cdUsed:item.cdUsed};
  if(action==='equip'){
   if(!row.learned)return;
   var prepared=w.ensurePreparedSpellsForCharacter(c),type=item.spellType,list=prepared[type];if(!list)return;
   if(row.equipped)prepared[type]=list.filter(function(id){return String(id)!==String(item.id);});
   else {if(list.length>=w.getPreparedSpellTypeLimitForCharacter(c,type)){w.showToast(t('Все слоты этого типа заняты','Усі слоти цього типу зайняті'));return;}list.push(String(item.id));}
   c.preparedSpells=prepared;
  }else if(action==='learn'||action==='forget'){
   if(action==='learn'&&row.learned||action==='forget'&&!row.learned)return;
   c.spellsLearned=c.spellsLearned||{};if(action==='forget')delete c.spellsLearned[item.id];else c.spellsLearned[item.id]=true;w.ensurePreparedSpellsForCharacter(c);
  }else if(action==='spend'||action==='restore'){
   if(row.spell&&!row.learned)return;
   if(!r.max||(action==='spend'&&!r.remaining)||(action==='restore'&&!r.used))return;
   var used=Math.max(0,Math.min(r.max,r.used+(action==='spend'?1:-1)));
   if(row.spell){c.spellCD=c.spellCD||{};c.spellCD[item.id]=Object.assign({},c.spellCD[item.id]||{},{used:used});}
   else item.cdUsed=used;
  }else return;
  pending={id:c.id,key:row.key};
  updateDialog();
  var saved;try{saved=await w.saveChars();}catch(error){saved={ok:false};}
  pending=null;
  function refreshClosedDesktop(){if(!dialogKey&&innerWidth>=900&&String(w.viewingCharId)===String(c.id)&&typeof w.renderCharSheet==='function')w.renderCharSheet();}
  if(saved&&saved.ok===false){
   ['preparedSpells','spellsLearned','spellCD'].forEach(function(field){if(snapshot[field]===undefined)delete c[field];else c[field]=snapshot[field];});
   if(snapshot.cdUsed===undefined)delete item.cdUsed;else item.cdUsed=snapshot.cdUsed;
   if(w.showToast)w.showToast(t('Не удалось сохранить изменение. Попробуйте ещё раз.','Не вдалося зберегти зміну. Спробуйте ще раз.'));
   refreshClosedDesktop();refresh();return;
  }
  refreshClosedDesktop();
  if(String(current)===String(c.id)&&dialogKey===row.key)dialogDirty=true;
  if(String(current)===String(c.id)&&(action==='learn'||action==='forget')){
   view().filter=action==='learn'?'all':'unlearned';
   // Follow the learned card instead of leaving a seemingly empty old collection.
   view().pages['learned-'+view().filter]=Math.floor(Math.max(0,selected(c).findIndex(function(x){return x.key===row.key;}))/4);
  }
  refresh(function(){if(String(current)===String(c.id)&&dialogKey===row.key&&(action==='learn'||action==='equip'))celebrate(action);});
 }
 function celebrate(action){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  var panel=document.querySelector('#zgms-dialog>section'),art=panel&&panel.querySelector('.zgms-detail-art'),control=panel&&panel.querySelector('.zgms-study-primary');
  if(art&&art.animate)art.animate([{filter:'brightness(1)',transform:'scale(1)'},{filter:'brightness(1.65)',transform:'scale(1.09)'},{filter:'brightness(1)',transform:'scale(1)'}],{duration:action==='learn'?650:380,easing:'ease-out'});
  if(control&&control.animate)control.animate([{boxShadow:'0 0 0 0 #e5ba6455',filter:'brightness(1.3)'},{boxShadow:'0 0 24px 8px #e5ba6400',filter:'brightness(1)'}],{duration:650,easing:'ease-out'});
 }
 document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-zgms]');if(!b){if(!ev.target.closest('.zgms-menu')){document.querySelector('.zgms-menu')?.remove();document.querySelectorAll('[data-zgms][aria-expanded=true]').forEach(function(x){x.setAttribute('aria-expanded','false');});}return;}
  if(b.disabled)return;var action=b.dataset.zgms;if(action!=='menu'&&action!=='detail-menu'){document.querySelector('.zgms-menu')?.remove();document.querySelectorAll('[data-zgms][aria-expanded=true]').forEach(function(x){x.setAttribute('aria-expanded','false');});}
  if(action==='group'){view().group=b.dataset.group;refresh();}
  else if(action==='filter'){view().filter=b.dataset.filter;refresh();}
  else if(action==='all'){view().filter='all';refresh();}
  else if(action==='unlearned'){view().filter='unlearned';refresh();}
  else if(action==='prev'||action==='next')page(action==='prev'?-1:1);
  else if(action==='card')open(b.dataset.key,b);
  else if(action==='preview-art')previewArt(b);
  else if(action==='close-art')closeArt(true);
  else if(action==='detail-tab')selectDetailTab(b.dataset.tab,false);
  else if(action==='study-tab')selectDetailTab('learn',true);
  else if(action==='back')w.zgCharBack();
  else if(action==='menu'||action==='detail-menu')menu(b,action==='detail-menu');
  else if(action==='close')close(true);else if(action==='add'||action==='add-trait'||action==='add-mastery')add(action==='add-trait'?'traits':action==='add-mastery'?'mastery':null,b);else mutate(action);
 });
 // A deliberate horizontal drag pages the card collection without opening a card.
 document.addEventListener('touchstart',function(ev){
  var grid=ev.target.closest('.zgms-grid'),touch=ev.touches[0],v=current&&view();
  skillGesture=grid&&innerWidth<900&&ev.touches.length===1&&!dialogKey&&!ev.target.closest('[data-zgms=add]')&&touch.clientX>20&&touch.clientX<innerWidth-20?{x:touch.clientX,y:touch.clientY,dx:0,dy:0,at:Date.now(),id:current,group:v.group,filter:v.filter}:null;
 },{passive:true});
 document.addEventListener('touchmove',function(ev){
  if(!skillGesture)return;if(ev.touches.length!==1){skillGesture=null;return;}
  var g=skillGesture;g.dx=ev.touches[0].clientX-g.x;g.dy=ev.touches[0].clientY-g.y;
  if(Math.abs(g.dy)>18&&Math.abs(g.dy)>Math.abs(g.dx)){skillGesture=null;return;}
  if(Math.abs(g.dx)>18&&Math.abs(g.dx)>Math.abs(g.dy)*1.5&&ev.cancelable)ev.preventDefault();
 },{passive:false});
 document.addEventListener('touchend',function(){
  var g=skillGesture;skillGesture=null;if(!g||dialogKey||g.id!==current||Date.now()-g.at>900||Math.abs(g.dx)<48||Math.abs(g.dx)<Math.abs(g.dy)*1.5)return;
  var c=char(),v=view();if(!c||g.group!==v.group||g.filter!==v.filter)return;
  suppressSkillClickUntil=Date.now()+400;var key=v.group+'-'+v.filter,count=Math.max(1,Math.ceil(selected(c).length/4)),delta=g.dx<0?1:-1,next=(v.pages[key]||0)+delta;
  if(next>=0&&next<count)page(delta);
 },{passive:true});
 document.addEventListener('touchcancel',function(){skillGesture=null;},{passive:true});
 document.addEventListener('click',function(ev){if(Date.now()<suppressSkillClickUntil&&ev.target.closest('.zgms-grid')){ev.preventDefault();ev.stopImmediatePropagation();}},true);
 document.addEventListener('keydown',function(ev){if(!dialogKey)return;var tab=ev.target.closest('[data-zgms=detail-tab]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){var ids=['use','learn','description'],i=ids.indexOf(detailTab);selectDetailTab(ids[ev.key==='Home'?0:ev.key==='End'?2:(i+(ev.key==='ArrowRight'?1:2))%3],true);ev.preventDefault();return;}if(ev.key==='Escape'){close(true);ev.preventDefault();}if(ev.key==='Tab'){var els=Array.from(document.querySelectorAll('#zgms-dialog button')).filter(function(el){return !el.disabled&&el.getClientRects().length;}),first=els[0],last=els[els.length-1];if(ev.shiftKey&&document.activeElement===first){last.focus();ev.preventDefault();}else if(!ev.shiftKey&&document.activeElement===last){first.focus();ev.preventDefault();}}});
 document.addEventListener('error',function(ev){var img=ev.target;if(img.tagName==='IMG'&&img.closest('.zgms-art,.zgms-detail-art')){img.hidden=true;}},true);
 if(w.matchMedia)w.matchMedia('(max-width:899px)').addEventListener('change',function(){if(dialogKey)refresh();});
 w.ZargotaMobileSkills={render:render,setActive:active,refresh:refresh,rows:rows,category:category,resource:resource,openSpell:openSpell};
})(window);
