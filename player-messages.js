(function(w){
  'use strict';
  var api,user='',roles={},threads={},drafts={},stops=[],epoch=0,selected='',expanded=false,root,resolveName;
  var icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3zM3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  function t(ru,uk){return w.ZargotaI18n&&w.ZargotaI18n.getLocale()==='uk'?uk:ru;}
  function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function entries(id){return Object.entries((threads[id]||{}).messages||{}).sort(function(a,b){return a[1].createdAt-b[1].createdAt||a[0].localeCompare(b[0]);});}
  function unread(id){var seen=((threads[id]||{}).read||{})[user]||0;return entries(id).filter(function(pair){return pair[1].senderUid!==user&&pair[1].createdAt>seen;}).length;}
  function name(id){return roles[id]==='player'?t('Мастер','Майстер'):(resolveName&&resolveName(id)||t('Игрок','Гравець'));}
  function button(label,fn,cls){var n=el('button',cls,label);n.type='button';n.addEventListener('click',fn);return n;}
  function ensure(){
    if(root)return;
    root=el('aside','zg-chat');root.id='zg-player-chat';
    var launcher=button('',function(){expanded=!expanded;paint();},'zg-chat-launcher');launcher.innerHTML=icon+'<span></span>';root.append(launcher);
    var panel=el('section','zg-chat-panel');panel.hidden=true;panel.setAttribute('aria-label',t('Переписка с мастером и игроками','Листування з майстром і гравцями'));
    var head=el('header'),title=el('strong','zg-chat-title');head.append(title);
    var close=button('×',function(){expanded=false;paint();launcher.focus();},'zg-chat-close');close.setAttribute('aria-label',t('Свернуть чат','Згорнути чат'));head.append(close);panel.append(head);
    var select=el('select','zg-chat-select');select.setAttribute('aria-label',t('Выберите игрока','Виберіть гравця'));select.addEventListener('change',function(){open(select.value);});panel.append(select);
    var log=el('div','zg-chat-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');log.addEventListener('scroll',read);panel.append(log);
    panel.append(el('p','zg-chat-note',t('Личная переписка · последние 50 сообщений','Особисте листування · останні 50 повідомлень')));
    var form=el('form','zg-chat-form'),input=el('textarea');input.rows=2;input.maxLength=500;input.placeholder=t('Короткое сообщение…','Коротке повідомлення…');input.setAttribute('aria-label',t('Сообщение','Повідомлення'));
    input.addEventListener('input',function(){var d=drafts[selected]||(drafts[selected]={});d.text=input.value;d.id=null;root.querySelector('.zg-chat-error').textContent='';});
    form.append(input);var send=el('button','zg-chat-send',t('Отправить','Надіслати'));send.type='submit';form.append(send);form.addEventListener('submit',sendMessage);panel.append(form);
    var error=el('p','zg-chat-error');error.setAttribute('role','status');panel.append(error);root.append(panel);document.body.append(root);
    root.addEventListener('keydown',function(e){if(e.key==='Escape'){e.stopPropagation();expanded=false;paint();launcher.focus();}});
    root.addEventListener('click',function(e){e.stopPropagation();});
    viewport();
  }
  function viewport(){if(!root)return;var v=w.visualViewport;root.style.setProperty('--chat-keyboard',Math.max(0,v?w.innerHeight-v.height-v.offsetTop:0)+'px');root.style.setProperty('--chat-view-height',(v?v.height:w.innerHeight)+'px');root.style.setProperty('--chat-clearance',v&&w.innerHeight-v.height>150?'24px':'110px');}
  function paint(){
    if(!root||!user)return;
    var ids=Object.keys(roles),count=ids.reduce(function(n,id){return n+unread(id);},0),launcher=root.querySelector('.zg-chat-launcher');
    launcher.querySelector('span').textContent=count?String(count):t('Чат','Чат');launcher.setAttribute('aria-label',t('Сообщения','Повідомлення')+(count?': '+count:''));launcher.classList.toggle('has-unread',count>0);launcher.setAttribute('aria-expanded',String(expanded));
    var panel=root.querySelector('.zg-chat-panel');panel.hidden=!expanded;launcher.hidden=expanded;
    if(!expanded)return;
    root.querySelector('.zg-chat-panel').setAttribute('aria-label',t('Переписка с мастером и игроками','Листування з майстром і гравцями'));
    root.querySelector('.zg-chat-close').setAttribute('aria-label',t('Свернуть чат','Згорнути чат'));
    root.querySelector('.zg-chat-select').setAttribute('aria-label',t('Выберите игрока','Виберіть гравця'));
    root.querySelector('.zg-chat-note').textContent=t('Личная переписка · последние 50 сообщений','Особисте листування · останні 50 повідомлень');
    root.querySelector('textarea').placeholder=t('Короткое сообщение…','Коротке повідомлення…');
    root.querySelector('textarea').setAttribute('aria-label',t('Сообщение','Повідомлення'));
    root.querySelector('.zg-chat-title').textContent=name(selected);
    var select=root.querySelector('select');select.hidden=ids.length<2;
    ids.forEach(function(id){var option=Array.from(select.options).find(function(o){return o.value===id;});if(!option){option=el('option');option.value=id;select.append(option);}option.textContent=name(id)+(unread(id)?' · '+unread(id):'');});select.value=selected;
    var log=root.querySelector('.zg-chat-log'),rows=entries(selected),nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<32;
    if(log.dataset.sheet!==selected){log.replaceChildren();log.dataset.sheet=selected;nearBottom=true;}
    var present=new Set(rows.map(function(p){return p[0];}));Array.from(log.children).forEach(function(n){if(!present.has(n.dataset.message))n.remove();});
    rows.forEach(function(pair){if(Array.from(log.children).some(function(n){return n.dataset.message===pair[0];}))return;var msg=pair[1],node=el('article','zg-chat-message'+(msg.senderUid===user?' is-own':''));node.dataset.message=pair[0];node.append(el('p','',msg.text));var at=new Date(msg.createdAt).toLocaleTimeString(t('ru-RU','uk-UA'),{hour:'2-digit',minute:'2-digit'});node.append(el('small','', (msg.senderUid===user?t('Вы','Ви'):name(selected))+' · '+at));log.append(node);});
    if(!rows.length)log.append(el('p','zg-chat-empty',t('Здесь можно написать короткое сообщение.','Тут можна написати коротке повідомлення.')));
    var d=drafts[selected]||{},input=root.querySelector('textarea');if(input.dataset.sheet!==selected){input.value=d.text||'';input.dataset.sheet=selected;root.querySelector('.zg-chat-error').textContent='';}input.disabled=!!d.sending;root.querySelector('.zg-chat-send').disabled=!!d.sending;root.querySelector('.zg-chat-send').textContent=d.sending?t('Отправка…','Надсилання…'):t('Отправить','Надіслати');
    if(nearBottom)log.scrollTop=log.scrollHeight;read();
  }
  var reading={};
  function read(){
    if(!api||!expanded||document.visibilityState==='hidden'||!selected)return;
    var log=root.querySelector('.zg-chat-log');if(log.scrollHeight-log.scrollTop-log.clientHeight>32)return;
    var rows=entries(selected),at=rows.length&&rows[rows.length-1][1].createdAt,id=selected,e=epoch;
    if(!at||!unread(id)||reading[id]>=at)return;reading[id]=at;
    api.readMessages(id,at).catch(function(){if(e===epoch)delete reading[id];});
  }
  async function sendMessage(event){
    event.preventDefault();if(!api||!roles[selected])return;
    var id=selected,d=drafts[id]||(drafts[id]={}),input=root.querySelector('textarea'),text=input.value.trim();if(!text||d.sending)return;
    if(!navigator.onLine){root.querySelector('.zg-chat-error').textContent=t('Нет связи. Текст сохранён здесь — отправьте после подключения.','Немає зв’язку. Текст збережено тут — надішліть після підключення.');return;}
    var e=epoch;d.text=input.value;d.id=d.id||w.crypto.randomUUID();d.sending=true;paint();
    try{await api.call({action:'message',sheetId:id,messageId:d.id,text:text});if(e!==epoch)return;drafts[id]={};if(selected===id){input.value='';root.querySelector('.zg-chat-error').textContent='';}}
    catch(error){if(e!==epoch)return;if(selected===id)root.querySelector('.zg-chat-error').textContent=/message-rate-limit/.test(String(error.message))?t('Подождите секунду и отправьте ещё раз.','Зачекайте секунду й надішліть ще раз.'):t('Не удалось отправить. Текст сохранён — попробуйте ещё раз.','Не вдалося надіслати. Текст збережено — спробуйте ще раз.');}
    finally{if(e===epoch){d.sending=false;paint();}}
  }
  function open(id){if(!roles[id])return;selected=id;expanded=true;ensure();paint();}
  function stop(){epoch++;stops.forEach(function(fn){fn();});stops=[];api=null;user='';roles={};threads={};drafts={};reading={};selected='';expanded=false;if(root)root.remove();root=null;}
  function start(client,uid,ids,names){
    stop();api=client;user=uid;roles=Object.assign({},ids);resolveName=names;var e=epoch,notified={};selected=Object.keys(roles)[0]||'';if(!selected||!client.watchMessages)return;ensure();paint();
    Object.keys(roles).forEach(function(id){stops.push(client.watchMessages(id,function(thread){
      if(e!==epoch)return;threads[id]=thread||{};var incoming=entries(id).filter(function(p){return p[1].senderUid!==user;}).pop(),last=incoming&&incoming[0];
      if(last&&last!==notified[id]&&unread(id)&&roles[id]==='player'&&!expanded){selected=id;expanded=true;}
      notified[id]=last;paint();
    },function(){if(e!==epoch)return;if(root&&selected===id)root.querySelector('.zg-chat-error').textContent=t('Переписка временно недоступна.','Листування тимчасово недоступне.');}));});
  }
  document.addEventListener('zargota:localechange',paint);document.addEventListener('visibilitychange',read);w.addEventListener('resize',viewport);if(w.visualViewport){w.visualViewport.addEventListener('resize',viewport);w.visualViewport.addEventListener('scroll',viewport);}
  w.ZargotaPlayerMessages={start:start,stop:stop,open:open};
})(window);
