(function(w){
 'use strict';
 var dialog=null,items=[],current='',scope='',snoozed='',timer,busy=false,lastPaint='',focusBefore=null,sounded=new Set();
 function t(ru,uk){return w.ZargotaI18n?.getLocale()==='uk'?uk:ru;}
 function localized(r,key){return w.ZargotaI18n?.getLocale()==='uk'&&r[key+'Uk']?r[key+'Uk']:w.ZargotaI18n?.translate(r[key]||'')||r[key]||'';}
 function text(value){var el=document.createElement('div');el.innerHTML=String(value||'');return el.textContent||'';}
 function eligible(){return !document.hidden&&!document.body.classList.contains('zg-irl-table-view')&&document.querySelector('#page-characters.active')&&w.charView==='sheet';}
 function close(){if(dialog){dialog.close();dialog.remove();dialog=null;}items=[];current='';lastPaint='';if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});focusBefore=null;}
 function refresh(){clearTimeout(timer);timer=setTimeout(sync,150);}
 function sync(){
  if(!eligible()){close();snoozed='';scope='';return;}
  var inbox=w.ZargotaPersistentCharacters?.itemInbox(w.viewingCharId),nextScope=inbox?inbox.uid+':'+inbox.sheetId:'';
  if(nextScope!==scope){close();scope=nextScope;snoozed='';}
  if(!inbox||!inbox.items.length){close();return;}
  if(snoozed===scope)return;
  items=inbox.items.slice().sort(function(a,b){return a.at-b.at;});
  if(!items.some(function(r){return r.id===current;}))current=items[0].id;
  if(!dialog)open();
  paint();
 }
 function open(){
  focusBefore=document.activeElement;
  dialog=document.createElement('dialog');dialog.id='character-item-arrival';dialog.setAttribute('data-zg-i18n-skip','');dialog.setAttribute('aria-labelledby','gia-title');
  dialog.innerHTML='<button type="button" class="gia-close" data-arrival-close>×</button><div class="gia-body"><p class="gia-eyebrow"></p><div class="gia-art"><img alt="" draggable="false"><span aria-hidden="true">◇</span></div><h2 id="gia-title"></h2><p class="gia-quantity"></p><p class="gia-description"></p></div><footer><nav><button type="button" data-arrival-prev>‹</button><span class="gia-count" aria-live="polite"></span><button type="button" data-arrival-next>›</button></nav><button type="button" class="gia-accept" data-arrival-accept></button><p class="gia-error" role="alert"></p></footer>';
  dialog.addEventListener('cancel',function(e){e.preventDefault();if(!busy){snoozed=scope;close();}});
  dialog.addEventListener('click',function(e){
   if(e.target.closest('[data-arrival-close]')&&!busy){snoozed=scope;close();}
   if(e.target.closest('[data-arrival-prev]'))step(-1);
   if(e.target.closest('[data-arrival-next]'))step(1);
   if(e.target.closest('[data-arrival-accept]'))accept();
  });
  dialog.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
  document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('[data-arrival-accept]').focus({preventScroll:true});
 }
 function paint(){
  if(!dialog)return;var index=items.findIndex(function(r){return r.id===current;}),r=items[index];if(!r)return;
  var signature=JSON.stringify([items.map(function(x){return x.id;}),r,w.ZargotaI18n?.getLocale(),busy]);if(signature===lastPaint)return;lastPaint=signature;
  var rarity=String(r.rarity||'common').toLowerCase();rarity=({legendary:'legend','very-rare':'epic',very_rare:'epic'})[rarity]||rarity;
  // Workshop palette fallback for player-only shells where shop code is not initialized.
  var palette=Array.isArray(w.SHOP_RARITY)?w.SHOP_RARITY:[{key:'common',color:'#8a7a5e'},{key:'uncommon',color:'#6fcb83'},{key:'rare',color:'#7a9ae0'},{key:'epic',color:'#a07fd4'},{key:'legend',color:'#e8c060'}],rarityEntry=palette.find(function(entry){return entry.key===rarity;})||palette[0],color=rarityEntry?.color||'#8a7a5e';
  dialog.dataset.rarity=rarityEntry?.key||'common';
  if(/^#[0-9a-f]{6}$/i.test(color))dialog.style.setProperty('--gia-glow',[1,3,5].map(function(offset){return parseInt(color.slice(offset,offset+2),16);}).join(','));
  dialog.querySelector('.gia-eyebrow').textContent=t('Вы получили предмет','Ви отримали предмет');
  dialog.querySelector('h2').textContent=text(localized(r,'name'));
  dialog.querySelector('.gia-description').textContent=text(localized(r,'description'));
  dialog.querySelector('.gia-quantity').textContent='× '+r.qty;
  var img=dialog.querySelector('img'),src=r.image||w.ZargotaItemIcons?.pathFor(r)||'',valid=/^(https?:\/\/|images\/|assets\/|data:image\/)/i.test(src);
  img.hidden=!valid;dialog.querySelector('.gia-art span').hidden=valid;
  if(valid&&img.getAttribute('src')!==src){img.src=src;img.onerror=function(){img.hidden=true;if(dialog)dialog.querySelector('.gia-art span').hidden=false;};}
  dialog.querySelector('.gia-count').textContent=(index+1)+' / '+items.length;
  var prev=dialog.querySelector('[data-arrival-prev]'),next=dialog.querySelector('[data-arrival-next]');
  prev.disabled=busy||index===0;next.disabled=busy||index===items.length-1;
  prev.setAttribute('aria-label',t('Предыдущий предмет','Попередній предмет'));next.setAttribute('aria-label',t('Следующий предмет','Наступний предмет'));
  dialog.querySelector('nav').hidden=items.length<2;
  dialog.querySelector('[data-arrival-close]').setAttribute('aria-label',t('Посмотреть позже','Переглянути пізніше'));
  dialog.querySelector('[data-arrival-close]').disabled=busy;
  dialog.querySelector('[data-arrival-accept]').textContent=busy?t('Сохраняем…','Зберігаємо…'):t('Принять','Прийняти');
  dialog.querySelector('[data-arrival-accept]').disabled=busy;
 }
 function step(delta){if(busy)return;var index=items.findIndex(function(r){return r.id===current;}),r=items[index+delta];if(r){current=r.id;paint();}}
 async function accept(){
  if(busy||!current)return;busy=true;var id=current,atScope=scope,hero=w.viewingCharId;dialog.querySelector('.gia-error').textContent='';paint();
  var receipt=items.find(function(r){return r.id===id;});
  // Acceptance is a user gesture: mobile audio can play without autoplay hacks.
  if(receipt&&!sounded.has(atScope+':'+id)){try{var method=receipt.currency||w.ZargotaItemGrants?.currency(receipt)?'coinChange':'itemReward';w.ZargotaSound?.[method]?.();sounded.add(atScope+':'+id);}catch(_){}}
  var result;try{result=await w.ZargotaPersistentCharacters.acceptItems(hero,[id]);}catch(_){result={ok:false};}
  busy=false;if(scope!==atScope)return;
  if(!result.ok&&dialog)dialog.querySelector('.gia-error').textContent=t('Не удалось подтвердить просмотр. Предмет уже в инвентаре. Попробуйте ещё раз.','Не вдалося підтвердити перегляд. Предмет уже в інвентарі. Спробуйте ще раз.');
  lastPaint='';sync();
 }
 w.ZargotaItemArrival={refresh:refresh};
 document.addEventListener('DOMContentLoaded',function(){if(w.ZG_APP_CHANGELOG?.[0]){w.ZG_APP_CHANGELOG[0].notes+=' Окно получения предмета: мягкие неровные края изображения, спокойное движение и свечение по редкости. Название не перекрывается картинкой; удалённые вещи исчезают из очереди уведомлений.';w.ZG_APP_CHANGELOG[0].notesUk+=' Вікно отримання предмета: м’які нерівні краї зображення, спокійний рух і світіння за рідкістю. Назва не перекривається картинкою; видалені речі зникають із черги сповіщень.';}});
 // Lightweight route checks also cover the classic sheet navigation, which has
 // no shared route event. Inbox access reads only one acknowledged sheet.
 setInterval(function(){if(eligible()||dialog||scope)sync();},700);
 document.addEventListener('visibilitychange',refresh);
 document.addEventListener('zargota:localechange',function(){lastPaint='';refresh();});
 w.addEventListener('zargota:persistent-auth-change',function(){scope='';snoozed='';close();refresh();});
})(window);
