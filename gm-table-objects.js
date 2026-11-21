/* Local GM preparation references, not copies of player inventory. */
(function(w){
 'use strict';
 var layer,table,entries=[],owner='',gesture=null,popup=null,suppress=0,selection=new Set(),marquee=null,moving=false;
 function t(ru,uk){return w.ZargotaI18n?.getLocale()==='uk'?uk:ru;}
 function api(){return w.ZargotaGmStatusLibrary;}
 function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function key(){return 'zg-gm-table-objects-v1:'+String(w.ZargotaPersistentCharacters?.tableIdentity().uid||'local');}
 function save(){try{localStorage.setItem(owner,JSON.stringify(entries));}catch(_){w.showToast?.(t('Не удалось сохранить расположение на устройстве.','Не вдалося зберегти розташування на пристрої.'));}}
 function load(){var next=key();if(next===owner)return;cancel();dismiss();selection.clear();owner=next;try{entries=JSON.parse(localStorage.getItem(owner)||'[]');}catch(_){entries=[];}if(!Array.isArray(entries))entries=[];
  entries=entries.filter(function(r){return r&&typeof r.id==='string'&&typeof r.key==='string'&&['items','statuses'].includes(r.kind)&&Number.isFinite(r.x)&&Number.isFinite(r.y)&&Number.isFinite(r.size)&&r.options&&typeof r.options==='object';}).slice(0,200);render();
 }
 function geometry(r){var size=Math.max(64,Math.min(240,r.size,(layer.clientWidth||576)/2.4,(layer.clientHeight||173)/.72));return {size:size,x:Math.max(0,Math.min(r.x,Math.max(0,layer.clientWidth-size*2.4))),y:Math.max(0,Math.min(r.y,Math.max(0,layer.clientHeight-size*.72)))};}
 function position(node,r){var g=geometry(r);node.style.left=g.x+'px';node.style.top=g.y+'px';node.style.width=(g.size*2.4)+'px';node.style.height=(g.size*.72)+'px';node.style.setProperty('--gmt-label-size',Math.max(12,Math.min(20,g.size*.13))+'px');}
 function render(){if(!layer)return;selection=new Set(Array.from(selection).filter(function(id){return entries.some(function(r){return r.id===id;});}));layer.innerHTML=entries.map(function(r){var def=api()?.lookup(r.kind,r.key),name=def?api().label(def):t('Недоступно','Недоступно');return '<div class="gmt-object" data-table-object="'+esc(r.id)+'"><button type="button" class="gmt-face" aria-label="'+esc(name)+'">'+(def?api().glyph(def):'<span>◇</span>')+'<span class="gmt-copy"><strong>'+esc(name)+'</strong>'+(r.kind==='items'?'<small>× '+esc(r.options.qty)+'</small>':'')+'</span></button><button type="button" class="gmt-resize" aria-label="'+t('Изменить размер','Змінити розмір')+'" title="'+t('Потяните за угол','Потягніть за кут')+'">◢</button></div>';}).join('');layer.querySelectorAll('[data-table-object]').forEach(function(node){position(node,entries.find(function(r){return r.id===node.dataset.tableObject;}));});paintSelection();}
 function paintSelection(){layer?.querySelectorAll('[data-table-object]').forEach(function(node){var on=selection.has(node.dataset.tableObject);node.classList.toggle('is-selected',on);node.querySelector('.gmt-face').setAttribute('aria-pressed',String(on));});}
 function clearMarquee(restore){if(!marquee)return;if(restore)selection=new Set(marquee.before);marquee.box.remove();marquee=null;paintSelection();}
 function selectMove(e){if(!marquee||marquee.id!==e.pointerId)return;var m=marquee,b=layer.getBoundingClientRect(),x=Math.max(b.left,Math.min(b.right,e.clientX)),y=Math.max(b.top,Math.min(b.bottom,e.clientY));if(!m.moved&&Math.hypot(x-m.x,y-m.y)<5)return;m.moved=true;e.preventDefault();
  var left=Math.min(x,m.x),top=Math.min(y,m.y),right=Math.max(x,m.x),bottom=Math.max(y,m.y);m.box.hidden=false;m.box.style.cssText='left:'+(left-b.left)+'px;top:'+(top-b.top)+'px;width:'+(right-left)+'px;height:'+(bottom-top)+'px';
  selection=new Set(m.add?m.before:[]);layer.querySelectorAll('[data-table-object]').forEach(function(node){var r=node.getBoundingClientRect();if(r.left<right&&r.right>left&&r.top<bottom&&r.bottom>top)selection.add(node.dataset.tableObject);});paintSelection();
 }
 function startGroup(e,r){
  if(!selection.has(r.id)){selection=new Set([r.id]);paintSelection();}
  var group=entries.filter(function(row){return selection.has(row.id);}).map(function(row){return {row:row,node:Array.from(layer.querySelectorAll('[data-table-object]')).find(function(n){return n.dataset.tableObject===row.id;}),before:{x:row.x,y:row.y,size:row.size},base:geometry(row)};});
  var startX=e.clientX,startY=e.clientY,finished=false;
  api()?.beginPrepared(e,r.kind,r.key,r.options,{
   move:function(x,y){moving=true;layer.classList.add('is-dragging');group.forEach(function(g){g.node.style.pointerEvents='none';g.node.classList.add('is-dragging');g.row.x=g.base.x+x-startX;g.row.y=g.base.y+y-startY;g.node.style.left=g.row.x+'px';g.node.style.top=g.row.y+'px';});},
   drop:function(x,y,granted){suppress=Date.now()+500;if(!granted&&background(x,y)){
    // Shift the entire group back inside the board without collapsing its spacing.
    var left=Math.min(...group.map(function(g){return g.row.x;})),top=Math.min(...group.map(function(g){return g.row.y;})),right=Math.max(...group.map(function(g){return g.row.x+g.base.size*2.4;})),bottom=Math.max(...group.map(function(g){return g.row.y+g.base.size*.72;}));
    var dx=Math.max(-left,Math.min(0,layer.clientWidth-right)),dy=Math.max(-top,Math.min(0,layer.clientHeight-bottom));group.forEach(function(g){g.row.x+=dx;g.row.y+=dy;g.row.size=g.base.size;});save();finished=true;
   }},
   cancel:function(){moving=false;layer.classList.remove('is-dragging');group.forEach(function(g){if(!finished)Object.assign(g.row,g.before);g.node.classList.remove('is-dragging');g.node.style.pointerEvents='';position(g.node,g.row);});}
  },group.map(function(g){return {kind:g.row.kind,key:g.row.key,options:g.row.options};}));
 }
 function background(x,y){if(!layer||!document.body.classList.contains('zg-irl-table-view'))return false;var b=layer.getBoundingClientRect(),el=document.elementFromPoint(x,y);return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom&&el===table;}
 function place(def,options,x,y){if(!background(x,y))return false;load();if(entries.length>=200){w.showToast?.(t('На столе уже 200 заготовок.','На столі вже 200 заготовок.'));return true;}var b=layer.getBoundingClientRect();entries.push({id:crypto.randomUUID(),kind:def._item?'items':'statuses',key:def.key,options:JSON.parse(JSON.stringify(options)),x:x-b.left-132,y:y-b.top-40,size:110});save();render();return true;}
 function dismiss(){popup?.remove();popup=null;}
 function pop(r,node,x,y,context){
  dismiss();var def=api()?.lookup(r.kind,r.key);popup=document.createElement('section');popup.className='gmt-popup'+(context?' gmt-context':'');popup.setAttribute('data-zg-i18n-skip','');popup.setAttribute('role','dialog');popup.setAttribute('aria-label',t('Заготовка на столе','Заготовка на столі'));
  if(context){var remove=document.createElement('button');remove.type='button';remove.textContent=t('Убрать со стола','Прибрати зі столу');remove.dataset.tableRemove='';remove.onclick=function(){entries=entries.filter(function(item){return item.id!==r.id;});save();dismiss();render();};popup.appendChild(remove);}
  else{
   var title=document.createElement('strong');title.textContent=def?api().label(def):t('Недоступно','Недоступно');popup.appendChild(title);
   var close=document.createElement('button');close.type='button';close.className='gmt-dismiss';close.textContent='×';close.setAttribute('aria-label',t('Закрыть','Закрити'));close.onclick=dismiss;popup.appendChild(close);
   if(def&&r.kind==='items'&&w.ZargotaItemDetailContent){
    var model=w.ZargotaItemDetailContent,locale=w.ZargotaI18n?.getLocale()||'ru',item=model.resolve(def,[],null);
    function localized(field){return String(locale==='uk'&&item[field+'Uk']?item[field+'Uk']:item[field]||'');}
    function section(heading,value){if(!value)return;var block=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=heading;p.innerHTML=w.ZargotaSpellDetailContent?.highlightPersonal(value)||esc(value);block.append(h,p);popup.appendChild(block);}
    var art=document.createElement('div');art.className='gmt-detail-art';art.innerHTML=api().glyph(Object.assign({},def,{imageThumb:def.image||def.imageThumb}));popup.insertBefore(art,title);
    var meta=document.createElement('p');meta.className='gmt-detail-kind';meta.textContent=model.kind(item,locale);popup.appendChild(meta);
    var stats=model.stats(item,locale);if(stats.length){var chips=document.createElement('div');chips.className='gmt-detail-stats';chips.innerHTML=stats.map(function(value){return '<span>'+(w.ZargotaSpellDetailContent?.highlightPersonal(value)||esc(value))+'</span>';}).join('');popup.appendChild(chips);}
    section(t('Свойства','Властивості'),localized('effectText'));
    section(t('Описание','Опис'),localized('description'));
   }else{var p=document.createElement('p');p.textContent=def?api().description(def):t('Запись удалена из каталога.','Запис видалено з каталогу.');popup.appendChild(p);}
   if(r.kind==='items'){var label=document.createElement('label');label.textContent=t('Количество каждому','Кількість кожному');var input=document.createElement('input');input.type='number';input.min=1;input.max=999;input.value=r.options.qty;input.setAttribute('aria-label',label.textContent);input.onchange=function(){var qty=Number(input.value);if(Number.isInteger(qty)&&qty>0&&qty<=999){r.options.qty=qty;save();render();}else input.reportValidity();};label.appendChild(input);popup.appendChild(label);}
   else{var duration=document.createElement('small'),unit=r.options.unit,names={rounds:['раунд.','раунд.'],minutes:['мин.','хв.'],hours:['ч.','год.'],days:['дн.','дн.']};duration.textContent=unit==='manual'?t('До снятия','До зняття'):r.options.duration+' '+t(...(names[unit]||['','']));popup.appendChild(duration);}
  }
  table.appendChild(popup);var b=table.getBoundingClientRect(),rect=node.getBoundingClientRect();popup.style.left=Math.max(8,Math.min((x||rect.right)-b.left,table.clientWidth-popup.offsetWidth-8))+'px';popup.style.top=Math.max(65,Math.min((y||rect.top)-b.top,layer.offsetTop+layer.clientHeight-popup.offsetHeight))+'px';popup.querySelector('button')?.focus({preventScroll:true});
 }
 function cancel(){clearMarquee(true);if(moving)api()?.cancelDrag();if(gesture){suppress=Date.now()+500;Object.assign(gesture.row,gesture.before);gesture=null;render();}}
 function init(){
  table=document.querySelector('#page-gm-table .zg-irl-table');if(!table)return;
  layer=document.createElement('div');layer.className='gmt-objects';layer.setAttribute('data-zg-i18n-skip','');table.appendChild(layer);load();if(w.ResizeObserver)new ResizeObserver(function(){if(!gesture&&!moving&&!marquee)render();}).observe(layer);
  layer.addEventListener('pointerdown',function(e){var node=e.target.closest('[data-table-object]'),r=node&&entries.find(function(item){return item.id===node.dataset.tableObject;});if(!r)return;dismiss();
   if(e.button===0&&e.target.closest('.gmt-resize')){e.preventDefault();var g=geometry(r);gesture={id:e.pointerId,row:r,node:node,x:e.clientX,y:e.clientY,mode:'resize',before:{x:r.x,y:r.y,size:r.size},base:g,moved:false};node.setPointerCapture(e.pointerId);}
   else if(e.button===0){
    if(e.shiftKey||e.ctrlKey||e.metaKey){e.preventDefault();if(selection.has(r.id))selection.delete(r.id);else selection.add(r.id);paintSelection();suppress=Date.now()+500;return;}
    startGroup(e,r);
   }
  });
  table.addEventListener('pointerdown',function(e){if(e.button!==0||e.target!==table||!background(e.clientX,e.clientY))return;e.preventDefault();dismiss();var box=document.createElement('div');box.className='gmt-marquee';box.hidden=true;layer.appendChild(box);marquee={id:e.pointerId,x:e.clientX,y:e.clientY,box:box,before:Array.from(selection),add:e.shiftKey||e.ctrlKey||e.metaKey,moved:false};if(!marquee.add){selection.clear();paintSelection();}table.setPointerCapture(e.pointerId);});
  document.addEventListener('pointermove',selectMove,{passive:false});
  document.addEventListener('pointerup',function(e){if(marquee&&marquee.id===e.pointerId){if(marquee.moved)suppress=Date.now()+500;clearMarquee(false);}});
  document.addEventListener('pointermove',function(e){if(!gesture||gesture.id!==e.pointerId)return;var g=gesture,dx=e.clientX-g.x,dy=e.clientY-g.y;if(Math.hypot(dx,dy)<5&&!g.moved)return;g.moved=true;e.preventDefault();if(g.mode==='move'){g.row.x=g.base.x+dx;g.row.y=g.base.y+dy;}else g.row.size=Math.max(64,Math.min(240,g.base.size+Math.max(dx,dy)));Object.assign(g.row,geometry(g.row));position(g.node,g.row);},{passive:false});
  document.addEventListener('pointerup',function(e){if(!gesture||gesture.id!==e.pointerId)return;var g=gesture;gesture=null;if(g.moved){save();suppress=Date.now()+500;}else if(g.mode==='move')pop(g.row,g.node,e.clientX,e.clientY,true);});
  layer.addEventListener('contextmenu',function(e){e.preventDefault();e.stopPropagation();if(gesture||Date.now()<suppress)return;var node=e.target.closest('[data-table-object]'),r=node&&entries.find(function(item){return item.id===node.dataset.tableObject;});if(r)pop(r,node,e.clientX,e.clientY,true);});
  layer.addEventListener('click',function(e){if(Date.now()<suppress||e.shiftKey||e.ctrlKey||e.metaKey||e.target.closest('.gmt-resize'))return;var node=e.target.closest('[data-table-object]'),r=node&&entries.find(function(item){return item.id===node.dataset.tableObject;});if(r)pop(r,node,0,0,false);});
  document.addEventListener('pointerdown',function(e){if(popup&&!popup.contains(e.target))dismiss();},true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&(gesture||popup||marquee||selection.size)){e.preventDefault();e.stopImmediatePropagation();cancel();dismiss();selection.clear();paintSelection();}},{capture:true});
  document.addEventListener('pointercancel',cancel);w.addEventListener('blur',function(){cancel();dismiss();});
  w.addEventListener('resize',function(){cancel();dismiss();render();});
  document.addEventListener('zargota:localechange',function(){cancel();dismiss();render();});
  w.addEventListener('zargota:persistent-auth-change',function(){owner='';load();});
  new MutationObserver(function(){load();if(!document.body.classList.contains('zg-irl-table-view')){cancel();dismiss();selection.clear();paintSelection();}}).observe(document.body,{attributes:true,attributeFilter:['class']});
  if(w.ZG_APP_CHANGELOG?.[0]){w.ZG_APP_CHANGELOG[0].notes+=' Предметы и статусы лежат на столе горизонтальными карточками с иконкой слева и названием справа. Их можно подготовить на столе: перетащить из хранилища, перемещать левой кнопкой, менять размер за угол и выдавать героям. Один клик открывает изображение, описание и цветовое выделение характеристик, правая кнопка — удаление со стола. Рамка на пустом месте выделяет несколько карточек: их можно переместить или выдать вместе. Shift-клик меняет состав выделения. Раскладка сохраняется на устройстве для аккаунта мастера.';w.ZG_APP_CHANGELOG[0].notesUk+=' Предмети й стани лежать на столі горизонтальними картками з іконкою ліворуч і назвою праворуч. Їх можна підготувати на столі: перетягнути зі сховища, переміщувати лівою кнопкою, змінювати розмір за кут і надавати героям. Один клік відкриває зображення, опис і кольорове виділення характеристик, права кнопка — видалення зі столу. Рамка на порожньому місці виділяє кілька карток: їх можна перемістити або надати разом. Shift-клік змінює склад виділення. Розкладка зберігається на пристрої для акаунта майстра.';}
 }
 w.ZargotaTableObjects={place:place};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
