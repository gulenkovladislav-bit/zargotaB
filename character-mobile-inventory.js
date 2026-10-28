/* Mobile bag/equipment presentation; keeps the existing sheet storage and item editors. */
(function(w){
 'use strict';
 var current=null,views={},detail=null,returnFocus=null,frame=0,coinDraft=null;
 var currencies=[['platinum','pl','ПЛ','Платина','Платина'],['gold','zl','ЗЛ','Золото','Золото'],['silver','sr','СР','Серебро','Срібло'],['copper','md','МД','Медь','Мідь']];
 function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
 function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function character(){return (w.characters||[]).find(function(c){return String(c.id)===String(current);});}
 function state(){return views[current]||(views[current]={group:'bag',sort:'manual',page:0});}
 function label(c,row,value){if(typeof value!=='string'&&typeof value!=='number')return '';return row.armory?w.armoryItemText(row.item,value):w.characterEntryText(c,String(value||''));}
 function name(c,row){return label(c,row,row.item.name||row.item.text)||t('Без названия','Без назви');}
 function button(action,title,body,attrs){return '<button type="button" data-zgmi="'+action+'" aria-label="'+e(title)+'" '+(attrs||'')+'>'+body+'</button>';}
 function mark(plus){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14'+(plus?'M12 5v14':'')+'"/></svg>';}
 function rows(c){
  var out=[];
  ['inventoryItems','equipItems'].forEach(function(field){(c[field]||[]).forEach(function(item,index){if(!item||typeof item!=='object')return;out.push({key:field+'-'+index,field:field,index:index,item:item,equipped:!!item.equipped});});});
  var armory=typeof w.loadArmoryItems==='function'?w.loadArmoryItems():[];
  Object.keys(c.arenaEquipSlots||{}).forEach(function(slot){var item=armory.find(function(x){return String(x.id)===String(c.arenaEquipSlots[slot]);});if(item)out.push({key:'armory-'+slot,slot:slot,item:item,armory:true,equipped:true});});
  return out;
 }
 function selected(c){var v=state(),list=rows(c).filter(function(row){return row.equipped===(v.group==='equipment');});if(v.sort==='name')list.sort(function(a,b){return name(c,a).localeCompare(name(c,b),t('ru','uk'));});if(v.sort==='qty')list.sort(function(a,b){return (Number(b.item.qty)||1)-(Number(a.item.qty)||1);});return list;}
 function art(c,row){return w.charInventoryArt(row.item,c);}
 function card(c,row){var qty=Math.max(1,parseInt(row.item.qty,10)||1);return button('item',name(c,row),'<span class="zgmi-art">'+art(c,row)+'</span><strong>'+e(name(c,row))+'</strong>'+(qty>1?'<span class="zgmi-qty">'+qty+'</span>':''),'class="zgmi-card" data-key="'+e(row.key)+'"');}
 function markup(c){
  var v=state(),list=selected(c),count=Math.max(1,Math.ceil(list.length/9));v.page=Math.min(v.page,count-1);
  var cards=list.slice(v.page*9,v.page*9+9).map(function(row){return card(c,row);});
  if(cards.length<9)cards.push(button('add',t('Добавить предмет','Додати предмет'),mark(true),'class="zgmi-card zgmi-add"'));
  while(cards.length<9)cards.push('<span class="zgmi-slot" aria-hidden="true"></span>');
  return '<section class="zgmi-sheet zgmi-v2" data-zg-i18n-skip><header class="zgmi-toolbar">'+button('back',t('Назад к персонажам','Назад до персонажів'),'‹')+'<h1>'+t('Инвентарь','Інвентар')+'</h1>'+button('add',t('Добавить предмет','Додати предмет'),mark(true))+button('menu',t('Действия инвентаря','Дії інвентарю'),'⋯','aria-expanded="false"')+'</header>'+
   '<div class="zgmi-wallet">'+currencies.map(function(x){var value=Math.max(0,parseInt((c.coins||{})[x[0]],10)||0);return button('coin',t(x[3],x[4])+': '+value,w.zgCoinIconHtml(x[1],24)+'<span>'+x[2]+'</span><b>'+value+'</b>','data-coin="'+x[0]+'"');}).join('')+'</div>'+
   '<nav class="zgmi-groups" aria-label="'+t('Разделы инвентаря','Розділи інвентарю')+'">'+[['bag',t('Сумка','Сумка')],['equipment',t('Снаряжение','Спорядження')]].map(function(x){return button('group',x[1],x[1],'data-group="'+x[0]+'" aria-pressed="'+(v.group===x[0])+'"');}).join('')+'</nav>'+
   '<div class="zgmi-tools"><span>'+(v.group==='bag'?(c.inventoryItems||[]).length+' / 20 '+t('мест','місць'):t('Предметов: ','Предметів: ')+list.length)+'</span><label><span class="zgmi-sr">'+t('Сортировка','Сортування')+'</span><select data-zgmi-sort aria-label="'+t('Сортировка','Сортування')+'">'+[['manual',t('По добавлению','За додаванням')],['name',t('По названию','За назвою')],['qty',t('По количеству','За кількістю')]].map(function(x){return '<option value="'+x[0]+'"'+(v.sort===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label></div>'+
   '<div class="zgmi-grid" aria-label="'+t('Предметы','Предмети')+'">'+cards.join('')+'</div>'+
   '<footer class="zgmi-footer">'+button('prev',t('Предыдущие предметы','Попередні предмети'),'‹',v.page?'':'disabled style="visibility:hidden"')+'<div>'+button('shop',t('Выбрать из товаров','Вибрати з товарів'),t('Из товаров','З товарів')+' ›')+(count>1?'<small aria-live="polite">'+(v.page+1)+' / '+count+'</small>':'')+'</div>'+button('next',t('Следующие предметы','Наступні предмети'),'›',v.page<count-1?'':'disabled style="visibility:hidden"')+'</footer></section>';
 }
 function render(c){if(String(current)!==String(c.id))close();current=c.id;return markup(c);}
 function refresh(id){if(id!=null&&String(id)!==String(current))return;if(!document.body.classList.contains('zg-inventory-view'))return;cancelAnimationFrame(frame);frame=requestAnimationFrame(function(){var c=character(),root=document.querySelector('.zgmi-v2');if(!c||!root)return;w.ZargotaMobileSheet.updateMarkup(root.parentElement,markup(c));if(detail)updateDetail();});}
 function close(){document.getElementById('zgmi-dialog')?.remove();detail=null;coinDraft=null;if(returnFocus&&returnFocus.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
 function active(on){if(!on){close();document.querySelector('.zgmi-menu')?.remove();}}
 function resolveDetail(c){if(!detail)return null;return rows(c).find(function(row){return detail.armory?row.armory&&row.slot===detail.slot&&String(row.item.id)===String(detail.item.id):row.field===detail.field&&row.item===detail.item;});}
 function present(title,content){var el=document.getElementById('zgmi-dialog');if(!el){el=document.createElement('div');el.id='zgmi-dialog';el.setAttribute('data-zg-i18n-skip','');el.innerHTML='<section role="dialog" aria-modal="true"></section>';el.addEventListener('click',function(ev){if(ev.target===el)close();});document.body.appendChild(el);}el.firstElementChild.setAttribute('aria-label',title);w.ZargotaMobileSheet.updateMarkup(el.firstElementChild,content);}
 function detailHTML(c,row){
  var item=row.item,description=label(c,row,item.description||item.desc||item.text),stats=[];
  if(row.armory){if(item.damageFormula)stats.push(item.damageFormula+(item.damageType?' · '+label(c,row,item.damageType):''));if(item.acBonus)stats.push(t('Броня +','Броня +')+item.acBonus);if(typeof item.range==='string')stats.push(label(c,row,item.range));if(typeof item.effects==='string')stats.push(label(c,row,item.effects));}
  return '<header><h2>'+e(name(c,row))+'</h2>'+button('detail-menu',t('Действия предмета','Дії предмета'),'⋯','aria-expanded="false"')+button('close',t('Закрыть','Закрити'),'×')+'</header><div class="zgmi-detail-scroll"><div class="zgmi-detail-art">'+art(c,row)+'</div>'+(row.equipped?'<div class="zgmi-equipped">'+t('Экипировано','Споряджено')+'</div>':'')+(stats.length?'<p class="zgmi-item-stats">'+e(stats.join(' · '))+'</p>':'')+'<p class="zgmi-description">'+e(description||t('Описание пока не добавлено.','Опис ще не додано.'))+'</p></div>'+(row.field==='inventoryItems'?'<div class="zgmi-quantity">'+button('minus',t('Уменьшить количество','Зменшити кількість'),mark(false),(item.qty||1)>1?'':'disabled')+'<div><small>'+t('Количество','Кількість')+'</small><strong aria-live="polite">'+Math.max(1,parseInt(item.qty,10)||1)+'</strong></div>'+button('plus',t('Увеличить количество','Збільшити кількість'),mark(true))+'</div>':'');
 }
 function updateDetail(){var c=character(),row=c&&resolveDetail(c);if(!row){close();return;}present(name(c,row),detailHTML(c,row));}
 function open(row,source){close();detail=row;returnFocus=source;updateDetail();document.querySelector('#zgmi-dialog [data-zgmi=close]')?.focus({preventScroll:true});}
 function coinHTML(){var x=currencies.find(function(x){return x[0]===coinDraft.key;});return '<header><h2>'+t(x[3],x[4])+'</h2>'+button('close',t('Закрыть','Закрити'),'×')+'</header><div class="zgmi-coin-art">'+w.zgCoinIconHtml(x[1],64)+'</div><div class="zgmi-quantity">'+button('coin-minus',t('Уменьшить','Зменшити'),mark(false),coinDraft.value?'':'disabled')+'<strong aria-live="polite">'+coinDraft.value+'</strong>'+button('coin-plus',t('Увеличить','Збільшити'),mark(true))+'</div><div class="zgmi-coin-steps">'+[1,10,100].map(function(n){return button('coin-step',t('Шаг ','Крок ')+n,'±'+n,'data-step="'+n+'" aria-pressed="'+(coinDraft.step===n)+'"');}).join('')+'</div><div class="zgmi-dialog-actions">'+button('close',t('Отмена','Скасувати'),t('Отмена','Скасувати'))+button('coin-save',t('Сохранить','Зберегти'),t('Сохранить','Зберегти'))+'</div>';}
 function showCoin(){var x=currencies.find(function(x){return x[0]===coinDraft.key;});present(t(x[3],x[4]),coinHTML());}
 function menu(source,isDetail){
  var old=document.querySelector('.zgmi-menu');if(old){old.remove();source.setAttribute('aria-expanded','false');return;}
  var row=isDetail&&resolveDetail(character()),el=document.createElement('div');el.className='zgmi-menu';el.setAttribute('data-zg-i18n-skip','');
  el.innerHTML=row?(row.armory?button('shop',t('Изменить снаряжение','Змінити спорядження'),t('Изменить снаряжение','Змінити спорядження')):button('edit',t('Редактировать','Редагувати'),t('Редактировать','Редагувати')))+button('equip',row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити'),row.equipped?t('Снять','Зняти'):t('Экипировать','Спорядити'))+(!row.armory?button('remove',t('Удалить','Видалити'),t('Удалить','Видалити')):''):button('add',t('Добавить предмет','Додати предмет'),t('Добавить предмет','Додати предмет'))+button('shop',t('Выбрать из товаров','Вибрати з товарів'),t('Из товаров','З товарів'));
  source.parentElement.appendChild(el);source.setAttribute('aria-expanded','true');
 }
 function add(){var c=character();if(state().group==='equipment'){w.charOpenEquipModal(c.id);return;}state().sort='manual';state().page=Math.floor(selected(c).length/9);w.addInventoryItem(c.id);}
 function mutate(action){var c=character(),row=c&&resolveDetail(c);if(!row)return;
  if(action==='edit'){close();w.openItemConstructor(c.id,row.field==='equipItems'?'equip':'inventory',row.index);return;}
  if(action==='remove'){
   present(t('Удаление предмета','Видалення предмета'),'<header><h2>'+e(name(c,row))+'</h2>'+button('close',t('Закрыть','Закрити'),'×')+'</header><p class="zgmi-confirm">'+t('Удалить этот предмет из листа?','Видалити цей предмет з аркуша?')+'</p><div class="zgmi-dialog-actions">'+button('detail-return',t('Отмена','Скасувати'),t('Отмена','Скасувати'))+button('confirm-remove',t('Удалить','Видалити'),t('Удалить','Видалити'))+'</div>');return;
  }
  if(action==='confirm-remove'){c[row.field].splice(row.index,1);w.saveChars({reason:'inventory-remove'});close();refresh();return;}
  if(action==='equip'){
   if(row.armory){delete c.arenaEquipSlots[row.slot];w.saveChars({reason:'inventory-equip'});w.renderCharSheet();}
   else if(row.field==='equipItems')w.toggleEquip(c.id,row.index);else w.toggleInventoryEquip(c.id,row.index);
   close();refresh();return;
  }
  if((action==='plus'||action==='minus')&&row.field==='inventoryItems'){w.charInventoryChangeQty(c.id,row.index,action==='plus'?1:-1);updateDetail();}
 }
 document.addEventListener('click',function(ev){var b=ev.target.closest('[data-zgmi]');if(!b){if(!ev.target.closest('.zgmi-menu'))document.querySelector('.zgmi-menu')?.remove();return;}var a=b.dataset.zgmi,c=character();if(!c)return;
  if(a!=='menu'&&a!=='detail-menu'){document.querySelector('.zgmi-menu')?.remove();document.querySelectorAll('[data-zgmi][aria-expanded=true]').forEach(function(el){el.setAttribute('aria-expanded','false');});}
  if(a==='back')w.zgCharBack();else if(a==='close')close();else if(a==='group'){state().group=b.dataset.group;state().page=0;refresh();}
  else if(a==='menu'||a==='detail-menu')menu(b,a==='detail-menu');else if(a==='add')add();
  else if(a==='shop'){close();w.charOpenEquipModal(c.id);}
  else if(a==='item'){var row=rows(c).find(function(row){return row.key===b.dataset.key;});if(row)open(row,b);}
  else if(a==='prev'||a==='next'){state().page=Math.max(0,state().page+(a==='next'?1:-1));refresh();}
  else if(a==='coin'){close();returnFocus=b;coinDraft={key:b.dataset.coin,value:Math.max(0,parseInt((c.coins||{})[b.dataset.coin],10)||0),step:1};showCoin();document.querySelector('#zgmi-dialog [data-zgmi=close]')?.focus({preventScroll:true});}
  else if(a==='coin-plus'||a==='coin-minus'){coinDraft.value=Math.max(0,coinDraft.value+(a==='coin-plus'?coinDraft.step:-coinDraft.step));showCoin();}
  else if(a==='coin-step'){coinDraft.step=Number(b.dataset.step);showCoin();}
  else if(a==='coin-save'){w.setCoin(c.id,coinDraft.key,coinDraft.value);close();refresh();}
  else if(a==='detail-return')updateDetail();else mutate(a);
 });
 document.addEventListener('change',function(ev){if(ev.target.matches('[data-zgmi-sort]')){state().sort=ev.target.value;state().page=0;refresh();}});
 document.addEventListener('keydown',function(ev){var dialog=document.getElementById('zgmi-dialog');if(!dialog)return;if(ev.key==='Escape'){close();ev.preventDefault();}else if(ev.key==='Tab'){var els=Array.from(dialog.querySelectorAll('button')).filter(function(el){return !el.disabled&&el.getClientRects().length;}),first=els[0],last=els[els.length-1];if(ev.shiftKey&&document.activeElement===first){last.focus();ev.preventDefault();}else if(!ev.shiftKey&&document.activeElement===last){first.focus();ev.preventDefault();}}});
 w.ZargotaMobileInventory={render:render,refresh:refresh,setActive:active,rows:rows};
})(window);
