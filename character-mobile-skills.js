/* Four-section mobile skills view. Uses existing character data and save/sync path. */
(function(w){
 'use strict';
 var current=null, views={}, dialogKey=null, returnFocus=null, refreshFrame=0;
 var colors={kodex:'#c8d4dc',folio:'#5a9ae0',obrad:'#c03030'};
 var books={kodex:'codex',folio:'folio',obrad:'ritual'};
 function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
 function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function text(c,s,spell){return spell?w.catalogEntryText(spell,s||''):w.characterEntryText(c,s||'');}
 function char(){return (w.characters||[]).find(function(c){return String(c.id)===String(current);});}
 function view(){return views[current]||(views[current]={group:'learned',filter:'equipped',pages:{}});}
 function labels(){return {personal:t('Личные','Особисті'),learned:t('Каталог','Каталог'),traits:t('Черты','Риси'),mastery:t('Мастерство','Майстерність')};}
 function category(item,field){
  // Legacy traits live in both arrays. Positions/styles remain in Mastery.
  var explicit=String(item.type||'').toLowerCase(), name=String(item.name||'').replace(/^[^\p{L}]+/u,'').toLowerCase();
  if (/черта|риса|trait/.test(explicit)||/^(?:черта|риса)(?=[\s:—-]|$)/u.test(name))return 'traits';
  return field==='mastery'?'mastery':'personal';
 }
 function resource(item,c,spell){
  var raw=String(spell?item.cd||'':item.usages||''), match=raw.match(/(\d+)\s*(?:раз|заряд)/i);
  // Use the sheet's existing spell charge convention; preserve full recovery text.
  var max=spell?(raw?(match?Number(match[1]):1):0):Math.max(0,Number(item.cdMax)||0);
  var used=spell?Number(c.spellCD&&c.spellCD[item.id]&&c.spellCD[item.id].used)||0:Number(item.cdUsed)||0;
  used=Math.max(0,Math.min(max,used));return {max:max,used:used,remaining:max-used,text:raw};
 }
 function safeImage(value){value=String(value||'');return /^(?:images\/|assets\/|https?:\/\/|data:image\/|blob:|\.\.?\/)/i.test(value)?value:'';}
 function artwork(item,spell,visual){
  var own=safeImage(item.iconAsset||item.abilityIcon||item.iconImage||item.image||item.icon);if(own)return {src:own,scene:false};
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
 function card(c,row){
  var r=row.resource,usage=recoveryLabel(text(c,r.text,row.spell&&row.item),r),status=r.max?t('Осталось ','Залишилось ')+r.remaining+t(' из ',' із ')+r.max:row.passive?t('Пассивная','Пасивна'):row.type;
  // The group and source icon already identify traits/mastery; do not repeat their label.
  if(!r.max&&/^(?:черта|риса|мастерство|майстерність)$/i.test(status))status='';
  if(usage.toLowerCase()===status.toLowerCase())usage='';
  var origin=sourceLabel(row),sameArt=row.spell&&row.art.src==='images/ui/combat-generated/'+(books[row.item.spellType]||'folio')+'.png';
  return button('card',row.name+', '+origin,'<span class="zgms-art '+(row.art.scene?'scene':'symbol')+'"><img src="'+e(row.art.src)+'" alt="" draggable="false">'+(sameArt?'':'<span class="zgms-source" role="img" aria-label="'+e(origin)+'" title="'+e(origin)+'" data-source="'+(row.spell?e(row.item.spellType):row.group)+'">'+source(row)+'</span>')+'</span><span class="zgms-copy"><strong>'+e(row.name||t('Без названия','Без назви'))+'</strong>'+(status?'<span class="zgms-resource'+(r.max&&!r.remaining?' exhausted':'')+'">'+e(status)+'</span>':'')+(usage?'<small>'+e(usage)+'</small>':'')+(row.equipped&&view().filter!=='equipped'?'<em>'+t('Экипировано','Споряджено')+'</em>':'')+'</span>','class="zgms-card" data-key="'+e(row.key)+'" style="--tone:'+row.tone+'"');
 }
 function selected(c){var v=view();return rows(c).filter(function(row){return row.group===v.group&&(row.group!=='learned'||(v.filter==='unlearned'?!row.learned:row.learned&&(v.filter==='all'||row.equipped)));}).sort(function(a,b){return Number(!!b.equipped)-Number(!!a.equipped);});}
 function content(c){
  var v=view(),all=selected(c),key=v.group+'-'+v.filter,count=Math.max(1,Math.ceil(all.length/4)),page=Math.min(v.pages[key]||0,count-1);v.pages[key]=page;
  var empty=v.group==='learned'?(v.filter==='equipped'?t('Пока нет экипированных способностей','Поки немає споряджених здібностей'):v.filter==='unlearned'?t('Нет неизученных записей','Немає невивчених записів'):t('Пока нет изученных способностей','Поки немає вивчених здібностей')):t('В этом разделе пока пусто','Цей розділ поки порожній');
  return '<div class="zgms-filter"'+(v.group==='learned'?'':' hidden')+'>'+['equipped','all','unlearned'].map(function(key){var label=key==='equipped'?t('Экипировано','Споряджено'):key==='all'?t('Изученные','Вивчені'):t('Не изучены','Не вивчені');return button('filter',label,label,'data-filter="'+key+'" aria-pressed="'+(v.filter===key)+'"');}).join('')+'</div><div class="zgms-grid" id="zgms-cards">'+(all.length?all.slice(page*4,page*4+4).map(function(row){return card(c,row);}).join(''):'<div class="zgms-empty"><span>◇</span><p>'+empty+'</p>'+button(v.group==='learned'&&v.filter==='equipped'?'all':'add',t('Добавить способности','Додати здібності'),v.group==='learned'&&v.filter==='equipped'?t('Открыть изученные','Відкрити вивчені'):t('Добавить','Додати'))+'</div>')+'</div><div class="zgms-pagination">'+button('prev',t('Предыдущая страница','Попередня сторінка'),'‹',page?'':'disabled')+'<span aria-live="polite">'+(page+1)+' / '+count+'</span>'+button('next',t('Следующая страница','Наступна сторінка'),'›',page<count-1?'':'disabled')+'</div>';
 }
 function markup(c){var v=view(),names=labels();return '<section class="zgms-screen" data-zg-i18n-skip><header class="zgms-header">'+button('back',t('Назад к персонажам','Назад до персонажів'),'‹')+'<h1>'+t('Навыки','Навички')+'</h1>'+button('menu',t('Действия раздела','Дії розділу'),'⋯','aria-expanded="false"')+'</header><nav class="zgms-tabs" aria-label="'+t('Разделы навыков','Розділи навичок')+'">'+Object.keys(names).map(function(key){return button('group',names[key],names[key],'data-group="'+key+'" aria-pressed="'+(v.group===key)+'"');}).join('')+'</nav><div class="zgms-content">'+content(c)+'</div></section>';}
 function active(on){document.body.classList.toggle('zg-skills-view',!!on);if(!on){close();document.querySelector('.zgms-menu')?.remove();}}
 function render(c){current=c.id;return markup(c);}
 function refresh(){
  if(!document.body.classList.contains('zg-skills-view'))return;
  cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(function(){var c=char(),root=document.querySelector('.zgms-screen');if(!c||!root)return;w.ZargotaMobileSheet.updateMarkup(root.parentElement,markup(c));if(dialogKey)updateDialog();});
 }
 function page(delta){var v=view(),key=v.group+'-'+v.filter;v.pages[key]=Math.max(0,(v.pages[key]||0)+delta);refresh();requestAnimationFrame(function(){var grid=document.querySelector('.zgms-grid');if(grid&&!matchMedia('(prefers-reduced-motion:reduce)').matches)grid.animate([{opacity:.25,transform:'translateX('+(delta*10)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'ease-out'});});}
 function close(){var dialog=document.getElementById('zgms-dialog');if(dialog)dialog.remove();dialogKey=null;if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
 function details(c,row){
  var fields=row.spell?[[t('Эффект','Ефект'),row.item.effect],[t('Бой','Бій'),row.item.battle],[t('Проявление','Прояв'),row.item.manifestation],[t('Описание','Опис'),row.item.description],[t('Обучение','Навчання'),row.item.learnText],[t('Ограничения','Обмеження'),row.item.restriction]].concat((row.item.optFields||[]).map(function(f){return [text(c,f.label,row.item),f.text];})):[];
  var r=row.resource,usage=recoveryLabel(text(c,r.text,row.spell&&row.item),r),seen=new Set();
  var rules=row.spell?fields.filter(function(f){if(!f[1])return false;var value=text(c,f[1],row.item).trim();if(seen.has(value))return false;seen.add(value);return true;}).map(function(f){return '<section class="zgms-rule"><h3>'+e(f[0])+'</h3><p>'+e(text(c,f[1],row.item))+'</p></section>';}).join(''):'<div class="zgms-rules">'+w.characterAbilityRulesHtml(row.description,row.item)+'</div>';
  var origin=sourceLabel(row),kind=row.type&&row.type!==origin?' · '+row.type:'';
  return '<header><h2>'+e(row.name)+'</h2>'+button('detail-menu',t('Действия способности','Дії здібності'),'⋯','aria-expanded="false"')+button('close',t('Закрыть','Закрити'),'×')+'</header>'+
   '<div class="zgms-detail-summary"><div class="zgms-detail-art '+(row.art.scene?'scene':'symbol')+'"><img alt="" src="'+e(row.art.src)+'"></div><div><span class="zgms-detail-type">'+e(origin+kind)+'</span>'+(row.item.descByLevel?'<small>'+t('На уровне персонажа: ','На рівні персонажа: ')+e(c.level||1)+'</small>':'')+(!r.max&&usage?'<small>'+e(usage)+'</small>':'')+'</div></div>'+
   (r.max?'<div class="zgms-charges'+(!r.remaining?' exhausted':'')+'">'+button('spend',t('Потратить использование','Витратити використання'),'−',r.remaining&&(!row.spell||row.learned)?'':'disabled')+'<div class="zgms-charge-copy"><span>'+t('Осталось','Залишилось')+' <strong aria-live="polite">'+r.remaining+' / '+r.max+'</strong></span>'+(usage?'<small>'+e(usage)+'</small>':'')+(!r.remaining?'<small class="zgms-exhausted-label">'+t('Всё потрачено','Усе витрачено')+'</small>':'')+'</div>'+button('restore',t('Вернуть использование','Повернути використання'),'＋',r.used?'':'disabled')+'</div>':'')+
   '<div class="zgms-detail-body">'+rules+'</div>';
 }
 function updateDialog(){var c=char(),row=c&&rows(c).find(function(x){return x.key===dialogKey;}),panel=document.querySelector('#zgms-dialog>section');if(!panel)return;if(!row){close();return;}w.ZargotaMobileSheet.updateMarkup(panel,details(c,row));panel.style.setProperty('--tone',row.tone);}
 function open(key,source){close();dialogKey=key;returnFocus=source;var el=document.createElement('div');el.id='zgms-dialog';el.setAttribute('data-zg-i18n-skip','');el.innerHTML='<section role="dialog" aria-modal="true" aria-label="'+t('Описание способности','Опис здібності')+'"></section>';el.addEventListener('click',function(ev){if(ev.target===el)close();});document.body.appendChild(el);updateDialog();var dismiss=el.querySelector('[data-zgms=close]');if(dismiss)dismiss.focus({preventScroll:true});}
 function menu(source,detail){
  var old=document.querySelector('.zgms-menu');if(old){old.remove();source.setAttribute('aria-expanded','false');return;}
  var c=char(),row=detail&&rows(c).find(function(x){return x.key===dialogKey;}),el=document.createElement('div');el.className='zgms-menu';el.setAttribute('data-zg-i18n-skip','');
  if(row)el.innerHTML=row.spell?button('equip',row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити'),row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити'),row.learned?'':'disabled')+button('learn',t('Изучение','Вивчення'),row.learned?t('Забыть','Забути'):t('Изучить','Вивчити'))+button('remove',t('Убрать из листа','Прибрати з аркуша'),t('Убрать из листа','Прибрати з аркуша')):button('edit',t('Редактировать','Редагувати'),t('Редактировать','Редагувати'))+button('remove',t('Удалить','Видалити'),t('Удалить','Видалити'));
  else el.innerHTML=button('add',t('Добавить','Додати'),view().group==='learned'?t('Добавить из каталога','Додати з каталогу'):t('Добавить запись','Додати запис'))+(view().group==='learned'?button('unlearned',t('Ещё не изучены','Ще не вивчені'),t('Ещё не изучены','Ще не вивчені')):'');
  source.setAttribute('aria-expanded','true');source.parentElement.appendChild(el);
 }
 function editorOptions(c,field){return {onSave:function(item){var index=(c[field]||[]).indexOf(item);refresh();if(index>=0)open(field+'-'+index,null);}};}
 function add(){var c=char(),group=view().group;if(group==='learned'){view().filter='unlearned';view().pages['learned-unlearned']=0;refresh();w.openSpellPicker(c.id);return;}
  var field=group==='personal'?'skills':'mastery';if(!c[field])c[field]=[];
  c[field].push({name:'',description:'',type:group==='traits'?'Черта':group==='mastery'?'Мастерство':'Активный',usages:'',cdMax:0,cdUsed:0});w.openSkillCardPopup(c.id,field,c[field].length-1,editorOptions(c,field));
 }
 function mutate(action){
  var c=char(),row=rows(c).find(function(x){return x.key===dialogKey;});if(!row)return;var item=row.item,r=row.resource;
  if(action==='edit'){close();w.openSkillCardPopup(c.id,row.field,row.index,editorOptions(c,row.field));var popup=document.getElementById('skill-card-popup');if(popup&&popup.dataset.mode!=='edit')popup.querySelector('.sc-edit-btn')?.click();return;}
  if(action==='remove'){
   if(!w.confirm(t('Убрать «','Прибрати «')+row.name+t('» из листа?','» з аркуша?')))return;
   close();if(row.spell)w.removeSpellRef(c.id,item.id);else w.removeListItem(c.id,row.field,row.index);refresh();return;
  }
  if(action==='equip'){
   if(!row.learned)return;
   var prepared=w.ensurePreparedSpellsForCharacter(c),type=item.spellType,list=prepared[type];if(!list)return;
   if(row.equipped)prepared[type]=list.filter(function(id){return String(id)!==String(item.id);});
   else {if(list.length>=w.getPreparedSpellTypeLimitForCharacter(c,type)){w.showToast(t('Все слоты этого типа заняты','Усі слоти цього типу зайняті'));return;}list.push(String(item.id));}
   c.preparedSpells=prepared;
  }else if(action==='learn'){
   c.spellsLearned=c.spellsLearned||{};if(row.learned)delete c.spellsLearned[item.id];else c.spellsLearned[item.id]=true;w.ensurePreparedSpellsForCharacter(c);
  }else if(action==='spend'||action==='restore'){
   if(row.spell&&!row.learned)return;
   var used=Math.max(0,Math.min(r.max,r.used+(action==='spend'?1:-1)));
   if(row.spell){c.spellCD=c.spellCD||{};c.spellCD[item.id]=Object.assign({},c.spellCD[item.id]||{},{used:used});}
   else item.cdUsed=used;
  }else return;
  w.saveChars();refresh();
 }
 document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-zgms]');if(!b){if(!ev.target.closest('.zgms-menu')){document.querySelector('.zgms-menu')?.remove();document.querySelectorAll('[data-zgms][aria-expanded=true]').forEach(function(x){x.setAttribute('aria-expanded','false');});}return;}
  var action=b.dataset.zgms;if(action!=='menu'&&action!=='detail-menu'){document.querySelector('.zgms-menu')?.remove();document.querySelectorAll('[data-zgms][aria-expanded=true]').forEach(function(x){x.setAttribute('aria-expanded','false');});}
  if(action==='group'){view().group=b.dataset.group;refresh();}
  else if(action==='filter'){view().filter=b.dataset.filter;refresh();}
  else if(action==='all'){view().filter='all';refresh();}
  else if(action==='unlearned'){view().filter='unlearned';refresh();}
  else if(action==='prev'||action==='next')page(action==='prev'?-1:1);
  else if(action==='card')open(b.dataset.key,b);
  else if(action==='back')w.zgCharBack();
  else if(action==='menu'||action==='detail-menu')menu(b,action==='detail-menu');
  else if(action==='close')close();else if(action==='add')add();else mutate(action);
 });
 document.addEventListener('keydown',function(ev){if(!dialogKey)return;if(ev.key==='Escape'){close();ev.preventDefault();}if(ev.key==='Tab'){var els=Array.from(document.querySelectorAll('#zgms-dialog button')).filter(function(el){return !el.disabled&&el.getClientRects().length;}),first=els[0],last=els[els.length-1];if(ev.shiftKey&&document.activeElement===first){last.focus();ev.preventDefault();}else if(!ev.shiftKey&&document.activeElement===last){first.focus();ev.preventDefault();}}});
 document.addEventListener('error',function(ev){var img=ev.target;if(img.tagName==='IMG'&&img.closest('.zgms-art,.zgms-detail-art')){img.hidden=true;}},true);
 w.ZargotaMobileSkills={render:render,setActive:active,refresh:refresh,rows:rows,category:category,resource:resource};
})(window);
